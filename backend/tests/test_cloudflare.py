import httpx

from app.core.config import settings


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
    "messages": [
        {
            "role": "system",
            "content": "You are a helpful assistant."
        },
        {
            "role": "user",
            "content": "Explain electricity bill in one simple sentence."
        }
    ]
}

response = httpx.post(
    url,
    headers=headers,
    json=payload,
    timeout=60
)

print("Status:", response.status_code)
print(response.json())