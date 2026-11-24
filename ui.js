/**
 * ui.js — Componentes y funciones de interfaz reutilizables
 */

// ─── Toast (notificaciones) ───────────────────────────────────────────────────

let _toastTimer = null;
export function toast(message, type = 'info', duration = 3000) {
  let el = document.getElementById('vb-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'vb-toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className   = `toast toast--${type} toast--visible`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('toast--visible'), duration);
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function showModal({ title, content, actions = [] }) {
  let backdrop = document.getElementById('vb-modal-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'vb-modal-backdrop';
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
  }
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__header">
        <h2 class="modal__title">${title}</h2>
        <button class="modal__close" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal__body">${typeof content === 'string' ? content : ''}</div>
      <div class="modal__footer">
        ${actions.map((a, i) =>
          `<button class="btn ${a.class || 'btn--secondary'}" data-action="${i}">${a.label}</button>`
        ).join('')}
      </div>
    </div>`;
  backdrop.classList.add('modal-backdrop--visible');
  if (typeof content !== 'string') {
    backdrop.querySelector('.modal__body').appendChild(content);
  }
  backdrop.querySelector('.modal__close').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  actions.forEach((a, i) => {
    backdrop.querySelector(`[data-action="${i}"]`)?.addEventListener('click', () => {
      if (a.callback) a.callback();
      if (a.close !== false) closeModal();
    });
  });
  return backdrop;
}

export function closeModal() {
  const b = document.getElementById('vb-modal-backdrop');
  if (b) b.classList.remove('modal-backdrop--visible');
}

// ─── Confirmación ─────────────────────────────────────────────────────────────

export function confirm(message, { confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false } = {}) {
  return new Promise(resolve => {
    showModal({
      title: '¿Estás segura?',
      content: `<p>${message}</p>`,
      actions: [
        { label: cancelLabel,  class: 'btn btn--secondary', callback: () => resolve(false) },
        { label: confirmLabel, class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, callback: () => resolve(true) },
      ]
    });
  });
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function showSpinner() {
  let el = document.getElementById('vb-spinner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'vb-spinner';
    el.innerHTML = '<div class="spinner__ring"></div>';
    el.className = 'spinner-overlay';
    document.body.appendChild(el);
  }
  el.classList.add('spinner-overlay--visible');
}
export function hideSpinner() {
  document.getElementById('vb-spinner')?.classList.remove('spinner-overlay--visible');
}

// ─── Helpers de formato ───────────────────────────────────────────────────────

export function formatPrice(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7)  return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days/7)} sem.`;
  if (days < 365) return `hace ${Math.floor(days/30)} mes.`;
  return `hace ${Math.floor(days/365)} año/s`;
}

// ─── Clasificación de clientes ────────────────────────────────────────────────

export function clientCategory(client, orders, vipSettings = {}) {
  const clientOrders = orders.filter(o => o.clientId === client.id && o.status === 'delivered');
  if (clientOrders.length === 0) return 'NUEVO';
  const lastDate  = new Date(Math.max(...clientOrders.map(o => new Date(o.createdAt))));
  const daysSince = (Date.now() - lastDate.getTime()) / 86400000;
  if (daysSince > 90) return 'INACTIVO';
  const totalSpent  = clientOrders.reduce((s, o) => s + (o.total || 0), 0);
  const orderCount  = clientOrders.length;
  const vipSpend    = Number(vipSettings.minSpend)  || 300;
  const vipOrders   = Number(vipSettings.minOrders) || 10;
  if (totalSpent >= vipSpend || orderCount >= vipOrders) return 'VIP';
  if (orderCount >= 2) return 'HABITUAL';
  return 'NUEVO';
}

export const CATEGORY_COLORS = {
  'NUEVO':    { bg: '#E3F2FD', text: '#1565C0' },
  'HABITUAL': { bg: '#E8F5E9', text: '#2E7D32' },
  'INACTIVO': { bg: '#FFF3E0', text: '#E65100' },
  'VIP':      { bg: '#F3E5F5', text: '#6A1B9A' },
};

export const ORDER_STATUS = {
  'pending':   { label: 'Pendiente',         color: '#FFF3E0', text: '#E65100' },
  'confirmed': { label: 'Confirmado',        color: '#E3F2FD', text: '#1565C0' },
  'preparing': { label: 'Preparando',        color: '#EDE7F6', text: '#4527A0' },
  'ready':     { label: 'Listo para recoger',color: '#E8F5E9', text: '#1B5E20' },
  'delivered': { label: 'Entregado',         color: '#F1F8E9', text: '#33691E' },
  'cancelled': { label: 'Cancelado',         color: '#FFEBEE', text: '#B71C1C' },
};

export const PENDING_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'];

// ─── Chip de estado ───────────────────────────────────────────────────────────

export function statusChip(status) {
  const s = ORDER_STATUS[status] || { label: status, color: '#eee', text: '#333' };
  return `<span class="chip" style="background:${s.color};color:${s.text}">${s.label}</span>`;
}

export function categoryChip(cat) {
  const c = CATEGORY_COLORS[cat] || { bg: '#eee', text: '#333' };
  return `<span class="chip" style="background:${c.bg};color:${c.text}">${cat}</span>`;
}

// ─── Render de tarjeta de producto ───────────────────────────────────────────

export function productCard(product, { onClick, onEdit } = {}) {
  const img     = product.image || './assets/placeholder.png';
  const avail   = product.available !== false;
  const hasVars = product.variants?.length > 0;
  const minPrice = hasVars
    ? Math.min(...product.variants.map(v => Number(v.price) || 0))
    : Number(product.price) || 0;

  const card = document.createElement('div');
  card.className = `product-card ${avail ? '' : 'product-card--unavailable'}`;
  card.innerHTML = `
    <div class="product-card__img-wrap">
      <img src="${img}" alt="${product.name}" loading="lazy" onerror="this.src='./assets/placeholder.png'">
      ${!avail ? '<span class="product-card__badge product-card__badge--out">Agotado</span>' : ''}
    </div>
    <div class="product-card__body">
      <p class="product-card__category">${product.category || ''}</p>
      <h3 class="product-card__name">${product.name}</h3>
      <p class="product-card__price">${hasVars ? 'Desde ' : ''}${formatPrice(minPrice)}</p>
    </div>
    <div class="product-card__actions">
      ${onEdit ? '<button class="btn btn--sm btn--secondary product-card__edit">Editar</button>' : ''}
    </div>`;

  if (onClick) card.addEventListener('click', (e) => {
    if (!e.target.classList.contains('product-card__edit')) onClick(product);
  });
  if (onEdit) card.querySelector('.product-card__edit')?.addEventListener('click', (e) => {
    e.stopPropagation(); onEdit(product);
  });
  return card;
}

// ─── Escape HTML ──────────────────────────────────────────────────────────────

export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

// ─── Generar UUID simple ──────────────────────────────────────────────────────

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}
