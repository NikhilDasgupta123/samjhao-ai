import json

from app.prompts.samjhao_prompt import SAMJHAO_SYSTEM_PROMPT
from app.schemas.analyze import AnalyzeRequest
from app.services.ai_service import (
    AIServiceError,
    generate_ai_response,
)


async def analyze_text(request: AnalyzeRequest) -> dict:
    messages = [
        {
            "role": "system",
            "content": SAMJHAO_SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": (
                f"Output language: {request.language}\n\n"
                f"Content:\n{request.text}"
            ),
        },
    ]

    ai_response = await generate_ai_response(messages)

    print("RAW AI RESPONSE:", ai_response)

    try:
        result = json.loads(ai_response)

    except json.JSONDecodeError as exc:
        raise AIServiceError(
            f"AI returned invalid JSON: {ai_response}"
        ) from exc

    return {
        "status": "success",
        "language": request.language,
        "summary": result.get("summary", ""),
        "actions": result.get("actions", []),
        "dates": result.get("dates", []),
        "amounts": result.get("amounts", []),
        "warnings": result.get("warnings", []),
        "evidence": result.get("evidence", []),
    }