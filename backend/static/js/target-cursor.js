/**
 * Puntero interactivo de retícula (Target Cursor)
 * Sigue el ratón con física suave y resalta elementos interactivos (.cursor-target)
 */
export function initTargetCursor(selector = '.cursor-target') {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const cursor = document.getElementById('target-cursor');
  if (!cursor) return null;

  let mouseX = -100;
  let mouseY = -100;
  let currentX = -100;
  let currentY = -100;
  let isHovered = false;
  let activeTarget = null;
  let rafId = null;

  cursor.style.opacity = '1';

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;

    const target = e.target.closest(selector);
    if (target) {
      if (activeTarget !== target) {
        activeTarget = target;
        isHovered = true;
        cursor.classList.add('is-targeting');
        const label = target.getAttribute('data-cursor-label') || 'Ver tráiler';
        const labelEl = cursor.querySelector('.target-label');
        if (labelEl) labelEl.textContent = label;
      }
    } else if (isHovered) {
      isHovered = false;
      activeTarget = null;
      cursor.classList.remove('is-targeting');
    }
  }

  function loop() {
    const ease = isHovered ? 0.22 : 0.45;
    currentX += (mouseX - currentX) * ease;
    currentY += (mouseY - currentY) * ease;

    cursor.style.transform = `translate3d(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px, 0)`;

    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('mousemove', onMouseMove, { passive: true });
  rafId = requestAnimationFrame(loop);

  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
  });

  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1';
  });

  return {
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
    }
  };
}
