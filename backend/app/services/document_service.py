from io import BytesIO

from docx import Document
from fastapi import HTTPException, UploadFile
from pypdf import PdfReader


ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def extract_pdf_text(content: bytes) -> str:
    reader = PdfReader(BytesIO(content))

    pages = []

    for page in reader.pages:
        text = page.extract_text()

        if text:
            pages.append(text)

    return "\n\n".join(pages).strip()


def extract_docx_text(content: bytes) -> str:
    document = Document(BytesIO(content))

    paragraphs = [
        paragraph.text
        for paragraph in document.paragraphs
        if paragraph.text.strip()
    ]

    return "\n".join(paragraphs).strip()


def extract_txt_text(content: bytes) -> str:
    return content.decode(
        "utf-8-sig",
        errors="replace"
    ).strip()


def extract_document_text(
    content: bytes,
    content_type: str
) -> tuple[str | None, str]:

    if content_type == "application/pdf":
        text = extract_pdf_text(content)

        if not text:
            return None, "requires_ocr_or_vision"

        return text, "extracted"

    if (
        content_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        return extract_docx_text(content), "extracted"

    if content_type == "text/plain":
        return extract_txt_text(content), "extracted"

    if content_type.startswith("image/"):
        return None, "requires_vision"

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