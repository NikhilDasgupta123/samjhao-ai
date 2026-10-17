from functools import lru_cache

from pydantic_ai import Agent, PromptedOutput

from app.agents.model import get_document_model
from app.prompts.document_analysis import DOCUMENT_ANALYSIS_PROMPT
from app.schemas.analyze import AnalysisResult
from app.services.ai_service import AIServiceError


@lru_cache(maxsize=1)
def get_document_agent() -> Agent[None, AnalysisResult]:
    return Agent(
        get_document_model(),
        output_type=PromptedOutput(AnalysisResult),
        system_prompt=DOCUMENT_ANALYSIS_PROMPT,
    )


async def analyze_document_text(text: str, language: str) -> AnalysisResult:
    try:
        result = await get_document_agent().run(
            f"Output language: {language}\n\nDocument text:\n{text}"
        )
    except Exception as exc:
        raise AIServiceError(
            "Cloudflare Workers AI document analysis failed. Check the Cloudflare "
            "credentials and configured text model."
        ) from exc

    return result.output
