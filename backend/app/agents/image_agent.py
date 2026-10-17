from functools import lru_cache

from pydantic_ai import Agent, BinaryContent, PromptedOutput

from app.agents.model import get_vision_model
from app.prompts.image_analysis import IMAGE_ANALYSIS_PROMPT
from app.schemas.analyze import AnalysisResult
from app.services.ai_service import AIServiceError


@lru_cache(maxsize=1)
def get_image_agent() -> Agent[None, AnalysisResult]:
    return Agent(
        get_vision_model(),
        output_type=PromptedOutput(AnalysisResult),
        system_prompt=IMAGE_ANALYSIS_PROMPT,
    )


async def analyze_image(
    image: bytes,
    content_type: str,
    language: str,
) -> AnalysisResult:
    try:
        result = await get_image_agent().run(
            [
                f"Analyze this image. Output language: {language}",
                BinaryContent(data=image, media_type=content_type),
            ]
        )
    except Exception as exc:
        raise AIServiceError(
            "Cloudflare Workers AI image analysis failed. Check the Cloudflare "
            "credentials and configured vision model."
        ) from exc

    return result.output
