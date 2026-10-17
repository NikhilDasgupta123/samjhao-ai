from typing import Literal

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


MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
DOCUMENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
}
IMAGE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}
ALL_FILE_TYPES = {**DOCUMENT_TYPES, **IMAGE_TYPES}


def extract_document_text(content: bytes, content_type: str) -> tuple[str | None, str]:
    if content_type == "application/pdf":
        return extract_pdf_document(content)

    if content_type == DOCUMENT_TYPES[".docx"]:
        return extract_docx_document(content)

    if content_type == "text/plain":
        return extract_txt_document(content)

    if content_type.startswith("image/"):
        return extract_image_document(content)

    return None, "unsupported"


async def read_uploaded_file(
    file: UploadFile,
    expected_kind: Literal["document", "image", "any"],
) -> tuple[bytes, str]:
    """Check the upload type and size before passing data to an agent."""
    extension = ""
    if file.filename:
        extension = "." + file.filename.rsplit(".", maxsplit=1)[-1].lower()

    content_type = ALL_FILE_TYPES.get(extension)
    if content_type is None and file.content_type in ALL_FILE_TYPES.values():
        content_type = file.content_type

    if expected_kind == "document":
        allowed_types = DOCUMENT_TYPES.values()
    elif expected_kind == "image":
        allowed_types = IMAGE_TYPES.values()
    else:
        allowed_types = ALL_FILE_TYPES.values()
    if content_type is None or content_type not in allowed_types:
        if expected_kind == "document":
            detail = "Upload a PDF, DOCX, or TXT file."
        elif expected_kind == "image":
            detail = "Upload a JPG, PNG, or WEBP image."
        else:
            detail = "Unsupported file type."
        raise HTTPException(status_code=400, detail=detail)

    content = await file.read(MAX_FILE_SIZE + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size cannot exceed 10 MB.",
        )

    return content, content_type


async def process_document(file: UploadFile) -> dict:
    """Extract text for the upload endpoint without invoking an AI agent."""
    content, content_type = await read_uploaded_file(file, expected_kind="any")
    extracted_text, extraction_status = extract_document_text(
        content,
        content_type,
    )

    return {
        "status": "success",
        "filename": file.filename or "uploaded-document",
        "content_type": content_type,
        "size": len(content),
        "extraction_status": extraction_status,
        "extracted_text": extracted_text,
    }
