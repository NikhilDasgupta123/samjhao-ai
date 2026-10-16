from io import BytesIO

from docx import Document


def extract_document(content: bytes) -> tuple[str | None, str]:
    document = Document(BytesIO(content))
    paragraphs = [
        paragraph.text
        for paragraph in document.paragraphs
        if paragraph.text.strip()
    ]

    return "\n".join(paragraphs).strip(), "extracted"
