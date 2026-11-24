/**
 * orders.js — Gestión de pedidos (3 pasos) + listado
 */

import {
  getAllOrders, saveOrder, getOrderById,
  getAllClients, saveClient, findClientByPhone,
  getAllProducts, getAllPromotions,
  getNextOrderNumber, getSetting
} from '../db.js';
import {
  toast, showModal, closeModal, confirm,
  formatPrice, formatDate, statusChip,
  ORDER_STATUS, PENDING_STATUSES,
  esc, uid
} from '../ui.js';
import { getActivePromotions, calcLinePrice, calcOrderTotal } from '../utils/prices.js';
import { openWhatsApp, orderStatusMessage, orderSummaryMessage } from '../utils/whatsapp.js';
import { navigate } from '../app.js';

const STEPS = ['Cliente', 'Productos', 'Confirmar'];

// ─── Vista de listado ─────────────────────────────────────────────────────────

export async function renderOrders(container) {
  let orders  = await getAllOrders();
  let filter  = 'all';
  let search  = '';

  function filtered() {
    return orders
      .filter(o => filter === 'all' || (filter === 'pending' ? PENDING_STATUSES.includes(o.status) : o.status === filter))
      .filter(o => !search || o.clientName?.toLowerCase().includes(search.toLowerCase()) || o.orderNumber?.includes(search))
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function renderList() {
    const listEl = container.querySelector('#orders-list');
    if (!listEl) return;
    const list = filtered();
    if (list.length === 0) {
      listEl.innerHTML = `<p class="empty-msg">No hay pedidos con este filtro.</p>`;
      return;
    }
    listEl.innerHTML = list.map(o => `
      <div class="order-card" data-id="${o.id}">
        <div class="order-card__top">
          <span class="order-card__num">${esc(o.orderNumber)}</span>
          ${statusChip(o.status)}
        </div>
        <div class="order-card__client">${esc(o.clientName || '—')}</div>
        <div class="order-card__footer">
          <span>${formatDate(o.createdAt)}</span>
          <span class="order-card__total">${formatPrice(o.total)}</span>
        </div>
      </div>`).join('');

    listEl.querySelectorAll('.order-card').forEach(el => {
      el.addEventListener('click', () => showOrderDetail(Number(el.dataset.id), orders, () => {
        getAllOrders().then(o => { orders.length=0; o.forEach(x => orders.push(x)); renderList(); });
      }));
    });
  }

  container.innerHTML = `
    <div class="view-orders">
      <div class="view-header">
        <h2 class="view-header__title">Pedidos</h2>
        <button class="btn btn--primary" id="btn-new-order">+ Nuevo pedido</button>
      </div>
      <div class="filter-bar">
        <input class="field__input" id="search-orders" type="search" placeholder="Buscar pedido o cliente…">
      </div>
      <div class="status-tabs" id="status-tabs">
        <button class="tab tab--active" data-filter="all">Todos</button>
        <button class="tab" data-filter="pending">Pendientes</button>
        ${Object.entries(ORDER_STATUS).map(([k,v]) =>
          `<button class="tab" data-filter="${k}">${v.label}</button>`
        ).join('')}
      </div>
      <div id="orders-list" class="orders-list"></div>
    </div>`;

  renderList();

  container.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach(b => b.classList.remove('tab--active'));
      btn.classList.add('tab--active');
      filter = btn.dataset.filter;
      renderList();
    });
  });
  container.querySelector('#search-orders').addEventListener('input', e => {
    search = e.target.value;
    renderList();
  });
  container.querySelector('#btn-new-order').addEventListener('click', () => {
    openOrderWizard(async (newOrder) => {
      await saveOrder(newOrder);
      orders = await getAllOrders();
      renderList();
      toast(`Pedido ${newOrder.orderNumber} guardado`, 'success');
    });
  });
}

// ─── Detalle de pedido ────────────────────────────────────────────────────────

async function showOrderDetail(orderId, allOrders, onUpdate) {
  const order  = allOrders.find(o => o.id === orderId);
  if (!order) return;
  const storeName = await getSetting('storeName', 'VeritosBusiness');
  const whatsapp  = await getSetting('whatsapp', '');

  const content = document.createElement('div');
  content.className = 'order-detail';

  function render() {
    content.innerHTML = `
      <div class="order-detail__header">
        <span class="order-detail__num">${esc(order.orderNumber)}</span>
        ${statusChip(order.status)}
      </div>
      <p class="order-detail__client">👤 ${esc(order.clientName)} ${order.clientPhone ? `· 📞 ${esc(order.clientPhone)}` : ''}</p>
      <p class="order-detail__date">📅 ${formatDate(order.createdAt)}</p>
      <h4 class="section__title">Productos</h4>
      <table class="order-table">
        <thead><tr><th>Producto</th><th>Variante</th><th>Cant.</th><th>Precio</th></tr></thead>
        <tbody>
          ${(order.lines || []).map(l => `
            <tr>
              <td>${esc(l.productName)}</td>
              <td>${esc(l.variantName || '—')}</td>
              <td>${l.qty}</td>
              <td>${formatPrice(l.totalPrice)}${l.discountAmount>0?` <small class="text-green">-${formatPrice(l.discountAmount)}</small>`:''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${order.discount > 0 ? `<p class="text-right text-green">Descuento total: -${formatPrice(order.discount)}</p>` : ''}
      <p class="order-detail__total">Total: <strong>${formatPrice(order.total)}</strong></p>
      ${order.notes ? `<p class="order-detail__notes">📝 ${esc(order.notes)}</p>` : ''}
      <h4 class="section__title">Cambiar estado</h4>
      <div class="status-selector">
        ${Object.entries(ORDER_STATUS).map(([k,v]) =>
          `<button class="btn btn--sm status-btn ${order.status===k?'btn--primary':'btn--secondary'}"
            data-status="${k}">${v.label}</button>`
        ).join('')}
      </div>`;

    content.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.dataset.status;
        if (newStatus === order.status) return;
        order.status = newStatus;
        order.updatedAt = new Date().toISOString();
        await saveOrder(order);
        onUpdate();
        render();
        // Ofrecer WhatsApp si hay teléfono
        if (order.clientPhone && whatsapp) {
          const msg = orderStatusMessage(order, order.clientName, storeName, newStatus);
          if (msg && await import('../ui.js').then(m => m.confirm(
            `¿Enviar aviso de "${ORDER_STATUS[newStatus]?.label}" a ${order.clientName} por WhatsApp?`,
            { confirmLabel: 'Abrir WhatsApp' }
          ))) {
            openWhatsApp(order.clientPhone.replace(/\D/g,''), msg);
          }
        }
      });
    });
  }

  render();

  showModal({
    title: 'Detalle de pedido',
    content,
    actions: [
      { label: 'Cerrar', class: 'btn btn--secondary' },
      ...(order.clientPhone && whatsapp ? [{
        label: '💬 Resumen WhatsApp', class: 'btn btn--success', close: false,
        callback: () => {
          const msg = orderSummaryMessage(order, order.clientName, storeName);
          openWhatsApp(order.clientPhone.replace(/\D/g,''), msg);
        }
      }] : []),
    ]
  });
}

// ─── Asistente de nuevo pedido (3 pasos) ──────────────────────────────────────

async function openOrderWizard(onConfirm) {
  const [clients, products, promotions] = await Promise.all([
    getAllClients(), getAllProducts(), getAllPromotions()
  ]);
  const activePromos = getActivePromotions(promotions);

  const state = {
    step:    0,
    client:  null,
    lines:   [],  // { productId, variantId, productName, variantName, qty, unitPrice, costPrice, totalPrice, discountAmount, promoApplied }
    notes:   '',
  };

  const wrap = document.createElement('div');
  wrap.className = 'wizard';

  function renderStep() {
    wrap.innerHTML = `
      <div class="wizard__steps">
        ${STEPS.map((s, i) => `<div class="wizard__step ${i===state.step?'wizard__step--active':i<state.step?'wizard__step--done':''}">
          <span class="wizard__step-num">${i < state.step ? '✓' : i+1}</span>
          <span class="wizard__step-label">${s}</span>
        </div>`).join('<div class="wizard__step-line"></div>')}
      </div>
      <div id="wizard-body" class="wizard__body"></div>
      <div class="wizard__footer">
        ${state.step > 0 ? `<button class="btn btn--secondary" id="wiz-back">← Atrás</button>` : '<span></span>'}
        <button class="btn btn--primary" id="wiz-next">${state.step === STEPS.length-1 ? '✅ Confirmar pedido' : 'Siguiente →'}</button>
      </div>`;

    const body = wrap.querySelector('#wizard-body');

    if (state.step === 0) renderStepClient(body, state, clients);
    if (state.step === 1) renderStepProducts(body, state, products, activePromos);
    if (state.step === 2) renderStepReview(body, state);

    wrap.querySelector('#wiz-next').addEventListener('click', async () => {
      if (state.step === 0) {
        if (!state.client) { toast('Selecciona o crea un cliente', 'warning'); return; }
        state.step = 1;
      } else if (state.step === 1) {
        if (state.lines.length === 0) { toast('Añade al menos un producto', 'warning'); return; }
        state.step = 2;
      } else {
        const orderNum = await getNextOrderNumber();
        const totals   = calcOrderTotal(state.lines);
        const order    = {
          orderNumber:  orderNum,
          clientId:     state.client.id,
          clientName:   state.client.name,
          clientPhone:  state.client.phone || '',
          lines:        state.lines,
          ...totals,
          costTotal:    state.lines.reduce((s,l) => s + (Number(l.costPrice)||0) * (l.qty||0), 0),
          notes:        state.notes,
          status:       'pending',
        };
        await onConfirm(order);
        closeModal();
        return;
      }
      renderStep();
    });

    wrap.querySelector('#wiz-back')?.addEventListener('click', () => {
      state.step--;
      renderStep();
    });
  }

  renderStep();

  showModal({
    title: 'Nuevo pedido',
    content: wrap,
    actions: [],
  });
}

// ─── Paso 1: Cliente ──────────────────────────────────────────────────────────

function renderStepClient(body, state, clients) {
  let search = '';

  body.innerHTML = `
    <div class="field">
      <label class="field__label">Buscar cliente</label>
      <input class="field__input" id="client-search" type="search" placeholder="Nombre o teléfono…" autocomplete="off">
    </div>
    <div id="client-results" class="client-results"></div>
    ${state.client ? `<div class="selected-client">
      <span class="selected-client__icon">✓</span>
      <strong>${esc(state.client.name)}</strong> ${esc(state.client.phone||'')}
      <button class="btn btn--sm btn--ghost" id="clear-client">Cambiar</button>
    </div>` : ''}
    <button class="btn btn--secondary btn--full" id="btn-new-wizard-client" style="margin-top:1rem">+ Crear cliente nuevo</button>`;

  const resultsEl = body.querySelector('#client-results');

  function showResults() {
    const q = search.toLowerCase();
    const matches = !q ? [] : clients.filter(c =>
      c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
    ).slice(0,8);
    resultsEl.innerHTML = matches.map(c => `
      <div class="client-result-item" data-id="${c.id}">
        <span class="client-result-item__avatar">${(c.name||'?')[0].toUpperCase()}</span>
        <span>${esc(c.name)}</span>
        <small>${esc(c.phone||'')}</small>
      </div>`).join('');
    resultsEl.querySelectorAll('.client-result-item').forEach(el => {
      el.addEventListener('click', () => {
        state.client = clients.find(c => c.id === Number(el.dataset.id));
        renderStepClient(body, state, clients);
      });
    });
  }

  body.querySelector('#client-search').addEventListener('input', e => {
    search = e.target.value;
    showResults();
  });

  body.querySelector('#clear-client')?.addEventListener('click', () => {
    state.client = null;
    renderStepClient(body, state, clients);
  });

  body.querySelector('#btn-new-wizard-client').addEventListener('click', () => {
    // Mini formulario inline de creación de cliente
    const form = document.createElement('form');
    form.innerHTML = `
      <div class="field"><label class="field__label">Nombre *</label>
        <input class="field__input" name="name" required placeholder="Nombre completo"></div>
      <div class="field"><label class="field__label">Teléfono</label>
        <input class="field__input" name="phone" type="tel" placeholder="600 123 456"></div>
      <div id="dup-warn" class="alert alert--warning hidden">Ya existe un cliente con ese teléfono.</div>
      <button class="btn btn--primary btn--full" type="submit">Crear cliente</button>`;

    form.querySelector('[name=phone]').addEventListener('blur', async e => {
      const phone = e.target.value.trim();
      if (!phone) return;
      const existing = await findClientByPhone(phone);
      form.querySelector('#dup-warn').classList.toggle('hidden', existing.length === 0);
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const newClient = { name: form.name.value.trim(), phone: form.phone.value.trim() };
      const id = await saveClient(newClient);
      newClient.id = id;
      clients.push(newClient);
      state.client = newClient;
      renderStepClient(body, state, clients);
    });

    body.innerHTML = '';
    body.appendChild(form);
  });
}

// ─── Paso 2: Productos ────────────────────────────────────────────────────────

function renderStepProducts(body, state, products, activePromos) {
  const CATS = ['Nutrición y batidos','Bebidas y aloe','Barritas y snacks','Cuidado personal','Nutrición deportiva'];
  let cat = CATS[0];

  function recalcLines() {
    state.lines.forEach(l => {
      const variant = { price: l.unitPrice, productId: l.productId, variantId: l.variantId };
      const r = calcLinePrice(variant, l.qty, activePromos);
      l.totalPrice    = r.totalPrice;
      l.discountAmount= r.discountAmount;
      l.promoApplied  = r.promoApplied;
    });
  }

  function renderBody() {
    const catProducts = products.filter(p => p.category === cat && p.available !== false);
    body.innerHTML = `
      <div class="category-tabs">
        ${CATS.map(c => `<button class="tab ${c===cat?'tab--active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <div class="product-selector">
        ${catProducts.length === 0 ? '<p class="empty-msg">Sin productos disponibles en esta categoría.</p>' :
          catProducts.map(p => productItemHtml(p)).join('')}
      </div>
      <hr class="divider">
      <h4 class="section__title">Líneas del pedido</h4>
      <div id="order-lines">${renderLines()}</div>`;

    body.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => { cat = btn.dataset.cat; renderBody(); });
    });
    body.querySelectorAll('.add-to-order').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = products.find(x => x.id === Number(btn.dataset.pid));
        if (!p) return;
        addToLines(p, btn.dataset.vid || null);
        body.querySelector('#order-lines').innerHTML = renderLines();
        attachLineEvents();
      });
    });
    attachLineEvents();
  }

  function attachLineEvents() {
    body.querySelectorAll('.line-qty').forEach(input => {
      input.addEventListener('change', () => {
        const idx = Number(input.closest('[data-line]').dataset.line);
        state.lines[idx].qty = Math.max(1, parseInt(input.value)||1);
        recalcLines();
        body.querySelector('#order-lines').innerHTML = renderLines();
        attachLineEvents();
      });
    });
    body.querySelectorAll('.line-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.closest('[data-line]').dataset.line);
        state.lines.splice(idx, 1);
        body.querySelector('#order-lines').innerHTML = renderLines();
        attachLineEvents();
      });
    });
  }

  function productItemHtml(p) {
    if (p.variants?.length > 0) {
      return `<div class="product-selector-item">
        <strong>${esc(p.name)}</strong>
        <div class="variant-buttons">
          ${p.variants.filter(v => v.available !== false).map(v => `
            <button class="btn btn--sm btn--secondary add-to-order" data-pid="${p.id}" data-vid="${v.id}">
              ${esc(v.name || v.flavor || v.format || 'Variante')} — ${formatPrice(v.price)}
            </button>`).join('')}
        </div></div>`;
    }
    return `<div class="product-selector-item">
      <strong>${esc(p.name)}</strong>
      <span>${formatPrice(p.price)}</span>
      <button class="btn btn--sm btn--primary add-to-order" data-pid="${p.id}">+ Añadir</button>
    </div>`;
  }

  function addToLines(product, variantId) {
    const variant = variantId
      ? product.variants?.find(v => v.id === variantId)
      : null;
    const price     = variant ? Number(variant.price) : Number(product.price) || 0;
    const costPrice = variant ? Number(variant.costPrice) : Number(product.costPrice) || 0;
    const variantName = variant ? (variant.name || variant.flavor || variant.format || '') : '';

    // ¿Ya existe esta línea?
    const existing = state.lines.find(l => l.productId === product.id && l.variantId === (variantId||null));
    if (existing) {
      existing.qty++;
      recalcLines();
      return;
    }

    const vcVariant = { price, productId: product.id, variantId: variantId || null };
    const result    = calcLinePrice(vcVariant, 1, activePromos);

    state.lines.push({
      productId:     product.id,
      variantId:     variantId || null,
      productName:   product.name,
      variantName,
      qty:           1,
      unitPrice:     price,
      costPrice,
      totalPrice:    result.totalPrice,
      discountAmount:result.discountAmount,
      promoApplied:  result.promoApplied,
    });
  }

  function renderLines() {
    if (state.lines.length === 0) return '<p class="empty-msg">Sin productos añadidos.</p>';
    const totals = calcOrderTotal(state.lines);
    return `
      ${state.lines.map((l, i) => `
        <div class="line-row" data-line="${i}">
          <div class="line-row__name">${esc(l.productName)}${l.variantName?` <small>(${esc(l.variantName)})</small>`:''}</div>
          <div class="line-row__controls">
            <input class="line-qty" type="number" min="1" value="${l.qty}" style="width:4rem">
            <span>${formatPrice(l.totalPrice)}</span>
            ${l.discountAmount>0?`<small class="text-green">-${formatPrice(l.discountAmount)}</small>`:''}
            <button class="btn btn--sm btn--danger line-del">🗑</button>
          </div>
        </div>`).join('')}
      <div class="line-row line-row--total">
        ${totals.discount>0?`<span class="text-green">Descuento: -${formatPrice(totals.discount)}</span>`:''}
        <strong>Total: ${formatPrice(totals.total)}</strong>
      </div>`;
  }

  renderBody();
}

// ─── Paso 3: Revisión ─────────────────────────────────────────────────────────

function renderStepReview(body, state) {
  const totals = calcOrderTotal(state.lines);
  body.innerHTML = `
    <div class="review-section">
      <h4 class="section__title">Cliente</h4>
      <p><strong>${esc(state.client?.name)}</strong> ${esc(state.client?.phone||'')}</p>
      <h4 class="section__title">Productos</h4>
      <table class="order-table">
        <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th></tr></thead>
        <tbody>
          ${state.lines.map(l => `<tr>
            <td>${esc(l.productName)}${l.variantName?` <small>(${esc(l.variantName)})</small>`:''}</td>
            <td>${l.qty}</td>
            <td>${formatPrice(l.totalPrice)}${l.discountAmount>0?` <span class="text-green">-${formatPrice(l.discountAmount)}</span>`:''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${totals.discount>0?`<p class="text-green">Descuento total: -${formatPrice(totals.discount)}</p>`:''}
      <p class="review-total">Total: <strong>${formatPrice(totals.total)}</strong></p>
      <div class="field">
        <label class="field__label">Notas del pedido</label>
        <textarea class="field__input" id="order-notes" rows="2" placeholder="Instrucciones especiales…">${esc(state.notes)}</textarea>
      </div>
    </div>`;

  body.querySelector('#order-notes').addEventListener('input', e => {
    state.notes = e.target.value;
  });
}
