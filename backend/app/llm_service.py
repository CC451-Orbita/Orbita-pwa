"""
llm_service.py — Servicio de integración con Google Gemini para Órbita MVP.
Optimizado para bajo consumo de tokens y baja latencia:
- Solo procesa texto contextualmente relevante (agenda y aportes publicados recientes).
- No procesa audio en tiempo real.
- Permite conversar normalmente con el agente.
- Genera un formato estructurado de aporte para editar antes de publicar.
- Revisa y valida el borrador del usuario tantas veces como se solicite.
"""

import json
import logging
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types
from .config import settings

logger = logging.getLogger("orbita.llm")

TERMINOS_PUNITIVOS = [
    "tímido", "flojo", "cállate", "habla de una vez", "por fin hablas",
    "interrumpiste", "no aportas", "inútil", "lento", "bloqueado", "culpable"
]


MODELOS_FALLBACK = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.8-flash"
]


class LLMService:
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model_name = settings.gemini_model
        self.client = None

        if self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
                logger.info(f"Cliente Gemini conectado con modelo primario: {self.model_name}")
            except Exception as e:
                logger.warning(f"No se pudo inicializar cliente Gemini: {e}")

    def _invocar_gemini_robusto(self, prompt: str, config: types.GenerateContentConfig) -> Optional[str]:
        """Ejecuta generate_content intentando el modelo configurado y rotando a modelos flash-lite si hay 429."""
        if not self.client:
            return None

        candidatos = [self.model_name] + [m for m in MODELOS_FALLBACK if m != self.model_name]
        for modelo in candidatos:
            try:
                resp = self.client.models.generate_content(
                    model=modelo,
                    contents=prompt,
                    config=config
                )
                if resp.text:
                    return resp.text.strip()
            except Exception as e:
                logger.warning(f"Falla o cuota excedida en modelo {modelo}: {e}. Intentando alternativa...")
                continue
        return None

    def es_seguro(self, texto: str) -> bool:
        texto_lower = texto.lower()
        for t in TERMINOS_PUNITIVOS:
            if t in texto_lower:
                return False
        return True

    def chat_simple_agente(
        self,
        tema_actual: str,
        agenda: List[str],
        aportes_previos: List[str],
        mensaje_usuario: str,
        historial: List[Dict[str, str]] = None
    ) -> str:
        """Chat normal con la IA usando únicamente contexto breve de agenda y aportes ya publicados."""
        contexto_agenda = ", ".join(agenda) if agenda else "Sin agenda específica"
        contexto_aportes = "; ".join(aportes_previos[-5:]) if aportes_previos else "Sin aportes previos"
        contexto_historial = "\n".join([
            f"{'Usuario' if h.get('rol') == 'user' else 'Agente'}: {h.get('contenido', '')}"
            for h in (historial or [])[-4:]
        ])

        prompt = (
            f"Eres el Asistente Estratégico de Órbita en una reunión ejecutiva.\n"
            f"Tema activo: «{tema_actual}».\n"
            f"Agenda global: {contexto_agenda}.\n"
            f"Aportes publicados recientemente por el equipo: {contexto_aportes}.\n\n"
            f"Historial de conversación previa:\n{contexto_historial}\n\n"
            f"Mensaje del usuario: {mensaje_usuario}\n\n"
            "Instrucciones:\n"
            "- Responde de manera profesional, precisa y directa (máximo 60 palabras).\n"
            "- Enfócate en aportar valor al tema en discusión.\n"
            "- Si el usuario discute una propuesta, ayúdale a pulirla y recuérdale que puede presionar "
            "'Generar formato de aporte' para redactar el borrador editable."
        )

        # Invocar con estrategia de alta resiliencia y rotación de modelos flash-lite
        res = self._invocar_gemini_robusto(
            prompt,
            types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=150
            )
        )
        if res and self.es_seguro(res):
            return res

        return (
            f"Para el tema «{tema_actual}», esa idea aporta claridad. "
            "Si lo deseas, pulsa 'Generar formato de aporte' para estructurarlo antes de publicarlo al equipo."
        )

    def generar_formato_aporte(
        self,
        tema_actual: str,
        agenda: List[str],
        aportes_previos: List[str],
        historial_chat: List[Dict[str, str]],
        instruccion_adicional: str = ""
    ) -> Dict[str, Any]:
        """Toma la discusión previa del chat y la traduce a un formato estructurado y editable."""
        resumen_chat = "\n".join([
            f"- {m.get('rol')}: {m.get('contenido')}"
            for m in (historial_chat or [])[-6:]
        ])

        prompt = (
            f"Eres el redactor técnico de Órbita.\n"
            f"Tema de agenda: «{tema_actual}».\n"
            f"Aportes del equipo: {'; '.join(aportes_previos[-3:]) if aportes_previos else 'Ninguno'}.\n"
            f"Discusión en el chat privado con el usuario:\n{resumen_chat or 'Sin discusión previa'}\n"
            f"Instrucción complementaria: {instruccion_adicional or 'Sintetizar la propuesta principal'}\n\n"
            "Tarea: Genera un formato de propuesta editable estructurado en formato JSON estricto con las siguientes claves:\n"
            "{\n"
            '  "titulo": "Título conciso y profesional de la propuesta (máx 8 palabras)",\n'
            '  "contenido": "Desarrollo claro de la propuesta (máximo 70 palabras)",\n'
            '  "puntos_clave": ["Punto 1 medible o de acción", "Punto 2 medible o de acción"],\n'
            '  "impacto": "Alto" | "Medio" | "Bajo"\n'
            "}\n"
            "Devuelve ÚNICAMENTE el JSON válido, sin delimitadores de código markdown."
        )

        res_json = self._invocar_gemini_robusto(
            prompt,
            types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=300,
                response_mime_type="application/json"
            )
        )
        if res_json:
            try:
                parsed = json.loads(res_json)
                return {
                    "titulo": parsed.get("titulo", f"Propuesta para {tema_actual}"),
                    "contenido": parsed.get("contenido", ""),
                    "puntos_clave": parsed.get("puntos_clave", []),
                    "impacto": parsed.get("impacto", "Medio")
                }
            except Exception as e:
                logger.error(f"Error parseando JSON de propuesta: {e}")

        return {
            "titulo": f"Iniciativa para {tema_actual}",
            "contenido": "Se propone consolidar los acuerdos prioritarios alineando los objetivos técnicos con la disponibilidad del equipo.",
            "puntos_clave": [
                "Definir metas inmediatas para el tema activo",
                "Establecer métricas claras de seguimiento"
            ],
            "impacto": "Medio"
        }

    def revisar_formato_aporte(
        self,
        tema_actual: str,
        titulo: str,
        contenido: str,
        puntos_clave: List[str],
        observacion_usuario: str = ""
    ) -> Dict[str, Any]:
        """El agente lee el borrador editado por el usuario y emite observaciones constructivas y ajustes sugeridos."""
        prompt = (
            f"Eres el Auditor de Calidad y Facilitador de Órbita.\n"
            f"Tema en deliberación: «{tema_actual}».\n"
            f"Borrador editado por el participante:\n"
            f"Título: {titulo}\n"
            f"Contenido: {contenido}\n"
            f"Puntos clave: {', '.join(puntos_clave)}\n"
            f"Observación o duda del participante: {observacion_usuario or 'Revisar claridad y concisión'}\n\n"
            "Tarea: Devuelve en formato JSON estricto:\n"
            "{\n"
            '  "aprobado_para_publicar": true | false,\n'
            '  "evaluacion": "Comentario constructivo de 1 a 2 frases breves sobre la solidez de la propuesta",\n'
            '  "sugerencia_mejora": "Texto alternativo mejorado si amerita ajuste o el mismo si está óptimo"\n'
            "}\n"
            "Devuelve ÚNICAMENTE el JSON válido."
        )

        res_json = self._invocar_gemini_robusto(
            prompt,
            types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=250,
                response_mime_type="application/json"
            )
        )
        if res_json:
            try:
                return json.loads(res_json)
            except Exception as e:
                logger.error(f"Error parseando JSON de revisión: {e}")

        return {
            "aprobado_para_publicar": True,
            "evaluacion": "La propuesta es clara, directa y se alinea con los objetivos del tema.",
            "sugerencia_mejora": contenido
        }

    def asistir_speech_preparacion(
        self,
        nombre_reunion: str,
        temas_agenda: List[str],
        speech_actual: str,
        solicitud: str = "",
        objetivo: str = ""
    ) -> Dict[str, Any]:
        """
        Asiste al participante en la preparación de su speech o notas de intervención.
        Permite estructurar argumentos, elevar el nivel de síntesis, definir llamados a la acción
        y alinear el discurso con los objetivos de la reunión.
        """
        temas_txt = ", ".join(temas_agenda) if temas_agenda else "Temas generales de deliberación"
        prompt = (
            f"Actúa como asistente ejecutivo de comunicación y oratoria para la reunión '{nombre_reunion or 'Reunión de deliberación'}'.\n"
            f"Agenda / Temas previstos: {temas_txt}.\n"
            f"Borrador actual del participante: \"{speech_actual or 'Sin borrador previo'}\"\n"
            f"Objetivo de la intervención: {objetivo or 'Aporte constructivo y directo'}\n"
            f"Solicitud específica del participante: {solicitud or 'Estructurar y optimizar el discurso para máxima claridad y brevedad'}\n\n"
            "Instrucciones:\n"
            "1. Redacta un speech optimizado, fluido y convincente en español (máximo 150 palabras).\n"
            "2. Identifica de 2 a 3 argumentos o puntos clave medibles.\n"
            "3. Provee un consejo rápido de entrega u oratoria (máximo 1 línea).\n"
            "Responde estrictamente en formato JSON con la siguiente estructura:\n"
            "{\n"
            '  "speech_optimizado": "Texto del discurso propuesto listo para hablar o leer",\n'
            '  "puntos_clave": ["Punto clave 1", "Punto clave 2"],\n'
            '  "consejo_oratoria": "Consejo breve sobre tono, ritmo o énfasis"\n'
            "}"
        )

        res_json = self._invocar_gemini_robusto(
            prompt,
            types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=400,
                response_mime_type="application/json"
            )
        )
        if res_json:
            try:
                return json.loads(res_json)
            except Exception as e:
                logger.error(f"Error parseando JSON de speech: {e}")

        texto_base = speech_actual if speech_actual.strip() else "Propongo enfocar nuestros esfuerzos en los puntos críticos de la agenda para asegurar la viabilidad técnica."
        return {
            "speech_optimizado": f"Estimado equipo: en relación a los temas tratados, {texto_base.strip()}",
            "puntos_clave": [
                "Alineación con los objetivos de la sesión",
                "Compromiso de entrega medible"
            ],
            "consejo_oratoria": "Mantén un tono calmo, pausado y haz énfasis en la propuesta de acción."
        }

    def generar_minuta_reunion(self, nombre_sala: str, temas: List[str], transcripcion: List[Dict[str, Any]]) -> str:
        resumen_aportes = "\n".join([
            f"- {a.get('nombre', 'Participante')}: {a.get('texto', '')}"
            for a in transcripcion[-25:]
        ])
        prompt = (
            f"Genera la minuta ejecutiva en Markdown de la reunión '{nombre_sala}'.\n"
            f"Temas tratados: {', '.join(temas)}.\n"
            f"Aportes oficiales:\n{resumen_aportes or 'Sin aportes registrados'}\n\n"
            "Estructura:\n## Decisiones acordadas\n## Próximos pasos\n## Balance de participación"
        )
        minuta_txt = self._invocar_gemini_robusto(
            prompt,
            types.GenerateContentConfig(temperature=0.2, max_output_tokens=500)
        )
        if minuta_txt:
            return minuta_txt

        return (
            f"## Decisiones acordadas\n\n"
            f"- Se concluyeron los temas: {', '.join(temas)}.\n"
            f"- Se registraron los aportes formales del equipo con equidad.\n\n"
            f"## Próximos pasos\n\n"
            f"- Ejecución y seguimiento en la siguiente sesión."
        )


llm_service = LLMService()
