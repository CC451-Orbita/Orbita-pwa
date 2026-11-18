"""
models.py — Esquemas de datos Pydantic para Órbita v3.0
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import time


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=4, max_length=64)
    nombre: str = Field(..., min_length=2, max_length=50)
    color: str = Field(default="#0ea5e9")
    rol: str = Field(default="Participante")
    canal_preferido: str = Field(default="texto")


class UserLogin(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=4, max_length=64)


class UserProfile(BaseModel):
    id: str
    username: str
    nombre: str
    color: str
    rol: str
    canal_preferido: str


class AgendaItem(BaseModel):
    id: str
    titulo: str
    completado: bool = False
    orden: int = 0


class AgendaAddRequest(BaseModel):
    titulo: str = Field(..., min_length=2, max_length=120)


class RoomCreate(BaseModel):
    nombre: str = Field(..., min_length=3, max_length=100)
    agenda: List[str] = Field(default_factory=lambda: ["Alineación inicial", "Desarrollo y propuestas", "Acuerdos y cierre"])
    estilo_moderacion: str = Field(default="suave")
    fecha_programada: Optional[str] = ""
    anfitrion_id: Optional[str] = ""
    anfitrion_nombre: Optional[str] = ""


class SaveMeetingLinkRequest(BaseModel):
    codigo: str
    nombre: str
    confirmado: bool = True


class SpeechPlanRequest(BaseModel):
    speech: str


class SpeechAssistRequest(BaseModel):
    nombre_reunion: str = ""
    temas_agenda: List[str] = Field(default_factory=list)
    speech_actual: str = ""
    solicitud: str = ""  # ej: "Estructurar en 3 puntos", "Hacerlo más conciso", etc.
    objetivo_intervencion: Optional[str] = ""


class ChatMessageCreate(BaseModel):
    texto: str = Field(..., min_length=1, max_length=500)


class ContributionCreate(BaseModel):
    titulo: str = Field(default="Propuesta")
    texto: str = Field(..., min_length=1, max_length=2000)
    puntos_clave: List[str] = Field(default_factory=list)
    impacto_estimado: str = Field(default="Medio")
    anonimo: bool = False
    duracion_segundos: float = 6.0


class InviteParticipantRequest(BaseModel):
    participante_id: str
    participante_nombre: str
    tema_titulo: str


class AgentChatRequest(BaseModel):
    tema_actual: str
    agenda: List[str] = Field(default_factory=list)
    aportes_previos: List[str] = Field(default_factory=list)
    mensaje_usuario: str
    historial: List[Dict[str, str]] = Field(default_factory=list)


class GenerateContributionFormatRequest(BaseModel):
    tema_actual: str
    agenda: List[str] = Field(default_factory=list)
    aportes_previos: List[str] = Field(default_factory=list)
    historial_chat: List[Dict[str, str]] = Field(default_factory=list)
    instruccion_adicional: Optional[str] = ""


class ReviewContributionFormatRequest(BaseModel):
    tema_actual: str
    titulo_propuesta: str
    contenido_propuesta: str
    puntos_clave: List[str] = Field(default_factory=list)
    observacion_usuario: Optional[str] = ""


class ParticipantState(BaseModel):
    id: str
    nombre: str
    color: str
    rol: str
    canal_preferido: str
    es_anfitrion: bool = False
    segundos_habla: float = 0.0
    aportes_conteo: int = 0
    mano_levantada: bool = False
    mic_activo: bool = False
    cam_activa: bool = False
    conectado: bool = True
    share: float = 0.0
    radio_orbita: float = 140.0
    brillo: float = 0.3
    ultimo_aporte_ts: float = Field(default_factory=time.time)


class RoomState(BaseModel):
    codigo: str
    nombre: str
    anfitrion_id: str = ""
    anfitrion_nombre: str = ""
    fecha_programada: str = ""
    agenda: List[AgendaItem]
    tema_idx: int = 0
    tema_activo: Optional[AgendaItem] = None
    participantes: Dict[str, ParticipantState] = Field(default_factory=dict)
    chat_grupal: List[Dict[str, Any]] = Field(default_factory=list)
    transcripcion: List[Dict[str, Any]] = Field(default_factory=list)
    indice_equilibrio: int = 100
    creado_en: float = Field(default_factory=time.time)
    cerrada: bool = False


class SummaryPromptRequest(BaseModel):
    nombre_sala: str
    temas: List[str]
    transcripcion: List[Dict[str, Any]]
