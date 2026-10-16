from functools import lru_cache

from langchain_openai import ChatOpenAI

from app.core.config import settings


@lru_cache(maxsize=1)
def get_llm() -> ChatOpenAI:
    """Create the LangChain chat model configured for Cloudflare Workers AI."""
    base_url = (
        "https://api.cloudflare.com/client/v4/accounts/"
        f"{settings.cloudflare_account_id}/ai/v1"
    )

    return ChatOpenAI(
        model=settings.cloudflare_model,
        api_key=settings.cloudflare_api_token,
        base_url=base_url,
        temperature=0.2,
        max_tokens=2048,
        timeout=60,
        max_retries=0,
        use_responses_api=False,
        model_kwargs={"response_format": {"type": "json_object"}},
    )
