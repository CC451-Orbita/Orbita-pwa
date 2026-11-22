/**
 * portada.js — Sistema solar de ejemplo de la pantalla de bienvenida.
 *
 * Usa la misma regla que el radar de la reunión (orbits_d3.js):
 * radio = rEq · √(cuota ideal / cuota real). Quien aporta más se acerca al sol;
 * quien aporta poco se aleja. Los datos son de ejemplo y no provienen del servidor.
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const C = 260;            // centro del lienzo 520 × 520
  const R_EQ = 150;         // anillo de equilibrio
  const R_MIN = 72;
  const R_MAX = 232;
  const SEGUNDOS_POR_TURNO = 12;
  const DURACION_CAMBIO = 1800;          // ms de la transferencia entre órbitas
  const DURACION_CAMBIO_REDUCIDO = 450;  // sin giro: solo un desplazamiento breve

  const EJEMPLO = [
    { nombre: "Ana", color: "#6cb6ff", segundos: 56, angulo: 0.4 },
    { nombre: "Luis", color: "#c69cf4", segundos: 30, angulo: 2.3 },
    { nombre: "Rosa", color: "#ff8fa3", segundos: 26, angulo: 3.9 },
    { nombre: "Teo", color: "#b8e986", segundos: 8, angulo: 5.2 }
  ];

  let participantes = [];
  let svg, lista, estado;
  let ultimoTiempo = null;

  function el(nombre, atributos, padre) {
    const nodo = document.createElementNS(NS, nombre);
    for (const [clave, valor] of Object.entries(atributos)) nodo.setAttribute(clave, valor);
    if (padre) padre.appendChild(nodo);
    return nodo;
  }

  function movimientoReducido() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.body.classList.contains("baja-estimulacion");
  }

  // Aceleración y frenado suaves: el planeta despega, viaja y se asienta.
  function suavizar(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function radioObjetivo(p, total) {
    const ideal = 1 / participantes.length;
    const cuota = Math.max(p.segundos / total, 0.001);
    return Math.max(R_MIN, Math.min(R_MAX, R_EQ * Math.sqrt(ideal / cuota)));
  }

  /** Recalcula cuotas y lanza una transferencia para cada planeta cuya órbita cambia. */
  function recalcular(ahora) {
    const total = participantes.reduce((s, p) => s + p.segundos, 0);
    participantes.forEach(p => {
      p.cuota = Math.round((p.segundos / total) * 100);
      const meta = radioObjetivo(p, total);
      if (Math.abs(meta - (p.hacia ?? p.radio)) < 0.5) return;
      p.desde = p.radio;
      p.hacia = meta;
      p.inicio = ahora;
    });
  }

  function dibujarEscena() {
    svg.innerHTML = "";
    window.Astros.definir(svg, "portada");

    // Las estrellas las dibuja cielo.js en el fondo de toda la portada
    const fondo = el("g", { "aria-hidden": "true" }, svg);

    // Anillo de equilibrio: una referencia discreta, no una órbita más
    el("circle", {
      cx: C, cy: C, r: R_EQ, fill: "none", stroke: "var(--equilibrio)",
      "stroke-width": 1, "stroke-dasharray": "1 9", "stroke-linecap": "round", opacity: 0.45
    }, fondo);
    const rotulo = el("text", {
      x: C, y: C - R_EQ - 9, "text-anchor": "middle",
      fill: "var(--equilibrio)", "font-size": 12, opacity: 0.55
    }, fondo);
    rotulo.textContent = "equilibrio";

    // Sol: el tema de la reunión
    window.Astros.sol(fondo, C, C, 25, "portada");
    const tema = el("text", {
      x: C, y: C + 46, "text-anchor": "middle", fill: "var(--sol-claro)", "font-size": 12, opacity: 0.85
    }, fondo);
    tema.textContent = "tema";

    // Órbitas y planetas
    const capaOrbitas = el("g", { "aria-hidden": "true" }, svg);
    const capaPlanetas = el("g", { "aria-hidden": "true" }, svg);
    participantes.forEach(p => {
      p.orbita = el("circle", {
        cx: C, cy: C, r: p.radio, fill: "none", stroke: "var(--tinta)", "stroke-width": 0.8, opacity: 0.16
      }, capaOrbitas);
      p.grupo = el("g", {}, capaPlanetas);
      p.luz = window.Astros.planeta(p.grupo, p.color, 11, "portada");
      p.etiqueta = el("text", {
        x: 18, y: 5, fill: "var(--tinta)", "font-size": 14, "font-weight": 700
      }, p.grupo);
      p.etiqueta.textContent = p.nombre;
    });
  }

  function dibujarLista() {
    lista.innerHTML = "";
    participantes.forEach(p => {
      const li = document.createElement("li");
      const boton = document.createElement("button");
      boton.type = "button";
      boton.innerHTML =
        `<span class="punto" style="background:${p.color}"></span>` +
        `<span>${p.nombre}</span><span class="cifra"></span>`;
      boton.addEventListener("click", () => darPalabra(p));
      p.cifra = boton.querySelector(".cifra");
      p.boton = boton;
      li.appendChild(boton);
      lista.appendChild(li);
    });
    actualizarCifras();
  }

  function actualizarCifras() {
    participantes.forEach(p => {
      p.cifra.textContent = `${p.cuota} %`;
      p.boton.setAttribute("aria-label", `Dar la palabra a ${p.nombre}, ahora con ${p.cuota} % del tiempo`);
    });
  }

  function darPalabra(p) {
    p.segundos += SEGUNDOS_POR_TURNO;
    recalcular(performance.now());
    actualizarCifras();
    const diferencia = p.hacia - R_EQ;
    const lugar = Math.abs(diferencia) < 14 ? "cerca del anillo de equilibrio"
      : diferencia > 0 ? "todavía fuera del anillo" : "dentro del anillo, más cerca del tema";
    estado.textContent = `${p.nombre} ahora tiene ${p.cuota} % del tiempo y queda ${lugar}.`;
  }

  function posicionar() {
    participantes.forEach(p => {
      p.orbita.setAttribute("r", p.radio.toFixed(1));
      const x = C + p.radio * Math.cos(p.angulo);
      const y = C + p.radio * Math.sin(p.angulo);
      p.grupo.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      window.Astros.orientar(p.luz, x, y, C, C);
      // La etiqueta pasa al lado izquierdo cuando el planeta está a la derecha del lienzo
      const izquierda = x > C + 140;
      p.etiqueta.setAttribute("x", izquierda ? -18 : 18);
      p.etiqueta.setAttribute("text-anchor", izquierda ? "end" : "start");
    });
  }

  function cuadro(tiempo) {
    const visible = svg.isConnected && svg.getClientRects().length > 0;
    if (visible) {
      const dt = ultimoTiempo === null ? 0 : Math.min((tiempo - ultimoTiempo) / 1000, 0.05);
      const quieto = movimientoReducido();
      const duracion = quieto ? DURACION_CAMBIO_REDUCIDO : DURACION_CAMBIO;
      participantes.forEach(p => {
        if (p.inicio !== undefined) {
          const t = Math.min(1, Math.max(0, (tiempo - p.inicio) / duracion));
          p.radio = p.desde + (p.hacia - p.desde) * suavizar(t);
          if (t >= 1) p.inicio = undefined;
        }
        // Velocidad angular según la órbita actual: al acercarse al sol, el planeta acelera
        if (!quieto) p.angulo += dt * 0.16 * Math.sqrt(R_EQ / p.radio);
      });
      posicionar();
    }
    ultimoTiempo = tiempo;
    requestAnimationFrame(cuadro);
  }

  function iniciar() {
    svg = document.getElementById("portada-orbitas");
    lista = document.getElementById("portada-participantes");
    estado = document.getElementById("portada-estado");
    if (!svg || !lista) return;

    // Entrada única: los planetas parten del anillo de equilibrio y viajan a su órbita
    participantes = EJEMPLO.map(p => ({ ...p, radio: R_EQ }));
    recalcular(performance.now() + 300);
    dibujarEscena();
    dibujarLista();
    posicionar();
    requestAnimationFrame(cuadro);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
