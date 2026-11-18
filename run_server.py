#!/usr/bin/env python3
"""
Launcher para el servidor desacoplado de Órbita v3.0
"""
import uvicorn
from backend.app.config import settings

if __name__ == "__main__":
    print("🪐 Iniciando Órbita v3.0...")
    print(f"📡 API y WebSockets: http://{settings.host}:{settings.port}/api")
    print(f"🌐 Interfaz frontend: http://{settings.host}:{settings.port}/")
    print(f"🤖 Modelo LLM: {settings.gemini_model}")
    uvicorn.run("backend.app.main:app", host=settings.host, port=settings.port, reload=True)
