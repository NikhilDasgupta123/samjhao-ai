"""Search recent online news coverage through the free GDELT DOC API."""

import html
import re

import httpx

from app.ai.catalyst_schemas import CatalystSource


GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"
_MARKET_TERMS = "stock OR shares OR earnings OR results OR order OR acquisition OR dividend OR regulation"


def _search_query(symbol: str, company_name: str | None) -> str:
    name = re.sub(r"[^\w\s&.,'-]+", " ", company_name or "").strip()
    name = re.sub(r"\s+", " ", name)
    subject = f'"{name}"' if name else symbol
    return f"{subject} ({_MARKET_TERMS})"


def _published_at(value: str | None) -> str | None:
    if not value:
        return None
    raw = str(value).strip()
    match = re.fullmatch(r"(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})", raw)
    if match:
        year, month, day, hour, minute, second = match.groups()
        return f"{year}-{month}-{day}T{hour}:{minute}:{second}+00:00"
    return raw


async def search_stock_news(
    symbol: str,
    company_name: str | None,
    *,
    limit: int = 8,
) -> list[CatalystSource]:
    """Return recent article links and headlines; article text is not copied."""
    params = {
        "query": _search_query(symbol, company_name),
        "mode": "artlist",
        "format": "json",
        "timespan": "30d",
        "maxrecords": str(min(max(limit * 2, 5), 20)),
        "sort": "datedesc",
    }
    headers = {"User-Agent": "MarketBriefAI/0.1 (stock catalyst research)"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0), follow_redirects=True) as client:
        response = await client.get(GDELT_DOC_API, params=params, headers=headers)
        response.raise_for_status()
        payload = response.json()

    articles = payload.get("articles", []) if isinstance(payload, dict) else []
    sources: list[CatalystSource] = []
    seen_urls: set[str] = set()
    for article in articles:
        if not isinstance(article, dict):
            continue
        url = str(article.get("url") or "").strip()
        title = html.unescape(str(article.get("title") or "")).strip()
        if not title or not url.startswith(("https://", "http://")) or url in seen_urls:
            continue
        seen_urls.add(url)
        sources.append(
            CatalystSource(
                id=f"N{len(sources) + 1}",
                kind="news",
                title=title[:300],
                url=url,
                publisher=str(article.get("domain") or article.get("sourcecountry") or "News source")[:120],
                published_at=_published_at(article.get("seendate")),
                thumbnail_url=(
                    str(article.get("socialimage")).strip()
                    if str(article.get("socialimage") or "").strip().startswith(("https://", "http://"))
                    else None
                ),
            )
        )
        if len(sources) >= limit:
            break
    return sources
