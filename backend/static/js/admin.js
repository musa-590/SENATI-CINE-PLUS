/**
 * CINE PLUS - Panel de Administración
 * Gestión completa de tráilers, categorías, subidas con progreso y seguridad de cuenta.
 */

import { initFluxLines } from './flux-lines.js';
import { initTargetCursor } from './target-cursor.js';
import { initTrailerStage } from './trailer-stage.js';
import { showToast } from './toast.js';

function boot() {
  initVisuals();
  initTabs();
  initModalPreview();
  initMovieForm();
  initMovieList();
  initCategories();
  initAccountForm();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/* -------------------------------------------------------------
 * 1. Efectos visuales de fondo y cursor
 * ------------------------------------------------------------- */
function initVisuals() {
  try {
    const fluxCanvas = document.getElementById('flux-lines-canvas');
    if (fluxCanvas) {
      initFluxLines(fluxCanvas);
    }
  } catch (e) {
    console.warn(e);
  }

  try {
    initTargetCursor('.cursor-target, .admin-movie, .btn, .mini-btn, .file-drop, .admin-tab');
  } catch (e) {
    console.warn(e);
  }
}

/* -------------------------------------------------------------
 * 2. Utilidades de API y CSRF
 * ------------------------------------------------------------- */
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

async function apiRequest(url, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  const token = getCsrfToken();
  if (token) {
    headers['X-CSRFToken'] = token;
  }
  headers['Accept'] = 'application/json';

  if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, { ...options, headers });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (res.status === 401) {
      showToast('Sesión expirada. Redirigiendo a inicio de sesión…', 'warning');
      setTimeout(() => {
        window.location.href = '/admin/login';
      }, 1200);
      return { ok: false, status: 401, error: 'Sesión expirada.' };
    }

    if (!res.ok) {
      const errMsg = (data && (data.error || data.message)) || `Error de servidor (${res.status})`;
      return { ok: false, status: res.status, error: errMsg, data };
    }

    return { ok: true, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: 'Error de red al conectar con el servidor.' };
  }
}

/* -------------------------------------------------------------
 * 3. Navegación por pestañas
 * ------------------------------------------------------------- */
function initTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const panes = {
    library: document.getElementById('section-library'),
    categories: document.getElementById('section-categories'),
    account: document.getElementById('section-account')
  };
  const newMovieBtn = document.getElementById('admin-new-movie-btn');

  function switchTab(tabKey) {
    tabs.forEach((tab) => {
      const isTarget = tab.dataset.tab === tabKey;
      tab.classList.toggle('is-active', isTarget);
      tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    Object.entries(panes).forEach(([key, pane]) => {
      if (pane) {
        pane.style.display = key === tabKey ? 'block' : 'none';
      }
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  if (newMovieBtn) {
    newMovieBtn.addEventListener('click', () => {
      switchTab('library');
      if (window.__resetMovieForm) {
        window.__resetMovieForm();
      }
      const titleInput = document.getElementById('movie-title');
      if (titleInput) {
        titleInput.focus();
        titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  window.__adminSwitchTab = switchTab;
}

/* -------------------------------------------------------------
 * 4. Modal de Previsualización de Tráiler
 * ------------------------------------------------------------- */
function initModalPreview() {
  const modal = document.getElementById('movie-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const video = document.getElementById('modal-video-player');
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
    stage: document.getElementById('modal-video-stage'),
    video,
    backdrop: document.getElementById('modal-video-backdrop'),
    poster: document.getElementById('modal-video-poster'),
    playButton: document.getElementById('modal-play-btn')
  });

  function closeModal() {
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

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display !== 'none') closeModal();
  });

  window.__openAdminPreview = (movie) => {
    if (!movie) return;
    if (titleEl) titleEl.textContent = movie.title || 'Sin título';
    if (descEl) descEl.textContent = movie.description || 'Sin descripción disponible.';

    if (tagCat) {
      tagCat.textContent = movie.category ? movie.category.name : 'General';
      tagCat.style.color = movie.category ? movie.category.accent : 'var(--ink)';
      tagCat.style.borderColor = movie.category ? movie.category.accent : 'var(--line)';
    }

    if (tagRating) tagRating.textContent = movie.rating || 'TP';
    if (tagFeatured) tagFeatured.style.display = movie.featured ? 'inline-block' : 'none';
    if (tagType) tagType.textContent = (movie.video_mime || '').includes('webm') ? 'WebM' : 'MP4';

    if (metaYear) metaYear.textContent = movie.year || '—';
    if (metaDuration) metaDuration.textContent = movie.duration ? `${movie.duration} min` : '—';
    if (metaFormat) metaFormat.textContent = (movie.video_mime || 'video/mp4').replace('video/', '').toUpperCase();

    const streamUrl = `/api/movies/${movie.id}/stream`;
    if (downloadLink) downloadLink.href = streamUrl;

    if (stageUI) stageUI.showPoster(movie.poster_url);
    video.removeAttribute('poster');
    video.src = streamUrl;

    modal.style.display = 'grid';
    document.body.classList.add('modal-open');
    video.play().catch(() => {});
  };
}

/* -------------------------------------------------------------
 * 5. Formulario de Subir / Editar Tráiler
 * ------------------------------------------------------------- */
function initMovieForm() {
  const form = document.getElementById('movie-form');
  const idInput = document.getElementById('movie-id');
  const titleInput = document.getElementById('movie-title');
  const descInput = document.getElementById('movie-description');
  const yearInput = document.getElementById('movie-year');
  const durationInput = document.getElementById('movie-duration');
  const ratingInput = document.getElementById('movie-rating');
  const catInput = document.getElementById('movie-category');
  const pubInput = document.getElementById('movie-published');
  const featInput = document.getElementById('movie-featured');

  const videoInput = document.getElementById('movie-video-input');
  const videoDropzone = document.getElementById('video-dropzone');
  const videoLabel = document.getElementById('video-file-label');

  const posterInput = document.getElementById('movie-poster-input');
  const posterDropzone = document.getElementById('poster-dropzone');
  const posterLabel = document.getElementById('poster-file-label');
  const posterPreviewWrap = document.getElementById('poster-preview-wrapper');
  const posterPreviewImg = document.getElementById('poster-preview-img');
  const clearPosterBtn = document.getElementById('clear-poster-btn');

  const progressBox = document.getElementById('upload-progress-box');
  const progressText = document.getElementById('progress-status-text');
  const progressPercent = document.getElementById('progress-percent');
  const progressFill = document.getElementById('progress-fill');
  const errorAlert = document.getElementById('form-error-alert');

  const cancelBtn = document.getElementById('form-cancel-btn');
  const submitBtn = document.getElementById('form-submit-btn');
  const submitLabel = document.getElementById('form-submit-label');
  const cardTitle = document.getElementById('form-card-title');
  const editBadge = document.getElementById('form-badge-edit');

  if (!form) return;

  function resetForm() {
    form.reset();
    idInput.value = '';
    cardTitle.textContent = 'Subir nuevo tráiler';
    editBadge.style.display = 'none';
    cancelBtn.style.display = 'none';
    submitLabel.textContent = 'Publicar tráiler';
    errorAlert.style.display = 'none';
    errorAlert.textContent = '';
    progressBox.style.display = 'none';

    videoLabel.textContent = 'Elegir archivo de vídeo';
    posterLabel.textContent = 'Elegir imagen de póster';
    posterPreviewWrap.style.display = 'none';
    posterPreviewImg.src = '';
  }

  window.__resetMovieForm = resetForm;
  if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

  // Manejadores Dropzone para Vídeo
  if (videoDropzone && videoInput) {
    videoDropzone.addEventListener('click', () => videoInput.click());
    videoDropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        videoInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      videoDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        videoDropzone.classList.add('is-drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      videoDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        videoDropzone.classList.remove('is-drag-over');
      });
    });

    videoDropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        const file = dt.files[0];
        if (file.type.includes('video') || file.name.match(/\.(mp4|webm)$/i)) {
          videoInput.files = dt.files;
          updateVideoLabel(file);
        } else {
          showToast('Solo se admiten archivos de vídeo MP4 o WebM.', 'warning');
        }
      }
    });

    videoInput.addEventListener('change', () => {
      if (videoInput.files && videoInput.files[0]) {
        updateVideoLabel(videoInput.files[0]);
      } else {
        videoLabel.textContent = 'Elegir archivo de vídeo';
      }
    });
  }

  function updateVideoLabel(file) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    videoLabel.textContent = `${file.name} (${mb} MB)`;
  }

  // Manejadores Dropzone para Póster
  if (posterDropzone && posterInput) {
    posterDropzone.addEventListener('click', () => posterInput.click());
    posterDropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        posterInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      posterDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        posterDropzone.classList.add('is-drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      posterDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        posterDropzone.classList.remove('is-drag-over');
      });
    });

    posterDropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        const file = dt.files[0];
        if (file.type.includes('image') || file.name.match(/\.(jpe?g|png|webp)$/i)) {
          posterInput.files = dt.files;
          updatePosterPreview(file);
        } else {
          showToast('El póster debe ser una imagen JPG, PNG o WebP.', 'warning');
        }
      }
    });

    posterInput.addEventListener('change', () => {
      if (posterInput.files && posterInput.files[0]) {
        updatePosterPreview(posterInput.files[0]);
      } else {
        posterPreviewWrap.style.display = 'none';
        posterLabel.textContent = 'Elegir imagen de póster';
      }
    });
  }

  function updatePosterPreview(file) {
    posterLabel.textContent = file.name;
    posterPreviewImg.src = URL.createObjectURL(file);
    posterPreviewWrap.style.display = 'flex';
  }

  if (clearPosterBtn) {
    clearPosterBtn.addEventListener('click', () => {
      posterInput.value = '';
      posterPreviewImg.src = '';
      posterPreviewWrap.style.display = 'none';
      posterLabel.textContent = 'Elegir imagen de póster';
    });
  }

  // Envío del formulario con progreso en tiempo real
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorAlert.style.display = 'none';
    errorAlert.textContent = '';

    const isEdit = Boolean(idInput.value);
    const movieId = idInput.value;

    const title = titleInput.value.trim();
    if (!title) {
      errorAlert.textContent = 'Debes indicar un título para el tráiler.';
      errorAlert.style.display = 'block';
      titleInput.focus();
      return;
    }

    if (!isEdit && (!videoInput.files || !videoInput.files.length)) {
      errorAlert.textContent = 'Selecciona un archivo de vídeo MP4 o WebM para el nuevo tráiler.';
      errorAlert.style.display = 'block';
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', descInput.value.trim());
    if (yearInput.value) formData.append('year', yearInput.value);
    if (durationInput.value) formData.append('duration', durationInput.value);
    if (ratingInput.value) formData.append('rating', ratingInput.value);
    formData.append('category_id', catInput.value || '');
    formData.append('published', pubInput.checked ? 'true' : 'false');
    formData.append('featured', featInput.checked ? 'true' : 'false');

    if (videoInput.files && videoInput.files[0]) {
      formData.append('video', videoInput.files[0]);
    }
    if (posterInput.files && posterInput.files[0]) {
      formData.append('poster', posterInput.files[0]);
    }

    submitBtn.disabled = true;
    submitLabel.textContent = isEdit ? 'Guardando cambios…' : 'Subiendo tráiler…';
    progressBox.style.display = 'block';
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressText.textContent = 'Subiendo archivos al servidor…';

    const xhr = new XMLHttpRequest();
    const url = isEdit ? `/api/movies/${movieId}` : '/api/movies';
    const method = isEdit ? 'PATCH' : 'POST';

    xhr.open(method, url, true);
    xhr.setRequestHeader('X-CSRFToken', getCsrfToken());
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        progressFill.style.width = `${pct}%`;
        progressPercent.textContent = `${pct}%`;
        if (pct >= 100) {
          progressText.textContent = 'Procesando vídeo y miniaturas en el servidor…';
        }
      }
    };

    xhr.onload = () => {
      submitBtn.disabled = false;
      submitLabel.textContent = isEdit ? 'Guardar cambios' : 'Publicar tráiler';

      let resp = null;
      try {
        resp = JSON.parse(xhr.responseText);
      } catch {
        resp = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        showToast(isEdit ? 'Tráiler actualizado con éxito' : 'Tráiler publicado con éxito', 'success');
        resetForm();
        setTimeout(() => window.location.reload(), 400);
      } else {
        progressBox.style.display = 'none';
        const msg = (resp && (resp.error || resp.message)) || `Error al guardar (${xhr.status})`;
        errorAlert.textContent = msg;
        errorAlert.style.display = 'block';
        showToast(msg, 'error');
      }
    };

    xhr.onerror = () => {
      submitBtn.disabled = false;
      submitLabel.textContent = isEdit ? 'Guardar cambios' : 'Publicar tráiler';
      progressBox.style.display = 'none';
      errorAlert.textContent = 'Error de conexión con el servidor al subir el archivo.';
      errorAlert.style.display = 'block';
      showToast('Error de conexión al subir el archivo.', 'error');
    };

    xhr.send(formData);
  });

  // Rellenar formulario para edición
  window.__editMovie = (movie) => {
    if (!movie) return;
    idInput.value = movie.id;
    titleInput.value = movie.title || '';
    descInput.value = movie.description || '';
    yearInput.value = movie.year || '';
    durationInput.value = movie.duration || '';
    ratingInput.value = movie.rating || 'TP';
    catInput.value = movie.category_id || (movie.category ? movie.category.id : '');
    pubInput.checked = Boolean(movie.published);
    featInput.checked = Boolean(movie.featured);

    cardTitle.textContent = `Editar tráiler: ${movie.title}`;
    editBadge.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-flex';
    submitLabel.textContent = 'Guardar cambios';
    errorAlert.style.display = 'none';

    if (movie.poster_url) {
      posterPreviewImg.src = movie.poster_url;
      posterPreviewWrap.style.display = 'flex';
      posterLabel.textContent = 'Póster actual en el servidor';
    } else {
      posterPreviewWrap.style.display = 'none';
      posterLabel.textContent = 'Elegir imagen de póster';
    }

    videoLabel.textContent = 'Dejar vacío para conservar el vídeo actual';

    const card = document.getElementById('movie-form-card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
}

/* -------------------------------------------------------------
 * 6. Lista de Biblioteca: Acciones de Películas
 * ------------------------------------------------------------- */
function initMovieList() {
  const searchInput = document.getElementById('admin-movie-search');
  const items = Array.from(document.querySelectorAll('.admin-movie'));

  // Filtro de búsqueda en la biblioteca
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      items.forEach((item) => {
        const title = (item.dataset.title || '').toLowerCase();
        const cat = (item.dataset.category || '').toLowerCase();
        const year = (item.dataset.year || '').toLowerCase();
        const match = !q || title.includes(q) || cat.includes(q) || year.includes(q);
        item.style.display = match ? 'flex' : 'none';
      });
    });
  }

  // Previsualizar
  document.querySelectorAll('.admin-btn-preview').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      const res = await apiRequest(`/api/movies/${id}`);
      btn.disabled = false;
      if (res.ok && res.data && res.data.movie) {
        if (window.__openAdminPreview) {
          window.__openAdminPreview(res.data.movie);
        }
      } else {
        showToast(res.error || 'No se pudo cargar el tráiler', 'error');
      }
    });
  });

  // Alternar Visibilidad (Publicada / Oculta)
  document.querySelectorAll('.admin-btn-toggle').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const isCurrentlyPub = btn.dataset.published === '1';
      const newPub = !isCurrentlyPub;

      btn.disabled = true;
      const res = await apiRequest(`/api/movies/${id}`, {
        method: 'PATCH',
        body: { published: newPub }
      });
      btn.disabled = false;

      if (res.ok) {
        btn.dataset.published = newPub ? '1' : '0';
        btn.title = newPub ? 'Ocultar de la cartelera' : 'Publicar en la cartelera';
        const badge = document.getElementById(`badge-pub-${id}`);
        if (badge) {
          badge.textContent = newPub ? 'Publicada' : 'Oculta';
          badge.className = `badge ${newPub ? 'badge--ok' : 'badge--off'}`;
        }

        // Actualizar contador rápido
        const pubStat = document.getElementById('stat-published-count');
        if (pubStat) {
          let curr = parseInt(pubStat.textContent, 10) || 0;
          curr = newPub ? curr + 1 : Math.max(0, curr - 1);
          pubStat.textContent = String(curr).padStart(2, '0');
        }

        showToast(newPub ? 'Tráiler publicado en cartelera' : 'Tráiler ocultado de cartelera', 'info');
      } else {
        showToast(res.error || 'No se pudo cambiar el estado', 'error');
      }
    });
  });

  // Editar
  document.querySelectorAll('.admin-btn-edit').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      const res = await apiRequest(`/api/movies/${id}`);
      btn.disabled = false;
      if (res.ok && res.data && res.data.movie) {
        if (window.__editMovie) {
          window.__editMovie(res.data.movie);
        }
      } else {
        showToast(res.error || 'No se pudo cargar la información del tráiler', 'error');
      }
    });
  });

  // Eliminar
  document.querySelectorAll('.admin-btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const title = btn.dataset.title || 'este tráiler';

      if (!window.confirm(`¿Estás seguro de eliminar "${title}"?\nEsta acción eliminará permanentemente el vídeo y el póster del servidor.`)) {
        return;
      }

      btn.disabled = true;
      const res = await apiRequest(`/api/movies/${id}`, { method: 'DELETE' });
      btn.disabled = false;

      if (res.ok) {
        showToast('Tráiler eliminado correctamente.', 'success');
        const row = document.getElementById(`admin-movie-${id}`);
        if (row) {
          row.style.opacity = '0';
          row.style.transform = 'translateX(20px)';
          row.style.transition = 'all 0.3s ease';
          setTimeout(() => row.remove(), 320);
        }

        // Si se estaba editando esta película, reiniciar formulario
        const idInput = document.getElementById('movie-id');
        if (idInput && idInput.value === String(id) && window.__resetMovieForm) {
          window.__resetMovieForm();
        }

        // Actualizar contadores
        const totalStat = document.getElementById('stat-movies-count');
        if (totalStat) {
          let curr = parseInt(totalStat.textContent, 10) || 1;
          totalStat.textContent = String(Math.max(0, curr - 1)).padStart(2, '0');
        }
      } else {
        showToast(res.error || 'No se pudo eliminar el tráiler', 'error');
      }
    });
  });
}

/* -------------------------------------------------------------
 * 7. Gestión de Categorías
 * ------------------------------------------------------------- */
function initCategories() {
  const form = document.getElementById('category-form');
  const idInput = document.getElementById('category-edit-id');
  const nameInput = document.getElementById('category-name-input');
  const orderInput = document.getElementById('category-order-input');
  const colorPicker = document.getElementById('category-accent-picker');
  const swatches = document.querySelectorAll('.color-pick-swatch');
  const cancelBtn = document.getElementById('category-cancel-edit-btn');
  const submitBtn = document.getElementById('category-submit-btn');
  const submitLabel = document.getElementById('category-submit-label');
  const errorAlert = document.getElementById('category-form-error');

  if (!form) return;

  // Paleta de colores predefinidos
  swatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      if (color && colorPicker) {
        colorPicker.value = color;
      }
    });
  });

  function resetCategoryForm() {
    form.reset();
    idInput.value = '';
    submitLabel.textContent = 'Crear categoría';
    cancelBtn.style.display = 'none';
    errorAlert.style.display = 'none';
    errorAlert.textContent = '';
    if (colorPicker) colorPicker.value = '#d9c7ae';
  }

  if (cancelBtn) cancelBtn.addEventListener('click', resetCategoryForm);

  // Envío del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorAlert.style.display = 'none';
    errorAlert.textContent = '';

    const name = nameInput.value.trim();
    if (!name) {
      errorAlert.textContent = 'El nombre de la categoría es obligatorio.';
      errorAlert.style.display = 'block';
      nameInput.focus();
      return;
    }

    const payload = {
      name,
      sort_order: parseInt(orderInput.value, 10) || 0,
      accent: colorPicker ? colorPicker.value : '#d9c7ae'
    };

    const isEdit = Boolean(idInput.value);
    const catId = idInput.value;
    const url = isEdit ? `/api/categories/${catId}` : '/api/categories';
    const method = isEdit ? 'PATCH' : 'POST';

    submitBtn.disabled = true;
    const res = await apiRequest(url, { method, body: payload });
    submitBtn.disabled = false;

    if (res.ok) {
      showToast(isEdit ? 'Categoría actualizada con éxito.' : 'Categoría creada con éxito.', 'success');
      resetCategoryForm();
      setTimeout(() => window.location.reload(), 300);
    } else {
      errorAlert.textContent = res.error || 'Error al guardar la categoría.';
      errorAlert.style.display = 'block';
      showToast(res.error || 'Error al guardar categoría', 'error');
    }
  });

  // Editar categoría
  document.querySelectorAll('.cat-btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      idInput.value = btn.dataset.id;
      nameInput.value = btn.dataset.name || '';
      orderInput.value = btn.dataset.order || '0';
      if (colorPicker && btn.dataset.accent) {
        colorPicker.value = btn.dataset.accent;
      }
      submitLabel.textContent = 'Guardar categoría';
      cancelBtn.style.display = 'inline-flex';
      errorAlert.style.display = 'none';
      nameInput.focus();
      nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  // Eliminar categoría
  document.querySelectorAll('.cat-btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name || 'esta categoría';
      const count = parseInt(btn.dataset.count, 10) || 0;

      if (count > 0) {
        showToast(`No puedes eliminar "${name}" porque contiene ${count} películas asociadas.`, 'warning');
        return;
      }

      if (!window.confirm(`¿Seguro que deseas eliminar la categoría "${name}"?`)) {
        return;
      }

      btn.disabled = true;
      const res = await apiRequest(`/api/categories/${id}`, { method: 'DELETE' });
      btn.disabled = false;

      if (res.ok) {
        showToast('Categoría eliminada.', 'success');
        const row = document.getElementById(`cat-row-${id}`);
        if (row) {
          row.style.opacity = '0';
          row.style.transition = 'opacity 0.25s ease';
          setTimeout(() => row.remove(), 260);
        }
        setTimeout(() => window.location.reload(), 400);
      } else {
        showToast(res.error || 'No se pudo eliminar la categoría.', 'error');
      }
    });
  });
}

/* -------------------------------------------------------------
 * 8. Seguridad de Cuenta: Cambio de Contraseña
 * ------------------------------------------------------------- */
function initAccountForm() {
  const form = document.getElementById('password-form');
  const currentInput = document.getElementById('current-password');
  const newInput = document.getElementById('new-password');
  const confirmInput = document.getElementById('confirm-password');
  const submitBtn = document.getElementById('password-submit-btn');
  const errorAlert = document.getElementById('password-form-error');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorAlert.style.display = 'none';
    errorAlert.textContent = '';

    const currentPassword = currentInput.value;
    const newPassword = newInput.value;
    const confirmPassword = confirmInput.value;

    if (!currentPassword) {
      errorAlert.textContent = 'Ingresa tu contraseña actual.';
      errorAlert.style.display = 'block';
      currentInput.focus();
      return;
    }

    if (newPassword.length < 8) {
      errorAlert.textContent = 'La nueva contraseña debe tener al menos 8 caracteres.';
      errorAlert.style.display = 'block';
      newInput.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      errorAlert.textContent = 'Las contraseñas no coinciden.';
      errorAlert.style.display = 'block';
      confirmInput.focus();
      return;
    }

    submitBtn.disabled = true;
    const res = await apiRequest('/api/auth/change-password', {
      method: 'POST',
      body: {
        current_password: currentPassword,
        new_password: newPassword
      }
    });
    submitBtn.disabled = false;

    if (res.ok) {
      showToast('Contraseña actualizada correctamente.', 'success');
      form.reset();
    } else {
      errorAlert.textContent = res.error || 'Error al actualizar la contraseña.';
      errorAlert.style.display = 'block';
      showToast(res.error || 'Error al actualizar contraseña.', 'error');
    }
  });
}
