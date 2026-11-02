/**
 * Título interactivo elástico (Elastic Title) para el Hero de CINE PLUS
 * Renderiza "CINE PLUS" con estética cromática metálica, deformación elástica y física de resortes
 */
export function initElasticMesh(canvas) {
  if (!canvas) return null;

  const text = canvas.getAttribute('data-text') || 'CINE PLUS';
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let width = 0;
  let height = 0;
  let rafId = 0;
  let mouse = { x: -1000, y: -1000, isDown: false, vx: 0, vy: 0 };
  let spring = { x: 0, y: 0, vx: 0, vy: 0, wobble: 0 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width * dpr;
    height = rect.height * dpr;
    canvas.width = width;
    canvas.height = height;
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const nx = (e.clientX - rect.left) * dpr;
    const ny = (e.clientY - rect.top) * dpr;
    mouse.vx = nx - mouse.x;
    mouse.vy = ny - mouse.y;
    mouse.x = nx;
    mouse.y = ny;

    // Distancia al centro del texto
    const dx = nx - width / 2;
    const dy = ny - height / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < width * 0.4) {
      spring.vx += (dx / dist) * 2.5;
      spring.vy += (dy / dist) * 2.5;
      spring.wobble = 1.0;
    }
  }

  function onMouseLeave() {
    mouse.x = -1000;
    mouse.y = -1000;
  }

  canvas.addEventListener('mousemove', onMouseMove, { passive: true });
  canvas.addEventListener('mouseleave', onMouseLeave, { passive: true });

  let time = 0;
  function render() {
    time += 0.02;

    // Física del resorte (deformación y rebote)
    const k = 0.08;
    const damp = 0.88;
    spring.vx += -spring.x * k;
    spring.vy += -spring.y * k;
    spring.vx *= damp;
    spring.vy *= damp;
    spring.x += spring.vx;
    spring.y += spring.vy;
    spring.wobble *= 0.96;

    ctx.clearRect(0, 0, width, height);

    // Calcular tamaño de fuente responsivo
    const fontSize = Math.min(width / 6.2, height * 0.65);
    ctx.font = `900 ${fontSize}px "Archivo Black", "Arial Black", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cx = width / 2 + spring.x;
    const cy = height / 2 + spring.y;

    // 1. Sombra suave de oclusión
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = 'rgba(10, 8, 7, 0.4)';
    ctx.fillText(text, cx, cy + 4);
    ctx.restore();

    // 2. Base metálica cromada cálida (Gradiente principal)
    const grad = ctx.createLinearGradient(
      cx - width * 0.35,
      cy - fontSize * 0.5,
      cx + width * 0.35,
      cy + fontSize * 0.5
    );
    grad.addColorStop(0.0, '#b8a68e');
    grad.addColorStop(0.2, '#f4ede2');
    grad.addColorStop(0.45, '#c9b79f');
    grad.addColorStop(0.7, '#8f7e6a');
    grad.addColorStop(0.85, '#f5efe6');
    grad.addColorStop(1.0, '#a3927d');

    ctx.fillStyle = grad;
    ctx.fillText(text, cx, cy);

    // 3. Resplandor especular dinámico
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const specGrad = ctx.createLinearGradient(
      cx - fontSize * 2 + Math.sin(time) * 40,
      cy - fontSize,
      cx + fontSize * 2 + Math.cos(time) * 40,
      cy + fontSize
    );
    specGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0)');
    specGrad.addColorStop(0.48, 'rgba(255, 255, 255, 0.65)');
    specGrad.addColorStop(0.52, 'rgba(255, 255, 255, 0.95)');
    specGrad.addColorStop(0.56, 'rgba(255, 255, 255, 0.65)');
    specGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = specGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // 4. Borde fino nítido
    ctx.lineWidth = Math.max(1, fontSize * 0.015);
    ctx.strokeStyle = 'rgba(244, 237, 226, 0.28)';
    ctx.strokeText(text, cx, cy);

    rafId = requestAnimationFrame(render);
  }

  // Esperar a que la fuente esté lista
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      rafId = requestAnimationFrame(render);
    });
  } else {
    rafId = requestAnimationFrame(render);
  }

  return {
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    }
  };
}
