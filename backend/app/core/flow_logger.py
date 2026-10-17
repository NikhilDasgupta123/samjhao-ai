import logging
import textwrap
from uuid import uuid4


_logger = logging.getLogger("uvicorn.error")
_BOX_WIDTH = 72


def new_flow_id() -> str:
    """Return a short ID for connecting log boxes from one request."""
    return uuid4().hex[:8]


def log_flow_event(flow_id: str, stage: str, detail: str) -> None:
    """Write one compact, terminal-friendly box for an analysis step."""
    content_width = _BOX_WIDTH - 2
    lines = textwrap.wrap(f"{flow_id} | {stage}", width=content_width)
    lines.extend(textwrap.wrap(detail, width=content_width) or [""])

    top = f"┌{'─' * _BOX_WIDTH}┐"
    bottom = f"└{'─' * _BOX_WIDTH}┘"
    body = [f"│ {line:<{content_width}} │" for line in lines]
    _logger.info("\n%s", "\n".join([top, *body, bottom]))


def summarize_provider_error(exc: Exception) -> str:
    """Summarize provider failures without logging request content or headers."""
    chain: list[Exception] = []
    current: Exception | None = exc
    while current is not None and current not in chain:
        chain.append(current)
        current = current.__cause__ or current.__context__

    status_summary = None
    provider_messages = []
    for error in chain:
        response = getattr(error, "response", None)
        status_code = getattr(error, "status_code", None)
        if status_code is None and response is not None:
            status_code = getattr(response, "status_code", None)
        if status_code is not None and status_summary is None:
            status_summary = f"{type(error).__name__} | HTTP {status_code}"

        body = getattr(error, "body", None)
        if not isinstance(body, dict) and response is not None:
            try:
                body = response.json()
            except Exception:
                body = None

        if isinstance(body, dict):
            provider_errors = body.get("errors")
            if isinstance(provider_errors, list):
                for provider_error in provider_errors[:2]:
                    if not isinstance(provider_error, dict):
                        continue
                    code = provider_error.get("code")
                    message = provider_error.get("message")
                    if message:
                        provider_messages.append(
                            f"{code}: {str(message).replace(chr(10), ' ')[:160]}"
                            if code is not None
                            else str(message).replace(chr(10), " ")[:160]
                        )
            elif isinstance(body.get("error"), dict):
                provider_error = body["error"]
                message = provider_error.get("message")
                code = provider_error.get("code")
                if message:
                    provider_messages.append(
                        f"{code}: {str(message).replace(chr(10), ' ')[:160]}"
                        if code is not None
                        else str(message).replace(chr(10), " ")[:160]
                    )
    if status_summary is not None:
        if provider_messages:
            status_summary += " | " + "; ".join(provider_messages[:2])
        return status_summary

    return " → ".join(type(error).__name__ for error in chain)
