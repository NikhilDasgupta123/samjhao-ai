from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    cloudflare_account_id: str
    cloudflare_api_token: str
    cloudflare_model: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()