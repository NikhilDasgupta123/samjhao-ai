from fastapi import APIRouter, File, Form, UploadFile

from auth.dependencies import CurrentUser
from app.schemas.document import FileAnalysisResponse
from app.services.file_analysis_service import analyze_file_upload


router = APIRouter(
    prefix="/api/images",
    tags=["Image analysis"],
)


@router.post("/analyze", response_model=FileAnalysisResponse)
async def analyze_image(
    _user: CurrentUser,
    file: UploadFile = File(...),
    language: str = Form(default="english"),
):
    """Analyze JPG, PNG, and WEBP uploads with the vision agent."""
    return await analyze_file_upload(file, expected_kind="image", language=language)
