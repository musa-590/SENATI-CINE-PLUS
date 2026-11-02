/**
 * OptionWheel (Vanilla ESM) — envuelve una lista server-rendered y la transforma
 * en una rueda cilíndrica vertical en desktop. En táctil/móvil actúa como fallback
 * accesible por scroll nativo.
 *
 * Uso:
 *   initOptionWheel(container, {
 *     items:   [{ id, label, slug, accent, count }], // opcional: si no, se leen hijos
 *     onSelect: (item, index) => void,              // opcional
 *     defaultIndex: 0,
 *     curve, tilt, spacing, fade, blur, minOpacity,
 *   });
 */

export function initOptionWheel(container, options = {}) {
  if (!container) return null;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 980;
  const candidateChildren = Array.from(container.children || []);
  const children = options.itemSelector
    ? Array.from(container.querySelectorAll(options.itemSelector))
    : (candidateChildren.length === 1 && candidateChildren[0].children.length > 1)
      ? Array.from(candidateChildren[0].children)
      : candidateChildren;
  if (!children.length) return null;

  const {
    items = children.map((el, index) => ({
      index,
      label: el.textContent.trim(),
      slug: el.dataset?.slug || '',
      accent: el.dataset?.accent || '',
      count: null,
      node: el,
    })),
    onSelect = null,
    defaultIndex = items.findIndex((it) => it.node?.classList?.contains('is-active')) ?? 0,
    curve = 0.92,
    spacing = 46,
    tilt = 6,
    fade = 0.14,
    blur = 0.25,
    minOpacity = 0.38,
  } = options;

  let activeIndex = Math.max(0, defaultIndex < 0 ? 0 : defaultIndex);
  let rafId = 0;
  let pos = activeIndex;
  let target = activeIndex;
  let drag = null;
  let destroyed = false;

  container.classList.add('option-wheel');
  container.setAttribute('role', 'listbox');
  if (!container.hasAttribute('tabindex')) container.tabIndex = 0;

  items.forEach((item, index) => {
    const node = item.node || container.children[index];
    if (node) node.classList.add('option-wheel__item');
    item.node = node;
  });

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function row(indexDelta) {
    // Proyección vertical: elementos por encima/abajo del centro.
    const d = indexDelta - pos;
    const tiltRad = (Math.PI * tilt) / 180;
    const R = tiltRad > 0.0005 ? spacing / tiltRad : 0;
    const ang = R > 0 ? Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad)) : 0;
    const y = R > 0 ? R * Math.sin(ang) : d * spacing;
    const x = R > 0 ? -curve * R * (1 - Math.cos(ang)) : 0;
    const rot = R > 0 ? (ang * 180) / Math.PI : 0;
    const dist = Math.abs(d);
    const opacity = Math.max(minOpacity, 1 - dist * fade);
    const blurPx = blur > 0 ? blur * dist : 0;
    return { d, y, x, rot, dist, opacity, blurPx };
  }

  function paint() {
    if (destroyed) return;
    const rect = container.getBoundingClientRect();
    const h = rect.height || container.clientHeight || 260;
    const centerOffset = h / 2;

    items.forEach((item, index) => {
      const node = item.node;
      if (!node) return;
      const state = row(index);

      node.style.transform = `translate3d(${state.x.toFixed(2)}px, ${
        centerOffset + state.y - node.offsetHeight / 2
      }px, 0) rotateX(${state.rot.toFixed(3)}deg)`;
      node.style.opacity = state.opacity.toFixed(3);
      node.style.filter = state.blurPx > 0 ? `blur(${state.blurPx.toFixed(2)}px)` : 'none';
      node.style.zIndex = String(1000 - Math.round(state.dist * 10));

      const selected = Math.round(pos) === index;
      node.classList.toggle('option-wheel__item--selected', selected);
      node.setAttribute('aria-selected', String(selected ? 'true' : 'false'));
      item.node.style.pointerEvents = 'auto';
    });
  }

  function stopRAF() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function step() {
    if (destroyed) return;
    pos += (target - pos) * 0.22;
    if (Math.abs(target - pos) < 0.001) {
      pos = target;
      rafId = 0;
      paint();
      return;
    }
    paint();
    rafId = window.requestAnimationFrame(step);
  }

  function ease() {
    if (destroyed) return;
    if (!rafId) {
      rafId = window.requestAnimationFrame(step);
    }
  }

  function goto(index, animate = true, silent = false) {
    const clamped = clamp(index, 0, items.length - 1);
    target = clamped;
    const changed = activeIndex !== clamped;
    if (animate) {
      ease();
    } else {
      pos = target;
      paint();
    }
    activeIndex = clamped;
    container.setAttribute('aria-activedescendant', items[activeIndex]?.node?.id || '');
    if (!silent && changed && typeof onSelect === 'function') {
      onSelect(items[activeIndex], activeIndex);
    }
    return activeIndex;
  }

  function wheel(e) {
    if (destroyed) return;
    e.preventDefault();
    const delta = Math.sign(e.deltaY || 0);
    goto(activeIndex + delta, true);
  }

  function onPointerDown(e) {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    drag = { y: e.clientY, start: target, active: false };
    container.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 5) drag.active = true;
    target = clamp(drag.start - dy / spacing, 0, items.length - 1);
    ease();
  }

  function onPointerUp(e) {
    if (!drag) return;
    if (drag.active) goto(Math.round(target), true);
    drag = null;
    try {
      container.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      goto(activeIndex + 1, true);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      goto(activeIndex - 1, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      goto(0, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      goto(items.length - 1, true);
    }
  }

  function onResize() {
    paint();
  }

  let running = !prefersReduced && !coarse;
  items.forEach((item) => {
    item.node?.addEventListener('click', () => {
      const idx = items.indexOf(item);
      goto(idx, true, !!onSelect);
    });
  });

  if (running) {
    container.classList.add('option-wheel-active');
    container.addEventListener('wheel', wheel, { passive: false });
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize, { passive: true });
    goto(activeIndex, false, true);
    paint();
  } else {
    container.classList.add('option-wheel-static');
    container.classList.remove('option-wheel-active');
    items.forEach((item) => {
      if (item.node) {
        item.node.style.transform = '';
        item.node.style.opacity = '';
        item.node.style.filter = '';
        item.node.style.zIndex = '';
      }
    });
  }

  function destroy() {
    destroyed = true;
    stopRAF();
    running = false;
    container.removeEventListener('wheel', wheel);
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerUp);
    container.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', onResize);
    container.classList.remove('option-wheel', 'option-wheel-active', 'option-wheel-static');
    items.forEach((item) => item.node?.classList.remove('option-wheel__item', 'option-wheel__item--selected'));
  }

  function setIndex(index) {
    goto(index, true, true);
  }

  return { destroy, setIndex, goto };
}
