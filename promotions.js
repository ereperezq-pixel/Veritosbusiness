/**
 * promotions.js — Gestión de promociones
 */

import { getAllPromotions, savePromotion, deletePromotion, getAllProducts } from '../db.js';
import { toast, showModal, closeModal, confirm, formatPrice, formatDate, esc, uid } from '../ui.js';

const PROMO_TYPES = {
  percent: '% Descuento porcentual',
  fixed:   '€ Descuento fijo por unidad',
  bundle:  '📦 Oferta por cantidad (pack)',
};

const STATUS_LABELS = {
  upcoming: { label: 'Próxima',       color: '#E3F2FD', text: '#1565C0' },
  active:   { label: 'Activa',        color: '#E8F5E9', text: '#1B5E20' },
  ending:   { label: 'Acaba pronto',  color: '#FFF3E0', text: '#E65100' },
  ended:    { label: 'Finalizada',    color: '#FAFAFA', text: '#757575' },
  disabled: { label: 'Desactivada',   color: '#FFEBEE', text: '#B71C1C' },
};

function promoStatus(p) {
  if (!p.enabled) return 'disabled';
  const now = new Date();
  if (p.startDate && new Date(p.startDate) > now) return 'upcoming';
  if (p.endDate) {
    const end = new Date(p.endDate);
    if (end < now) return 'ended';
    // Acaba en menos de 48h
    if (end - now < 48 * 3600 * 1000) return 'ending';
  }
  return 'active';
}

export async function renderPromotions(container) {
  let promos   = await getAllPromotions();
  let products = await getAllProducts();
  let filter   = 'all';

  function filtered() {
    if (filter === 'all') return promos;
    return promos.filter(p => promoStatus(p) === filter);
  }

  function renderList() {
    const listEl = container.querySelector('#promos-list');
    if (!listEl) return;
    const list = filtered().sort((a,b) => {
      const order = ['active','ending','upcoming','ended','disabled'];
      return order.indexOf(promoStatus(a)) - order.indexOf(promoStatus(b));
    });
    if (list.length === 0) {
      listEl.innerHTML = `<p class="empty-msg">No hay promociones con este filtro.</p>`;
      return;
    }
    listEl.innerHTML = list.map(p => {
      const st  = promoStatus(p);
      const stl = STATUS_LABELS[st];
      return `<div class="promo-card" data-id="${p.id}">
        <div class="promo-card__header">
          <span class="chip" style="background:${stl.color};color:${stl.text}">${stl.label}</span>
          <strong>${esc(p.name)}</strong>
          <label class="toggle promo-card__toggle" title="${p.enabled?'Desactivar':'Activar'}">
            <input type="checkbox" class="promo-toggle" data-id="${p.id}" ${p.enabled?'checked':''}>
            <span class="toggle__slider"></span>
          </label>
        </div>
        <p class="promo-card__desc">${esc(promoDescription(p))}</p>
        <div class="promo-card__meta">
          ${p.startDate ? `<small>Inicio: ${formatDate(p.startDate)}</small>` : ''}
          ${p.endDate   ? `<small>Fin: ${formatDate(p.endDate)}</small>` : '<small>Sin fecha de fin</small>'}
        </div>
        <div class="promo-card__actions">
          <button class="btn btn--sm btn--secondary promo-edit" data-id="${p.id}">✏️ Editar</button>
          <button class="btn btn--sm btn--danger promo-del" data-id="${p.id}">🗑 Eliminar</button>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.promo-toggle').forEach(cb => {
      cb.addEventListener('change', async () => {
        const p = promos.find(x => x.id === Number(cb.dataset.id));
        if (!p) return;
        p.enabled = cb.checked;
        await savePromotion(p);
        promos = await getAllPromotions();
        renderList();
        toast(p.enabled ? 'Promoción activada' : 'Promoción desactivada', 'info');
      });
    });
    listEl.querySelectorAll('.promo-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = promos.find(x => x.id === Number(btn.dataset.id));
        if (p) showPromoForm(p, products, async (updated) => {
          await savePromotion(updated);
          promos = await getAllPromotions();
          renderList();
          toast('Promoción guardada', 'success');
        });
      });
    });
    listEl.querySelectorAll('.promo-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (await confirm('¿Eliminar esta promoción?', { confirmLabel: 'Eliminar', danger: true })) {
          await deletePromotion(Number(btn.dataset.id));
          promos = await getAllPromotions();
          renderList();
          toast('Promoción eliminada', 'info');
        }
      });
    });
  }

  container.innerHTML = `
    <div class="view-promotions">
      <div class="view-header">
        <h2 class="view-header__title">Promociones</h2>
        <button class="btn btn--primary" id="btn-new-promo">+ Nueva</button>
      </div>
      <div class="status-tabs">
        <button class="tab tab--active" data-filter="all">Todas</button>
        ${Object.entries(STATUS_LABELS).map(([k,v]) =>
          `<button class="tab" data-filter="${k}">${v.label}</button>`
        ).join('')}
      </div>
      <div id="promos-list"></div>
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

  container.querySelector('#btn-new-promo').addEventListener('click', () => {
    showPromoForm(null, products, async (data) => {
      await savePromotion(data);
      promos = await getAllPromotions();
      renderList();
      toast('Promoción creada', 'success');
    });
  });
}

function promoDescription(p) {
  if (p.type === 'percent') return `${p.value}% de descuento`;
  if (p.type === 'fixed')   return `${formatPrice(p.value)} de descuento por unidad`;
  if (p.type === 'bundle')  return `${p.bundleQty} unidades por ${formatPrice(p.bundlePrice)}`;
  return '';
}

// ─── Formulario de promoción ──────────────────────────────────────────────────

function showPromoForm(existing, products, onSave) {
  const wrap = document.createElement('div');

  function buildForm() {
    const type = existing?.type || 'percent';
    const selectedProducts = existing?.productIds || [];

    wrap.innerHTML = `
      <div class="field">
        <label class="field__label">Nombre *</label>
        <input class="field__input" id="prom-name" value="${esc(existing?.name||'')}" required placeholder="Nombre de la promoción">
      </div>
      <div class="field">
        <label class="field__label">Tipo *</label>
        <select class="field__input" id="prom-type">
          ${Object.entries(PROMO_TYPES).map(([k,v]) =>
            `<option value="${k}" ${existing?.type===k?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div id="prom-type-fields"></div>
      <div class="field">
        <label class="field__label">Descripción (visible al cliente)</label>
        <input class="field__input" id="prom-desc" value="${esc(existing?.description||'')}" placeholder="Descripción breve…">
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field__label">Fecha inicio</label>
          <input class="field__input" id="prom-start" type="datetime-local" value="${existing?.startDate ? toLocalInput(existing.startDate) : ''}">
        </div>
        <div class="field">
          <label class="field__label">Fecha fin</label>
          <input class="field__input" id="prom-end" type="datetime-local" value="${existing?.endDate ? toLocalInput(existing.endDate) : ''}">
        </div>
      </div>
      <label class="field__label toggle-label">
        <span>Activa</span>
        <label class="toggle">
          <input type="checkbox" id="prom-enabled" ${existing?.enabled!==false?'checked':''}>
          <span class="toggle__slider"></span>
        </label>
      </label>
      <h4 class="section__title">Aplicar a productos (vacío = todos)</h4>
      <div class="product-checkboxes">
        ${products.map(p => `
          <label class="checkbox-label">
            <input type="checkbox" class="prom-prod" value="${p.id}" ${selectedProducts.includes(p.id)?'checked':''}>
            ${esc(p.name)}
          </label>`).join('')}
      </div>`;

    renderTypeFields(wrap.querySelector('#prom-type-fields'), type, existing);

    wrap.querySelector('#prom-type').addEventListener('change', e => {
      renderTypeFields(wrap.querySelector('#prom-type-fields'), e.target.value, null);
    });
  }

  buildForm();

  showModal({
    title: existing ? 'Editar promoción' : 'Nueva promoción',
    content: wrap,
    actions: [
      { label: 'Cancelar', class: 'btn btn--secondary' },
      { label: 'Guardar', class: 'btn btn--primary', close: false, callback: async () => {
        const name = wrap.querySelector('#prom-name')?.value.trim();
        if (!name) { toast('El nombre es obligatorio', 'error'); return; }
        const type = wrap.querySelector('#prom-type')?.value;
        const productIds = [...wrap.querySelectorAll('.prom-prod:checked')].map(cb => Number(cb.value));
        const data = {
          ...existing,
          id:          existing?.id,
          name,
          type,
          description: wrap.querySelector('#prom-desc')?.value.trim(),
          enabled:     wrap.querySelector('#prom-enabled')?.checked,
          startDate:   wrap.querySelector('#prom-start')?.value ? new Date(wrap.querySelector('#prom-start').value).toISOString() : null,
          endDate:     wrap.querySelector('#prom-end')?.value   ? new Date(wrap.querySelector('#prom-end').value).toISOString()   : null,
          productIds,
          value:       type !== 'bundle' ? Number(wrap.querySelector('#prom-value')?.value) || 0 : null,
          bundleQty:   type === 'bundle' ? Number(wrap.querySelector('#prom-bqty')?.value)  || 2 : null,
          bundlePrice: type === 'bundle' ? Number(wrap.querySelector('#prom-bprice')?.value)|| 0 : null,
        };
        if (!data.id) delete data.id;
        await onSave(data);
        closeModal();
      }},
    ]
  });
}

function renderTypeFields(el, type, existing) {
  if (type === 'percent') {
    el.innerHTML = `<div class="field"><label class="field__label">Porcentaje de descuento (%)</label>
      <input class="field__input" id="prom-value" type="number" min="1" max="100" value="${existing?.value||''}" placeholder="Ej: 10"></div>`;
  } else if (type === 'fixed') {
    el.innerHTML = `<div class="field"><label class="field__label">Descuento fijo por unidad (€)</label>
      <input class="field__input" id="prom-value" type="number" min="0.01" step="0.01" value="${existing?.value||''}" placeholder="Ej: 2.00"></div>`;
  } else if (type === 'bundle') {
    el.innerHTML = `<div class="field-row">
      <div class="field"><label class="field__label">Unidades del pack</label>
        <input class="field__input" id="prom-bqty" type="number" min="2" value="${existing?.bundleQty||2}"></div>
      <div class="field"><label class="field__label">Precio del pack (€)</label>
        <input class="field__input" id="prom-bprice" type="number" min="0" step="0.01" value="${existing?.bundlePrice||''}" placeholder="Ej: 35.00"></div>
    </div>`;
  }
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
