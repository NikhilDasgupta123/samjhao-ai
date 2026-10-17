from typing import Literal

from fastapi import UploadFile

from app.core.flow_logger import log_flow_event, new_flow_id
from app.schemas.analyze import AnalysisResult
from app.services.document_service import read_uploaded_file
from app.workflows.file_analysis import analyze_uploaded_file


def format_analysis_response(language: str, analysis: AnalysisResult) -> dict:
    return {
        "status": "success",
        "language": language,
        **analysis.model_dump(),
    }


async def analyze_file_upload(
    file: UploadFile,
    expected_kind: Literal["document", "image"],
    language: str,
) -> dict:
    flow_id = new_flow_id()
    endpoint = (
        "POST /api/documents/analyze"
        if expected_kind == "document"
        else "POST /api/images/analyze"
    )
    log_flow_event(flow_id, "REQUEST RECEIVED", f"Endpoint: {endpoint}")

    try:
        content, content_type = await read_uploaded_file(file, expected_kind)
    except Exception as exc:
        detail = getattr(exc, "detail", type(exc).__name__)
        log_flow_event(flow_id, "UPLOAD REJECTED", str(detail))
        raise

    log_flow_event(
        flow_id,
        "UPLOAD VALIDATED",
        f"Type: {content_type} | Size: {len(content):,} bytes",
    )
    result = await analyze_uploaded_file(
        content=content,
        content_type=content_type,
        filename=file.filename or "uploaded-file",
        language=language,
        flow_id=flow_id,
    )
    log_flow_event(flow_id, "API RESPONSE", "Structured analysis response is ready")
    return {
        "status": "success",
        "filename": file.filename or "uploaded-file",
        "content_type": content_type,
        "language": language,
        "analysis": format_analysis_response(language, result["analysis"]),
    }
