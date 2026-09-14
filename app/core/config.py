"""
app/core/config.py — OpRail Application Settings
Reads from .env file via pydantic-settings.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database — defaults to SQLite for zero-setup dev; switch to PG in .env
    DATABASE_URL: str = "sqlite:///./oprail.db"

    # Gemini (optional — templated fallback used when empty)
    GEMINI_API_KEY: str = ""

    # App
    SECRET_KEY: str = "dev-secret-key"
    ENVIRONMENT: str = "development"

    # Priority engine weights (tunable via .env)
    SEVERITY_WEIGHT: float = 0.40
    OVERDUE_WEIGHT: float = 0.30
    TRAIN_DENSITY_WEIGHT: float = 0.15
    ASSET_CRITICALITY_WEIGHT: float = 0.15

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.GEMINI_API_KEY and self.GEMINI_API_KEY != "your_gemini_api_key_here")


settings = Settings()
