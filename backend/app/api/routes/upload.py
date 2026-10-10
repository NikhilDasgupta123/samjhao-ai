from fastapi import APIRouter, File, UploadFile

from app.schemas.document import UploadResponse
from app.services.document_service import process_document


router = APIRouter(
    prefix="/api",
    tags=["Documents"]
)


@router.post(
    "/upload",
    response_model=UploadResponse
)
async def upload_document(
    file: UploadFile = File(...)
):
    return await process_document(file)