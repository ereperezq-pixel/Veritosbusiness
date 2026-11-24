/**
 * stats.js — Estadísticas y control económico
 */

import { getAllOrders, getAllClients, getSetting } from '../db.js';
import { formatPrice, formatDate, clientCategory, esc } from '../ui.js';

export async function renderStats(container) {
  const [allOrders, allClients, vipSpend, vipOrders] = await Promise.all([
    getAllOrders(),
    getAllClients(),
    getSetting('vipMinSpend', 300),
    getSetting('vipMinOrders', 10),
  ]);
  const vipSettings = { minSpend: vipSpend, minOrders: vipOrders };

  let period = 'month'; // day | month | year | custom
  let customStart = null, customEnd = null;

  function filterOrders() {
    const now = new Date();
    return allOrders.filter(o => {
      if (o.status !== 'delivered') return false;
      const d = new Date(o.createdAt);
      if (period === 'day')   return d.toDateString() === now.toDateString();
      if (period === 'month') return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
      if (period === 'year')  return d.getFullYear()===now.getFullYear();
      if (period === 'custom' && customStart && customEnd) {
        return d >= new Date(customStart) && d <= new Date(customEnd + 'T23:59:59');
      }
      return true;
    });
  }

  function renderContent() {
    const orders = filterOrders();
    const billing = orders.reduce((s, o) => s + (o.total||0), 0);
    const cost    = orders.reduce((s, o) => s + (o.costTotal||0), 0);
    const profit  = billing - cost;
    const discount = orders.reduce((s, o) => s + (o.discount||0), 0);

    // Clientes
    const clientOrders = {};
    orders.forEach(o => {
      if (!clientOrders[o.clientId]) clientOrders[o.clientId] = [];
      clientOrders[o.clientId].push(o);
    });
    const newClients       = allClients.filter(c => clientCategory(c, allOrders, vipSettings) === 'NUEVO').length;
    const habitualClients  = allClients.filter(c => clientCategory(c, allOrders, vipSettings) === 'HABITUAL').length;
    const inactiveClients  = allClients.filter(c => clientCategory(c, allOrders, vipSettings) === 'INACTIVO').length;
    const avgSpend         = allClients.length ? billing / allClients.length : 0;

    // Productos más vendidos
    const prodSales = {};
    orders.forEach(o => (o.lines||[]).forEach(l => {
      const key = l.productName || l.productId;
      if (!prodSales[key]) prodSales[key] = { name: key, qty: 0, revenue: 0 };
      prodSales[key].qty     += l.qty || 0;
      prodSales[key].revenue += l.totalPrice || 0;
    }));
    const topProducts = Object.values(prodSales).sort((a,b) => b.qty - a.qty).slice(0,10);

    // Ventas por categoría
    const catSales = {};
    orders.forEach(o => (o.lines||[]).forEach(l => {
      const cat = l.productCategory || 'Sin categoría';
      catSales[cat] = (catSales[cat] || 0) + (l.totalPrice || 0);
    }));

    // Evolución de ventas (últimos 12 meses)
    const monthlyData = buildMonthlyData(allOrders);

    const main = container.querySelector('#stats-content');
    if (!main) return;
    main.innerHTML = `
      <!-- Resumen económico -->
      <section class="section">
        <h3 class="section__title">Resumen económico</h3>
        <div class="stats-grid stats-grid--4">
          <div class="stat-card stat-card--blue">
            <span class="stat-card__label">Facturación</span>
            <span class="stat-card__value">${formatPrice(billing)}</span>
          </div>
          <div class="stat-card stat-card--orange">
            <span class="stat-card__label">Coste mercancía</span>
            <span class="stat-card__value">${formatPrice(cost)}</span>
          </div>
          <div class="stat-card stat-card--green">
            <span class="stat-card__label">Beneficio bruto</span>
            <span class="stat-card__value">${formatPrice(profit)}</span>
          </div>
          <div class="stat-card stat-card--purple">
            <span class="stat-card__label">Descuentos concedidos</span>
            <span class="stat-card__value">-${formatPrice(discount)}</span>
          </div>
        </div>
      </section>

      <!-- Clientes -->
      <section class="section">
        <h3 class="section__title">Clientes</h3>
        <div class="stats-grid stats-grid--4">
          <div class="stat-card"><span class="stat-card__label">Nuevos</span><span class="stat-card__value">${newClients}</span></div>
          <div class="stat-card"><span class="stat-card__label">Habituales</span><span class="stat-card__value">${habitualClients}</span></div>
          <div class="stat-card"><span class="stat-card__label">Inactivos</span><span class="stat-card__value">${inactiveClients}</span></div>
          <div class="stat-card"><span class="stat-card__label">Gasto medio</span><span class="stat-card__value">${formatPrice(avgSpend)}</span></div>
        </div>
      </section>

      <!-- Evolución de ventas -->
      <section class="section">
        <h3 class="section__title">Evolución mensual (12 meses)</h3>
        <div class="chart-wrap">${renderBarChart(monthlyData)}</div>
      </section>

      <!-- Productos más vendidos -->
      <section class="section">
        <h3 class="section__title">Productos más vendidos</h3>
        ${topProducts.length === 0 ? '<p class="empty-msg">Sin datos.</p>' : `
          <table class="stats-table">
            <thead><tr><th>Producto</th><th>Unidades</th><th>Facturación</th></tr></thead>
            <tbody>${topProducts.map(p => `
              <tr>
                <td>${esc(p.name)}</td>
                <td>${p.qty}</td>
                <td>${formatPrice(p.revenue)}</td>
              </tr>`).join('')}
            </tbody>
          </table>`}
      </section>

      <!-- Ventas por categoría -->
      <section class="section">
        <h3 class="section__title">Ventas por categoría</h3>
        ${Object.keys(catSales).length === 0 ? '<p class="empty-msg">Sin datos.</p>' :
          renderCategoryChart(catSales)}
      </section>`;
  }

  container.innerHTML = `
    <div class="view-stats">
      <div class="view-header">
        <h2 class="view-header__title">Estadísticas</h2>
      </div>
      <div class="period-tabs">
        <button class="tab tab--active" data-period="day">Hoy</button>
        <button class="tab" data-period="month">Este mes</button>
        <button class="tab" data-period="year">Este año</button>
        <button class="tab" data-period="custom">Personalizado</button>
      </div>
      <div id="custom-range" class="custom-range hidden">
        <input class="field__input" id="stat-start" type="date">
        <span>→</span>
        <input class="field__input" id="stat-end" type="date">
        <button class="btn btn--primary btn--sm" id="apply-custom">Aplicar</button>
      </div>
      <div id="stats-content"></div>
    </div>`;

  period = 'month';
  renderContent();

  container.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach(b => b.classList.remove('tab--active'));
      btn.classList.add('tab--active');
      period = btn.dataset.period;
      container.querySelector('#custom-range').classList.toggle('hidden', period !== 'custom');
      if (period !== 'custom') renderContent();
    });
  });

  container.querySelector('#apply-custom').addEventListener('click', () => {
    customStart = container.querySelector('#stat-start').value;
    customEnd   = container.querySelector('#stat-end').value;
    renderContent();
  });
}

// ─── Gráfico de barras SVG ────────────────────────────────────────────────────

function buildMonthlyData(orders) {
  const data = {};
  const now  = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    data[key] = { label: d.toLocaleDateString('es-ES',{month:'short',year:'2-digit'}), value: 0 };
  }
  orders.filter(o => o.status === 'delivered').forEach(o => {
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (data[key]) data[key].value += o.total || 0;
  });
  return Object.values(data);
}

function renderBarChart(data) {
  const max   = Math.max(...data.map(d => d.value), 1);
  const W     = 100 / data.length;
  const bars  = data.map((d, i) => {
    const h = Math.round((d.value / max) * 100);
    return `<g transform="translate(${i * W + W*0.1}%, 0)">
      <rect x="0" y="${100-h}%" width="${W*0.8}%" height="${h}%" fill="var(--color-primary)" rx="2"/>
      <text x="${W*0.4}%" y="98%" text-anchor="middle" class="chart-label">${d.label}</text>
    </g>`;
  }).join('');
  return `<svg class="bar-chart" viewBox="0 0 400 180" preserveAspectRatio="none">
    <style>.chart-label{font-size:9px;fill:var(--color-text-muted);}</style>
    <g transform="translate(0,10)">${bars}</g>
  </svg>`;
}

function renderCategoryChart(catSales) {
  const total = Object.values(catSales).reduce((s, v) => s + v, 0) || 1;
  const colors = ['#2E7D32','#43A047','#66BB6A','#A5D6A7','#C8E6C9'];
  let rows = '';
  let i = 0;
  for (const [cat, val] of Object.entries(catSales).sort((a,b)=>b[1]-a[1])) {
    const pct = Math.round((val/total)*100);
    rows += `<div class="cat-bar">
      <span class="cat-bar__label">${esc(cat)}</span>
      <div class="cat-bar__track">
        <div class="cat-bar__fill" style="width:${pct}%;background:${colors[i%colors.length]}"></div>
      </div>
      <span class="cat-bar__pct">${pct}% (${formatPrice(val)})</span>
    </div>`;
    i++;
  }
  return `<div class="cat-chart">${rows}</div>`;
}
