/**
 * dashboard.js — Panel principal de VeritosBusiness
 */

import { getAllOrders, getAllClients, getSetting } from '../db.js';
import { formatPrice, formatDate, statusChip, PENDING_STATUSES } from '../ui.js';
import { navigate } from '../app.js';

export async function renderDashboard(container) {
  const [orders, clients, storeName] = await Promise.all([
    getAllOrders(),
    getAllClients(),
    getSetting('storeName', 'VeritosBusiness'),
  ]);

  const now       = new Date();
  const thisMonth = orders.filter(o => {
    const d = new Date(o.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      && o.status === 'delivered';
  });

  const billing = thisMonth.reduce((s, o) => s + (o.total || 0), 0);
  const cost    = thisMonth.reduce((s, o) => s + (o.costTotal || 0), 0);
  const profit  = billing - cost;

  const pending = orders.filter(o => PENDING_STATUSES.includes(o.status));
  const recent  = [...orders].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,5);

  container.innerHTML = `
    <div class="dashboard">
      <div class="dashboard__greeting">
        <h2>Hola, ${storeName} 👋</h2>
        <p class="text-muted">${formatMonthYear(now)}</p>
      </div>

      <!-- Resumen económico -->
      <section class="section">
        <h3 class="section__title">Este mes</h3>
        <div class="stats-grid">
          <div class="stat-card stat-card--blue">
            <span class="stat-card__label">Facturación</span>
            <span class="stat-card__value">${formatPrice(billing)}</span>
          </div>
          <div class="stat-card stat-card--orange">
            <span class="stat-card__label">Coste mercancía</span>
            <span class="stat-card__value">${formatPrice(cost)}</span>
          </div>
          <div class="stat-card stat-card--green">
            <span class="stat-card__label">Beneficio</span>
            <span class="stat-card__value">${formatPrice(profit)}</span>
          </div>
        </div>
      </section>

      <!-- Indicadores -->
      <section class="section">
        <div class="kpi-row">
          <div class="kpi ${pending.length > 0 ? 'kpi--alert' : ''}">
            <span class="kpi__value">${pending.length}</span>
            <span class="kpi__label">Pedidos pendientes</span>
          </div>
          <div class="kpi">
            <span class="kpi__value">${clients.length}</span>
            <span class="kpi__label">Clientes</span>
          </div>
        </div>
        ${pending.length > 0 ? `
          <div class="alert alert--warning" id="pending-alert">
            <strong>⚠️ Tienes ${pending.length} pedido${pending.length > 1 ? 's' : ''} sin entregar</strong>
            <button class="btn btn--sm btn--primary" id="btn-view-pending">Ver pedidos</button>
          </div>` : ''}
      </section>

      <!-- Accesos directos -->
      <section class="section">
        <h3 class="section__title">Accesos rápidos</h3>
        <div class="shortcuts-grid">
          ${shortcut('orders',     '📦', 'Pedidos')}
          ${shortcut('clients',    '👤', 'Clientes')}
          ${shortcut('products',   '🌿', 'Productos')}
          ${shortcut('promotions', '🏷️',  'Promociones')}
          ${shortcut('stats',      '📊', 'Estadísticas')}
          ${shortcut('settings',   '⚙️',  'Configuración')}
        </div>
      </section>

      <!-- Pedidos recientes -->
      <section class="section">
        <div class="section__header">
          <h3 class="section__title">Pedidos recientes</h3>
          <button class="btn btn--sm btn--ghost" data-nav="orders">Ver todos</button>
        </div>
        ${recent.length === 0
          ? `<p class="empty-msg">No hay pedidos aún. <button class="btn btn--sm btn--primary" data-nav="orders">Crear el primero</button></p>`
          : `<div class="order-list">${recent.map(orderRow).join('')}</div>`}
      </section>
    </div>`;

  // Eventos
  container.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });
  container.querySelectorAll('.shortcut-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });
  container.getElementById?.('btn-view-pending')?.addEventListener('click', () => navigate('orders'));
  document.getElementById('btn-view-pending')?.addEventListener('click', () => navigate('orders'));
}

function shortcut(view, icon, label) {
  return `<button class="shortcut-btn" data-view="${view}">
    <span class="shortcut-btn__icon">${icon}</span>
    <span class="shortcut-btn__label">${label}</span>
  </button>`;
}

function orderRow(order) {
  return `<div class="order-row">
    <div class="order-row__num">${order.orderNumber || '—'}</div>
    <div class="order-row__client">${order.clientName || '—'}</div>
    <div class="order-row__right">
      <span class="order-row__total">${formatPrice(order.total)}</span>
      ${statusChip(order.status)}
      <span class="order-row__date">${formatDate(order.createdAt)}</span>
    </div>
  </div>`;
}

function formatMonthYear(d) {
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
}
