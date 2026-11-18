"""
main.py — Servidor principal FastAPI para Órbita v3.0
Endpoints REST para autenticación SQLite, salas, agenda, enlaces guardados,
confirmación de asistencia, planificación de speech, chat grupal, agente de IA y WebSockets.
"""

import os
from typing import List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings
from .models import (
    UserRegister, UserLogin, UserProfile, RoomCreate, RoomState,
    ContributionCreate, ChatMessageCreate, AgentChatRequest, AgendaAddRequest,
    SaveMeetingLinkRequest, SpeechPlanRequest, SpeechAssistRequest, InviteParticipantRequest,
    GenerateContributionFormatRequest, ReviewContributionFormatRequest,
    SummaryPromptRequest
)
from .database import (
    registrar_usuario_bd, autenticar_usuario_bd, guardar_reunion_bd,
    guardar_enlace_o_asistencia_bd, listar_reuniones_usuario_bd, guardar_speech_reunion_bd
)
from .room_manager import room_manager
from .llm_service import llm_service

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Backend modular de Órbita: deliberación equilibrada, reuniones programadas y moderación de anfitriones."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------
# RUTAS DE AUTENTICACIÓN
# -------------------------------------------------------------
@app.post("/api/auth/registrar", response_model=UserProfile)
def auth_registrar(datos: UserRegister):
    try:
        user = registrar_usuario_bd(
            username=datos.username,
            password=datos.password,
            nombre=datos.nombre,
            color=datos.color,
            rol=datos.rol,
            canal=datos.canal_preferido
        )
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/login", response_model=UserProfile)
def auth_login(datos: UserLogin):
    user = autenticar_usuario_bd(datos.username, datos.password)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    return user


# -------------------------------------------------------------
# GESTIÓN DE REUNIONES PENDIENTES, ENLACES Y PLANIFICACIÓN DE SPEECH
# -------------------------------------------------------------
@app.get("/api/usuarios/{user_id}/reuniones")
def obtener_reuniones_usuario(user_id: str):
    return listar_reuniones_usuario_bd(user_id)


@app.post("/api/usuarios/{user_id}/reuniones/guardar")
def guardar_enlace_reunion(user_id: str, datos: SaveMeetingLinkRequest):
    guardar_enlace_o_asistencia_bd(user_id, datos.codigo.upper(), datos.nombre, datos.confirmado)
    return {"status": "ok"}


@app.post("/api/usuarios/{user_id}/reuniones/{codigo}/speech")
def guardar_speech_planificado(user_id: str, codigo: str, datos: SpeechPlanRequest):
    guardar_speech_reunion_bd(user_id, codigo.upper(), datos.speech)
    return {"status": "ok"}


# -------------------------------------------------------------
# RUTAS DE SALAS Y AGENDA
# -------------------------------------------------------------
@app.post("/api/salas", response_model=RoomState)
def crear_sala(datos: RoomCreate):
    sala = room_manager.crear_sala(
        nombre=datos.nombre,
        agenda_titulos=datos.agenda,
        estilo_moderacion=datos.estilo_moderacion,
        anfitrion_id=datos.anfitrion_id or "",
        anfitrion_nombre=datos.anfitrion_nombre or "",
        fecha_programada=datos.fecha_programada or ""
    )

    if datos.anfitrion_id:
        guardar_reunion_bd(
            codigo=sala.codigo,
            nombre=sala.nombre,
            anfitrion_id=datos.anfitrion_id,
            anfitrion_nombre=datos.anfitrion_nombre or "Facilitador",
            agenda=datos.agenda,
            fecha_programada=datos.fecha_programada or ""
        )

    return sala


@app.get("/api/salas", response_model=List[Dict[str, Any]])
def listar_salas():
    return [
        {
            "codigo": r.codigo,
            "nombre": r.nombre,
            "anfitrion_nombre": r.anfitrion_nombre,
            "fecha_programada": r.fecha_programada,
            "participantes_conteo": len([p for p in r.participantes.values() if p.conectado]),
            "tema_activo": r.tema_activo.titulo if r.tema_activo else "General",
            "indice_equilibrio": r.indice_equilibrio
        }
        for r in room_manager.rooms.values()
    ]


@app.get("/api/salas/{codigo}", response_model=RoomState)
def obtener_sala(codigo: str):
    sala = room_manager.obtener_sala(codigo)
    if not sala:
        raise HTTPException(status_code=404, detail="Sala no encontrada")
    return sala


@app.post("/api/salas/{codigo}/agenda")
async def agregar_tema_agenda(codigo: str, datos: AgendaAddRequest):
    sala = room_manager.obtener_sala(codigo)
    if not sala:
        raise HTTPException(status_code=404, detail="Sala no encontrada")

    nuevo_tema = room_manager.agregar_tema_agenda(codigo, datos.titulo)
    await room_manager.emitir_evento(codigo, "agenda_actualizada", {
        "agenda": [item.model_dump() for item in sala.agenda],
        "nuevo_tema": nuevo_tema.model_dump() if nuevo_tema else None
    })
    return {"status": "ok", "tema": nuevo_tema}


@app.post("/api/salas/{codigo}/unirse", response_model=RoomState)
async def unirse_a_sala(codigo: str, datos_user: UserProfile):
    sala = room_manager.unirse_a_sala(codigo, datos_user)
    if not sala:
        raise HTTPException(status_code=404, detail="Sala no encontrada")

    # Guardar en su historial local de usuario
    guardar_enlace_o_asistencia_bd(datos_user.id, codigo.upper(), sala.nombre, confirmado=True)

    await room_manager.emitir_evento(codigo, "participante_ingreso", {
        "participante": sala.participantes[datos_user.id].model_dump(),
        "indice_equilibrio": sala.indice_equilibrio
    })
    return sala


# -------------------------------------------------------------
# FUNCIÓN EXCLUSIVA DEL ANFITRIÓN: INVITAR A PARTICIPAR
# -------------------------------------------------------------
@app.post("/api/salas/{codigo}/invitar-participante")
async def invitar_participante(codigo: str, anfitrion_id: str, datos: InviteParticipantRequest):
    sala = room_manager.obtener_sala(codigo)
    if not sala:
        raise HTTPException(status_code=404, detail="Sala no encontrada")

    # Validar que quien invoca sea anfitrión (ya sea registrado en sala o por anfitrion_id)
    solicitante = sala.participantes.get(anfitrion_id)
    es_anfitrion = (solicitante and solicitante.es_anfitrion) or (sala.anfitrion_id == anfitrion_id)
    if not es_anfitrion:
        raise HTTPException(status_code=403, detail="Solo los anfitriones de la sala pueden invitar a participar.")

    nombre_anfitrion = solicitante.nombre if solicitante else (sala.anfitrion_nombre or "Anfitrión")

    # Emitir evento privado por WebSocket dirigido al participante invitado
    await room_manager.emitir_evento(codigo, "invitacion_anfitrion", {
        "destinatario_id": datos.participante_id,
        "destinatario_nombre": datos.participante_nombre,
        "anfitrion_nombre": nombre_anfitrion,
        "tema_titulo": datos.tema_titulo
    })
    return {"status": "ok", "mensaje": "Invitación enviada en privado."}


# -------------------------------------------------------------
# CHAT GRUPAL VS. APORTES OFICIALES
# -------------------------------------------------------------
@app.post("/api/salas/{codigo}/chat")
async def enviar_mensaje_chat_grupal(codigo: str, user_id: str, datos: ChatMessageCreate):
    sala = room_manager.obtener_sala(codigo)
    if not sala:
        raise HTTPException(status_code=404, detail="Sala no encontrada")

    mensaje = room_manager.registrar_mensaje_chat(codigo, user_id, datos.texto)
    await room_manager.emitir_evento(codigo, "nuevo_mensaje_chat", {
        "mensaje": mensaje
    })
    return {"status": "ok", "mensaje": mensaje}


@app.post("/api/salas/{codigo}/aportes")
async def registrar_aporte(codigo: str, user_id: str, datos: ContributionCreate):
    sala = room_manager.obtener_sala(codigo)
    if not sala:
        raise HTTPException(status_code=404, detail="Sala no encontrada")

    aporte = room_manager.registrar_aporte(
        codigo=codigo,
        user_id=user_id,
        titulo=datos.titulo,
        texto=datos.texto,
        puntos_clave=datos.puntos_clave,
        impacto=datos.impacto_estimado,
        duracion=datos.duracion_segundos,
        anonimo=datos.anonimo
    )

    await room_manager.emitir_evento(codigo, "nuevo_aporte", {
        "aporte": aporte,
        "participantes": [p.model_dump() for p in sala.participantes.values()],
        "indice_equilibrio": sala.indice_equilibrio
    })
    return {"status": "ok", "aporte": aporte}


@app.post("/api/salas/{codigo}/siguiente-tema")
async def avanzar_siguiente_tema(codigo: str):
    sala = room_manager.obtener_sala(codigo)
    if not sala:
        raise HTTPException(status_code=404, detail="Sala no encontrada")

    nuevo_tema = room_manager.siguiente_tema(codigo)
    await room_manager.emitir_evento(codigo, "cambio_tema", {
        "tema_activo": nuevo_tema.model_dump() if nuevo_tema else None,
        "cerrada": sala.cerrada
    })
    return {"status": "ok", "tema_activo": nuevo_tema, "cerrada": sala.cerrada}


# -------------------------------------------------------------
# CHAT Y FORMATO EDITABLE CON AGENTE DE IA (GEMINI 3.8 FLASH)
# -------------------------------------------------------------
@app.post("/api/ia/chat-agente")
def chat_simple_con_agente(datos: AgentChatRequest):
    respuesta = llm_service.chat_simple_agente(
        tema_actual=datos.tema_actual,
        agenda=datos.agenda,
        aportes_previos=datos.aportes_previos,
        mensaje_usuario=datos.mensaje_usuario,
        historial=datos.historial
    )
    return {"status": "ok", "respuesta": respuesta}


@app.post("/api/ia/generar-formato-aporte")
def generar_formato_aporte(datos: GenerateContributionFormatRequest):
    formato = llm_service.generar_formato_aporte(
        tema_actual=datos.tema_actual,
        agenda=datos.agenda,
        aportes_previos=datos.aportes_previos,
        historial_chat=datos.historial_chat,
        instruccion_adicional=datos.instruccion_adicional
    )
    return {"status": "ok", "formato": formato}


@app.post("/api/ia/revisar-formato-aporte")
def revisar_formato_aporte(datos: ReviewContributionFormatRequest):
    revision = llm_service.revisar_formato_aporte(
        tema_actual=datos.tema_actual,
        titulo=datos.titulo_propuesta,
        contenido=datos.contenido_propuesta,
        puntos_clave=datos.puntos_clave,
        observacion_usuario=datos.observacion_usuario
    )
    return {"status": "ok", "revision": revision}


@app.post("/api/ia/asistir-speech")
def asistir_speech_preparacion(datos: SpeechAssistRequest):
    resultado = llm_service.asistir_speech_preparacion(
        nombre_reunion=datos.nombre_reunion,
        temas_agenda=datos.temas_agenda,
        speech_actual=datos.speech_actual,
        solicitud=datos.solicitud,
        objetivo=datos.objetivo_intervencion or ""
    )
    return {"status": "ok", "asistencia": resultado}


@app.post("/api/ia/minuta")
def generar_minuta_reunion(req: SummaryPromptRequest):
    minuta = llm_service.generar_minuta_reunion(
        nombre_sala=req.nombre_sala,
        temas=req.temas,
        transcripcion=req.transcripcion
    )
    return {"status": "ok", "minuta": minuta}


# -------------------------------------------------------------
# WEBSOCKET MULTIUSUARIO EN TIEMPO REAL
# -------------------------------------------------------------
@app.websocket("/ws/sala/{codigo}")
async def websocket_sala(websocket: WebSocket, codigo: str):
    codigo = codigo.upper()
    await room_manager.conectar_ws(codigo, websocket)
    try:
        while True:
            datos = await websocket.receive_json()
            tipo = datos.get("tipo")
            payload = datos.get("datos", {})

            if tipo == "alternar_mano":
                user_id = payload.get("user_id")
                sala = room_manager.obtener_sala(codigo)
                if sala and user_id in sala.participantes:
                    p = sala.participantes[user_id]
                    p.mano_levantada = not p.mano_levantada
                    await room_manager.emitir_evento(codigo, "estado_mano", {
                        "user_id": user_id,
                        "mano_levantada": p.mano_levantada
                    })
    except WebSocketDisconnect:
        room_manager.desconectar_ws(codigo, websocket)


# -------------------------------------------------------------
# SERVIDO ESTÁTICO DE FRONTEND
# -------------------------------------------------------------
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend"))
if os.path.isdir(frontend_dir):
    app.mount("/vendor", StaticFiles(directory=os.path.join(frontend_dir, "vendor")), name="vendor")
    app.mount("/js", StaticFiles(directory=os.path.join(frontend_dir, "js")), name="js")
    app.mount("/css", StaticFiles(directory=os.path.join(frontend_dir, "css")), name="css")
    app.mount("/icons", StaticFiles(directory=os.path.join(frontend_dir, "icons")), name="icons")

    @app.get("/")
    def index_page():
        return FileResponse(os.path.join(frontend_dir, "index.html"))
