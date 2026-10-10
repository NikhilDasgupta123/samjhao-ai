from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.analyze import AnalyzeRequest
from app.schemas.document import UploadResponse
from app.services.analyze_service import analyze_text
from app.services.document_service import process_document


router = APIRouter(
    prefix="/api",
    tags=["Documents"],
)


@router.post(
    "/upload",
    response_model=UploadResponse,
)
async def upload_document(
    file: UploadFile = File(...),
):
    return await process_document(file)


@router.post("/documents/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    language: str = Form(default="english"),
):
    document = await process_document(file)

    extracted_text = document.get("extracted_text")

    if not extracted_text:
        raise HTTPException(
            status_code=400,
            detail=(
                "Text could not be extracted from this file. "
                "Image/vision support will be added next."
            ),
        )

    # Temporary V1 safety limit
    max_chars = 20000

    if len(extracted_text) > max_chars:
        raise HTTPException(
            status_code=413,
            detail=(
                "Document is too large for the current version. "
                "Large-document processing will be added next."
            ),
        )

    request = AnalyzeRequest(
        text=extracted_text,
        language=language,
    )

    analysis = await analyze_text(request)

    return {
        "status": "success",
        "filename": document["filename"],
        "content_type": document["content_type"],
        "language": language,
        "analysis": analysis,
    }