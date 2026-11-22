/**
 * astros.js — Sol y planetas compartidos por la portada y el radar de la reunión.
 *
 * Iluminación: cada planeta tiene una capa de luz y sombra definida con la luz
 * hacia +x. En cada cuadro esa capa se rota para mirar al sol, de modo que el
 * lado iluminado siempre apunta al tema. Cuesta un atributo `transform` por
 * planeta y cuadro; los degradados y el filtro del sol se definen una sola vez.
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";

  function el(nombre, atributos, padre) {
    const nodo = document.createElementNS(NS, nombre);
    for (const [clave, valor] of Object.entries(atributos || {})) nodo.setAttribute(clave, valor);
    if (padre) padre.appendChild(nodo);
    return nodo;
  }

  function degradadoRadial(defs, id, atributos, paradas) {
    const g = el("radialGradient", { id, ...atributos }, defs);
    paradas.forEach(([offset, color, opacidad]) =>
      el("stop", { offset, "stop-color": color, "stop-opacity": opacidad }, g));
    return g;
  }

  /** Crea los degradados y filtros con un prefijo propio para cada SVG. */
  function definir(svg, prefijo) {
    const defs = el("defs", {}, svg);

    // Corona amplia y resplandor cercano del sol
    degradadoRadial(defs, `${prefijo}-corona`, {}, [
      ["0%", "#ffc35c", 0.5], ["30%", "#f2a93b", 0.22], ["65%", "#f2a93b", 0.06], ["100%", "#f2a93b", 0]
    ]);
    // Disco con oscurecimiento hacia el borde, como una estrella real
    degradadoRadial(defs, `${prefijo}-disco`, { cx: "46%", cy: "44%", r: "60%" }, [
      ["0%", "#fff4d6", 1], ["35%", "#ffd27a", 1], ["75%", "#f5a73a", 1], ["100%", "#d9801c", 1]
    ]);

    // Granulación de la superficie: ruido fijo recortado al disco
    const filtro = el("filter", { id: `${prefijo}-granulos`, x: "0", y: "0", width: "100%", height: "100%" }, defs);
    el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.22", numOctaves: "2", seed: "4", result: "ruido" }, filtro);
    el("feColorMatrix", {
      in: "ruido", type: "matrix", result: "manchas",
      values: "0 0 0 0 0.85  0 0 0 0 0.42  0 0 0 0 0.08  2.2 0 0 0 -1.05"
    }, filtro);
    el("feComposite", { in: "manchas", in2: "SourceGraphic", operator: "in" }, filtro);

    // Lado nocturno del planeta: oscuro lejos del sol, con un terminador suave
    const noche = el("linearGradient", { id: `${prefijo}-noche`, x1: "0", y1: "0", x2: "1", y2: "0" }, defs);
    [["0%", 0.74], ["38%", 0.55], ["56%", 0.1], ["66%", 0]].forEach(([offset, opacidad]) =>
      el("stop", { offset, "stop-color": "#050b1a", "stop-opacity": opacidad }, noche));

    // Brillo del lado iluminado
    degradadoRadial(defs, `${prefijo}-brillo`, { cx: "74%", cy: "50%", r: "55%" }, [
      ["0%", "#ffffff", 0.55], ["55%", "#ffffff", 0.08], ["100%", "#ffffff", 0]
    ]);

    definiciones[prefijo] = defs;
    return defs;
  }

  const definiciones = {};

  /** Atmósfera: anillo de luz tenue del color del planeta. Un degradado por color. */
  function atmosfera(prefijo, color) {
    const id = `${prefijo}-atm-${color.replace(/[^a-z0-9]/gi, "")}`;
    const defs = definiciones[prefijo];
    if (defs && !defs.querySelector(`#${id}`)) {
      degradadoRadial(defs, id, {}, [
        ["0%", color, 0], ["60%", color, 0], ["66%", color, 0.3], ["100%", color, 0]
      ]);
    }
    return `url(#${id})`;
  }

  /** Dibuja el sol centrado en (cx, cy). */
  function sol(padre, cx, cy, radio, prefijo) {
    const g = el("g", { class: "astro-sol", "aria-hidden": "true" }, padre);
    el("circle", { cx, cy, r: radio * 2.8, fill: `url(#${prefijo}-corona)` }, g);
    el("circle", { cx, cy, r: radio, fill: `url(#${prefijo}-disco)` }, g);
    el("circle", { cx, cy, r: radio, fill: "#000", filter: `url(#${prefijo}-granulos)`, opacity: 0.38 }, g);
    return g;
  }

  /**
   * Dibuja un planeta en el origen de `padre` (que se traslada desde fuera).
   * Devuelve la capa de luz, que hay que orientar con `orientar`.
   */
  function planeta(padre, color, radio, prefijo) {
    el("circle", { class: "astro-atmosfera", r: radio * 1.55, fill: atmosfera(prefijo, color) }, padre);
    el("circle", { class: "astro-cuerpo", r: radio, fill: color }, padre);
    const luz = el("g", { class: "astro-luz" }, padre);
    el("circle", { r: radio, fill: `url(#${prefijo}-noche)` }, luz);
    el("circle", { r: radio, fill: `url(#${prefijo}-brillo)` }, luz);
    return luz;
  }

  /** Gira la capa de luz para que el lado iluminado mire hacia el sol. */
  function orientar(luz, x, y, cx, cy) {
    const grados = Math.atan2(cy - y, cx - x) * 180 / Math.PI;
    luz.setAttribute("transform", `rotate(${grados.toFixed(1)})`);
  }

  window.Astros = { definir, sol, planeta, orientar, atmosfera, el };
})();
