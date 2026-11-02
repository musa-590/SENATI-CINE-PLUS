/**
 * CINE PLUS - Aplicación Web Pública
 * Manejo interactivo de cartelera, carrusel 3D, reproductor de tráilers, búsqueda y filtros.
 */

import { initFluxLines } from './flux-lines.js';
import { initElasticMesh } from './elastic-mesh.js';
import { initFlexCarousel } from './flex-carousel.js?v=v3';
import { initChromaGrid } from './chroma-grid.js';
import { initTargetCursor } from './target-cursor.js';
import { initTrailerStage } from './trailer-stage.js';
import { showToast } from './toast.js';
import { initBlobCursor } from './blob-cursor.js';
import { initOptionWheel } from './option-wheel.js';

function boot() {
  initBackgroundEffects();
  initSidebar();
  initModalPlayer();
  initCatalogFilters();
  initCarousel();
  console.error('CAROUSEL_INIT_DONE');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/* -------------------------------------------------------------
 * 1. Efectos visuales de fondo y retícula
 * ------------------------------------------------------------- */
function initBackgroundEffects() {
  try {
    const fluxCanvas = document.getElementById('flux-lines-canvas');
    if (fluxCanvas) {
      initFluxLines(fluxCanvas);
    }
  } catch (err) {
    console.warn('[CinePlus] No se pudo inicializar FluxLines:', err);
  }

  try {
    const blobCanvas = document.getElementById('blob-cursor-canvas');
    if (blobCanvas) {
      initBlobCursor(blobCanvas, { size: 150, color: '#d9c7ae', lag: 0.2, trail: 4 });
    }
  } catch (err) {
    console.warn('[CinePlus] No se pudo inicializar BlobCursor:', err);
  }

  try {
    const heroCanvas = document.getElementById('hero-elastic-canvas');
    if (heroCanvas) {
      initElasticMesh(heroCanvas);
    }
  } catch (err) {
    console.warn('[CinePlus] No se pudo inicializar ElasticMesh:', err);
  }

  try {
    const grid = document.getElementById('movies-grid');
    if (grid) {
      initChromaGrid(grid);
    }
  } catch (err) {
    console.warn('[CinePlus] No se pudo inicializar ChromaGrid:', err);
  }

  try {
    initTargetCursor('.cursor-target, .chroma-card, .btn, .filter-chip, .rail-cat-item');
  } catch (err) {
    console.warn('[CinePlus] No se pudo inicializar TargetCursor:', err);
  }
}

/* -------------------------------------------------------------
 * 2. Menú lateral (Rail)
 * ------------------------------------------------------------- */
function initSidebar() {
  const shell = document.getElementById('public-shell');
  const rail = document.getElementById('site-sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const closeBtn = document.getElementById('sidebar-close-btn');
  const backdrop = document.getElementById('sidebar-backdrop');
  const navLinks = document.querySelectorAll('.rail-nav-link');
  const catItems = document.querySelectorAll('.rail-cat-item');

  if (!shell || !rail) return;

  function closeMobileSidebar() {
    rail.classList.remove('is-open');
    if (backdrop) backdrop.style.display = 'none';
    document.body.classList.remove('sidebar-open');
  }

  function openMobileSidebar() {
    rail.classList.add('is-open');
    if (backdrop) backdrop.style.display = 'block';
    document.body.classList.add('sidebar-open');
  }

  function toggleRail(forceOpen) {
    const isMobile = window.innerWidth <= 1040;
    if (isMobile) {
      const willOpen = typeof forceOpen === 'boolean' ? forceOpen : !rail.classList.contains('is-open');
      if (willOpen) {
        openMobileSidebar();
      } else {
        closeMobileSidebar();
      }
    } else {
      const willOpen = typeof forceOpen === 'boolean' ? forceOpen : shell.classList.contains('is-rail-collapsed');
      if (willOpen) {
        shell.classList.remove('is-rail-collapsed');
      } else {
        shell.classList.add('is-rail-collapsed');
      }
    }
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleRail();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      closeMobileSidebar();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      closeMobileSidebar();
    });
    backdrop.addEventListener('touchstart', (e) => {
      e.preventDefault();
      closeMobileSidebar();
    }, { passive: false });
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.forEach((l) => l.classList.remove('is-active'));
      link.classList.add('is-active');
      if (window.innerWidth <= 1040) {
        closeMobileSidebar();
      }
    });
  });

  catItems.forEach((item) => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 1040) {
        closeMobileSidebar();
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && rail.classList.contains('is-open')) {
      closeMobileSidebar();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1040 && rail.classList.contains('is-open')) {
      closeMobileSidebar();
    }
  }, { passive: true });
}

/* ----------
 * 3. Modal de reproducción de tráilers
 * ------------------------------------------------------------- */
function initModalPlayer() {
  const modal = document.getElementById('movie-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const video = document.getElementById('modal-video-player');
  const stage = document.getElementById('modal-video-stage');
  const titleEl = document.getElementById('movie-modal-title');
  const descEl = document.getElementById('modal-description');
  const tagCat = document.getElementById('modal-tag-category');
  const tagRating = document.getElementById('modal-tag-rating');
  const tagFeatured = document.getElementById('modal-tag-featured');
  const tagType = document.getElementById('modal-tag-type');
  const metaYear = document.getElementById('modal-meta-year');
  const metaDuration = document.getElementById('modal-meta-duration');
  const metaFormat = document.getElementById('modal-meta-format');
  const downloadLink = document.getElementById('modal-download-link');

  if (!modal || !video) return;

  const stageUI = initTrailerStage({
    stage,
    video,
    backdrop: document.getElementById('modal-video-backdrop'),
    poster: document.getElementById('modal-video-poster'),
    playButton: document.getElementById('modal-play-btn')
  });

  function openModal(data) {
    if (!data || !data.streamUrl) {
      showToast('No se encontró el enlace de transmisión del tráiler', 'warning');
      return;
    }

    if (titleEl) titleEl.textContent = data.title || 'Sin título';
    if (descEl) descEl.textContent = data.description || 'Sin descripción disponible.';

    if (tagCat) {
      tagCat.textContent = data.categoryName || 'General';
      tagCat.style.borderColor = data.categoryAccent || 'var(--line-strong)';
      tagCat.style.color = data.categoryAccent || 'var(--ink)';
    }

    if (tagRating) tagRating.textContent = data.rating || 'TP';
    if (tagFeatured) tagFeatured.style.display = data.featured === '1' || data.featured === true ? 'inline-block' : 'none';
    if (tagType) tagType.textContent = (data.videoType || 'video/mp4').includes('webm') ? 'WebM' : 'MP4';

    if (metaYear) metaYear.textContent = data.year || '—';
    if (metaDuration) metaDuration.textContent = data.duration ? `${data.duration} min` : '—';
    if (metaFormat) metaFormat.textContent = (data.videoType || 'video/mp4').replace('video/', '').toUpperCase();

    if (downloadLink) {
      downloadLink.href = data.streamUrl;
    }

    // El póster va de fondo (recortado) y no dentro del vídeo: un póster
    // vertical incrustado en la caja apaisada dejaba franjas negras enormes.
    if (stageUI) stageUI.showPoster(data.posterUrl);
    video.removeAttribute('poster');
    video.src = data.streamUrl;

    modal.style.display = 'grid';
    document.body.classList.add('modal-open');

    // Reproducción automática suave (si el navegador la permite)
    video.play().catch(() => {
      // Bloqueado: el botón central de la etapa queda visible para arrancar.
    });
  }

  function closeModal() {
    if (modal.style.display === 'none') return;
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {
      console.warn(e);
    }
    if (stageUI) stageUI.reset();
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display !== 'none') {
      closeModal();
    }
  });

  // Vinculación de clic en las tarjetas de la cuadrícula
  const grid = document.getElementById('movies-grid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.chroma-card');
      if (!card) return;
      openModal({
        id: card.dataset.movieId,
        title: card.dataset.title,
        description: card.dataset.description,
        year: card.dataset.year,
        duration: card.dataset.duration,
        rating: card.dataset.rating,
        categoryName: card.dataset.categoryName,
        categorySlug: card.dataset.categorySlug,
        categoryAccent: card.dataset.categoryAccent,
        streamUrl: card.dataset.streamUrl,
        posterUrl: card.dataset.posterUrl,
        featured: card.dataset.featured,
        videoType: card.dataset.videoType
      });
    });

    grid.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.chroma-card');
        if (card) {
          e.preventDefault();
          card.click();
        }
      }
    });
  }

  window.__cineplusOpenModal = openModal;
}

/* -------------------------------------------------------------
 * 4. Carrusel 3D En Portada
 * ------------------------------------------------------------- */
function initCarousel() {
  console.warn('[CinePlus DBG4] initCarousel');
  const container = document.getElementById('carousel-stage');
  const jsonScript = document.getElementById('featured-movies-json');
  if (!container || !jsonScript) return;

  const titleEl = document.getElementById('carousel-title');
  const subtitleEl = document.getElementById('carousel-subtitle');
  const indexEl = document.getElementById('carousel-current-index');
  const countEl = document.getElementById('carousel-total-count');

  let items = [];
  try {
    items = JSON.parse(jsonScript.textContent);
  } catch (err) {
    console.warn('[CinePlus] Error al parsear JSON del carrusel:', err);
    return;
  }

  if (!items || !items.length) return;

  if (countEl) countEl.textContent = String(items.length).padStart(2, '0');

  function updateCaption(item, idx) {
    if (!item) return;
    if (titleEl) titleEl.textContent = item.title || 'Pelicula destacada';
    if (subtitleEl) {
      const parts = [item.category, item.year].filter(Boolean);
      subtitleEl.textContent = parts.length ? parts.join(' - ') : 'Trailer oficial';
    }
    if (indexEl) indexEl.textContent = String(idx + 1).padStart(2, '0');
  }

  updateCaption(items[0], 0);

  container.style.height = 'clamp(310px, 33vw, 430px)';
  container.style.minHeight = '310px';

  window.setTimeout(() => {
    initFlexCarousel(
      container,
      items,
      (selectedItem) => {
        if (!selectedItem) return;
        const card = document.querySelector(`.chroma-card[data-movie-id="${selectedItem.id}"]`);
        if (card) {
          card.click();
        } else if (window.__cineplusOpenModal) {
          window.__cineplusOpenModal({
            id: selectedItem.id,
            title: selectedItem.title,
            description: '',
            year: selectedItem.year,
            duration: '',
            rating: 'TP',
            categoryName: selectedItem.category,
            streamUrl: `/api/movies/${selectedItem.id}/stream`,
            posterUrl: selectedItem.fullPoster || selectedItem.src,
            featured: true
          });
        }
      },
      {
        preset: 'liquid',
        intro: 'rise',
        cardHeight: 0.54,
        gap: 16,
        radius: 16,
        squeeze: 0.2,
        focusOnClick: true,
        captions: true,
        captureWheel: true,
        autoplay: true,
        interval: 3.8,
        onChange: (index, item) => {
          updateCaption(item, index);
        }
      }
    );
  }, 120);

} // fin initCarousel

  // Vinculacion de clic en las tarjetas de la cuadr (la cuadricula se enlaza mas abajo)

/* -------------------------------------------------------------
 * 5. Búsqueda y Filtros de Categoría
 * ------------------------------------------------------------- */
function initCatalogFilters() {
  const filterChips = document.querySelectorAll('.filter-chip[data-slug]');
  const railCatItems = document.querySelectorAll('.rail-cat-item[data-slug]');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  const emptyClearBtn = document.getElementById('empty-clear-filters-btn');
  const countEl = document.getElementById('visible-movie-count');
  const labelEl = document.getElementById('visible-movie-label');
  const noResultsEl = document.getElementById('no-results-empty');
  const cards = Array.from(document.querySelectorAll('.chroma-card'));

  let activeSlug = '';

  function applyFilters() {
    let visibleCount = 0;

    cards.forEach((card) => {
      const cardSlug = card.dataset.categorySlug || '';
      const matchCategory = !activeSlug || cardSlug === activeSlug;

      if (matchCategory) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    if (countEl) {
      countEl.textContent = String(visibleCount).padStart(2, '0');
    }
    if (labelEl) {
      labelEl.textContent = visibleCount === 1 ? 'título' : 'títulos';
    }

    if (noResultsEl) {
      noResultsEl.style.display = visibleCount === 0 && cards.length > 0 ? 'block' : 'none';
    }

    const hasActiveFilters = Boolean(activeSlug);
    if (clearFiltersBtn) {
      clearFiltersBtn.style.display = hasActiveFilters ? 'inline-flex' : 'none';
    }

    filterChips.forEach((chip) => {
      const chipSlug = chip.getAttribute('data-slug');
      chip.classList.toggle('is-active', chipSlug === activeSlug);
    });

    railCatItems.forEach((item) => {
      const itemSlug = item.getAttribute('data-slug');
      item.classList.toggle('is-active', itemSlug === activeSlug);
    });
  }

  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeSlug = chip.getAttribute('data-slug') || '';
      applyFilters();
    });
  });

  railCatItems.forEach((item) => {
    item.addEventListener('click', () => {
      activeSlug = item.getAttribute('data-slug') || '';
      applyFilters();
      const catalogSection = document.getElementById('cartelera');
      if (catalogSection) {
        catalogSection.scrollIntoView({ behavior: 'smooth' });
      }
      if (window.innerWidth <= 1040) {
        const rail = document.getElementById('site-sidebar');
        if (rail) rail.classList.remove('is-open');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (backdrop) backdrop.style.display = 'none';
        document.body.classList.remove('sidebar-open');
      }
    });
  });

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      activeSlug = '';
      applyFilters();
    });
  }

  if (emptyClearBtn) {
    emptyClearBtn.addEventListener('click', () => {
      activeSlug = '';
      applyFilters();
    });
  }
}
