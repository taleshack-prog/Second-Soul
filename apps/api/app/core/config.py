"""Configuração central da API Second Soul."""

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    # App
    APP_NAME: str = "Second Soul API"
    VERSION: str = "0.1.0"
    DEBUG: bool = True
    ENVIRONMENT: Literal["dev", "staging", "prod"] = "dev"
    FRONTEND_URL: str = "http://localhost:3000"  # <- faltava na spec; main.py quebrava sem isto

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/secondsoul"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # AWS
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_CONTENT: str = "secondsoul-content"
    S3_BUCKET_MODELS: str = "secondsoul-models"

    # AI Providers
    GROQ_API_KEY: str = ""
    # IMPORTANTE: llama3-70b-8192 foi DESCOMISSIONADO na Groq (retorna 400).
    # llama-3.3-70b-versatile também está em depreciação (jun/2026).
    # Default seguro atual: gpt-oss-120b (open-weight, produção). Troque via .env.
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    ELEVENLABS_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Blockchain
    STELLAR_NETWORK: str = "testnet"
    STELLAR_HORIZON_URL: str = "https://horizon-testnet.stellar.org"

    # Pricing (BRL)
    PREMIUM_PRICE: float = 29.0
    VITALICIO_PRICE: float = 1497.0
    HERANCA_PRICE: float = 4997.0

    # Limits
    FREEMIUM_INTERACTIONS_MONTHLY: int = 50
    MAX_CONTENT_SIZE_MB: int = 500
    MAX_FAMILY_MEMBERS: int = 20


settings = Settings()
