"""Search public, indexed web and social results through the open-source DDGS library."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

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


def _run_text_search(query: str, limit: int) -> list[dict[str, str]]:
    """Use metasearch engines; results link to public pages and are not scraped."""
    return DDGS(timeout=8).text(
        query,
        region="in-en",
        safesearch="moderate",
        timelimit="w",
        max_results=limit,
        backend="auto",
    )


def _search_stock_web_sync(
    symbol: str,
    company_name: str | None,
    limit: int,
) -> list[CatalystSource]:
    subject = (company_name or "").replace('"', " ").strip() or symbol
    web_query = f'"{subject}" {symbol} India {_MARKET_TERMS}'
    social_sites = " OR ".join(f"site:{domain}" for domain in _SOCIAL_DOMAINS)
    social_query = f'"{subject}" {symbol} India stock ({social_sites})'

    # Search broad web pages and public social posts independently so a noisy
    # platform-specific query cannot hide relevant blogs or community posts.
    with ThreadPoolExecutor(max_workers=2) as executor:
        web_future = executor.submit(_run_text_search, web_query, limit)
        social_future = executor.submit(_run_text_search, social_query, limit)
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
        if hostname.endswith("youtube.com") or hostname.endswith("youtu.be"):
            continue
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
    """Return recent, public web and social links for an NSE company."""
    return await asyncio.to_thread(_search_stock_web_sync, symbol, company_name, limit)
