/**
 * CINE PLUS - Etapa del reproductor de tráilers.
 *
 * La comparten la cartelera pública (app.js) y el panel (admin.js) para que el
 * modal se vea igual en los dos sitios:
 *  - muestra la portada a sangre (recortada) mientras el tráiler no arranca y
 *    la deja de relleno difuminado detrás para la zona sobrante;
 *  - oculta el botón grande de reproducción en cuanto el vídeo arranca, porque
 *    los navegadores bloquean el autoplay con sonido;
 *  - vuelve a mostrar la portada al cerrar o al terminar el tráiler.
 */
export function initTrailerStage({ stage, video, backdrop, poster, playButton }) {
  if (!stage || !video) return null;

  function markStarted() {
    stage.classList.add('is-started');
  }

  video.addEventListener('play', markStarted);
  video.addEventListener('playing', markStarted);
  video.addEventListener('ended', () => {
    stage.classList.remove('is-started');
  });

  if (playButton) {
    playButton.addEventListener('click', (event) => {
      event.stopPropagation();
      play();
    });
  }

  // Mientras la portada está visible, cualquier clic en el escenario arranca el tráiler.
  stage.addEventListener('click', () => {
    if (!stage.classList.contains('is-started')) {
      play();
    }
  });

  function play() {
    let attempt = null;
    try {
      attempt = video.play();
    } catch (err) {
      attempt = null;
    }
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {});
    }
  }

  return {
    /** Usa el póster como portada y como relleno difuminado. */
    showPoster(url) {
      const posterUrl = (url || '').trim();
      const value = posterUrl ? `url("${posterUrl}")` : '';
      if (backdrop) {
        backdrop.style.backgroundImage = value;
      }
      if (poster) {
        poster.style.backgroundImage = value;
      }
      stage.classList.toggle('has-backdrop', Boolean(posterUrl));
      stage.classList.toggle('has-poster', Boolean(posterUrl));
    },

    /** Deja la etapa como recién abierta. */
    reset() {
      stage.classList.remove('is-started');
      this.showPoster('');
    }
  };
}
