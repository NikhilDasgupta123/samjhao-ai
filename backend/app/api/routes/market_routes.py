from fastapi import APIRouter

from auth.dependencies import CurrentUser
from app.ai.catalyst_schemas import DailyMarketDigestRequest, DailyMarketDigestResponse
from app.ai.client import get_daily_market_digest_from_ai_service


router = APIRouter(prefix="/api/market", tags=["Market news"])


@router.post("/digest", response_model=DailyMarketDigestResponse)
async def daily_market_digest_request(request: DailyMarketDigestRequest, _user: CurrentUser):
    """Return an automatically generated daily India stock-market news digest."""
    return await get_daily_market_digest_from_ai_service(request)
