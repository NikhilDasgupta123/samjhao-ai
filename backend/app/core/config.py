from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    cloudflare_account_id: str
    cloudflare_api_token: str
    cloudflare_model: str = "@cf/meta/llama-3.1-8b-instruct"
    cloudflare_vision_model: str = "@cf/meta/llama-3.2-11b-vision-instruct"

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
