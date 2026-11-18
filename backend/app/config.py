"""
config.py — Configuración global del backend de Órbita
Centraliza variables de entorno, claves de API y modelos de LLM.
"""

import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    app_name: str = "Órbita API"
    app_version: str = "3.0.0"
    gemini_api_key: str = Field(
        default_factory=lambda: os.getenv("GEMINI_API_KEY", "")
    )
    gemini_model: str = Field(
        default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    )
    cors_origins: list[str] = ["*"]
    host: str = "0.0.0.0"
    port: int = 8000


settings = Settings()
