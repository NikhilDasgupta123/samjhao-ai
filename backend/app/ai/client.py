"""Async HTTP client used by the public API to reach the separate AI service."""

import httpx
from pydantic import ValidationError

from app.ai.catalyst_schemas import StockCatalystRequest, StockCatalystResponse
from app.ai.errors import AIServiceError
from app.ai.schemas import StockAnalyzeRequest, StockAnalyzeResponse
from app.core.settings import settings


async def _post_to_ai_service(path: str, payload: dict) -> dict:
    url = f"{settings.ai_service_url.rstrip('/')}{path}"
    try:
        async with httpx.AsyncClient(
            timeout=settings.ai_service_timeout_seconds
        ) as client:
            response = await client.post(url, json=payload)
    except httpx.TimeoutException as exc:
        raise AIServiceError(
            "AI service request timed out. The API is available; retry the request."
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
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError("AI service response must be a JSON object.")
        return result
    except (ValueError, ValidationError) as exc:
        raise AIServiceError("AI service returned an invalid JSON response.") from exc


async def analyze_stock_with_ai_service(
    request: StockAnalyzeRequest,
) -> StockAnalyzeResponse:
    payload = await _post_to_ai_service(
        "/internal/stocks/analyze",
        request.model_dump(mode="json"),
    )
    try:
        return StockAnalyzeResponse.model_validate(payload)
    except ValidationError as exc:
        raise AIServiceError("AI service returned an invalid analysis response.") from exc


async def research_stock_catalysts_with_ai_service(
    request: StockCatalystRequest,
) -> StockCatalystResponse:
    payload = await _post_to_ai_service(
        "/internal/stocks/catalysts",
        request.model_dump(mode="json"),
    )
    try:
        return StockCatalystResponse.model_validate(payload)
    except ValidationError as exc:
        raise AIServiceError("AI service returned an invalid catalyst response.") from exc
