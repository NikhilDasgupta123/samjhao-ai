from fastapi import APIRouter

from app.schemas.analyze import (
    AnalyzeRequest,
    AnalyzeResponse
)

from app.services.analyze_service import analyze_text


router = APIRouter(
    prefix="/api",
    tags=["Analyze"]
)


@router.post(
    "/analyze",
    response_model=AnalyzeResponse
)
def analyze(request: AnalyzeRequest):
    return analyze_text(request)