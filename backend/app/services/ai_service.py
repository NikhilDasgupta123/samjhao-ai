import json

import httpx

from app.core.config import settings


class AIServiceError(Exception):
    pass


async def generate_ai_response(messages: list[dict]) -> str:
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/"
        f"{settings.cloudflare_account_id}/ai/run/"
        f"{settings.cloudflare_model}"
    )

    headers = {
        "Authorization": f"Bearer {settings.cloudflare_api_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "messages": messages,
        "temperature": 0.2,
        "response_format": {
            "type": "json_object"
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
            )

            response.raise_for_status()

    except httpx.HTTPError as exc:
        raise AIServiceError(
            f"Cloudflare AI request failed: {exc}"
        ) from exc

    data = response.json()

    if not data.get("success"):
        raise AIServiceError(
            f"Cloudflare AI returned an error: {data.get('errors')}"
        )

    result = data.get("result", {})

    generated_text = result.get("response")

    # Fallback for models that return choices
    if not generated_text:
        choices = result.get("choices", [])

        if choices:
            generated_text = (
                choices[0]
                .get("message", {})
                .get("content")
            )

    if generated_text is None:
        raise AIServiceError(
            "Cloudflare AI returned an empty response."
        )

    # JSON mode may sometimes return dict directly
    if isinstance(generated_text, (dict, list)):
        return json.dumps(
            generated_text,
            ensure_ascii=False
        )

    return str(generated_text).strip()