from io import BytesIO

from pypdf import PdfReader


def extract_document(content: bytes) -> tuple[str | None, str]:
    reader = PdfReader(BytesIO(content))
    pages = []

    for page in reader.pages:
        text = page.extract_text()

        if text:
            pages.append(text)

    extracted_text = "\n\n".join(pages).strip()

    if not extracted_text:
        return None, "requires_ocr_or_vision"

    return extracted_text, "extracted"
