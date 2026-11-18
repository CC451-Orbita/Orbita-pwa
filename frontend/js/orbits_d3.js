/**
 * orbits_d3.js — Visualización orbital con D3.js
 * Paleta sobria: Space Navy, Steel Blue, Champagne Gold y Mint.
 */

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
    this.capaFondo = null;
    this.capaOrbitas = null;
    this.capaAnillos = null;
    this.capaPlanetas = null;
    this.animacionId = null;
    this.angulos = {};
    this.participantes = [];
    this.rotar = true;

    this.inicializar();
  }

  inicializar() {
    const contenedor = document.getElementById(this.contenedorId);
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const { ancho, alto, rEq } = this.opciones;
    const cx = ancho / 2;
    const cy = alto / 2;

    this.svg = d3.select(contenedor)
      .append("svg")
      .attr("viewBox", `0 0 ${ancho} ${alto}`)
      .attr("class", "w-full h-full select-none");

    const defs = this.svg.append("defs");

    // Gradiente del sol central (Champagne Gold / Amber)
    const gradSol = defs.append("radialGradient")
      .attr("id", "d3-grad-sol")
      .attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
    gradSol.append("stop").attr("offset", "0%").attr("stop-color", "#fef3c7");
    gradSol.append("stop").attr("offset", "60%").attr("stop-color", "#d97706");
    gradSol.append("stop").attr("offset", "100%").attr("stop-color", "rgba(217, 119, 6, 0)");

    // Filtro de brillo sutil
    const filtro = defs.append("filter")
      .attr("id", "d3-brillo")
      .attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "180%");
    filtro.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    const merge = filtro.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    this.capaFondo = this.svg.append("g").attr("class", "capa-fondo");
    this.capaOrbitas = this.svg.append("g").attr("class", "capa-orbitas");
    this.capaAnillos = this.svg.append("g").attr("class", "capa-anillos");
    this.capaPlanetas = this.svg.append("g").attr("class", "capa-planetas");

    // Anillo de equilibrio (Steel Blue)
    this.capaAnillos.append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", rEq)
      .attr("fill", "none")
      .attr("stroke", "#0284c7")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "5 5")
      .attr("opacity", 0.5)
      .attr("class", "anillo-equilibrio");

    // Halo del anillo
    this.capaAnillos.append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", rEq)
      .attr("fill", "none")
      .attr("stroke", "#0284c7")
      .attr("stroke-width", 10)
      .attr("opacity", 0.05);

    // Sol central (tema activo)
    this.capaAnillos.append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", 42)
      .attr("fill", "url(#d3-grad-sol)")
      .attr("class", "halo-sol-animado");

    this.capaAnillos.append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", 22)
      .attr("fill", "#d97706")
      .attr("stroke", "#fde68a")
      .attr("stroke-width", 1.8)
      .attr("filter", "url(#d3-brillo)");

    this.capaAnillos.append("text")
      .attr("x", cx)
      .attr("y", cy + 5)
      .attr("text-anchor", "middle")
      .attr("fill", "#451a03")
      .attr("font-size", "13px")
      .attr("font-weight", "800")
      .attr("pointer-events", "none")
      .text("✦");

    this.iniciarLoopAnimacion();
  }

  actualizar(participantes, miId) {
    this.participantes = participantes || [];
    const n = Math.max(this.participantes.length, 1);
    const { ancho, alto, rEq, rMin, rMax } = this.opciones;
    const cx = ancho / 2;
    const cy = alto / 2;
    const idealShare = 1.0 / n;

    this.participantes.forEach((p, i) => {
      if (this.angulos[p.id] == null) {
        this.angulos[p.id] = (i / n) * Math.PI * 2 - Math.PI / 2;
      }
      const share = Math.max(p.share || 0, 0.02);
      const radioCalculado = rEq * Math.sqrt(idealShare / share);
      p._radio = Math.max(rMin, Math.min(rMax, p.radio_orbita || radioCalculado));
      p._tamano = p.id === miId ? 20 : 16;
    });

    const selOrbitas = this.capaOrbitas.selectAll("circle.linea-orbita")
      .data(this.participantes, d => d.id);

    selOrbitas.exit().remove();

    selOrbitas.enter()
      .append("circle")
      .attr("class", "linea-orbita")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("fill", "none")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 4")
      .merge(selOrbitas)
      .transition().duration(400)
      .attr("r", d => d._radio)
      .attr("stroke", d => d.color || "#0ea5e9")
      .attr("opacity", 0.22);

    const selPlanetas = this.capaPlanetas.selectAll("g.nodo-planeta")
      .data(this.participantes, d => d.id);

    selPlanetas.exit().remove();

    const gEnter = selPlanetas.enter()
      .append("g")
      .attr("class", d => `nodo-planeta ${d.id === miId ? 'es-mi-planeta' : ''}`)
      .attr("role", "button")
      .attr("tabindex", "0")
      .on("click", (event, d) => {
        event.stopPropagation();
        if (this.opciones.alSeleccionarPlaneta) {
          this.opciones.alSeleccionarPlaneta(d);
        }
      });

    gEnter.append("circle")
      .attr("class", "halo-planeta")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("filter", "url(#d3-brillo)");

    gEnter.append("circle")
      .attr("class", "cuerpo-planeta")
      .attr("cx", 0)
      .attr("cy", 0);

    gEnter.append("text")
      .attr("class", "inicial-planeta")
      .attr("x", 0)
      .attr("y", 4)
      .attr("text-anchor", "middle")
      .attr("fill", "#ffffff")
      .attr("font-size", "11px")
      .attr("font-weight", "800")
      .attr("pointer-events", "none");

    gEnter.append("text")
      .attr("class", "etiqueta-nombre")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .attr("fill", "#cbd5e1")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("pointer-events", "none");

    const gMerge = gEnter.merge(selPlanetas);

    gMerge.select(".halo-planeta")
      .attr("r", d => d._tamano + (d.brillo || 0.3) * 10)
      .attr("fill", d => d.color || "#0ea5e9")
      .attr("opacity", d => (d.brillo || 0.3) * 0.35);

    gMerge.select(".cuerpo-planeta")
      .attr("r", d => d._tamano)
      .attr("fill", d => d.color || "#0ea5e9")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", d => (d.id === miId ? 2 : 1));

    gMerge.select(".inicial-planeta")
      .text(d => (d.nombre || "P").charAt(0).toUpperCase());

    gMerge.select(".etiqueta-nombre")
      .attr("y", d => d._tamano + 14)
      .text(d => (d.id === miId ? `${d.nombre} (Tú)` : d.nombre));

    this.gruposPlanetas = gMerge;
  }

  iniciarLoopAnimacion() {
    const { ancho, alto, rEq } = this.opciones;
    const cx = ancho / 2;
    const cy = alto / 2;
    let ultimoTiempo = performance.now();

    const paso = (t) => {
      const delta = Math.min((t - ultimoTiempo) / 1000, 0.1);
      ultimoTiempo = t;

      if (this.rotar && this.participantes.length > 0 && this.gruposPlanetas) {
        this.participantes.forEach((p) => {
          const velocidad = 0.22 * Math.sqrt(rEq / (p._radio || rEq));
          this.angulos[p.id] = (this.angulos[p.id] || 0) + velocidad * delta;

          const angulo = this.angulos[p.id];
          const x = cx + p._radio * Math.cos(angulo);
          const y = cy + p._radio * Math.sin(angulo);

          this.capaPlanetas.selectAll("g.nodo-planeta")
            .filter(d => d.id === p.id)
            .attr("transform", `translate(${x}, ${y})`);
        });
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
