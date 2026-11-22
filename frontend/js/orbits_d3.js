/**
 * orbits_d3.js — Sistema solar de la reunión.
 *
 * Cada participante es un planeta alrededor del tema (el sol). El radio sigue la
 * regla rEq · √(cuota ideal / cuota real): quien aporta más se acerca al sol.
 * Los cambios de órbita se animan como una transferencia suave y cada persona
 * que entra a la sala llega como un cometa. El sol y los planetas se dibujan con
 * astros.js, que orienta la luz de cada planeta hacia el sol.
 */

const PREFIJO_RADAR = "radar";
const DURACION_CAMBIO = 1800;
const DURACION_REDUCIDA = 450;
const DURACION_LLEGADA = 2600;

function suavizar(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

class D3OrbitalSystem {
  constructor(contenedorId, opciones = {}) {
    this.contenedorId = contenedorId;
    this.opciones = Object.assign({
      ancho: 500,
      alto: 500,
      rEq: 140,
      rMin: 64,
      rMax: 224,
      alSeleccionarPlaneta: null
    }, opciones);

    this.svg = null;
    this.animacionId = null;
    this.participantes = [];
    this.estados = new Map();      // id → { radio, desde, hacia, inicio, angulo, llegada, nodos }
    this.llegadas = new Set();     // ids que deben entrar como cometa
    this.rotar = true;

    this.inicializar();
  }

  get movimientoReducido() {
    return !this.rotar || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  inicializar() {
    const contenedor = document.getElementById(this.contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const { el } = window.Astros;
    const { ancho, alto, rEq } = this.opciones;
    this.cx = ancho / 2;
    this.cy = alto / 2;

    this.svg = el("svg", {
      viewBox: `0 0 ${ancho} ${alto}`,
      class: "w-full h-full select-none",
      role: "group",
      "aria-label": "Sistema solar de la reunión: cada planeta es una persona y su distancia al tema indica cuánto ha aportado"
    }, contenedor);
    this.defs = window.Astros.definir(this.svg, PREFIJO_RADAR);

    // Anillo de equilibrio: referencia discreta, no una órbita más
    const fondo = el("g", { "aria-hidden": "true" }, this.svg);
    el("circle", {
      cx: this.cx, cy: this.cy, r: rEq, fill: "none", stroke: "var(--equilibrio)",
      "stroke-width": 1, "stroke-dasharray": "1 9", "stroke-linecap": "round", opacity: 0.45
    }, fondo);
    const rotulo = el("text", {
      x: this.cx, y: this.cy - rEq - 9, "text-anchor": "middle",
      fill: "var(--equilibrio)", "font-size": 12, opacity: 0.55
    }, fondo);
    rotulo.textContent = "equilibrio";

    window.Astros.sol(fondo, this.cx, this.cy, 24, PREFIJO_RADAR);
    const tema = el("text", {
      x: this.cx, y: this.cy + 44, "text-anchor": "middle",
      fill: "var(--sol-claro)", "font-size": 12, opacity: 0.85
    }, fondo);
    tema.textContent = "tema";

    this.capaOrbitas = el("g", { "aria-hidden": "true" }, this.svg);
    this.capaColas = el("g", { "aria-hidden": "true" }, this.svg);
    this.capaPlanetas = el("g", {}, this.svg);

    // Aviso para lectores de pantalla cuando alguien entra
    this.aviso = document.createElement("p");
    this.aviso.className = "sr-only";
    this.aviso.setAttribute("aria-live", "polite");
    contenedor.appendChild(this.aviso);

    this.iniciarLoopAnimacion();
  }

  /** Marca a un participante nuevo para que entre como cometa en la próxima actualización. */
  anunciarLlegada(id) {
    this.llegadas.add(id);
  }

  /**
   * Ángulo inicial para un planeta nuevo: el centro del mayor hueco entre los
   * planetas que ya están en el sistema, para que no aparezca encima de otro.
   */
  anguloLibre(i, n) {
    const ocupados = [...this.estados.values()]
      .map(e => ((e.angulo % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))
      .sort((a, b) => a - b);
    if (ocupados.length === 0) return (i / n) * Math.PI * 2 - Math.PI / 2;
    let mejor = ocupados[0] + Math.PI, hueco = 0;
    ocupados.forEach((a, k) => {
      const siguiente = k + 1 < ocupados.length ? ocupados[k + 1] : ocupados[0] + 2 * Math.PI;
      if (siguiente - a > hueco) {
        hueco = siguiente - a;
        mejor = a + hueco / 2;
      }
    });
    return mejor;
  }

  cuotaDe(p, total) {
    if (typeof p.share === "number") return p.share;
    return total > 0 ? (p.segundos_habla || 0) / total : 0;
  }

  actualizar(participantes, miId) {
    if (!this.svg) return;
    this.participantes = participantes || [];
    const n = Math.max(this.participantes.length, 1);
    const { rEq, rMin, rMax } = this.opciones;
    const ideal = 1 / n;
    const total = this.participantes.reduce((s, p) => s + (p.segundos_habla || 0), 0);
    const ahora = performance.now();
    const vigentes = new Set();
    // Al montar el sistema, todos se reparten por igual; después, cada recién llegado busca un hueco
    const primeraCarga = this.estados.size === 0;

    this.participantes.forEach((p, i) => {
      vigentes.add(p.id);
      const cuota = this.cuotaDe(p, total);
      const meta = Math.max(rMin, Math.min(rMax, p.radio_orbita || rEq * Math.sqrt(ideal / Math.max(cuota, 0.02))));
      let estado = this.estados.get(p.id);

      if (!estado) {
        const angulo = primeraCarga ? (i / n) * Math.PI * 2 - Math.PI / 2 : this.anguloLibre(i, n);
        estado = { radio: meta, hacia: meta, angulo };
        if (this.llegadas.has(p.id)) {
          estado.llegada = { inicio: ahora };
          this.aviso.textContent = `${p.nombre} se unió a la sala.`;
        }
        this.llegadas.delete(p.id);
        estado.nodos = this.crearPlaneta(p, p.id === miId);
        this.estados.set(p.id, estado);
      } else if (Math.abs(meta - estado.hacia) > 0.5) {
        estado.desde = estado.radio;
        estado.hacia = meta;
        estado.inicio = ahora;
      }

      estado.datos = p;
      const nombre = p.id === miId ? `${p.nombre} (tú)` : p.nombre;
      estado.nodos.etiqueta.textContent = nombre;
      estado.nodos.grupo.setAttribute("aria-label",
        `${nombre}: ${Math.round(cuota * 100)} % del tiempo de palabra. Ver detalle.`);
    });

    // Participantes que salieron
    for (const [id, estado] of this.estados) {
      if (vigentes.has(id)) continue;
      estado.nodos.grupo.remove();
      estado.nodos.orbita.remove();
      estado.nodos.cola.remove();
      this.estados.delete(id);
    }
  }

  crearPlaneta(p, esMio) {
    const { el } = window.Astros;
    const tamano = esMio ? 16 : 13;
    const color = p.color || "#6cb6ff";

    const orbita = el("circle", {
      cx: this.cx, cy: this.cy, fill: "none", stroke: "var(--tinta)", "stroke-width": 0.8, opacity: 0.16
    }, this.capaOrbitas);
    const cola = el("path", { fill: color, opacity: 0 }, this.capaColas);

    const grupo = el("g", { class: "nodo-planeta", role: "button", tabindex: "0" }, this.capaPlanetas);
    el("circle", { class: "foco-planeta", r: tamano + 9, fill: "none", stroke: "var(--sol-claro)", "stroke-width": 2 }, grupo);
    if (esMio) {
      // Anillo fino que distingue tu planeta
      el("circle", { r: tamano + 5, fill: "none", stroke: "var(--tinta)", "stroke-width": 1.2, opacity: 0.7 }, grupo);
    }
    const luz = window.Astros.planeta(grupo, color, tamano, PREFIJO_RADAR);
    const destello = el("circle", { r: tamano * 1.3, fill: "#fff", opacity: 0 }, grupo);
    const etiqueta = el("text", {
      class: "etiqueta-planeta", y: tamano + 17, "text-anchor": "middle",
      fill: "var(--tinta)", "font-size": 12, "font-weight": 700
    }, grupo);

    const seleccionar = (evento) => {
      evento.stopPropagation();
      const estado = this.estados.get(p.id);
      if (this.opciones.alSeleccionarPlaneta && estado) this.opciones.alSeleccionarPlaneta(estado.datos);
    };
    grupo.addEventListener("click", seleccionar);
    grupo.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" || evento.key === " ") {
        evento.preventDefault();
        seleccionar(evento);
      }
    });

    return { grupo, orbita, cola, luz, destello, etiqueta, tamano };
  }

  /** Cola de cometa: una cuña que se afina hacia atrás desde la cabeza. */
  dibujarCola(nodos, x, y, x0, y0, intensidad) {
    const dx = x - x0, dy = y - y0;
    const largo = Math.hypot(dx, dy);
    if (largo < 0.5 || intensidad <= 0) {
      nodos.cola.setAttribute("opacity", 0);
      return;
    }
    const ux = dx / largo, uy = dy / largo;
    const extension = 95 * intensidad + 10;
    const ancho = nodos.tamano * 0.55;
    const px = -uy * ancho, py = ux * ancho;
    const fx = x - ux * extension, fy = y - uy * extension;
    nodos.cola.setAttribute("d",
      `M${(x + px).toFixed(1)} ${(y + py).toFixed(1)} L${fx.toFixed(1)} ${fy.toFixed(1)} L${(x - px).toFixed(1)} ${(y - py).toFixed(1)} Z`);
    nodos.cola.setAttribute("opacity", (0.45 * intensidad).toFixed(2));
  }

  iniciarLoopAnimacion() {
    const { rEq } = this.opciones;
    let ultimo = performance.now();

    const paso = (t) => {
      const dt = Math.min((t - ultimo) / 1000, 0.1);
      ultimo = t;
      const visible = this.svg && this.svg.getClientRects().length > 0;

      if (visible) {
        const reducido = this.movimientoReducido;
        const duracion = reducido ? DURACION_REDUCIDA : DURACION_CAMBIO;

        for (const estado of this.estados.values()) {
          const { nodos } = estado;

          // Transferencia entre órbitas
          if (estado.inicio !== undefined) {
            const avance = Math.min(1, Math.max(0, (t - estado.inicio) / duracion));
            estado.radio = estado.desde + (estado.hacia - estado.desde) * suavizar(avance);
            if (avance >= 1) estado.inicio = undefined;
          }
          if (!reducido) estado.angulo += 0.22 * Math.sqrt(rEq / estado.radio) * dt;

          let radio = estado.radio;
          let angulo = estado.angulo;
          let opacidad = 1;
          let opacidadOrbita = 0.16;

          if (estado.llegada) {
            const avance = Math.min(1, (t - estado.llegada.inicio) / (reducido ? DURACION_REDUCIDA : DURACION_LLEGADA));
            if (reducido) {
              // Sin cometa: el planeta aparece en su órbita
              opacidad = avance;
            } else {
              // Llega en espiral desde fuera del radar y frena al entrar en su órbita
              const e = 1 - Math.pow(1 - avance, 3);
              radio = 340 + (estado.radio - 340) * e;
              angulo = estado.angulo - 1.3 * (1 - e);
              nodos.destello.setAttribute("opacity", (0.5 * (1 - avance)).toFixed(2));
            }
            opacidadOrbita = 0.16 * avance;
            if (avance >= 1) {
              estado.llegada = undefined;
              nodos.destello.setAttribute("opacity", 0);
            }
          }

          const x = this.cx + radio * Math.cos(angulo);
          const y = this.cy + radio * Math.sin(angulo);

          if (estado.llegada && !reducido && estado.x !== undefined) {
            const avance = (t - estado.llegada.inicio) / DURACION_LLEGADA;
            this.dibujarCola(nodos, x, y, estado.x, estado.y, 1 - avance);
          } else {
            nodos.cola.setAttribute("opacity", 0);
          }

          estado.x = x;
          estado.y = y;
          nodos.grupo.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
          nodos.grupo.setAttribute("opacity", opacidad.toFixed(2));
          nodos.orbita.setAttribute("r", estado.radio.toFixed(1));
          nodos.orbita.setAttribute("opacity", opacidadOrbita.toFixed(3));
          window.Astros.orientar(nodos.luz, x, y, this.cx, this.cy);
        }
      }

      this.animacionId = requestAnimationFrame(paso);
    };

    this.animacionId = requestAnimationFrame(paso);
  }

  detener() {
    if (this.animacionId) cancelAnimationFrame(this.animacionId);
  }
}

window.D3OrbitalSystem = D3OrbitalSystem;
