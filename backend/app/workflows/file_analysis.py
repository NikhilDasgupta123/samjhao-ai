from functools import lru_cache
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.document_agent import analyze_document_text
from app.agents.image_agent import analyze_image
from app.core.config import settings
from app.core.flow_logger import (
    log_flow_event,
    new_flow_id,
    summarize_provider_error,
)
from app.schemas.analyze import AnalysisResult
from app.services.ai_service import AIServiceError
from app.services.document_service import extract_document_text


MAX_ANALYSIS_CHARACTERS = 20_000


class FileAnalysisError(Exception):
    """Base error for content that cannot be sent through the file workflow."""


class DocumentTextNotFoundError(FileAnalysisError):
    """Raised when a PDF or DOCX does not contain extractable text."""


class DocumentTooLargeError(FileAnalysisError):
    """Raised when extracted text is too long for the current workflow."""


class FileAnalysisState(TypedDict, total=False):
    content: bytes
    content_type: str
    filename: str
    language: str
    flow_id: str
    extracted_text: str
    analysis: AnalysisResult


def choose_analysis_route(state: FileAnalysisState) -> str:
    """Send image MIME types to the vision agent and other files to extraction."""
    if state["content_type"].startswith("image/"):
        route = "image"
        destination = "vision agent → Cloudflare vision model"
    else:
        route = "document"
        destination = "document text extraction → PydanticAI document agent"

    log_flow_event(
        state["flow_id"],
        "LANGGRAPH ROUTING",
        f"{state['content_type']} → {route} branch ({destination})",
    )
    return route


async def extract_document_node(state: FileAnalysisState) -> dict:
    log_flow_event(
        state["flow_id"],
        "TEXT EXTRACTION",
        f"Extracting content from {state['content_type']}",
    )
    extracted_text, extraction_status = extract_document_text(
        content=state["content"],
        content_type=state["content_type"],
    )

    if extraction_status != "extracted" or not extracted_text:
        raise DocumentTextNotFoundError(
            "No readable text was found in this file. Scanned PDFs need OCR first."
        )

    if len(extracted_text) > MAX_ANALYSIS_CHARACTERS:
        raise DocumentTooLargeError(
            "This document is too large for the current analysis limit "
            f"of {MAX_ANALYSIS_CHARACTERS:,} characters."
        )

    log_flow_event(
        state["flow_id"],
        "TEXT READY",
        f"Extracted {len(extracted_text):,} characters; sending to document agent",
    )
    return {"extracted_text": extracted_text}


async def analyze_document_node(state: FileAnalysisState) -> dict:
    log_flow_event(
        state["flow_id"],
        "DOCUMENT AGENT",
        "PydanticAI → Cloudflare Workers AI | "
        f"model={settings.cloudflare_model}",
    )
    analysis = await analyze_document_text(
        text=state["extracted_text"],
        language=state["language"],
    )
    log_flow_event(state["flow_id"], "DOCUMENT AGENT", "Analysis returned")
    return {"analysis": analysis}


async def analyze_image_node(state: FileAnalysisState) -> dict:
    log_flow_event(
        state["flow_id"],
        "IMAGE AGENT",
        f"model={settings.cloudflare_vision_model} | {state['content_type']} | "
        f"{len(state['content']):,} bytes",
    )
    analysis = await analyze_image(
        image=state["content"],
        content_type=state["content_type"],
        language=state["language"],
    )
    log_flow_event(state["flow_id"], "IMAGE AGENT", "Analysis returned")
    return {"analysis": analysis}


@lru_cache(maxsize=1)
def get_file_analysis_graph():
    workflow = StateGraph(FileAnalysisState)
    workflow.add_node("extract_document_text", extract_document_node)
    workflow.add_node("analyze_document", analyze_document_node)
    workflow.add_node("analyze_image", analyze_image_node)

    workflow.add_conditional_edges(
        START,
        choose_analysis_route,
        {"document": "extract_document_text", "image": "analyze_image"},
    )
    workflow.add_edge("extract_document_text", "analyze_document")
    workflow.add_edge("analyze_document", END)
    workflow.add_edge("analyze_image", END)
    return workflow.compile()


async def analyze_uploaded_file(
    *,
    content: bytes,
    content_type: str,
    filename: str,
    language: str,
    flow_id: str | None = None,
) -> FileAnalysisState:
    flow_id = flow_id or new_flow_id()
    try:
        result = await get_file_analysis_graph().ainvoke(
            {
                "content": content,
                "content_type": content_type,
                "filename": filename,
                "language": language,
                "flow_id": flow_id,
            }
        )
    except Exception as exc:
        if isinstance(exc, FileAnalysisError):
            failure_detail = str(exc)
        elif isinstance(exc, AIServiceError) and exc.__cause__ is not None:
            failure_detail = summarize_provider_error(exc.__cause__)
        else:
            failure_detail = summarize_provider_error(exc)
        log_flow_event(
            flow_id,
            "WORKFLOW FAILED",
            failure_detail,
        )
        raise

    log_flow_event(flow_id, "WORKFLOW COMPLETE", "AnalysisResult is ready")
    return result
