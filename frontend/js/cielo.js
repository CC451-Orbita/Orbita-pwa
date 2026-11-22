/**
 * cielo.js — Fondo de galaxia para la portada y el sistema solar de la reunión.
 *
 * Cada lienzo con la clase `cielo` dibuja una banda de vía láctea con nebulosas
 * tenues y estrellas que titilan. Opciones por atributo:
 *   data-cometas="si"   → cruza un cometa cada 11 a 20 s (solo en la portada;
 *                          en la reunión el cometa anuncia la llegada de alguien).
 *   data-intensidad="0.7" → atenúa nebulosas y polvo de estrellas.
 * Con «reducir movimiento» el cielo queda quieto. Con baja estimulación la CSS
 * oculta todos los cielos y el bucle deja de pintar mientras no se ven.
 */
(function () {
  function movimientoReducido() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.body.classList.contains("baja-estimulacion");
  }

  class Cielo {
    constructor(lienzo) {
      this.lienzo = lienzo;
      this.ctx = lienzo.getContext("2d");
      this.cometas = lienzo.dataset.cometas === "si";
      this.intensidadBase = parseFloat(lienzo.dataset.intensidad || "1");
      // data-titileo="no": cielo quieto, se pinta solo al cambiar de tamaño
      this.titileo = lienzo.dataset.titileo !== "no";
      this.ancho = 0;
      this.alto = 0;
      this.cometa = null;
      this.proximoCometa = performance.now() + 2500;
      this.ultimo = null;

      new ResizeObserver(() => this.ajustarTamano()).observe(lienzo);
      requestAnimationFrame(t => this.cuadro(t));
    }

    azar() {
      this.semilla = (this.semilla * 16807) % 2147483647;
      return this.semilla / 2147483647;
    }

    // Distribución aproximadamente normal, para concentrar estrellas en la banda
    normal() {
      return (this.azar() + this.azar() + this.azar() + this.azar() - 2) / 2;
    }

    /** Punto de la banda galáctica: diagonal desde abajo al centro hasta arriba a la derecha. */
    puntoBanda(t, desvio) {
      const { ancho, alto } = this;
      const x0 = ancho * 0.30, y0 = alto * 1.10;
      const x1 = ancho * 1.05, y1 = alto * -0.05;
      const dx = x1 - x0, dy = y1 - y0;
      const largo = Math.hypot(dx, dy);
      const nx = -dy / largo, ny = dx / largo;
      const curva = Math.sin(t * Math.PI) * alto * 0.06;
      return { x: x0 + dx * t + nx * (desvio + curva), y: y0 + dy * t + ny * (desvio + curva) };
    }

    static nebulosa(c, x, y, radio, color, alfa) {
      const g = c.createRadialGradient(x, y, 0, x, y, radio);
      g.addColorStop(0, `rgba(${color}, ${alfa})`);
      g.addColorStop(1, `rgba(${color}, 0)`);
      c.fillStyle = g;
      c.fillRect(x - radio, y - radio, radio * 2, radio * 2);
    }

    static estrella(c, x, y, r, alfa, tono) {
      c.globalAlpha = alfa;
      c.fillStyle = tono;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }

    dibujarFondo() {
      const { ancho, alto, escala } = this;
      this.semilla = 11;
      this.fondo = document.createElement("canvas");
      this.fondo.width = ancho * escala;
      this.fondo.height = alto * escala;
      const c = this.fondo.getContext("2d");
      c.scale(escala, escala);

      // En pantallas angostas la banda cruza el texto: se atenúa para no restar legibilidad
      const intensidad = this.intensidadBase * (ancho < 860 && this.cometas ? 0.6 : 1);
      const grosor = Math.min(ancho, alto) * 0.16;

      // Nebulosas a lo largo de la banda: violeta, azul y un toque cálido
      [
        [0.15, "110, 92, 214", 0.14, 2.2],
        [0.35, "61, 123, 224", 0.12, 2.6],
        [0.55, "150, 110, 230", 0.10, 2.0],
        [0.72, "242, 169, 59", 0.05, 1.6],
        [0.90, "80, 140, 230", 0.11, 2.3]
      ].forEach(([t, color, alfa, tam]) => {
        const p = this.puntoBanda(t, this.normal() * grosor * 0.3);
        Cielo.nebulosa(c, p.x, p.y, grosor * tam, color, alfa * intensidad);
      });

      const tonos = ["#ffffff", "#dce6ff", "#fff1d6", "#cfd9ff"];
      const area = ancho * alto;

      // Polvo de estrellas denso dentro de la banda
      const enBanda = Math.round((area / 650) * intensidad);
      for (let i = 0; i < enBanda; i++) {
        const p = this.puntoBanda(this.azar(), this.normal() * grosor);
        Cielo.estrella(c, p.x, p.y, 0.35 + this.azar() * 0.5, 0.15 + this.azar() * 0.35, tonos[i % 4]);
      }

      // Estrellas dispersas
      const dispersas = Math.round(area / 6000);
      for (let i = 0; i < dispersas; i++) {
        Cielo.estrella(c, this.azar() * ancho, this.azar() * alto,
          0.4 + this.azar() * 0.7, 0.2 + this.azar() * 0.45, tonos[i % 4]);
      }

      // Unas pocas estrellas brillantes con halo
      const brillantes = Math.max(3, Math.round(area / 200000));
      for (let i = 0; i < brillantes; i++) {
        const x = this.azar() * ancho, y = this.azar() * alto;
        c.globalAlpha = 1;
        Cielo.nebulosa(c, x, y, 7, "220, 230, 255", 0.35);
        Cielo.estrella(c, x, y, 1.3, 0.95, "#ffffff");
      }
      c.globalAlpha = 1;

      this.titilantes = Array.from({ length: Math.round(area / 30000) + 8 }, () => ({
        x: this.azar() * ancho,
        y: this.azar() * alto,
        r: 0.7 + this.azar() * 0.8,
        fase: this.azar() * Math.PI * 2,
        ritmo: 0.5 + this.azar() * 1.2
      }));
    }

    ajustarTamano() {
      const caja = this.lienzo.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) return;
      this.escala = Math.min(window.devicePixelRatio || 1, 2);
      this.ancho = caja.width;
      this.alto = caja.height;
      this.lienzo.width = Math.round(this.ancho * this.escala);
      this.lienzo.height = Math.round(this.alto * this.escala);
      this.ctx.setTransform(this.escala, 0, 0, this.escala, 0, 0);
      this.dibujarFondo();
      this.pintar(performance.now(), 0);
    }

    lanzarCometa(ahora) {
      const angulo = (24 + Math.random() * 14) * Math.PI / 180;
      const velocidad = Math.max(this.ancho, this.alto) * (0.32 + Math.random() * 0.12);
      this.cometa = {
        x: this.ancho * (0.45 + Math.random() * 0.6),
        y: -20,
        vx: -Math.cos(angulo) * velocidad,
        vy: Math.sin(angulo) * velocidad,
        cola: 120 + Math.random() * 90,
        inicio: ahora,
        vida: 2600
      };
    }

    dibujarCometa(ahora, dt) {
      const cometa = this.cometa;
      if (!cometa) return;
      const ctx = this.ctx;
      cometa.x += cometa.vx * dt;
      cometa.y += cometa.vy * dt;
      const edad = (ahora - cometa.inicio) / cometa.vida;
      if (edad >= 1 || cometa.x < -300 || cometa.y > this.alto + 300) {
        this.cometa = null;
        return;
      }
      const brillo = Math.sin(Math.min(1, edad) * Math.PI);
      const rapidez = Math.hypot(cometa.vx, cometa.vy);
      const ux = cometa.vx / rapidez, uy = cometa.vy / rapidez;
      const colaX = cometa.x - ux * cometa.cola, colaY = cometa.y - uy * cometa.cola;

      const g = ctx.createLinearGradient(cometa.x, cometa.y, colaX, colaY);
      g.addColorStop(0, `rgba(235, 242, 255, ${0.75 * brillo})`);
      g.addColorStop(0.3, `rgba(180, 205, 255, ${0.28 * brillo})`);
      g.addColorStop(1, "rgba(180, 205, 255, 0)");
      const px = -uy * 2.2, py = ux * 2.2;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cometa.x + px, cometa.y + py);
      ctx.lineTo(colaX, colaY);
      ctx.lineTo(cometa.x - px, cometa.y - py);
      ctx.closePath();
      ctx.fill();

      const halo = ctx.createRadialGradient(cometa.x, cometa.y, 0, cometa.x, cometa.y, 9);
      halo.addColorStop(0, `rgba(255, 255, 255, ${0.9 * brillo})`);
      halo.addColorStop(1, "rgba(200, 220, 255, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(cometa.x - 9, cometa.y - 9, 18, 18);
    }

    pintar(ahora, dt) {
      if (!this.fondo) return;
      const ctx = this.ctx;
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, this.ancho, this.alto);
      ctx.drawImage(this.fondo, 0, 0, this.ancho, this.alto);
      if (!this.titileo) {
        this.titilantes.forEach(e => Cielo.estrella(ctx, e.x, e.y, e.r, 0.5, "#ffffff"));
        ctx.globalAlpha = 1;
        return;
      }
      if (movimientoReducido()) {
        this.cometa = null;
        return;
      }
      const s = ahora / 1000;
      this.titilantes.forEach(e => {
        const alfa = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(s * e.ritmo + e.fase));
        Cielo.estrella(ctx, e.x, e.y, e.r, alfa, "#ffffff");
      });
      ctx.globalAlpha = 1;
      this.dibujarCometa(ahora, dt);
    }

    cuadro(ahora) {
      const visible = !document.hidden && this.lienzo.getClientRects().length > 0;
      if (visible && (this.titileo || this.cometas)) {
        const dt = this.ultimo === null ? 0 : Math.min((ahora - this.ultimo) / 1000, 0.05);
        if (this.cometas && !this.cometa && ahora >= this.proximoCometa && !movimientoReducido()) {
          this.lanzarCometa(ahora);
          this.proximoCometa = ahora + 11000 + Math.random() * 9000;
        }
        this.pintar(ahora, dt);
      }
      this.ultimo = ahora;
      requestAnimationFrame(t => this.cuadro(t));
    }
  }

  function iniciar() {
    document.querySelectorAll("canvas.cielo").forEach(lienzo => new Cielo(lienzo));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
