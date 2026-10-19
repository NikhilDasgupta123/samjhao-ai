"""Search public, indexed web and social results through the open-source DDGS library."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import ipaddress
import socket
from urllib.parse import parse_qs, urljoin, urlparse, urlsplit

import httpx
from ddgs import DDGS

from app.ai.catalyst_schemas import CatalystSource


_SOCIAL_DOMAINS = (
    "x.com",
    "twitter.com",
    "facebook.com",
    "reddit.com",
    "stocktwits.com",
    "threads.net",
    "linkedin.com",
    "instagram.com",
    "t.me",
    "telegram.me",
)
_MARKET_TERMS = "(NSE OR stock OR shares OR earnings OR results OR order OR contract OR dividend OR regulation OR news OR market)"
_PREVIEW_TIMEOUT_SECONDS = 3.0
_PREVIEW_MAX_BYTES = 512 * 1024
_PREVIEW_MAX_REDIRECTS = 2


class _OpenGraphImageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.image_url: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "meta" or self.image_url:
            return
        metadata = {key.lower(): value for key, value in attrs if value is not None}
        key = (metadata.get("property") or metadata.get("name") or "").lower()
        if key in {"og:image", "og:image:url", "twitter:image", "twitter:image:src"}:
            self.image_url = metadata.get("content")


async def _is_public_https_url(value: str) -> bool:
    """Reject private or non-HTTPS hosts before fetching public preview metadata."""
    try:
        parsed = urlsplit(value)
        if parsed.scheme.lower() != "https" or not parsed.hostname or parsed.username or parsed.password:
            return False
        if parsed.port not in (None, 443):
            return False
        hostname = parsed.hostname.rstrip(".").lower()
        if hostname == "localhost" or hostname.endswith((".localhost", ".local", ".internal")):
            return False
        try:
            return ipaddress.ip_address(hostname).is_global
        except ValueError:
            addresses = await asyncio.to_thread(socket.getaddrinfo, hostname, 443, type=socket.SOCK_STREAM)
            return bool(addresses) and all(ipaddress.ip_address(address[4][0]).is_global for address in addresses)
    except (OSError, ValueError):
        return False


async def _fetch_open_graph_image(client: httpx.AsyncClient, page_url: str) -> str | None:
    current_url = page_url
    for _ in range(_PREVIEW_MAX_REDIRECTS + 1):
        if not await _is_public_https_url(current_url):
            return None
        try:
            async with client.stream("GET", current_url, headers={"Accept": "text/html"}) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        return None
                    current_url = urljoin(current_url, location)
                    continue
                if response.status_code != 200:
                    return None
                content_type = response.headers.get("content-type", "").lower()
                if content_type and "html" not in content_type:
                    return None
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    remaining = _PREVIEW_MAX_BYTES - len(body)
                    if remaining <= 0:
                        break
                    body.extend(chunk[:remaining])
                    if len(chunk) > remaining:
                        break
                parser = _OpenGraphImageParser()
                parser.feed(body.decode(response.encoding or "utf-8", errors="ignore"))
                if not parser.image_url:
                    return None
                image_url = urljoin(str(response.url), parser.image_url.strip())
                if await _is_public_https_url(image_url):
                    return image_url
        except (httpx.HTTPError, UnicodeError, ValueError):
            return None
    return None


async def _add_page_preview_images(sources: list[CatalystSource]) -> list[CatalystSource]:
    missing_images = [source for source in sources if not source.thumbnail_url][:8]
    if not missing_images:
        return sources

    semaphore = asyncio.Semaphore(4)
    timeout = httpx.Timeout(_PREVIEW_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        async def load_thumbnail(source: CatalystSource) -> tuple[str, str | None]:
            async with semaphore:
                return source.id, await _fetch_open_graph_image(client, str(source.url))

        thumbnails = dict(await asyncio.gather(*(load_thumbnail(source) for source in missing_images)))

    return [
        source.model_copy(update={"thumbnail_url": thumbnails[source.id]})
        if thumbnails.get(source.id)
        else source
        for source in sources
    ]


def _run_text_search(query: str, limit: int, timelimit: str = "m") -> list[dict[str, str]]:
    """Use metasearch engines and return links with any image metadata they provide."""
    return DDGS(timeout=8).text(
        query,
        region="in-en",
        safesearch="moderate",
        timelimit=timelimit,
        max_results=limit,
        backend="auto",
    )


def _run_video_search(query: str, limit: int, timelimit: str = "m") -> list[dict[str, object]]:
    """Search indexed video sources, including YouTube, for recent coverage."""
    return DDGS(timeout=8).videos(
        query,
        region="in-en",
        safesearch="moderate",
        timelimit=timelimit,
        max_results=limit,
        backend="auto",
    )


def _result_thumbnail_url(result: dict[str, object]) -> str | None:
    candidates: list[object] = [
        result.get(key)
        for key in ("thumbnail", "thumbnail_url", "image", "image_url")
    ]
    images = result.get("images")
    if isinstance(images, dict):
        candidates.extend(images.get(key) for key in ("large", "medium", "small", "thumbnail", "url"))
        candidates.extend(images.values())
    for candidate in candidates:
        if isinstance(candidate, dict):
            candidate = candidate.get("url") or candidate.get("src")
        if isinstance(candidate, str) and candidate.strip().startswith(("https://", "http://")):
            return candidate.strip()
    return None


def _youtube_video_id(url: str) -> str | None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host == "youtu.be":
        return parsed.path.strip("/").split("/")[0] or None
    if host == "youtube.com" or host.endswith(".youtube.com"):
        video_id = parse_qs(parsed.query).get("v", [None])[0]
        if video_id:
            return video_id
        parts = parsed.path.strip("/").split("/")
        if len(parts) > 1 and parts[0] in {"shorts", "embed", "live"}:
            return parts[1]
    return None


def _is_youtube_url(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host == "youtu.be" or host == "youtube.com" or host.endswith(".youtube.com")


def _search_stock_videos_sync(
    symbol: str,
    company_name: str | None,
    limit: int,
) -> list[CatalystSource]:
    subject = (company_name or "").replace('"', " ").strip() or symbol
    query = f'"{subject}" {symbol} India stock news results market analysis'
    return _video_sources(_run_video_search(query, limit), limit)


def _video_sources(results: list[dict[str, object]], limit: int) -> list[CatalystSource]:
    sources: list[CatalystSource] = []
    seen_urls: set[str] = set()
    for result in results:
        if not isinstance(result, dict):
            continue
        url = next((
            candidate
            for candidate in (str(result.get(key) or "").strip() for key in ("content", "url", "href", "embed_url"))
            if candidate.startswith(("https://", "http://")) and _is_youtube_url(candidate)
        ), "")
        title = str(result.get("title") or "").strip()
        if not title or not url or url in seen_urls:
            continue
        seen_urls.add(url)

        thumbnail_url = _result_thumbnail_url(result)
        video_id = _youtube_video_id(url)
        if not thumbnail_url and video_id:
            thumbnail_url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

        publisher = str(result.get("publisher") or result.get("uploader") or "YouTube")
        published_at = result.get("published") or result.get("date")
        description = result.get("description") or result.get("body")
        sources.append(
            CatalystSource(
                id=f"V{len(sources) + 1}",
                kind="video",
                title=title[:300],
                url=url,
                publisher=publisher[:120],
                published_at=str(published_at)[:80] if published_at else None,
                snippet=str(description).strip()[:700] or None if description else None,
                thumbnail_url=thumbnail_url,
            )
        )
        if len(sources) >= limit:
            break
    return sources


def _search_stock_web_sync(
    symbol: str,
    company_name: str | None,
    limit: int,
) -> list[CatalystSource]:
    subject = (company_name or "").replace('"', " ").strip() or symbol
    web_query = f'"{subject}" {symbol} India {_MARKET_TERMS}'
    social_sites = " OR ".join(f"site:{domain}" for domain in _SOCIAL_DOMAINS)
    social_query = f'"{subject}" {symbol} India stock ({social_sites})'
    return _search_web_queries_sync(web_query, social_query, limit, timelimit="m")


def _search_india_market_web_sync(limit: int) -> list[CatalystSource]:
    market_terms = '(NSE OR Nifty OR Sensex) (India OR Indian) (stocks OR shares OR market OR earnings OR results)'
    social_sites = " OR ".join(f"site:{domain}" for domain in _SOCIAL_DOMAINS)
    social_query = f'(NSE OR Nifty OR Sensex) India stock market ({social_sites})'
    return _search_web_queries_sync(market_terms, social_query, limit, timelimit="d")


def _search_web_queries_sync(
    web_query: str,
    social_query: str,
    limit: int,
    *,
    timelimit: str,
) -> list[CatalystSource]:

    # Search broad web pages and public social posts independently so a noisy
    # platform-specific query cannot hide relevant blogs or community posts.
    with ThreadPoolExecutor(max_workers=2) as executor:
        web_future = executor.submit(_run_text_search, web_query, limit, timelimit)
        social_future = executor.submit(_run_text_search, social_query, limit, timelimit)
        web_results: list[dict[str, str]] = []
        social_results: list[dict[str, str]] = []
        failures = []
        for future, target in (
            (social_future, "social"),
            (web_future, "web"),
        ):
            try:
                results = future.result()
            except Exception as exc:
                failures.append(exc)
                continue
            if target == "social":
                social_results = results
            else:
                web_results = results
        if failures and not social_results and not web_results:
            raise RuntimeError("All public web search queries failed") from failures[0]

    sources: list[CatalystSource] = []
    seen_urls: set[str] = set()
    for result in [*social_results, *web_results]:
        if not isinstance(result, dict):
            continue
        url = str(result.get("href") or result.get("url") or "").strip()
        title = str(result.get("title") or "").strip()
        if not title or not url.startswith(("https://", "http://")) or url in seen_urls:
            continue
        seen_urls.add(url)
        hostname = (urlparse(url).hostname or "").lower()
        publisher = hostname.removeprefix("www.") or "Web source"
        published_at = result.get("date") or result.get("published")
        snippet = str(result.get("body") or result.get("description") or "").strip()
        sources.append(
            CatalystSource(
                id=f"W{len(sources) + 1}",
                kind="web",
                title=title[:300],
                url=url,
                publisher=publisher[:120],
                published_at=str(published_at)[:80] if published_at else None,
                snippet=snippet[:700] or None,
                thumbnail_url=_result_thumbnail_url(result),
            )
        )
        if len(sources) >= limit:
            break
    return sources


async def search_stock_web(
    symbol: str,
    company_name: str | None,
    *,
    limit: int = 10,
) -> list[CatalystSource]:
    """Return recent public web/social links and available page preview images."""
    sources = await asyncio.to_thread(_search_stock_web_sync, symbol, company_name, limit)
    return await _add_page_preview_images(sources)


async def search_stock_videos(
    symbol: str,
    company_name: str | None,
    *,
    limit: int = 8,
) -> list[CatalystSource]:
    """Return recent stock-related video links and thumbnails."""
    return await asyncio.to_thread(_search_stock_videos_sync, symbol, company_name, limit)


async def search_india_market_web(*, limit: int = 8) -> list[CatalystSource]:
    """Return daily India-wide market web and public social coverage."""
    sources = await asyncio.to_thread(_search_india_market_web_sync, limit)
    return await _add_page_preview_images(sources)


async def search_india_market_videos(*, limit: int = 6) -> list[CatalystSource]:
    """Return recent YouTube videos, widening to a week if today's search is empty."""
    query = "India stock market today NSE Nifty Sensex Indian stocks daily news analysis"
    results = await asyncio.to_thread(_run_video_search, query, limit, "d")
    videos = _video_sources(results, limit)
    if videos:
        return videos
    weekly_results = await asyncio.to_thread(_run_video_search, query, limit, "w")
    return _video_sources(weekly_results, limit)
