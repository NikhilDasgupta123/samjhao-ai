"""Search YouTube metadata with yt-dlp without downloading video or audio."""

import asyncio
from datetime import datetime, timedelta, timezone
import html
import shutil
import subprocess
from typing import Any

from app.ai.catalyst_schemas import CatalystSource


def _video_date(value: Any) -> str | None:
    raw = str(value or "").strip()
    if len(raw) == 8 and raw.isdigit():
        try:
            return datetime.strptime(raw, "%Y%m%d").date().isoformat()
        except ValueError:
            return None
    return None


def _published_at(entry: dict[str, Any]) -> str | None:
    upload_date = _video_date(entry.get("upload_date"))
    if upload_date:
        return upload_date
    timestamp = entry.get("timestamp")
    if isinstance(timestamp, (int, float)):
        try:
            return datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat()
        except (OverflowError, OSError, ValueError):
            return None
    return None


def _search_videos_sync(
    symbol: str,
    company_name: str | None,
    limit: int,
) -> list[CatalystSource]:
    from yt_dlp import YoutubeDL

    company = (company_name or symbol).strip()
    query = f"{company} {symbol} stock news NSE India"
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "noplaylist": True,
        "ignoreerrors": True,
        "socket_timeout": 10,
        "retries": 0,
        "playlist_items": "1-15",
        "extractor_args": {"youtubetab": {"approximate_date": ["true"]}},
    }
    node_path = shutil.which("node")
    if node_path:
        try:
            node_version = subprocess.run(
                [node_path, "--version"],
                capture_output=True,
                text=True,
                timeout=2,
                check=False,
            ).stdout.strip().lstrip("v").split(".", 1)[0]
            if node_version.isdigit() and int(node_version) >= 22:
                options["js_runtimes"] = {"node": {}}
        except (OSError, subprocess.SubprocessError):
            pass
    with YoutubeDL(options) as downloader:
        result = downloader.extract_info(f"ytsearch15:{query}", download=False)

    entries = (result or {}).get("entries") or []
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    sources: list[CatalystSource] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        video_id = str(entry.get("id") or "").strip()
        title = html.unescape(str(entry.get("title") or "")).strip()
        if not video_id or not title:
            continue
        published_at = _published_at(entry)
        if not published_at:
            continue
        published = datetime.fromisoformat(published_at)
        if published.tzinfo is None:
            published = published.replace(tzinfo=timezone.utc)
        if published < cutoff:
            continue
        url = str(entry.get("webpage_url") or entry.get("url") or "")
        if not url.startswith("http"):
            url = f"https://www.youtube.com/watch?v={video_id}"
        if "youtube.com/" not in url and "youtu.be/" not in url:
            url = f"https://www.youtube.com/watch?v={video_id}"
        description = html.unescape(str(entry.get("description") or "")).strip()
        sources.append(
            CatalystSource(
                id=f"V{len(sources) + 1}",
                kind="video",
                title=title[:300],
                url=url,
                publisher=str(entry.get("channel") or entry.get("uploader") or "YouTube")[:120],
                published_at=published_at,
                snippet=description[:500] or None,
                thumbnail_url=entry.get("thumbnail") or None,
            )
        )
        if len(sources) >= limit:
            break
    return sources


async def search_stock_videos(
    symbol: str,
    company_name: str | None,
    *,
    limit: int = 6,
) -> list[CatalystSource]:
    """Run yt-dlp's search extractor off the event loop; never download media."""
    return await asyncio.to_thread(_search_videos_sync, symbol, company_name, limit)
