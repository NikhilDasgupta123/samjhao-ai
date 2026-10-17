from app.schemas.analyze import AnalyzeRequest
from app.core.flow_logger import log_flow_event, new_flow_id
from app.services.file_analysis_service import format_analysis_response
from app.workflows.file_analysis import analyze_uploaded_file


async def analyze_text(request: AnalyzeRequest) -> dict:
    flow_id = new_flow_id()
    log_flow_event(
        flow_id,
        "REQUEST RECEIVED",
        f"Endpoint: POST /api/analyze | Characters: {len(request.text):,}",
    )
    result = await analyze_uploaded_file(
        content=request.text.encode("utf-8"),
        content_type="text/plain",
        filename="text-input.txt",
        language=request.language,
        flow_id=flow_id,
    )
    log_flow_event(flow_id, "API RESPONSE", "Structured analysis response is ready")
    return format_analysis_response(request.language, result["analysis"])
