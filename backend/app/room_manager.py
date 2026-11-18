"""
room_manager.py — Gestor de estado de salas, participantes, anfitriones y física orbital.
"""

import math
import time
import random
from typing import Dict, List, Optional
from fastapi import WebSocket
from .models import RoomState, AgendaItem, ParticipantState, UserProfile

R_EQ = 140.0
R_MIN = 64.0
R_MAX = 224.0


class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, RoomState] = {}
        self.active_connections: Dict[str, List[WebSocket]] = {}

    def generar_codigo_sala(self) -> str:
        while True:
            num = random.randint(1000, 9999)
            code = f"ORB-{num}"
            if code not in self.rooms:
                return code

    def crear_sala(
        self,
        nombre: str,
        agenda_titulos: List[str],
        estilo_moderacion: str = "suave",
        anfitrion_id: str = "",
        anfitrion_nombre: str = "",
        fecha_programada: str = ""
    ) -> RoomState:
        codigo = self.generar_codigo_sala()
        agenda = [
            AgendaItem(id=f"tema-{i+1}", titulo=tit.strip(), completado=False, orden=i)
            for i, tit in enumerate(agenda_titulos if agenda_titulos else ["Alineación inicial", "Propuestas", "Acuerdos"])
        ]
        sala = RoomState(
            codigo=codigo,
            nombre=nombre,
            anfitrion_id=anfitrion_id,
            anfitrion_nombre=anfitrion_nombre,
            fecha_programada=fecha_programada,
            agenda=agenda,
            tema_idx=0,
            tema_activo=agenda[0] if agenda else None,
            participantes={},
            chat_grupal=[],
            transcripcion=[],
            indice_equilibrio=100
        )
        self.rooms[codigo] = sala
        self.active_connections[codigo] = []
        return sala

    def obtener_sala(self, codigo: str) -> Optional[RoomState]:
        return self.rooms.get(codigo.upper())

    def agregar_tema_agenda(self, codigo: str, titulo: str) -> Optional[AgendaItem]:
        sala = self.obtener_sala(codigo)
        if not sala:
            return None
        nuevo_id = f"tema-{len(sala.agenda) + 1}"
        nuevo_item = AgendaItem(id=nuevo_id, titulo=titulo.strip(), completado=False, orden=len(sala.agenda))
        sala.agenda.append(nuevo_item)
        if not sala.tema_activo:
            sala.tema_activo = nuevo_item
        return nuevo_item

    def unirse_a_sala(self, codigo: str, user: UserProfile) -> Optional[RoomState]:
        codigo = codigo.upper()
        sala = self.obtener_sala(codigo)
        if not sala:
            return None

        es_anfitrion = (user.id == sala.anfitrion_id) or (not sala.anfitrion_id)

        if user.id not in sala.participantes:
            sala.participantes[user.id] = ParticipantState(
                id=user.id,
                nombre=user.nombre,
                color=user.color,
                rol=user.rol,
                canal_preferido=user.canal_preferido,
                es_anfitrion=es_anfitrion,
                segundos_habla=1.0,
                brillo=0.3
            )
        else:
            sala.participantes[user.id].conectado = True
            if es_anfitrion:
                sala.participantes[user.id].es_anfitrion = True

        self.recalcular_orbitas(sala)
        return sala

    def recalcular_orbitas(self, sala: RoomState):
        activos = [p for p in sala.participantes.values() if p.conectado]
        n = len(activos)
        if n == 0:
            sala.indice_equilibrio = 100
            return

        total_segundos = sum(p.segundos_habla for p in activos) or 1.0
        ideal_share = 1.0 / n

        desviaciones = []
        for p in sala.participantes.values():
            if not p.conectado:
                continue
            p.share = p.segundos_habla / total_segundos
            share_seguro = max(p.share, 0.01)

            radio = R_EQ * math.sqrt(ideal_share / share_seguro)
            p.radio_orbita = max(R_MIN, min(R_MAX, radio))
            desviaciones.append(abs(p.share - ideal_share))

            tiempo_inactivo = time.time() - p.ultimo_aporte_ts
            if tiempo_inactivo > 15:
                p.brillo = max(0.2, p.brillo * 0.95)

        desviacion_media = sum(desviaciones) / n
        factor_desbalance = min(1.0, desviacion_media / (1.0 if n == 1 else (1.0 - 1.0/n)))
        sala.indice_equilibrio = max(10, int(100 * (1.0 - factor_desbalance * 0.9)))

    def registrar_aporte(
        self,
        codigo: str,
        user_id: str,
        titulo: str,
        texto: str,
        puntos_clave: List[str] = None,
        impacto: str = "Medio",
        duracion: float = 6.0,
        anonimo: bool = False
    ) -> Dict:
        sala = self.obtener_sala(codigo)
        if not sala:
            return {}

        nombre_hablante = "Aporte anónimo" if anonimo else "Participante"
        p = sala.participantes.get(user_id)
        if p and not anonimo:
            nombre_hablante = p.nombre
            p.segundos_habla += duracion
            p.aportes_conteo += 1
            p.brillo = 1.0
            p.ultimo_aporte_ts = time.time()

        item_aporte = {
            "id": f"ap-{int(time.time()*1000)}",
            "autor_id": "" if anonimo else user_id,
            "nombre": nombre_hablante,
            "color": "#64748b" if anonimo else (p.color if p else "#0ea5e9"),
            "titulo": titulo or "Propuesta",
            "texto": texto,
            "puntos_clave": puntos_clave or [],
            "impacto": impacto,
            "anonimo": anonimo,
            "timestamp": time.time(),
            "tema_id": sala.tema_activo.id if sala.tema_activo else "general"
        }
        sala.transcripcion.append(item_aporte)
        self.recalcular_orbitas(sala)
        return item_aporte

    def registrar_mensaje_chat(self, codigo: str, user_id: str, texto: str) -> Dict:
        sala = self.obtener_sala(codigo)
        if not sala:
            return {}
        p = sala.participantes.get(user_id)
        nombre = p.nombre if p else "Participante"
        color = p.color if p else "#64748b"

        mensaje = {
            "id": f"msg-{int(time.time()*1000)}",
            "autor_id": user_id,
            "nombre": nombre,
            "color": color,
            "texto": texto,
            "timestamp": time.time()
        }
        sala.chat_grupal.append(mensaje)
        return mensaje

    def siguiente_tema(self, codigo: str) -> Optional[AgendaItem]:
        sala = self.obtener_sala(codigo)
        if not sala:
            return None

        if sala.tema_idx < len(sala.agenda) - 1:
            sala.agenda[sala.tema_idx].completado = True
            sala.tema_idx += 1
            sala.tema_activo = sala.agenda[sala.tema_idx]
        else:
            if sala.tema_activo:
                sala.tema_activo.completado = True
            sala.cerrada = True

        return sala.tema_activo

    async def conectar_ws(self, codigo: str, websocket: WebSocket):
        await websocket.accept()
        if codigo not in self.active_connections:
            self.active_connections[codigo] = []
        self.active_connections[codigo].append(websocket)

    def desconectar_ws(self, codigo: str, websocket: WebSocket):
        if codigo in self.active_connections and websocket in self.active_connections[codigo]:
            self.active_connections[codigo].remove(websocket)

    async def emitir_evento(self, codigo: str, tipo_evento: str, datos: Dict):
        if codigo in self.active_connections:
            mensaje = {"tipo": tipo_evento, "datos": datos, "ts": time.time()}
            desconectados = []
            for ws in self.active_connections[codigo]:
                try:
                    await ws.send_json(mensaje)
                except Exception:
                    desconectados.append(ws)
            for ws in desconectados:
                self.desconectar_ws(codigo, ws)


room_manager = RoomManager()
