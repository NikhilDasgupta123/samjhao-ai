import json

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from app.prompts.samjhao_prompt import SAMJHAO_SYSTEM_PROMPT
from app.schemas.analyze import AnalyzeRequest
from app.services.ai_service import AIServiceError, get_llm


ANALYSIS_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", "{system_prompt}"),
        ("human", "Output language: {language}\n\nContent:\n{text}"),
    ]
)
ANALYSIS_CHAIN = ANALYSIS_PROMPT | get_llm() | StrOutputParser()


async def analyze_text(request: AnalyzeRequest) -> dict:
    try:
        ai_response = await ANALYSIS_CHAIN.ainvoke(
            {
                "system_prompt": SAMJHAO_SYSTEM_PROMPT,
                "language": request.language,
                "text": request.text,
            }
        )
    except Exception as exc:
        raise AIServiceError(
            f"Cloudflare AI request failed: {exc}"
        ) from exc

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
