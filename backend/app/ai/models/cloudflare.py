from functools import lru_cache

from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.core.settings import settings


@lru_cache(maxsize=2)
def get_cloudflare_model(model_name: str) -> OpenAIChatModel:
    """Create a PydanticAI model client for Cloudflare Workers AI."""
    base_url = (
        "https://api.cloudflare.com/client/v4/accounts/"
        f"{settings.cloudflare_account_id}/ai/v1"
    )
    provider = OpenAIProvider(
        base_url=base_url,
        api_key=settings.cloudflare_api_token,
    )
    return OpenAIChatModel(model_name, provider=provider)


def get_stock_model() -> OpenAIChatModel:
    """Use the configured Cloudflare Workers AI text model for stock research."""
    return get_cloudflare_model(settings.cloudflare_model)
