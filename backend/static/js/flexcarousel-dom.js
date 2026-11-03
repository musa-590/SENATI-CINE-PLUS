/**
 * CINE PLUS - Carrusel de portada (nativo, sin dependencias).
 *
 * Interacción:
 *  - Arrastre con ratón y deslizamiento táctil (con inercia y ajuste a la tarjeta más cercana).
 *  - Flechas prev/next, teclado (←/→, Inicio/Fin, Intro/Espacio) y rueda horizontal.
 *  - Autoplay que se pausa al pasar el ratón, al enfocar, al arrastrar, al abrirse el
 *    tráiler y con la pestaña en segundo plano; se reanuda tras unos segundos sin uso.
 *  - Bucle infinito real: la pista contiene tres copias de la lista y el índice se
 *    recoloca de banda sin salto visible.
 */

const BAND_COPIES = 3;
const DRAG_THRESHOLD = 6;
const WHEEL_COOLDOWN = 240;

export function initFlexCarousel(container, items = [], onSelect = null, options = {}) {
  if (!container || !items || !items.length) return null;

  const settings = {
    interval: Math.max(1.5, Number(options.interval ?? 4.2)) * 1000,
    autoplay: options.autoplay !== false,
    onChange: typeof options.onChange === 'function' ? options.onChange : null,
    onSelect: typeof onSelect === 'function' ? onSelect : null
  };

  const total = items.length;
  const loop = total * BAND_COPIES;

  /* ---------- estructura ---------- */

  container.classList.add('flex-carousel');
  container.querySelectorAll('[data-carousel-viewport]').forEach((node) => node.remove());
  container.tabIndex = 0;
  container.setAttribute('role', 'region');
  container.setAttribute('aria-roledescription', 'carrusel');
  if (!container.getAttribute('aria-label')) {
    container.setAttribute('aria-label', 'Películas en portada');
  }

  const viewport = document.createElement('div');
  viewport.className = 'carousel-viewport';
  viewport.dataset.carouselViewport = '';

  const track = document.createElement('div');
  track.className = 'flex-carousel__track';
  viewport.append(track);

  const repeated = [];
  for (let copy = 0; copy < BAND_COPIES; copy += 1) {
    repeated.push(...items);
  }

  const cards = repeated.map((item, position) => {
    const cardIndex = position % total;
    const isClone = position < total || position >= total * 2;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'flex-carousel__card';
    card.dataset.index = String(position);
    card.tabIndex = -1;
    if (isClone) {
      card.setAttribute('aria-hidden', 'true');
    } else {
      card.setAttribute('aria-label', `Abrir el tráiler de ${item.title || 'la película'}`);
    }

    const poster = document.createElement('img');
    poster.className = 'flex-carousel__poster';
    poster.src = item.src;
    poster.alt = '';
    poster.decoding = 'async';
    poster.loading = isClone ? 'lazy' : 'eager';
    poster.draggable = false;

    const info = document.createElement('span');
    info.className = 'flex-carousel__info';
    const name = document.createElement('strong');
    name.textContent = item.title || 'Película destacada';
    const meta = document.createElement('span');
    meta.textContent = [item.category, item.year].filter(Boolean).join(' · ') || 'Tráiler oficial';
    info.append(name, meta);

    card.append(poster, info);
    track.append(card);
    return { card, item, position, cardIndex };
  });

  container.append(viewport);
  const liveRegion = container.querySelector('#carousel-live');

  /* ---------- geometría ---------- */

  let stageWidth = 1;
  let cardWidth = 1;
  let stride = 1;
  let index = total;
  let currentX = 0;
  let lastItemIndex = -1;

  function measure() {
    stageWidth = Math.max(1, container.clientWidth || container.getBoundingClientRect().width || 1);
    cardWidth = Math.max(1, cards[0]?.card.offsetWidth || 1);
    const gapStyle = window.getComputedStyle(track);
    const gap = parseFloat(gapStyle.columnGap || gapStyle.gap || '0') || 0;
    stride = Math.max(1, cardWidth + gap);
  }

  const centerOf = (position) => stageWidth / 2 - (position * stride + cardWidth / 2);
  const nearestPosition = (x) => Math.round((stageWidth / 2 - x - cardWidth / 2) / stride);
  const clampPosition = (position) => Math.max(0, Math.min(loop - 1, position));

  function applyX(x, animate) {
    currentX = x;
    if (animate) {
      // Devuelve el control al CSS (transición normal del carrusel).
      track.style.removeProperty('transition');
    } else {
      // Los saltos y el arrastre deben ser instantáneos; `!important` gana incluso a
      // la regla global de movimiento reducido, que también usa !important.
      track.style.setProperty('transition', 'none', 'important');
    }
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    syncActiveCard(x);
  }

  /** Resalta la tarjeta más cercana al centro mientras se mueve la pista. */
  let activeCard = -1;

  function syncActiveCard(x) {
    const position = clampPosition(nearestPosition(x));
    if (position === activeCard) return;
    if (activeCard >= 0) cards[activeCard]?.card.classList.remove('is-active');
    activeCard = position;
    cards[activeCard]?.card.classList.add('is-active');
  }

  /** Mantiene el índice en la copia central desplazando el píxel lo mismo (sin salto visible). */
  function alignBand() {
    if (index >= total && index < total * 2) return false;
    while (index < total) index += total;
    while (index >= total * 2) index -= total;
    applyX(centerOf(index), false);
    return true;
  }

  function notify(force = false) {
    const itemIndex = ((index % total) + total) % total;
    if (!force && itemIndex === lastItemIndex) return;
    lastItemIndex = itemIndex;
    if (settings.onChange) settings.onChange(itemIndex, items[itemIndex]);
    if (liveRegion) {
      const item = items[itemIndex];
      const meta = [item.category, item.year].filter(Boolean).join(' · ');
      liveRegion.textContent = `${item.title || 'Película destacada'}${meta ? ` · ${meta}` : ''} (${itemIndex + 1} de ${total})`;
    }
  }

  /** Ajusta la pista a la tarjeta más cercana a la posición visual `x`. */
  function settle(x, animate = true) {
    index = clampPosition(nearestPosition(x));
    applyX(centerOf(index), animate);
    notify();
  }

  function goTo(position, animate = true) {
    alignBand();
    index = clampPosition(position);
    applyX(centerOf(index), animate);
    notify();
    interacted();
  }

  function step(delta) {
    alignBand();
    goTo(index + delta);
  }

  /* ---------- autoplay ---------- */

  let ticker = 0;
  let idle = 0;
  let hovering = false;
  let focused = false;
  let paused = false;

  function autoplayAllowed() {
    return (
      settings.autoplay &&
      !paused &&
      !hovering &&
      !focused &&
      !dragging &&
      !document.hidden &&
      !document.body.classList.contains('modal-open')
    );
  }

  function interacted() {
    idle = 0;
  }

  function startTicker() {
    if (ticker || !settings.autoplay) return;
    ticker = window.setInterval(() => {
      if (!autoplayAllowed()) {
        idle = 0;
        return;
      }
      idle += 250;
      if (idle >= settings.interval) {
        idle = 0;
        alignBand();
        goTo(index + 1);
      }
    }, 250);
  }

  /* ---------- puntero ---------- */

  let dragging = false;
  let moved = false;
  let pointerId = -1;
  let startX = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;

  function onPointerDown(event) {
    if (event.button !== undefined && event.button > 0) return;
    alignBand();
    dragging = true;
    moved = false;
    pointerId = event.pointerId;
    startX = event.clientX;
    lastX = startX;
    lastTime = performance.now();
    velocity = 0;
    container.setAttribute('data-dragging', '');
    track.style.transition = 'none';
    try {
      container.setPointerCapture(event.pointerId);
    } catch (_) {
      /* algunos navegadores no permiten capturar: seguimos sin captura */
    }
    interacted();
  }

  function onPointerMove(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    if (!moved && Math.abs(dx) > DRAG_THRESHOLD) moved = true;

    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) {
      const instant = (event.clientX - lastX) / dt;
      velocity = velocity * 0.6 + instant * 0.4;
    }
    lastX = event.clientX;
    lastTime = now;

    applyX(centerOf(index) + dx, false);
    interacted();
  }

  function endDrag(event, cancelled) {
    if (!dragging) return;
    if (event && event.pointerId !== undefined && event.pointerId !== pointerId) return;
    dragging = false;
    container.removeAttribute('data-dragging');
    try {
      container.releasePointerCapture(pointerId);
    } catch (_) {
      /* nada que liberar */
    }
    if (cancelled) {
      settle(centerOf(index), true);
      return;
    }
    const projection = velocity * 180;
    settle(currentX + projection, true);
    interacted();
  }

  function onPointerUp(event) {
    endDrag(event, false);
  }

  function onPointerCancel(event) {
    endDrag(event, true);
  }

  /* ---------- teclado, rueda y clic ---------- */

  function onKeyDown(event) {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        step(1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        step(-1);
        break;
      case 'Home':
        event.preventDefault();
        goTo(total);
        break;
      case 'End':
        event.preventDefault();
        goTo(total * 2 - 1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const itemIndex = ((index % total) + total) % total;
        if (settings.onSelect) settings.onSelect(items[itemIndex], itemIndex);
        break;
      }
      default:
        break;
    }
  }

  let wheelAt = 0;

  function onWheel(event) {
    if (event.ctrlKey) return;
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const shifted = event.shiftKey && Math.abs(event.deltaX) < Math.abs(event.deltaY);
    // La rueda vertical deja scrollear la página: solo se captura el gesto horizontal.
    if (!horizontal && !shifted) return;
    event.preventDefault();
    const now = performance.now();
    if (now - wheelAt < WHEEL_COOLDOWN) return;
    wheelAt = now;
    const amount = horizontal ? event.deltaX : event.deltaY;
    step(amount > 0 ? 1 : -1);
  }

  function onClick(event) {
    const card = event.target.closest('.flex-carousel__card');
    if (!card || moved) return;
    const position = Number(card.dataset.index);
    if (Number.isNaN(position)) return;
    const itemIndex = ((position % total) + total) % total;
    if (settings.onSelect) settings.onSelect(items[itemIndex], itemIndex);
  }

  function onPointerEnter() {
    hovering = true;
  }

  function onPointerLeave() {
    hovering = false;
    interacted();
  }

  function onFocus() {
    focused = true;
    interacted();
  }

  function onBlur() {
    focused = false;
  }

  function onVisibility() {
    interacted();
  }

  /* ---------- ciclo de vida ---------- */

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerCancel);
  container.addEventListener('pointerenter', onPointerEnter);
  container.addEventListener('pointerleave', onPointerLeave);
  container.addEventListener('keydown', onKeyDown);
  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('focus', onFocus);
  container.addEventListener('blur', onBlur);
  track.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVisibility);

  const resizeObserver = new ResizeObserver(() => {
    const previousStride = stride;
    measure();
    if (previousStride !== stride) {
      applyX(centerOf(index), false);
    }
  });
  resizeObserver.observe(container);

  measure();
  applyX(centerOf(index), false);
  notify(true);
  startTicker();

  return {
    next() {
      step(1);
    },
    prev() {
      step(-1);
    },
    goTo(position) {
      goTo(total + position);
    },
    pause() {
      paused = true;
      idle = 0;
    },
    resume() {
      paused = false;
      interacted();
      alignBand();
    },
    refresh() {
      measure();
      alignBand();
      applyX(centerOf(index), false);
    },
    get index() {
      return ((index % total) + total) % total;
    },
    destroy() {
      window.clearInterval(ticker);
      ticker = 0;
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerCancel);
      container.removeEventListener('pointerenter', onPointerEnter);
      container.removeEventListener('pointerleave', onPointerLeave);
      container.removeEventListener('keydown', onKeyDown);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('focus', onFocus);
      container.removeEventListener('blur', onBlur);
      track.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVisibility);
      viewport.remove();
      container.classList.remove('flex-carousel');
    }
  };
}
