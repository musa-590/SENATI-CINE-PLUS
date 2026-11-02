/**
 * Efecto interactivo de cuadrícula cromática (ChromaGrid)
 * Maneja el foco de luz dinámico al interactuar con las tarjetas de películas
 */
export function initChromaGrid(root = document.getElementById('movies-grid')) {
  if (!root) return null;

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let rafId = 0;
  let tx = -9999;
  let ty = -9999;
  let cx = -9999;
  let cy = -9999;
  let targetPower = 0;
  let currentPower = 0;

  function update() {
    rafId = 0;
    const dt = 0.15;
    cx += (tx - cx) * dt;
    cy += (ty - cy) * dt;
    currentPower += (targetPower - currentPower) * dt;

    root.style.setProperty('--chroma-x', `${cx.toFixed(1)}px`);
    root.style.setProperty('--chroma-y', `${cy.toFixed(1)}px`);
    root.style.setProperty('--chroma-power', currentPower.toFixed(3));

    if (Math.abs(targetPower - currentPower) > 0.01 || Math.abs(tx - cx) > 1 || Math.abs(ty - cy) > 1) {
      rafId = requestAnimationFrame(update);
    }
  }

  function onPointerMove(e) {
    const rect = root.getBoundingClientRect();
    tx = e.clientX - rect.left;
    ty = e.clientY - rect.top;
    targetPower = 1;

    if (!rafId && !reduce) {
      rafId = requestAnimationFrame(update);
    }
  }

  function onPointerLeave() {
    targetPower = 0;
    if (!rafId && !reduce) {
      rafId = requestAnimationFrame(update);
    }
  }

  root.addEventListener('pointermove', onPointerMove, { passive: true });
  root.addEventListener('pointerleave', onPointerLeave, { passive: true });

  return {
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
    }
  };
}
