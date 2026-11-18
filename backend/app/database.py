"""
database.py — Base de datos SQLite simple y persistente para autenticación de usuarios,
reuniones creadas, enlaces guardados y confirmación de asistencia.
"""

import sqlite3
import hashlib
import os
import uuid
import json
from typing import Optional, Dict, List

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../orbita.db"))


def obtener_conexion():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def inicializar_bd():
    with obtener_conexion() as conn:
        # Tabla de usuarios
        conn.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                nombre TEXT NOT NULL,
                color TEXT NOT NULL,
                rol TEXT NOT NULL DEFAULT 'Participante',
                canal_preferido TEXT NOT NULL DEFAULT 'texto',
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Tabla de reuniones programadas o creadas
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reuniones (
                codigo TEXT PRIMARY KEY,
                nombre TEXT NOT NULL,
                anfitrion_id TEXT NOT NULL,
                anfitrion_nombre TEXT NOT NULL,
                fecha_programada TEXT,
                agenda_json TEXT NOT NULL,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Tabla de reuniones guardadas o con asistencia confirmada
        conn.execute("""
            CREATE TABLE IF NOT EXISTS asistencias (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                codigo_sala TEXT NOT NULL,
                nombre_sala TEXT NOT NULL,
                es_anfitrion BOOLEAN DEFAULT 0,
                confirmado BOOLEAN DEFAULT 1,
                speech_planificado TEXT DEFAULT '',
                fecha_guardado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, codigo_sala)
            )
        """)
        conn.commit()


def hashear_password(password: str, salt: str) -> str:
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()


def registrar_usuario_bd(username: str, password: str, nombre: str, color: str, rol: str = "Participante", canal: str = "texto") -> Dict:
    username = username.strip().lower()
    salt = uuid.uuid4().hex[:16]
    pw_hash = hashear_password(password, salt)
    user_id = f"usr_{uuid.uuid4().hex[:8]}"

    with obtener_conexion() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM usuarios WHERE username = ?", (username,))
        if cursor.fetchone():
            raise ValueError("El nombre de usuario ya está registrado.")

        cursor.execute("""
            INSERT INTO usuarios (id, username, password_hash, salt, nombre, color, rol, canal_preferido)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, username, pw_hash, salt, nombre.strip(), color, rol, canal))
        conn.commit()

    return {
        "id": user_id,
        "username": username,
        "nombre": nombre.strip(),
        "color": color,
        "rol": rol,
        "canal_preferido": canal
    }


def autenticar_usuario_bd(username: str, password: str) -> Optional[Dict]:
    username = username.strip().lower()
    with obtener_conexion() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM usuarios WHERE username = ?", (username,))
        row = cursor.fetchone()
        if not row:
            return None

        pw_hash = hashear_password(password, row["salt"])
        if pw_hash != row["password_hash"]:
            return None

        return {
            "id": row["id"],
            "username": row["username"],
            "nombre": row["nombre"],
            "color": row["color"],
            "rol": row["rol"],
            "canal_preferido": row["canal_preferido"]
        }


def guardar_reunion_bd(codigo: str, nombre: str, anfitrion_id: str, anfitrion_nombre: str, agenda: List[str], fecha_programada: str = ""):
    with obtener_conexion() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO reuniones (codigo, nombre, anfitrion_id, anfitrion_nombre, fecha_programada, agenda_json)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (codigo, nombre, anfitrion_id, anfitrion_nombre, fecha_programada, json.dumps(agenda)))

        # Se registra automáticamente como anfitrión de su reunión
        conn.execute("""
            INSERT OR REPLACE INTO asistencias (id, user_id, codigo_sala, nombre_sala, es_anfitrion, confirmado)
            VALUES (?, ?, ?, ?, 1, 1)
        """, (f"asist_{uuid.uuid4().hex[:8]}", anfitrion_id, codigo, nombre))
        conn.commit()


def guardar_enlace_o_asistencia_bd(user_id: str, codigo_sala: str, nombre_sala: str, confirmado: bool = True):
    with obtener_conexion() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO asistencias (id, user_id, codigo_sala, nombre_sala, confirmado)
            VALUES (?, ?, ?, ?, ?)
        """, (f"asist_{uuid.uuid4().hex[:8]}", user_id, codigo_sala, nombre_sala, 1 if confirmado else 0))
        conn.commit()


def listar_reuniones_usuario_bd(user_id: str) -> List[Dict]:
    with obtener_conexion() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.codigo_sala, a.nombre_sala, a.es_anfitrion, a.confirmado, a.speech_planificado,
                   r.fecha_programada, r.anfitrion_nombre, r.agenda_json
            FROM asistencias a
            LEFT JOIN reuniones r ON a.codigo_sala = r.codigo
            WHERE a.user_id = ?
            ORDER BY a.fecha_guardado DESC
        """, (user_id,))
        filas = cursor.fetchall()
        resultado = []
        for f in filas:
            agenda = []
            if f["agenda_json"]:
                try:
                    agenda = json.loads(f["agenda_json"])
                except Exception:
                    agenda = []
            resultado.append({
                "codigo": f["codigo_sala"],
                "nombre": f["nombre_sala"],
                "es_anfitrion": bool(f["es_anfitrion"]),
                "confirmado": bool(f["confirmado"]),
                "speech_planificado": f["speech_planificado"] or "",
                "fecha_programada": f["fecha_programada"] or "Pendiente de inicio",
                "anfitrion_nombre": f["anfitrion_nombre"] or "Facilitador",
                "agenda": agenda
            })
        return resultado


def guardar_speech_reunion_bd(user_id: str, codigo_sala: str, speech: str):
    with obtener_conexion() as conn:
        conn.execute("""
            UPDATE asistencias SET speech_planificado = ?
            WHERE user_id = ? AND codigo_sala = ?
        """, (speech, user_id, codigo_sala))
        conn.commit()


inicializar_bd()
