"""Async HTTP client used by the public API to reach the separate AI service."""

import httpx
from pydantic import ValidationError

from app.ai.errors import AIServiceError
from app.ai.schemas import StockAnalyzeRequest, StockAnalyzeResponse
from app.core.settings import settings


async def analyze_stock_with_ai_service(
    request: StockAnalyzeRequest,
) -> StockAnalyzeResponse:
    url = f"{settings.ai_service_url.rstrip('/')}/internal/stocks/analyze"

    try:
        async with httpx.AsyncClient(
            timeout=settings.ai_service_timeout_seconds
        ) as client:
            response = await client.post(url, json=request.model_dump(mode="json"))
    except httpx.TimeoutException as exc:
        raise AIServiceError(
            "AI analysis timed out. The API is available; retry the stock analysis."
        ) from exc
    except httpx.RequestError as exc:
        raise AIServiceError(
            "AI analysis service is unavailable. Start the AI service on port 8001."
        ) from exc

    if response.is_error:
        try:
            detail = response.json().get("detail")
        except (ValueError, AttributeError):
            detail = None
        raise AIServiceError(
            str(detail or f"AI service returned HTTP {response.status_code}.")
        )

    try:
        return StockAnalyzeResponse.model_validate(response.json())
    except (ValueError, ValidationError) as exc:
        raise AIServiceError("AI service returned an invalid analysis response.") from exc
