/**
 * clients.js — Gestión de clientes
 */

import { getAllClients, saveClient, deleteClient, getOrdersByClient, getSetting } from '../db.js';
import { getAllOrders } from '../db.js';
import { toast, showModal, closeModal, confirm, formatPrice, formatDate, relativeTime,
         clientCategory, categoryChip, esc, uid } from '../ui.js';
import { openWhatsApp } from '../utils/whatsapp.js';

export async function renderClients(container) {
  const [clients, orders, vipSpend, vipOrders] = await Promise.all([
    getAllClients(),
    getAllOrders(),
    getSetting('vipMinSpend', 300),
    getSetting('vipMinOrders', 10),
  ]);
  const vipSettings = { minSpend: vipSpend, minOrders: vipOrders };

  let filter = '';

  function filteredClients() {
    if (!filter) return clients;
    const q = filter.toLowerCase();
    return clients.filter(c =>
      c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
    );
  }

  function renderList() {
    const list = filteredClients();
    const listEl = container.querySelector('#clients-list');
    if (!listEl) return;
    if (list.length === 0) {
      listEl.innerHTML = `<p class="empty-msg">No se encontraron clientes.</p>`;
      return;
    }
    listEl.innerHTML = list.map(c => {
      const cat = clientCategory(c, orders, vipSettings);
      const co  = orders.filter(o => o.clientId === c.id && o.status === 'delivered');
      const spent = co.reduce((s, o) => s + (o.total || 0), 0);
      return `<div class="client-card" data-id="${c.id}">
        <div class="client-card__avatar">${(c.name || '?')[0].toUpperCase()}</div>
        <div class="client-card__info">
          <div class="client-card__name">${esc(c.name)}</div>
          <div class="client-card__meta">${esc(c.phone || '—')} · ${co.length} pedido${co.length !== 1 ? 's' : ''} · ${formatPrice(spent)}</div>
        </div>
        <div class="client-card__right">
          ${categoryChip(cat)}
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.client-card').forEach(el => {
      el.addEventListener('click', () => {
        const c = clients.find(x => x.id === Number(el.dataset.id));
        if (c) showClientDetail(c, orders, vipSettings);
      });
    });
  }

  container.innerHTML = `
    <div class="view-clients">
      <div class="view-header">
        <h2 class="view-header__title">Clientes <span class="badge">${clients.length}</span></h2>
        <button class="btn btn--primary" id="btn-new-client">+ Nuevo</button>
      </div>
      <div class="search-bar">
        <input class="field__input" id="search-clients" type="search" placeholder="Buscar por nombre o teléfono…" autocomplete="off">
      </div>
      <div id="clients-list" class="client-list"></div>
    </div>`;

  renderList();

  container.querySelector('#search-clients').addEventListener('input', e => {
    filter = e.target.value.trim();
    renderList();
  });

  container.querySelector('#btn-new-client').addEventListener('click', () => {
    showClientForm(null, async (data) => {
      await saveClient(data);
      clients.length = 0;
      (await getAllClients()).forEach(c => clients.push(c));
      renderList();
      toast('Cliente guardado', 'success');
    }, clients);
  });
}

// ─── Formulario de cliente ────────────────────────────────────────────────────

function showClientForm(existing, onSave, allClients) {
  const isNew = !existing;
  const form = document.createElement('form');
  form.className = 'client-form';
  form.innerHTML = `
    <div class="field">
      <label class="field__label">Nombre y apellidos *</label>
      <input class="field__input" name="name" type="text" value="${esc(existing?.name || '')}" required placeholder="Nombre completo">
    </div>
    <div class="field">
      <label class="field__label">Teléfono</label>
      <input class="field__input" name="phone" type="tel" value="${esc(existing?.phone || '')}" placeholder="Ej: 600 123 456">
    </div>
    <div class="field">
      <label class="field__label">Observaciones</label>
      <textarea class="field__input" name="notes" rows="3" placeholder="Notas internas…">${esc(existing?.notes || '')}</textarea>
    </div>
    <div id="phone-warning" class="alert alert--warning hidden">Ya existe un cliente con ese teléfono.</div>`;

  form.querySelector('[name=phone]').addEventListener('blur', async (e) => {
    const phone = e.target.value.trim();
    if (!phone) return;
    const matches = allClients.filter(c => c.phone === phone && c.id !== existing?.id);
    form.querySelector('#phone-warning').classList.toggle('hidden', matches.length === 0);
  });

  showModal({
    title: isNew ? 'Nuevo cliente' : 'Editar cliente',
    content: form,
    actions: [
      { label: 'Cancelar', class: 'btn btn--secondary' },
      { label: 'Guardar', class: 'btn btn--primary', close: false, callback: async () => {
        if (!form.reportValidity()) return;
        const data = {
          ...existing,
          id:    existing?.id,
          name:  form.name.value.trim(),
          phone: form.phone.value.trim(),
          notes: form.notes.value.trim(),
        };
        if (!data.id) delete data.id;
        await onSave(data);
        closeModal();
      }},
    ]
  });
}

// ─── Detalle de cliente ───────────────────────────────────────────────────────

function showClientDetail(client, allOrders, vipSettings) {
  const clientOrders = allOrders
    .filter(o => o.clientId === client.id)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  const delivered = clientOrders.filter(o => o.status === 'delivered');
  const spent     = delivered.reduce((s, o) => s + (o.total || 0), 0);
  const ticket    = delivered.length ? spent / delivered.length : 0;
  const cat       = clientCategory(client, allOrders, vipSettings);

  const lastDate  = delivered.length
    ? new Date(Math.max(...delivered.map(o => new Date(o.createdAt))))
    : null;

  // Productos más comprados
  const productCount = {};
  delivered.forEach(o => (o.lines || []).forEach(l => {
    const key = l.productName || l.productId;
    productCount[key] = (productCount[key] || 0) + (l.qty || 1);
  }));
  const topProducts = Object.entries(productCount)
    .sort((a,b) => b[1] - a[1]).slice(0,5);

  const content = `
    <div class="client-detail">
      <div class="client-detail__header">
        <div class="client-detail__avatar">${(client.name || '?')[0].toUpperCase()}</div>
        <div>
          <h3>${esc(client.name)}</h3>
          <p>${esc(client.phone || 'Sin teléfono')} ${categoryChip(cat)}</p>
        </div>
      </div>
      <div class="stats-mini-grid">
        <div class="stat-mini"><span>${delivered.length}</span><small>Pedidos</small></div>
        <div class="stat-mini"><span>${formatPrice(spent)}</span><small>Gastado</small></div>
        <div class="stat-mini"><span>${formatPrice(ticket)}</span><small>Ticket medio</small></div>
        <div class="stat-mini"><span>${lastDate ? relativeTime(lastDate.toISOString()) : '—'}</span><small>Última compra</small></div>
      </div>
      ${client.notes ? `<p class="client-detail__notes">${esc(client.notes)}</p>` : ''}
      ${topProducts.length ? `
        <h4 class="section__title">Productos favoritos</h4>
        <ul class="simple-list">${topProducts.map(([n,c]) => `<li>${esc(n)} <span class="badge">${c}</span></li>`).join('')}</ul>` : ''}
      <h4 class="section__title">Historial de pedidos</h4>
      ${clientOrders.length === 0
        ? '<p class="empty-msg">Sin pedidos.</p>'
        : `<div class="order-list order-list--compact">${clientOrders.map(o => `
            <div class="order-row order-row--compact">
              <span>${esc(o.orderNumber)}</span>
              <span>${formatPrice(o.total)}</span>
              <span>${formatDate(o.createdAt)}</span>
            </div>`).join('')}</div>`}
    </div>`;

  showModal({
    title: 'Ficha de cliente',
    content,
    actions: [
      { label: 'Cerrar', class: 'btn btn--secondary' },
      ...(client.phone ? [{
        label: '💬 WhatsApp', class: 'btn btn--success', close: false,
        callback: () => openWhatsApp(client.phone.replace(/\D/g, ''), `Hola ${client.name} 👋`)
      }] : []),
      { label: '✏️ Editar', class: 'btn btn--primary', close: false,
        callback: () => {
          closeModal();
          showClientForm(client, async (data) => {
            await saveClient(data);
            toast('Cliente actualizado', 'success');
            closeModal();
          }, []);
        }
      },
    ]
  });
}
