from fastapi import APIRouter

from app.schemas.analyze import (
    AnalyzeRequest,
    AnalyzeResponse,
)
from app.services.analyze_service import analyze_text


router = APIRouter(
    prefix="/api",
    tags=["Analyze"],
)


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
)
async def analyze(request: AnalyzeRequest):
    return await analyze_text(request)