(function () {
  const $ = id => document.getElementById('asistente-' + id);
  const formatos = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
  const formatoGrabacion = formatos.find(tipo => window.MediaRecorder?.isTypeSupported(tipo));
  const soportaGrabacion = Boolean(formatoGrabacion && navigator.mediaDevices?.getUserMedia);
  const limiteAudio = 2 * 1024 * 1024;
  let sesion = null;

  for (const tema of window.ORBITA_DATA.agenda) {
    $('tema').add(new Option(tema.titulo, tema.titulo));
  }

  function refrescar() {
    if (!sesion) return;
    const { disponible, fase, historial } = sesion;
    const libre = disponible && !fase;
    const grabando = fase === 'grabando';
    $('grabar').disabled = !(soportaGrabacion && (libre || grabando));
    $('grabar').textContent = grabando ? 'Detener grabación' : 'Grabar mensaje';
    $('grabar').setAttribute('aria-pressed', grabando);
    $('enviar').disabled = !libre || !$('mensaje').value.trim() || $('mensaje').value.length > 2000;
    $('mensaje').readOnly = Boolean(fase);
    $('escuchar').hidden = !historial.length;
    $('escuchar').disabled = !libre;
  }

  function estado(actual, fase, mensaje) {
    if (sesion !== actual) return;
    actual.fase = fase;
    $('estado').textContent = mensaje;
    refrescar();
  }

  async function pedir(actual, ruta, opciones = {}) {
    let respuesta;
    try {
      respuesta = await fetch('api/asistente/' + ruta, {
        ...opciones, signal: actual.control.signal, cache: 'no-store'
      });
    } catch {
      throw new Error('No se pudo conectar con el servidor del asistente.');
    }
    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => null);
      throw new Error(datos?.error || 'El servidor del asistente no está disponible. Inicia Órbita con npm start.');
    }
    return respuesta;
  }

  function enviarJson(actual, ruta, datos) {
    return pedir(actual, ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
  }

  function quitarAudio(actual) {
    const audio = $('audio');
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio.hidden = true;
    if (actual.urlAudio) URL.revokeObjectURL(actual.urlAudio);
    actual.urlAudio = null;
  }

  async function abrir() {
    const actual = { control: new AbortController(), disponible: false, fase: '', historial: [] };
    sesion = actual;
    $('historial').replaceChildren();
    $('mensaje').value = '';
    $('tema').value = '';
    estado(actual, 'conexion', 'Comprobando el servidor del asistente…');
    try {
      const respuesta = await pedir(actual, 'estado');
      const datos = await respuesta.json().catch(() => null);
      if (typeof datos?.configurado !== 'boolean') {
        throw new Error('El servidor del asistente no está disponible. Inicia Órbita con npm start.');
      }
      if (sesion !== actual) return;
      actual.disponible = datos.configurado;
      const mensaje = actual.disponible
        ? soportaGrabacion ? '' : 'Este navegador permite conversar por escrito. La grabación requiere acceso al micrófono.'
        : 'Configura la clave de Gemini en el servidor y reinícialo.';
      estado(actual, '', mensaje);
    } catch (error) {
      estado(actual, '', error.message);
    }
  }

  function cerrar() {
    const actual = sesion;
    if (!actual) return;
    sesion = null;
    actual.control.abort();
    clearTimeout(actual.timer);
    if (actual.grabador?.state === 'recording') actual.grabador.stop();
    actual.media?.getTracks().forEach(pista => pista.stop());
    quitarAudio(actual);
  }

  async function transcribir(actual, audio) {
    if (!audio.size || audio.size > limiteAudio) {
      estado(actual, '', 'La grabación está vacía o supera los 2 MB. Intenta una grabación más corta.');
      return;
    }
    estado(actual, 'transcribir', 'Transcribiendo la grabación…');
    try {
      const respuesta = await pedir(actual, 'transcribir', { method: 'POST', body: audio });
      const { texto } = await respuesta.json();
      if (sesion !== actual) return;
      const previo = $('mensaje').value.trimEnd();
      $('mensaje').value = previo ? `${previo}\n${texto}` : texto;
      estado(actual, '', $('mensaje').value.length > 2000
        ? 'Reduce el mensaje a 2000 caracteres antes de enviarlo.'
        : 'Revisa la transcripción y envíala cuando esté lista.');
      $('mensaje').focus();
    } catch (error) {
      estado(actual, '', error.message);
    }
  }

  async function grabar() {
    const actual = sesion;
    if (!actual?.disponible || !soportaGrabacion) return;
    if (actual.fase === 'grabando') {
      if (actual.grabador.state === 'recording') {
        estado(actual, 'transcribir', 'Terminando la grabación…');
        actual.grabador.stop();
      }
      return;
    }
    if (actual.fase) return;
    estado(actual, 'permiso', 'Esperando permiso para usar el micrófono…');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (sesion !== actual) {
        media.getTracks().forEach(pista => pista.stop());
        return;
      }
      actual.media = media;
      $('audio').pause();
      const grabador = new MediaRecorder(media, { mimeType: formatoGrabacion });
      actual.grabador = grabador;
      const partes = [];
      grabador.addEventListener('dataavailable', ({ data }) => {
        if (data.size) partes.push(data);
      });
      let fallo = false;
      grabador.addEventListener('error', () => {
        fallo = true;
      });
      grabador.addEventListener('stop', () => {
        clearTimeout(actual.timer);
        media.getTracks().forEach(pista => pista.stop());
        actual.grabador = null;
        actual.media = null;
        if (sesion !== actual) return;
        if (fallo) estado(actual, '', 'La grabación se interrumpió. Puedes volver a grabar o escribir.');
        else transcribir(actual, new Blob(partes, { type: grabador.mimeType || formatoGrabacion }));
      });
      grabador.start();
      actual.timer = setTimeout(() => {
        if (sesion === actual && grabador.state === 'recording') grabador.stop();
      }, 45000);
      estado(actual, 'grabando', 'Grabando. Pulsa Detener grabación al terminar.');
    } catch {
      actual.media?.getTracks().forEach(pista => pista.stop());
      estado(actual, '', 'No se pudo iniciar el micrófono. Revisa los permisos o escribe el mensaje.');
    }
  }

  function agregarTurno(rol, texto) {
    const item = document.createElement('li');
    if (rol === 'usuario') item.className = 'asistente-propio';
    const nombre = document.createElement('strong');
    nombre.textContent = rol === 'usuario' ? 'Tú' : 'Asistente';
    const mensaje = document.createElement('p');
    mensaje.textContent = texto;
    item.append(nombre, mensaje);
    $('historial').append(item);
  }

  async function responder(evento) {
    evento.preventDefault();
    const actual = sesion;
    const mensaje = $('mensaje').value.trim();
    if (!actual?.disponible || actual.fase || !mensaje || mensaje.length > 2000) return;
    estado(actual, 'responder', 'Preparando la respuesta…');
    try {
      const respuesta = await enviarJson(actual, 'responder', {
        mensaje, tema: $('tema').value, historial: actual.historial.slice(-8)
      });
      const { texto } = await respuesta.json();
      if (sesion !== actual) return;
      quitarAudio(actual);
      actual.historial.push({ rol: 'usuario', texto: mensaje }, { rol: 'asistente', texto });
      agregarTurno('usuario', mensaje);
      agregarTurno('asistente', texto);
      $('mensaje').value = '';
      estado(actual, '', 'Respuesta lista. Puedes escucharla o enviar otro mensaje.');
    } catch (error) {
      estado(actual, '', error.message);
    }
  }

  async function escuchar() {
    const actual = sesion;
    if (!actual?.disponible || actual.fase || !actual.historial.length) return;
    const audio = $('audio');
    const reproducir = () => audio.play().catch(() => {
      if (sesion === actual && !actual.fase && actual.urlAudio) {
        estado(actual, '', 'Pulsa Reproducir en el control de audio.');
      }
    });
    if (actual.urlAudio) {
      reproducir();
      return;
    }
    estado(actual, 'voz', 'Generando el audio de la respuesta…');
    try {
      const respuesta = await enviarJson(actual, 'voz', { texto: actual.historial.at(-1).texto });
      const contenido = await respuesta.blob();
      if (sesion !== actual) return;
      actual.urlAudio = URL.createObjectURL(contenido);
      audio.src = actual.urlAudio;
      audio.hidden = false;
      estado(actual, '', 'Audio disponible.');
      reproducir();
    } catch (error) {
      estado(actual, '', error.message);
    }
  }

  $('grabar').addEventListener('click', grabar);
  $('formulario').addEventListener('submit', responder);
  $('escuchar').addEventListener('click', escuchar);
  $('mensaje').addEventListener('input', refrescar);
  window.Asistente = { abrir, cerrar };
})();
