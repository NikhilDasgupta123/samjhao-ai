from typing import Optional

from pydantic import BaseModel

from app.schemas.analyze import AnalyzeResponse


class FileAnalysisResponse(BaseModel):
    status: str
    filename: str
    content_type: str
    language: str
    analysis: AnalyzeResponse


class UploadResponse(BaseModel):
    status: str
    filename: str
    content_type: str
    size: int
    extraction_status: str
    extracted_text: Optional[str] = None
