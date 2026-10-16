from fastapi import HTTPException, UploadFile

from app.services.document_extractors.docx import (
    extract_document as extract_docx_document,
)
from app.services.document_extractors.image import (
    extract_document as extract_image_document,
)
from app.services.document_extractors.pdf import (
    extract_document as extract_pdf_document,
)
from app.services.document_extractors.txt import (
    extract_document as extract_txt_document,
)


ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def extract_document_text(
    content: bytes,
    content_type: str
) -> tuple[str | None, str]:

    if content_type == "application/pdf":
        return extract_pdf_document(content)

    if (
        content_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        return extract_docx_document(content)

    if content_type == "text/plain":
        return extract_txt_document(content)

    if content_type.startswith("image/"):
        return extract_image_document(content)

    return None, "unsupported"


async def process_document(file: UploadFile) -> dict:

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type."
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size cannot exceed 10 MB."
        )

    extracted_text, extraction_status = extract_document_text(
        content=content,
        content_type=file.content_type
    )

    return {
        "status": "success",
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(content),
        "extraction_status": extraction_status,
        "extracted_text": extracted_text,
    }
