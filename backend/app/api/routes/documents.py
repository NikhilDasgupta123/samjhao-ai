from fastapi import APIRouter, File, Form, UploadFile

from auth.dependencies import CurrentUser
from app.schemas.document import FileAnalysisResponse
from app.services.file_analysis_service import analyze_file_upload


router = APIRouter(
    prefix="/api/documents",
    tags=["Document analysis"],
)


@router.post("/analyze", response_model=FileAnalysisResponse)
async def analyze_document(
    _user: CurrentUser,
    file: UploadFile = File(...),
    language: str = Form(default="english"),
):
    """Analyze PDF, DOCX, and TXT uploads with the document agent."""
    return await analyze_file_upload(file, expected_kind="document", language=language)
