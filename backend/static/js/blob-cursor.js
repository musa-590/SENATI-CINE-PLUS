/**
 * CINE PLUS - BlobCursor (Vanilla Canvas 2D)
 * Halo líquido ambiental orgánico que acompaña al puntero del ratón con inercia,
 * deformación elástica y gradientes cálidos sin dependencias externas (cero Three.js).
 */

export function initBlobCursor(canvas, options = {}) {
  if (!canvas) return null;

  // Respetar preferencias de accesibilidad y dispositivos táctiles
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return null;

  const size = options.size || 130;
  const color = options.color || '#d9c7ae';
  const lag = options.lag ?? 0.22;
  const trailLength = options.trail || 4;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = true;
  let rafId = 0;

  // Estado del puntero y física
  let targetX = -500;
  let targetY = -500;
  let currentX = -500;
  let currentY = -500;
  let vx = 0;
  let vy = 0;
  let hasMoved = false;

  // Estela de gotas líquidas secundarias
  const trail = [];
  for (let i = 0; i < trailLength; i++) {
    trail.push({ x: -500, y: -500, vx: 0, vy: 0, size: size * (1 - (i + 1) * 0.16) });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  function onPointerMove(e) {
    targetX = e.clientX;
    targetY = e.clientY;
    if (!hasMoved) {
      currentX = targetX;
      currentY = targetY;
      trail.forEach(t => { t.x = targetX; t.y = targetY; });
      hasMoved = true;
    }
  }

  function onPointerLeave() {
    targetX = -500;
    targetY = -500;
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('mouseleave', onPointerLeave, { passive: true });

  let wobbleAngle = 0;

  function render() {
    if (!running) return;

    // Pausar renderizado si la pestaña está oculta o si el reproductor de vídeo está abierto
    if (document.hidden || document.body.classList.contains('modal-open')) {
      rafId = requestAnimationFrame(render);
      return;
    }

    wobbleAngle += 0.04;
    ctx.clearRect(0, 0, width, height);

    if (hasMoved && targetX > -100 && targetY > -100) {
      // Interpolación del cabezal principal
      const dx = targetX - currentX;
      const dy = targetY - currentY;
      vx = vx * 0.7 + dx * lag;
      vy = vy * 0.7 + dy * lag;
      currentX += vx;
      currentY += vy;

      const speed = Math.hypot(vx, vy);
      const angle = Math.atan2(vy, vx);
      const stretch = Math.min(1 + speed * 0.035, 1.6);
      const squeeze = 1 / Math.sqrt(stretch);

      // Dibujar gotas de la estela secundaria
      let prevX = currentX;
      let prevY = currentY;

      for (let i = 0; i < trail.length; i++) {
        const t = trail[i];
        const tLag = 0.28 - i * 0.04;
        t.x += (prevX - t.x) * tLag;
        t.y += (prevY - t.y) * tLag;

        const rad = Math.max(t.size * 0.5, 10);
        const grad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, rad);
        const alpha = 0.09 / (i + 1.2);
        grad.addColorStop(0, `rgba(217, 199, 174, ${alpha.toFixed(3)})`);
        grad.addColorStop(0.65, `rgba(180, 154, 120, ${(alpha * 0.4).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(10, 9, 8, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(t.x, t.y, rad, 0, Math.PI * 2);
        ctx.fill();

        prevX = t.x;
        prevY = t.y;
      }

      // Dibujar gota principal deformada con gradiente líquido
      ctx.save();
      ctx.translate(currentX, currentY);
      ctx.rotate(angle);
      ctx.scale(stretch, squeeze);

      const mainRad = size * 0.5;
      const mainGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, mainRad);
      mainGrad.addColorStop(0, 'rgba(244, 237, 226, 0.16)');
      mainGrad.addColorStop(0.35, 'rgba(217, 199, 174, 0.11)');
      mainGrad.addColorStop(0.7, 'rgba(180, 154, 120, 0.04)');
      mainGrad.addColorStop(1, 'rgba(10, 9, 8, 0)');

      ctx.fillStyle = mainGrad;
      ctx.beginPath();
      // Pequeña ondulación orgánica
      const wobbleR = mainRad + Math.sin(wobbleAngle) * 3;
      ctx.arc(0, 0, Math.max(wobbleR, 10), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    rafId = requestAnimationFrame(render);
  }

  rafId = requestAnimationFrame(render);

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('mouseleave', onPointerLeave);
      ctx.clearRect(0, 0, width, height);
    }
  };
}
