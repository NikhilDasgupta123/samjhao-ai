from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    cloudflare_account_id: str | None = None
    cloudflare_api_token: str | None = None
    cloudflare_model: str = "@cf/meta/llama-3.1-8b-instruct"
    ai_service_url: str = "http://127.0.0.1:8001"
    ai_service_timeout_seconds: int = Field(default=180, ge=1, le=600)
    database_url: str = "postgresql+psycopg://samjhao:samjhao_local_dev@127.0.0.1:5432/samjhao"
    auth_cookie_name: str = "samjhao_session"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: str = "lax"
    auth_session_days: int = Field(default=14, ge=1)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @model_validator(mode="after")
    def validate_cookie_settings(self):
        value = self.auth_cookie_samesite.lower()
        if value not in {"lax", "strict", "none"}:
            raise ValueError("AUTH_COOKIE_SAMESITE must be lax, strict, or none")
        if value == "none" and not self.auth_cookie_secure:
            raise ValueError("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAMESITE=none")
        return self

    @property
    def auth_cookie_samesite_value(self) -> str:
        return self.auth_cookie_samesite.lower()

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
