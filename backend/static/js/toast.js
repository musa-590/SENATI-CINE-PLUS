/**
 * Sistema de notificaciones toast nativo y accesible
 */
export function showToast(message, type = 'info', duration = 3800) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type} is-visible`;
  toast.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.className = 'toast-msg';
  text.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Cerrar notificación');
  closeBtn.innerHTML = '×';
  closeBtn.onclick = () => removeToast(toast);

  toast.appendChild(text);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  toast.classList.remove('is-visible');
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(10px)';
  toast.style.transition = 'all 0.25s ease';
  setTimeout(() => toast.remove(), 260);
}
