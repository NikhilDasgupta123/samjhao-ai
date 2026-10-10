from typing import Optional

from pydantic import BaseModel


class UploadResponse(BaseModel):
    status: str
    filename: str
    content_type: str
    size: int
    extraction_status: str
    extracted_text: Optional[str] = None