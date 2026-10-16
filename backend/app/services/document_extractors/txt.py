def extract_document(content: bytes) -> tuple[str | None, str]:
    extracted_text = content.decode("utf-8-sig", errors="replace").strip()
    return extracted_text, "extracted"
