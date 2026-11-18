"""
test_backend.py — Pruebas automatizadas actualizadas para el backend modular de Órbita
Verifica registro y login (SQLite), salas y agenda dinámica, chat grupal vs aportes oficiales,
y chat con agente para generar y revisar formato estructurado de aporte.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


import uuid

def test_registro_y_login_usuario():
    username = f"test_{uuid.uuid4().hex[:6]}"
    password = "password123"

    res_reg = client.post("/api/auth/registrar", json={
        "username": username,
        "password": password,
        "nombre": "Director de Proyecto",
        "color": "#0ea5e9",
        "rol": "Facilitador",
        "canal_preferido": "texto"
    })
    assert res_reg.status_code == 200
    user_data = res_reg.json()
    assert user_data["username"] == username
    assert user_data["id"].startswith("usr_")

    res_login = client.post("/api/auth/login", json={
        "username": username,
        "password": password
    })
    assert res_login.status_code == 200
    assert res_login.json()["id"] == user_data["id"]


def test_agenda_dinamica():
    res_sala = client.post("/api/salas", json={
        "nombre": "Comité de Arquitectura",
        "agenda": ["Tema 1: Contexto"]
    })
    assert res_sala.status_code == 200
    codigo = res_sala.json()["codigo"]

    res_tema = client.post(f"/api/salas/{codigo}/agenda", json={
        "titulo": "Tema 2: Infraestructura y Escalabilidad"
    })
    assert res_tema.status_code == 200
    assert res_tema.json()["tema"]["titulo"] == "Tema 2: Infraestructura y Escalabilidad"

    res_check = client.get(f"/api/salas/{codigo}")
    assert len(res_check.json()["agenda"]) == 2


def test_chat_simple_y_formato_aporte(monkeypatch):
    from backend.app.llm_service import llm_service
    monkeypatch.setattr(
        llm_service,
        "chat_simple_agente",
        lambda tema_actual, agenda, aportes_previos, mensaje_usuario, historial=None: "Respuesta concisa del agente."
    )
    monkeypatch.setattr(
        llm_service,
        "generar_formato_aporte",
        lambda tema_actual, agenda, aportes_previos, historial_chat, instruccion_adicional="": {
            "titulo": "Optimización de costos",
            "contenido": "Se sugiere reducir el uso de tokens usando solo agenda y aportes.",
            "puntos_clave": ["Contexto acotado", "Bajo consumo"],
            "impacto": "Alto"
        }
    )
    monkeypatch.setattr(
        llm_service,
        "revisar_formato_aporte",
        lambda tema_actual, titulo, contenido, puntos_clave, observacion_usuario="": {
            "aprobado_para_publicar": True,
            "evaluacion": "Formato óptimo.",
            "sugerencia_mejora": contenido
        }
    )

    # 1. Chat simple con el agente
    res_chat = client.post("/api/ia/chat-agente", json={
        "tema_actual": "Costos de IA",
        "agenda": ["Costos de IA"],
        "aportes_previos": [],
        "mensaje_usuario": "¿Cómo optimizamos las llamadas a la API?",
        "historial": []
    })
    assert res_chat.status_code == 200
    assert res_chat.json()["respuesta"] == "Respuesta concisa del agente."

    # 2. Generar formato estructurado editable
    res_formato = client.post("/api/ia/generar-formato-aporte", json={
        "tema_actual": "Costos de IA",
        "agenda": ["Costos de IA"],
        "aportes_previos": [],
        "historial_chat": [{"rol": "user", "contenido": "¿Cómo optimizamos las llamadas?"}]
    })
    assert res_formato.status_code == 200
    assert res_formato.json()["formato"]["titulo"] == "Optimización de costos"

    # 3. Revisar formato con la IA
    res_rev = client.post("/api/ia/revisar-formato-aporte", json={
        "tema_actual": "Costos de IA",
        "titulo_propuesta": "Optimización de costos",
        "contenido_propuesta": "Contenido editado",
        "puntos_clave": ["Punto 1"],
        "observacion_usuario": "¿Está conciso?"
    })
    assert res_rev.status_code == 200
    assert res_rev.json()["revision"]["aprobado_para_publicar"] is True
