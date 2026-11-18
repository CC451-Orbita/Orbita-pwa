/**
 * api.js — Cliente HTTP REST y WebSocket para Órbita v3.0
 */

class OrbitaApiClient {
  constructor() {
    this.baseUrl = window.location.origin;
    this.ws = null;
  }

  async registrar(username, password, nombre, color, rol, canal) {
    const res = await fetch(`${this.baseUrl}/api/auth/registrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        password: password,
        nombre: nombre,
        color: color,
        rol: rol,
        canal_preferido: canal
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error en el registro");
    }
    return await res.json();
  }

  async login(username, password) {
    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        password: password
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Credenciales incorrectas");
    }
    return await res.json();
  }

  async obtenerReunionesUsuario(userId) {
    const res = await fetch(`${this.baseUrl}/api/usuarios/${userId}/reuniones`);
    if (!res.ok) throw new Error("Error al obtener reuniones");
    return await res.json();
  }

  async guardarEnlaceReunion(userId, codigo, nombre, confirmado = true) {
    const res = await fetch(`${this.baseUrl}/api/usuarios/${userId}/reuniones/guardar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: codigo,
        nombre: nombre,
        confirmado: confirmado
      })
    });
    if (!res.ok) throw new Error("Error al guardar enlace");
    return await res.json();
  }

  async guardarSpeechPlanificado(userId, codigo, speech) {
    const res = await fetch(`${this.baseUrl}/api/usuarios/${userId}/reuniones/${codigo}/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speech: speech })
    });
    if (!res.ok) throw new Error("Error al guardar speech");
    return await res.json();
  }

  async listarSalas() {
    const res = await fetch(`${this.baseUrl}/api/salas`);
    if (!res.ok) throw new Error("Error al listar salas");
    return await res.json();
  }

  async crearSala(nombre, agenda, estiloModeracion = "suave", anfitrionId = "", anfitrionNombre = "", fechaProgramada = "") {
    const res = await fetch(`${this.baseUrl}/api/salas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: nombre,
        agenda: agenda,
        estilo_moderacion: estiloModeracion,
        anfitrion_id: anfitrionId,
        anfitrion_nombre: anfitrionNombre,
        fecha_programada: fechaProgramada
      })
    });
    if (!res.ok) throw new Error("Error al crear sala");
    return await res.json();
  }

  async obtenerSala(codigo) {
    const res = await fetch(`${this.baseUrl}/api/salas/${codigo}`);
    if (!res.ok) throw new Error("Sala no encontrada");
    return await res.json();
  }

  async unirseASala(codigo, userObj) {
    const res = await fetch(`${this.baseUrl}/api/salas/${codigo}/unirse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userObj)
    });
    if (!res.ok) throw new Error("No se pudo unir a la sala");
    return await res.json();
  }

  async agregarTemaAgenda(codigo, titulo) {
    const res = await fetch(`${this.baseUrl}/api/salas/${codigo}/agenda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: titulo })
    });
    if (!res.ok) throw new Error("Error al agregar tema");
    return await res.json();
  }

  // Invitar a participar (Exclusivo de anfitriones)
  async invitarParticipante(codigo, anfitrionId, participanteId, participanteNombre, temaTitulo) {
    const res = await fetch(`${this.baseUrl}/api/salas/${codigo}/invitar-participante?anfitrion_id=${anfitrionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participante_id: participanteId,
        participante_nombre: participanteNombre,
        tema_titulo: temaTitulo
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error al invitar");
    }
    return await res.json();
  }

  async enviarMensajeChat(codigo, userId, texto) {
    const res = await fetch(`${this.baseUrl}/api/salas/${codigo}/chat?user_id=${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: texto })
    });
    if (!res.ok) throw new Error("Error al enviar mensaje");
    return await res.json();
  }

  async enviarAporte(codigo, userId, aporteObj) {
    const res = await fetch(`${this.baseUrl}/api/salas/${codigo}/aportes?user_id=${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aporteObj)
    });
    if (!res.ok) throw new Error("Error al enviar aporte");
    return await res.json();
  }

  async avanzarSiguienteTema(codigo) {
    const res = await fetch(`${this.baseUrl}/api/salas/${codigo}/siguiente-tema`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Error al avanzar tema");
    return await res.json();
  }

  // Chat con Agente de IA
  async chatConAgente(temaActual, agenda, aportesPrevios, mensaje, historial = []) {
    const res = await fetch(`${this.baseUrl}/api/ia/chat-agente`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tema_actual: temaActual,
        agenda: agenda,
        aportes_previos: aportesPrevios,
        mensaje_usuario: mensaje,
        historial: historial
      })
    });
    if (!res.ok) throw new Error("Error en el chat con el agente");
    return await res.json();
  }

  // Generar formato estructurado de aporte
  async generarFormatoAporte(temaActual, agenda, aportesPrevios, historialChat, instruccion = "") {
    const res = await fetch(`${this.baseUrl}/api/ia/generar-formato-aporte`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tema_actual: temaActual,
        agenda: agenda,
        aportes_previos: aportesPrevios,
        historial_chat: historialChat,
        instruccion_adicional: instruccion
      })
    });
    if (!res.ok) throw new Error("Error generando formato de aporte");
    return await res.json();
  }

  // Revisar formato estructurado con el agente
  async revisarFormatoAporte(temaActual, titulo, contenido, puntosClave = [], observacion = "") {
    const res = await fetch(`${this.baseUrl}/api/ia/revisar-formato-aporte`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tema_actual: temaActual,
        titulo_propuesta: titulo,
        contenido_propuesta: contenido,
        puntos_clave: puntosClave,
        observacion_usuario: observacion
      })
    });
    if (!res.ok) throw new Error("Error revisando formato con la IA");
    return await res.json();
  }

  // Asistir redacción y optimización de speech previo con IA
  async asistirSpeech(nombreReunion, temasAgenda, speechActual, solicitud = "", objetivo = "") {
    const res = await fetch(`${this.baseUrl}/api/ia/asistir-speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre_reunion: nombreReunion,
        temas_agenda: temasAgenda,
        speech_actual: speechActual,
        solicitud: solicitud,
        objetivo_intervencion: objetivo
      })
    });
    if (!res.ok) throw new Error("Error en asistencia de speech con IA");
    return await res.json();
  }

  async generarMinuta(nombreSala, temas, transcripcion) {
    const res = await fetch(`${this.baseUrl}/api/ia/minuta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre_sala: nombreSala,
        temas: temas,
        transcripcion: transcripcion
      })
    });
    if (!res.ok) throw new Error("Error generando minuta");
    return await res.json();
  }

  conectarWs(codigo, alRecibir) {
    if (this.ws) {
      this.ws.close();
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(`${proto}//${window.location.host}/ws/sala/${codigo}`);

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (alRecibir) alRecibir(msg.tipo, msg.datos);
      } catch (e) {
        console.error("Error al procesar WebSocket:", e);
      }
    };
  }

  enviarWs(tipo, datos) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ tipo: tipo, datos: datos }));
    }
  }
}

window.orbitaApi = new OrbitaApiClient();
