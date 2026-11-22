/**
 * app.js — Controlador reactivo de interfaz con Alpine.js para Órbita v3.0
 */

document.addEventListener("alpine:init", () => {
  Alpine.data("orbitaApp", () => ({
    vista: "bienvenida",
    modoAuth: "login",
    usuario: null,
    errorAuth: "",

    // Formulario de autenticación
    authForm: {
      loginUser: "",
      loginPass: "",
      regUser: "",
      regPass: "",
      regNombre: "",
      regColor: "#0ea5e9",
      regRol: "Participante",
      regCanal: "texto"
    },
    cargandoAuth: false,

    // Gestión de salas y reuniones pendientes
    codigoSalaActual: "",
    salaActual: null,
    misReuniones: [],
    fechaProgramadaInput: "",
    codigoGuardarInput: "",
    nombreGuardarInput: "",
    mostrarModalGuardarEnlace: false,

    // Planificación de speech y notas previas
    reunionSeleccionadaPlan: null,
    speechPlanTexto: "",
    guardandoSpeech: false,
    cargandoIaSpeech: false,
    resultadoIaSpeech: null,
    solicitudIaSpeechInput: "",

    // Drawer / Panel flotante de speech en reunión
    mostrarSpeechEnReunion: false,

    // Agenda dinámica
    nuevoTemaInput: "",
    mostrarAgregarTema: false,

    // Paneles en reunión
    panelLateralAbierto: true,
    panelReunionMovil: "centro",
    pestañaLateral: "chat", // 'chat', 'agente', 'agenda'
    pestañaCentro: "radar", // 'radar' o 'aportes'
    aporteDesplegadoId: null, // ID del aporte expandido

    // Chat grupal
    mensajeChatInput: "",

    // Chat con Agente de IA
    mensajeAgenteInput: "",
    historialChatAgente: [],
    cargandoAgente: false,

    // Formato estructurado de aporte
    formatoAporteBorrador: {
      titulo: "",
      contenido: "",
      puntos_clave: [],
      impacto: "Medio"
    },
    publicandoAporte: false,
    errorAporte: "",
    cargandoFormatoAporte: false,
    evaluacionIaFormato: null,
    nuevoPuntoClaveInput: "",

    // Notificación de invitación exclusiva del anfitrión recibida
    invitacionAnfitrionRecibida: null,
    mostrarModalInvitacionAnfitrion: false,

    // Reconocimiento y dictado por voz (Web Speech API)
    reconocimientoVoz: null,
    dictandoEn: null, // 'chat', 'agente', 'speech', 'speech_instruccion'
    soportaReconocimientoVoz: false,

    // Controles de llamada
    micActivo: false,
    camActiva: false,
    manoLevantada: false,
    sistemaOrbitalD3: null,
    fichaParticipante: null,

    // Modales
    mostrarModalAccesibilidad: false,

    // Minuta ejecutiva
    minutaGeneradaMarkdown: "",
    cargandoMinuta: false,

    // Accesibilidad
    altoContraste: false,
    bajaEstimulacion: false,
    textoGrande: false,
    fuenteAccesible: false,

    async init() {
      this.cargarUsuarioGuardado();
      this.cargarPreferenciasAccesibilidad();
      this.inicializarReconocimientoVoz();
      this.$nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
      });
    },

    inicializarReconocimientoVoz() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.soportaReconocimientoVoz = true;
        this.reconocimientoVoz = new SpeechRecognition();
        this.reconocimientoVoz.continuous = false;
        this.reconocimientoVoz.interimResults = false;
        this.reconocimientoVoz.lang = "es-ES";

        this.reconocimientoVoz.onresult = (event) => {
          const transcripcion = event.results[0][0].transcript;
          if (this.dictandoEn === "chat") {
            this.mensajeChatInput = (this.mensajeChatInput ? this.mensajeChatInput + " " : "") + transcripcion;
          } else if (this.dictandoEn === "agente") {
            this.mensajeAgenteInput = (this.mensajeAgenteInput ? this.mensajeAgenteInput + " " : "") + transcripcion;
          } else if (this.dictandoEn === "speech") {
            this.speechPlanTexto = (this.speechPlanTexto ? this.speechPlanTexto + " " : "") + transcripcion;
          } else if (this.dictandoEn === "speech_instruccion") {
            this.solicitudIaSpeechInput = (this.solicitudIaSpeechInput ? this.solicitudIaSpeechInput + " " : "") + transcripcion;
          }
          this.dictandoEn = null;
        };

        this.reconocimientoVoz.onerror = (e) => {
          console.warn("Aviso de reconocimiento de voz:", e.error);
          this.dictandoEn = null;
        };

        this.reconocimientoVoz.onend = () => {
          this.dictandoEn = null;
        };
      } else {
        this.soportaReconocimientoVoz = false;
      }
    },

    alternarDictadoPorVoz(destino) {
      if (!this.soportaReconocimientoVoz || !this.reconocimientoVoz) {
        alert("El reconocimiento por voz no está disponible en este navegador o requiere permisos de micrófono.");
        return;
      }
      if (this.dictandoEn === destino) {
        this.reconocimientoVoz.stop();
        this.dictandoEn = null;
      } else {
        try {
          this.dictandoEn = destino;
          this.reconocimientoVoz.start();
        } catch (e) {
          console.warn("Error iniciando dictado:", e);
          this.dictandoEn = null;
        }
      }
    },

    cargarUsuarioGuardado() {
      const u = localStorage.getItem("orbita_usuario_v3");
      if (u) {
        try {
          this.usuario = JSON.parse(u);
          this.vista = "salas";
          this.cargarMisReuniones();
        } catch (_) {}
      }
    },

    guardarUsuarioLocal() {
      if (this.usuario) {
        localStorage.setItem("orbita_usuario_v3", JSON.stringify(this.usuario));
      }
    },

    cerrarSesion() {
      this.usuario = null;
      localStorage.removeItem("orbita_usuario_v3");
      this.vista = "bienvenida";
    },

    navegarA(nuevaVista) {
      this.vista = nuevaVista;
      if (nuevaVista === "salas") {
        this.cargarMisReuniones();
      }
      this.$nextTick(() => {
        if (window.lucide) window.lucide.createIcons();
        if (nuevaVista === "reunion" && !this.sistemaOrbitalD3) {
          this.montarRadarD3();
        }
      });
    },

    // -------------------------------------------------------------
    // AUTENTICACIÓN
    // -------------------------------------------------------------
    async ejecutarLogin(username, password) {
      this.errorAuth = "";
      const user = (username || this.authForm.loginUser || "").trim();
      const pass = password || this.authForm.loginPass || "";
      if (!user || !pass) {
        this.errorAuth = "Ingresa tu usuario y contraseña.";
        return;
      }
      this.cargandoAuth = true;
      try {
        const u = await window.orbitaApi.login(user, pass);
        this.usuario = u;
        this.guardarUsuarioLocal();
        this.authForm.loginPass = "";
        this.navegarA("salas");
      } catch (err) {
        this.errorAuth = err.message;
      } finally {
        this.cargandoAuth = false;
      }
    },

    async ejecutarRegistro(username, password, nombre, color, rol, canal) {
      this.errorAuth = "";
      const user = (username || this.authForm.regUser || "").trim();
      const pass = password || this.authForm.regPass || "";
      const nom = (nombre || this.authForm.regNombre || "").trim();
      const col = color || this.authForm.regColor || "#0ea5e9";
      const ro = rol || this.authForm.regRol || "Participante";
      const can = canal || this.authForm.regCanal || "texto";

      if (!user || user.length < 3) {
        this.errorAuth = "El nombre de usuario debe tener al menos 3 caracteres.";
        return;
      }
      if (!pass || pass.length < 4) {
        this.errorAuth = "La contraseña debe tener al menos 4 caracteres.";
        return;
      }
      if (!nom) {
        this.errorAuth = "Ingresa un nombre visible o cargo.";
        return;
      }

      this.cargandoAuth = true;
      try {
        const u = await window.orbitaApi.registrar(user, pass, nom, col, ro, can);
        this.usuario = u;
        this.guardarUsuarioLocal();
        this.authForm.regPass = "";
        this.navegarA("salas");
      } catch (err) {
        this.errorAuth = err.message;
      } finally {
        this.cargandoAuth = false;
      }
    },

    // -------------------------------------------------------------
    // REUNIONES PENDIENTES, GUARDADAS Y PLANIFICACIÓN DE SPEECH
    // -------------------------------------------------------------
    async cargarMisReuniones() {
      if (!this.usuario) return;
      try {
        this.misReuniones = await window.orbitaApi.obtenerReunionesUsuario(this.usuario.id);
        // Las tarjetas se crean después de la primera pasada de íconos: hay que dibujarlos de nuevo
        this.$nextTick(() => { if (window.lucide) window.lucide.createIcons(); });
      } catch (e) {
        console.error("Error al cargar reuniones:", e);
      }
    },

    async guardarEnlaceManual() {
      if (!this.codigoGuardarInput.trim() || !this.usuario) return;
      try {
        const codigo = this.codigoGuardarInput.trim().toUpperCase();
        const nombre = this.nombreGuardarInput.trim() || `Reunión ${codigo}`;
        await window.orbitaApi.guardarEnlaceReunion(this.usuario.id, codigo, nombre, true);
        this.codigoGuardarInput = "";
        this.nombreGuardarInput = "";
        this.mostrarModalGuardarEnlace = false;
        await this.cargarMisReuniones();
      } catch (e) {
        alert("Error al guardar enlace: " + e.message);
      }
    },

    abrirPlanificarSpeech(reu) {
      this.reunionSeleccionadaPlan = reu;
      this.speechPlanTexto = reu.speech_planificado || "";
      this.resultadoIaSpeech = null;
      this.solicitudIaSpeechInput = "";
      this.navegarA("speech");
    },

    async asistirSpeechConIa(modoPredefinido = "") {
      this.cargandoIaSpeech = true;
      try {
        const nombreReu = this.reunionSeleccionadaPlan ? this.reunionSeleccionadaPlan.nombre : (this.salaActual ? this.salaActual.nombre : "Reunión");
        const temas = this.salaActual ? this.obtenerTemasAgendaTextos() : (this.reunionSeleccionadaPlan?.agenda || []);
        const solicitud = modoPredefinido || this.solicitudIaSpeechInput || "Optimizar y estructurar con claridad";

        const res = await window.orbitaApi.asistirSpeech(
          nombreReu,
          temas,
          this.speechPlanTexto,
          solicitud,
          "Intervención persuasiva y concisa"
        );
        this.resultadoIaSpeech = res.asistencia;
      } catch (e) {
        this.resultadoIaSpeech = {
          speech_optimizado: this.speechPlanTexto.trim()
            ? `Propuesta clave: ${this.speechPlanTexto.trim()}`
            : "Estimado equipo: propongo priorizar los puntos acordados en la agenda para asegurar resultados medibles.",
          puntos_clave: ["Enfoque en prioridades", "Compromiso de ejecución"],
          consejo_oratoria: "Pausa brevemente antes de enunciar la propuesta principal para captar la atención."
        };
      } finally {
        this.cargandoIaSpeech = false;
      }
    },

    aplicarSpeechOptimizado() {
      if (this.resultadoIaSpeech && this.resultadoIaSpeech.speech_optimizado) {
        this.speechPlanTexto = this.resultadoIaSpeech.speech_optimizado;
        this.resultadoIaSpeech = null;
      }
    },

    async guardarSpeech() {
      const codigo = this.reunionSeleccionadaPlan?.codigo || this.salaActual?.codigo;
      if (!codigo || !this.usuario) return;
      this.guardandoSpeech = true;
      try {
        await window.orbitaApi.guardarSpeechPlanificado(
          this.usuario.id,
          codigo,
          this.speechPlanTexto
        );
        if (this.reunionSeleccionadaPlan) {
          this.reunionSeleccionadaPlan.speech_planificado = this.speechPlanTexto;
        }
        alert("Speech y notas guardadas para esta reunión.");
      } catch (e) {
        alert("Error al guardar speech: " + e.message);
      } finally {
        this.guardandoSpeech = false;
      }
    },

    async cargarSpeechParaSalaActual() {
      if (!this.usuario || !this.salaActual) return;
      try {
        const reus = await window.orbitaApi.obtenerReunionesUsuario(this.usuario.id);
        const match = reus.find(r => r.codigo === this.salaActual.codigo);
        if (match) {
          this.reunionSeleccionadaPlan = match;
          this.speechPlanTexto = match.speech_planificado || "";
        } else {
          this.speechPlanTexto = "";
        }
      } catch (e) {
        console.error("Error al cargar speech de la sala:", e);
      }
    },

    copiarCodigoReunion(codigo) {
      navigator.clipboard.writeText(codigo);
      alert(`Código ${codigo} copiado al portapapeles.`);
    },

    copiarEnlaceReunion(codigo) {
      const url = `${window.location.origin}/#${codigo}`;
      navigator.clipboard.writeText(url);
      alert(`Enlace de reunión copiado al portapapeles:\n${url}`);
    },

    // -------------------------------------------------------------
    // CREAR Y CONECTARSE A SALAS
    // -------------------------------------------------------------
    async crearSala(nombre, agendaTexto, estilo) {
      try {
        const temas = agendaTexto.split("\n").map(t => t.trim()).filter(Boolean);
        const s = await window.orbitaApi.crearSala(
          nombre,
          temas,
          estilo,
          this.usuario?.id || "",
          this.usuario?.nombre || "Facilitador",
          this.fechaProgramadaInput || "Inmediata"
        );
        this.fechaProgramadaInput = "";
        await this.ingresarASala(s.codigo);
      } catch (err) {
        alert("Error al crear la sala: " + err.message);
      }
    },

    async ingresarASala(codigo) {
      if (!this.usuario) {
        this.navegarA("auth");
        return;
      }
      try {
        const s = await window.orbitaApi.unirseASala(codigo, this.usuario);
        this.salaActual = s;
        this.codigoSalaActual = s.codigo;
        await this.cargarSpeechParaSalaActual();
        window.orbitaApi.conectarWs(s.codigo, (tipo, datos) => this.procesarEventoWs(tipo, datos));
        this.navegarA("espera");
      } catch (err) {
        alert("No fue posible ingresar a la sala: " + err.message);
      }
    },

    async agregarTema() {
      if (!this.nuevoTemaInput.trim() || !this.salaActual) return;
      try {
        await window.orbitaApi.agregarTemaAgenda(this.salaActual.codigo, this.nuevoTemaInput.trim());
        this.nuevoTemaInput = "";
        this.mostrarAgregarTema = false;
      } catch (err) {
        alert("Error al agregar tema: " + err.message);
      }
    },

    // -------------------------------------------------------------
    // INVITAR A PARTICIPAR (EXCLUSIVO DEL ANFITRIÓN)
    // -------------------------------------------------------------
    esAnfitrion() {
      if (!this.salaActual || !this.usuario) return false;
      const part = this.salaActual.participantes[this.usuario.id];
      return part ? part.es_anfitrion : (this.salaActual.anfitrion_id === this.usuario.id);
    },

    async invitarParticipanteSeleccionado(participante) {
      if (!this.esAnfitrion()) {
        alert("Solo los anfitriones de la sala pueden invitar a participar.");
        return;
      }
      try {
        const tema = this.salaActual?.tema_activo?.titulo || "Tema central";
        await window.orbitaApi.invitarParticipante(
          this.salaActual.codigo,
          this.usuario.id,
          participante.id,
          participante.nombre,
          tema
        );
        this.fichaParticipante = null;
        alert(`Invitación privada enviada a ${participante.nombre}.`);
      } catch (e) {
        alert("Error al enviar invitación: " + e.message);
      }
    },

    responderInvitacionAnfitrion(aceptar) {
      this.mostrarModalInvitacionAnfitrion = false;
      if (aceptar) {
        this.pestañaLateral = "agente";
        this.panelLateralAbierto = true;
      }
      this.invitacionAnfitrionRecibida = null;
    },

    // -------------------------------------------------------------
    // CHAT GRUPAL VS. AGENTE DE IA
    // -------------------------------------------------------------
    async enviarMensajeChatGrupal() {
      if (!this.mensajeChatInput.trim() || !this.salaActual || !this.usuario) return;
      const texto = this.mensajeChatInput.trim();
      this.mensajeChatInput = "";
      try {
        await window.orbitaApi.enviarMensajeChat(this.salaActual.codigo, this.usuario.id, texto);
      } catch (err) {
        console.error("Error enviando mensaje al chat:", err);
      }
    },

    obtenerAportesPreviosTextos() {
      if (!this.salaActual || !this.salaActual.transcripcion) return [];
      return this.salaActual.transcripcion.slice(-4).map(a => `${a.nombre}: ${a.texto}`);
    },

    obtenerTemasAgendaTextos() {
      if (!this.salaActual || !this.salaActual.agenda) return [];
      return this.salaActual.agenda.map(t => t.titulo);
    },

    async enviarMensajeAgente() {
      if (!this.mensajeAgenteInput.trim() || !this.salaActual) return;
      const consulta = this.mensajeAgenteInput.trim();
      this.mensajeAgenteInput = "";

      this.historialChatAgente.push({ rol: "user", contenido: consulta });
      this.cargandoAgente = true;

      try {
        const tema = this.salaActual?.tema_activo?.titulo || "Tema general";
        const agenda = this.obtenerTemasAgendaTextos();
        const aportes = this.obtenerAportesPreviosTextos();

        const res = await window.orbitaApi.chatConAgente(tema, agenda, aportes, consulta, this.historialChatAgente);
        this.historialChatAgente.push({ rol: "agent", contenido: res.respuesta });
      } catch (err) {
        this.historialChatAgente.push({
          rol: "agent",
          contenido: "Recuerda que puedes presionar 'Generar formato de aporte' para estructurar tu propuesta."
        });
      } finally {
        this.cargandoAgente = false;
        this.$nextTick(() => {
          const el = document.getElementById("contenedor-chat-agente");
          if (el) el.scrollTop = el.scrollHeight;
        });
      }
    },

    mostrarPanelReunion(panel) {
      if (panel === "radar" || panel === "aportes") {
        this.pestañaCentro = panel;
        this.panelReunionMovil = "centro";
      } else {
        this.pestañaLateral = panel;
        this.panelLateralAbierto = true;
        this.panelReunionMovil = "lateral";
      }
    },

    abrirBorradorAporte() {
      if (!this.$refs.editorAporte.open) {
        this.errorAporte = "";
        this.$refs.editorAporte.showModal();
      }
    },

    async generarFormatoDesdeChat() {
      this.cargandoFormatoAporte = true;
      this.evaluacionIaFormato = null;
      try {
        const tema = this.salaActual?.tema_activo?.titulo || "Tema central";
        const agenda = this.obtenerTemasAgendaTextos();
        const aportes = this.obtenerAportesPreviosTextos();

        const res = await window.orbitaApi.generarFormatoAporte(tema, agenda, aportes, this.historialChatAgente);
        this.formatoAporteBorrador = {
          titulo: res.formato.titulo || `Propuesta para ${tema}`,
          contenido: res.formato.contenido || "",
          puntos_clave: res.formato.puntos_clave || [],
          impacto: res.formato.impacto || "Medio"
        };
        this.abrirBorradorAporte();
      } catch (err) {
        this.abrirBorradorAporte();
        this.errorAporte = "No se pudo generar el borrador: " + err.message;
      } finally {
        this.cargandoFormatoAporte = false;
      }
    },

    agregarPuntoClave() {
      if (this.nuevoPuntoClaveInput.trim()) {
        this.formatoAporteBorrador.puntos_clave.push(this.nuevoPuntoClaveInput.trim());
        this.nuevoPuntoClaveInput = "";
      }
    },

    eliminarPuntoClave(idx) {
      this.formatoAporteBorrador.puntos_clave.splice(idx, 1);
    },

    async solicitarRevisionAgente(observacion = "") {
      if (this.cargandoFormatoAporte || !this.formatoAporteBorrador.contenido.trim()) return;
      this.errorAporte = "";
      this.evaluacionIaFormato = null;
      this.cargandoFormatoAporte = true;
      try {
        const tema = this.salaActual?.tema_activo?.titulo || "Tema central";
        const res = await window.orbitaApi.revisarFormatoAporte(
          tema,
          this.formatoAporteBorrador.titulo,
          this.formatoAporteBorrador.contenido,
          this.formatoAporteBorrador.puntos_clave,
          observacion
        );
        this.evaluacionIaFormato = res.revision;
      } catch (err) {
        this.errorAporte = "No se pudo revisar el aporte: " + err.message;
      } finally {
        this.cargandoFormatoAporte = false;
      }
    },

    aplicarSugerenciaIaEnBorrador() {
      if (this.evaluacionIaFormato && this.evaluacionIaFormato.sugerencia_mejora) {
        this.formatoAporteBorrador.contenido = this.evaluacionIaFormato.sugerencia_mejora;
        this.evaluacionIaFormato = null;
      }
    },

    async publicarAporteOficial() {
      const texto = this.formatoAporteBorrador.contenido.trim();
      if (!texto || !this.salaActual || !this.usuario || this.publicandoAporte) return;

      this.publicandoAporte = true;
      this.errorAporte = "";
      try {
        await window.orbitaApi.enviarAporte(this.salaActual.codigo, this.usuario.id, {
          titulo: this.formatoAporteBorrador.titulo.trim() || "Propuesta",
          texto,
          puntos_clave: this.formatoAporteBorrador.puntos_clave,
          impacto_estimado: this.formatoAporteBorrador.impacto,
          anonimo: false,
          duracion_segundos: 8.0
        });

        this.$refs.editorAporte.close();
        this.nuevoPuntoClaveInput = "";
        this.formatoAporteBorrador = { titulo: "", contenido: "", puntos_clave: [], impacto: "Medio" };
        this.evaluacionIaFormato = null;
        this.mostrarPanelReunion("aportes");
      } catch (err) {
        this.errorAporte = "No se pudo publicar el aporte: " + err.message;
      } finally {
        this.publicandoAporte = false;
      }
    },

    alternarDespliegueAporte(aporteId) {
      this.aporteDesplegadoId = (this.aporteDesplegadoId === aporteId) ? null : aporteId;
    },

    // -------------------------------------------------------------
    // RADAR Y WEBSOCKETS
    // -------------------------------------------------------------
    montarRadarD3() {
      const contenedor = document.getElementById("lienzo-orbital");
      if (!contenedor) return;

      this.sistemaOrbitalD3 = new window.D3OrbitalSystem("lienzo-orbital", {
        ancho: 500,
        alto: 500,
        alSeleccionarPlaneta: (p) => {
          this.fichaParticipante = p;
        }
      });

      if (this.salaActual) {
        this.actualizarRadar();
      }
    },

    actualizarRadar() {
      if (!this.sistemaOrbitalD3 || !this.salaActual) return;
      const participantesLista = Object.values(this.salaActual.participantes || {});
      this.sistemaOrbitalD3.actualizar(participantesLista, this.usuario?.id);
    },

    procesarEventoWs(tipo, datos) {
      if (tipo === "participante_ingreso") {
        if (this.salaActual) {
          const esNuevo = !this.salaActual.participantes[datos.participante.id];
          if (esNuevo && this.sistemaOrbitalD3) {
            this.sistemaOrbitalD3.anunciarLlegada(datos.participante.id);
          }
          this.salaActual.participantes[datos.participante.id] = datos.participante;
          this.salaActual.indice_equilibrio = datos.indice_equilibrio;
          this.actualizarRadar();
        }
      } else if (tipo === "invitacion_anfitrion") {
        // Notificación de invitación si va dirigida al usuario
        if (this.usuario && datos.destinatario_id === this.usuario.id) {
          this.invitacionAnfitrionRecibida = datos;
          this.mostrarModalInvitacionAnfitrion = true;
        }
      } else if (tipo === "nuevo_aporte") {
        if (this.salaActual) {
          this.salaActual.transcripcion.push(datos.aporte);
          this.salaActual.indice_equilibrio = datos.indice_equilibrio;
          datos.participantes.forEach(p => {
            this.salaActual.participantes[p.id] = p;
          });
          this.actualizarRadar();
        }
      } else if (tipo === "nuevo_mensaje_chat") {
        if (this.salaActual) {
          this.salaActual.chat_grupal.push(datos.mensaje);
          this.$nextTick(() => {
            const el = document.getElementById("contenedor-mensajes-chat");
            if (el) el.scrollTop = el.scrollHeight;
          });
        }
      } else if (tipo === "agenda_actualizada") {
        if (this.salaActual) {
          this.salaActual.agenda = datos.agenda;
        }
      } else if (tipo === "actualizacion_orbita") {
        if (this.salaActual) {
          datos.participantes.forEach(p => {
            this.salaActual.participantes[p.id] = p;
          });
          this.salaActual.indice_equilibrio = datos.indice_equilibrio;
          this.actualizarRadar();
        }
      } else if (tipo === "cambio_tema") {
        if (this.salaActual) {
          this.salaActual.tema_activo = datos.tema_activo;
          this.salaActual.cerrada = datos.cerrada;
          if (datos.cerrada) {
            this.concluirReunion();
          }
        }
      } else if (tipo === "estado_mano") {
        if (this.salaActual && this.salaActual.participantes[datos.user_id]) {
          this.salaActual.participantes[datos.user_id].mano_levantada = datos.mano_levantada;
          this.actualizarRadar();
        }
      }
    },

    alternarMic() {
      this.micActivo = !this.micActivo;
    },

    alternarCam() {
      this.camActiva = !this.camActiva;
    },

    alternarMano() {
      this.manoLevantada = !this.manoLevantada;
      window.orbitaApi.enviarWs("alternar_mano", { user_id: this.usuario?.id });
    },

    async avanzarTema() {
      if (!this.salaActual) return;
      try {
        await window.orbitaApi.avanzarSiguienteTema(this.salaActual.codigo);
      } catch (err) {
        alert("Error al avanzar tema: " + err.message);
      }
    },

    async concluirReunion() {
      this.cargandoMinuta = true;
      this.navegarA("minuta");

      try {
        const temas = (this.salaActual?.agenda || []).map(t => t.titulo);
        const res = await window.orbitaApi.generarMinuta(
          this.salaActual?.nombre || "Reunión",
          temas,
          this.salaActual?.transcripcion || []
        );
        this.minutaGeneradaMarkdown = res.minuta;
      } catch (err) {
        this.minutaGeneradaMarkdown = "## Decisiones acordadas\n- Se revisaron los temas en equilibrio.";
      } finally {
        this.cargandoMinuta = false;
      }
    },

    // Accesibilidad
    cargarPreferenciasAccesibilidad() {
      this.altoContraste = localStorage.getItem("orbita_acc_contraste") === "true";
      this.bajaEstimulacion = localStorage.getItem("orbita_acc_estimulacion") === "true";
      this.textoGrande = localStorage.getItem("orbita_acc_texto") === "true";
      this.fuenteAccesible = localStorage.getItem("orbita_acc_fuente") === "true";
      this.aplicarClasesAccesibilidad();
    },

    alternarAltoContraste() {
      this.altoContraste = !this.altoContraste;
      localStorage.setItem("orbita_acc_contraste", this.altoContraste);
      this.aplicarClasesAccesibilidad();
    },

    alternarBajaEstimulacion() {
      this.bajaEstimulacion = !this.bajaEstimulacion;
      localStorage.setItem("orbita_acc_estimulacion", this.bajaEstimulacion);
      this.aplicarClasesAccesibilidad();
    },

    alternarTextoGrande() {
      this.textoGrande = !this.textoGrande;
      localStorage.setItem("orbita_acc_texto", this.textoGrande);
      this.aplicarClasesAccesibilidad();
    },

    alternarFuenteAccesible() {
      this.fuenteAccesible = !this.fuenteAccesible;
      localStorage.setItem("orbita_acc_fuente", this.fuenteAccesible);
      this.aplicarClasesAccesibilidad();
    },

    aplicarClasesAccesibilidad() {
      document.body.classList.toggle("alto-contraste", this.altoContraste);
      document.body.classList.toggle("baja-estimulacion", this.bajaEstimulacion);
      document.body.classList.toggle("texto-grande", this.textoGrande);
      document.body.classList.toggle("fuente-accesible", this.fuenteAccesible);
      if (this.sistemaOrbitalD3) {
        this.sistemaOrbitalD3.rotar = !this.bajaEstimulacion;
      }
    }
  }));
});
