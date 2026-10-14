/* ============================================================
   Interfaz no convencional: sistema solar de la reunión (RF-07, RF-08)
   - Distancia al sol = participación: muy cerca = domina, muy lejos = no ha aportado.
   - Anillo punteado = órbita de equilibrio (todos aportan parecido).
   - Brillo = aporte reciente. Sin números ni rankings en pantalla compartida.
   ============================================================ */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const C = 250, R_EQ = 140, R_MIN = 62, R_MAX = 228;
  const angulos = {};
  let svg, capaPlanetas, anilloVentana, raf = null, girar = true;

  function el(tag, attrs, padre) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(e);
    return e;
  }

  window.Orbitas = {
    montar(contenedor) {
      contenedor.innerHTML = '';
      svg = el('svg', { viewBox: '0 0 500 500', role: 'img', 'aria-label': 'Sistema solar de la reunión: cada planeta es un participante' }, contenedor);
      const defs = el('defs', {}, svg);
      const g = el('radialGradient', { id: 'sol' }, defs);
      el('stop', { offset: '0%', 'stop-color': '#FFE8A8' }, g);
      el('stop', { offset: '60%', 'stop-color': '#F5B94A' }, g);
      el('stop', { offset: '100%', 'stop-color': '#F5B94A', 'stop-opacity': '0' }, g);
      const f = el('filter', { id: 'brillo', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
      el('feGaussianBlur', { stdDeviation: '6', result: 'b' }, f);
      const m = el('feMerge', {}, f); el('feMergeNode', { in: 'b' }, m); el('feMergeNode', { in: 'SourceGraphic' }, m);

      anilloVentana = el('circle', { cx: C, cy: C, r: R_EQ, class: 'anillo-ventana', fill: 'none' }, svg);
      el('circle', { cx: C, cy: C, r: R_EQ, class: 'orbita-equilibrio', fill: 'none' }, svg);
      el('circle', { cx: C, cy: C, r: 70, fill: 'url(#sol)' }, svg);
      el('circle', { cx: C, cy: C, r: 30, fill: '#FFD27A' }, svg);
      capaPlanetas = el('g', {}, svg);
    },

    /* participantes: [{id,nombre,color,share,reciente(0..1),esTu}] */
    dibujar(participantes, opciones = {}) {
      if (!svg) return;
      girar = !opciones.bajaEstimulacion;
      const n = participantes.length || 1, ideal = 1 / n;
      capaPlanetas.innerHTML = '';
      participantes.forEach((p, i) => {
        if (angulos[p.id] == null) angulos[p.id] = (i / n) * Math.PI * 2 - Math.PI / 2;
        const share = Math.max(p.share, 0.015);
        const r = Math.max(R_MIN, Math.min(R_MAX, R_EQ * Math.sqrt(ideal / share)));
        p._r = r;
        const a = angulos[p.id];
        const x = C + r * Math.cos(a), y = C + r * Math.sin(a);
        el('circle', { cx: C, cy: C, r, fill: 'none', class: 'orbita-traza' }, capaPlanetas);
        const grupo = el('g', { class: 'planeta' + (p.esTu ? ' es-tu' : ''), transform: `translate(${x},${y})` }, capaPlanetas);
        const radio = 15 + (p.esTu ? 3 : 0);
        el('circle', { r: radio, fill: p.color, opacity: 0.35 + 0.65 * Math.max(0.25, p.reciente), filter: p.reciente > 0.5 ? 'url(#brillo)' : '' }, grupo);
        if (p.esTu) el('circle', { r: radio + 5, fill: 'none', stroke: '#fff', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }, grupo);
        const t = el('text', { y: radio + 15, 'text-anchor': 'middle', class: 'etiqueta-planeta' }, grupo);
        t.textContent = p.esTu ? p.nombre + ' (tú)' : p.nombre;
      });
    },

    avanzarGiro(participantes) {
      if (!girar) return;
      participantes.forEach(p => { angulos[p.id] = (angulos[p.id] || 0) + 0.0016 * (R_EQ / (p._r || R_EQ)); });
    },

    ventana(activa) { anilloVentana?.classList.toggle('activa', !!activa); },

    /* Texto equivalente para la lista accesible (lector de pantalla). */
    describir(p, n) {
      const ideal = 1 / n;
      if (p.share > ideal * 1.6) return 'muy cerca del sol';
      if (p.share < ideal * 0.4) return 'lejos del sol, aún sin aportar mucho';
      return 'en la órbita de equilibrio';
    }
  };
})();
