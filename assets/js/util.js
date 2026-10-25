const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Escape text before placing it in HTML. Use for anything a visitor can type.
export const h = value => String(value ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

export const pad = n => String(n).padStart(2, '0');

export const icon = name => `<svg aria-hidden="true"><use href="assets/img/icons.svg#${name}"></use></svg>`;

export function formatDate(iso) {
  if (!iso) return 'Not yet';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
