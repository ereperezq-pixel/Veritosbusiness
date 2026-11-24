/**
 * products.js — Gestión de productos y variantes
 */

import { getAllProducts, saveProduct, deleteProduct } from '../db.js';
import { toast, showModal, closeModal, confirm, formatPrice, productCard, esc, uid } from '../ui.js';

const CATEGORIES = [
  'Nutrición y batidos',
  'Bebidas y aloe',
  'Barritas y snacks',
  'Cuidado personal',
  'Nutrición deportiva',
];

export async function renderProducts(container) {
  let products = await getAllProducts();
  let filterCat = 'all';
  let filterText = '';

  function filtered() {
    return products.filter(p => {
      if (filterCat !== 'all' && p.category !== filterCat) return false;
      if (filterText && !p.name?.toLowerCase().includes(filterText.toLowerCase())) return false;
      return true;
    });
  }

  function renderGrid() {
    const grid = container.querySelector('#products-grid');
    if (!grid) return;
    const list = filtered();
    if (list.length === 0) {
      grid.innerHTML = `<p class="empty-msg">No hay productos en esta categoría.</p>`;
      return;
    }
    grid.innerHTML = '';
    list.forEach(p => {
      grid.appendChild(productCard(p, {
        onEdit: () => showProductForm(p, async (updated) => {
          await saveProduct(updated);
          products = await getAllProducts();
          renderGrid();
          toast('Producto guardado', 'success');
        }),
      }));
    });
  }

  container.innerHTML = `
    <div class="view-products">
      <div class="view-header">
        <h2 class="view-header__title">Productos</h2>
        <button class="btn btn--primary" id="btn-new-product">+ Nuevo</button>
      </div>
      <div class="filter-bar">
        <input class="field__input" id="search-products" type="search" placeholder="Buscar…" autocomplete="off">
      </div>
      <div class="category-tabs" id="cat-tabs">
        <button class="tab tab--active" data-cat="all">Todos</button>
        ${CATEGORIES.map(c => `<button class="tab" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <div id="products-grid" class="products-grid"></div>
    </div>`;

  renderGrid();

  container.querySelector('#search-products').addEventListener('input', e => {
    filterText = e.target.value;
    renderGrid();
  });

  container.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach(b => b.classList.remove('tab--active'));
      btn.classList.add('tab--active');
      filterCat = btn.dataset.cat;
      renderGrid();
    });
  });

  container.querySelector('#btn-new-product').addEventListener('click', () => {
    showProductForm(null, async (data) => {
      await saveProduct(data);
      products = await getAllProducts();
      renderGrid();
      toast('Producto creado', 'success');
    });
  });
}

// ─── Formulario de producto ───────────────────────────────────────────────────

function showProductForm(existing, onSave) {
  const isNew = !existing;
  const variants = existing ? JSON.parse(JSON.stringify(existing.variants || [])) : [];

  const wrap = document.createElement('div');
  wrap.className = 'product-form';

  function buildForm() {
    wrap.innerHTML = `
      <div class="field">
        <label class="field__label">Nombre *</label>
        <input class="field__input" id="pf-name" type="text" value="${esc(existing?.name||'')}" required placeholder="Nombre del producto">
      </div>
      <div class="field">
        <label class="field__label">Categoría *</label>
        <select class="field__input" id="pf-category" required>
          ${CATEGORIES.map(c => `<option value="${esc(c)}" ${existing?.category===c?'selected':''}>${esc(c)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label class="field__label">Descripción</label>
        <textarea class="field__input" id="pf-desc" rows="2" placeholder="Descripción breve…">${esc(existing?.description||'')}</textarea>
      </div>
      <div class="field">
        <label class="field__label">Fotografía</label>
        <div class="img-preview-wrap">
          <img id="pf-img-preview" src="${existing?.image||'./assets/placeholder.png'}" alt="Vista previa" class="img-preview"
            onerror="this.src='./assets/placeholder.png'">
        </div>
        <input class="field__input" id="pf-image-url" type="url" placeholder="URL de la imagen (opcional)"
          value="${esc(existing?.image||'')}">
        <label class="btn btn--secondary btn--full" style="margin-top:0.5rem;cursor:pointer;">
          📷 Cargar desde dispositivo
          <input type="file" id="pf-image-file" accept="image/*" style="display:none">
        </label>
      </div>
      <div class="field">
        <label class="field__label toggle-label">
          <span>Disponible</span>
          <label class="toggle">
            <input type="checkbox" id="pf-available" ${existing?.available!==false?'checked':''}>
            <span class="toggle__slider"></span>
          </label>
        </label>
      </div>
      <hr class="divider">
      <h4 class="section__title">Variantes <button type="button" class="btn btn--sm btn--ghost" id="add-variant">+ Añadir</button></h4>
      <div id="variants-list"></div>`;

    renderVariants();

    wrap.querySelector('#pf-image-url').addEventListener('input', e => {
      wrap.querySelector('#pf-img-preview').src = e.target.value || './assets/placeholder.png';
    });
    wrap.querySelector('#pf-image-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        wrap.querySelector('#pf-img-preview').src = ev.target.result;
        wrap.querySelector('#pf-image-url').value = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    wrap.querySelector('#add-variant').addEventListener('click', () => {
      variants.push({ id: uid(), name: '', flavor: '', format: '', price: '', costPrice: '', available: true });
      renderVariants();
    });
  }

  function renderVariants() {
    const listEl = wrap.querySelector('#variants-list');
    if (!listEl) return;
    if (variants.length === 0) {
      listEl.innerHTML = `<p class="text-muted">Sin variantes: precio único en el producto.</p>
        <div class="field-row">
          <div class="field"><label class="field__label">Precio venta *</label>
            <input class="field__input" id="pf-price" type="number" min="0" step="0.01"
              value="${esc(existing?.price||'')}" placeholder="0.00"></div>
          <div class="field"><label class="field__label">Coste adquisición</label>
            <input class="field__input" id="pf-cost" type="number" min="0" step="0.01"
              value="${esc(existing?.costPrice||'')}" placeholder="0.00"></div>
        </div>`;
      return;
    }
    listEl.innerHTML = variants.map((v, i) => `
      <div class="variant-row" data-idx="${i}">
        <div class="variant-row__header">
          <strong>Variante ${i+1}</strong>
          <button type="button" class="btn btn--sm btn--danger variant-del" data-idx="${i}">🗑</button>
        </div>
        <div class="field-row">
          <div class="field"><label class="field__label">Nombre</label>
            <input class="field__input" data-field="name" value="${esc(v.name)}" placeholder="Nombre variante"></div>
          <div class="field"><label class="field__label">Sabor</label>
            <input class="field__input" data-field="flavor" value="${esc(v.flavor||'')}" placeholder="Sabor"></div>
        </div>
        <div class="field-row">
          <div class="field"><label class="field__label">Precio *</label>
            <input class="field__input" data-field="price" type="number" min="0" step="0.01" value="${esc(v.price)}" placeholder="0.00"></div>
          <div class="field"><label class="field__label">Coste</label>
            <input class="field__input" data-field="costPrice" type="number" min="0" step="0.01" value="${esc(v.costPrice||'')}" placeholder="0.00"></div>
        </div>
        <label class="field__label toggle-label">
          <span>Disponible</span>
          <label class="toggle"><input type="checkbox" data-field="available" ${v.available!==false?'checked':''}><span class="toggle__slider"></span></label>
        </label>
      </div>`).join('');

    listEl.querySelectorAll('.variant-del').forEach(btn => {
      btn.addEventListener('click', () => {
        variants.splice(Number(btn.dataset.idx), 1);
        renderVariants();
      });
    });
    listEl.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('input', () => {
        const row  = input.closest('[data-idx]');
        const idx  = Number(row.dataset.idx);
        const field = input.dataset.field;
        variants[idx][field] = input.type === 'checkbox' ? input.checked : input.value;
      });
    });
  }

  buildForm();

  showModal({
    title: isNew ? 'Nuevo producto' : 'Editar producto',
    content: wrap,
    actions: [
      { label: 'Cancelar', class: 'btn btn--secondary' },
      { label: 'Guardar', class: 'btn btn--primary', close: false, callback: async () => {
        const name = wrap.querySelector('#pf-name')?.value.trim();
        if (!name) { toast('El nombre es obligatorio', 'error'); return; }
        const data = {
          ...existing,
          id:          existing?.id,
          name,
          category:    wrap.querySelector('#pf-category')?.value,
          description: wrap.querySelector('#pf-desc')?.value.trim(),
          image:       wrap.querySelector('#pf-image-url')?.value.trim() || null,
          available:   wrap.querySelector('#pf-available')?.checked,
          variants:    variants.length ? variants : [],
          price:       variants.length ? null : Number(wrap.querySelector('#pf-price')?.value) || 0,
          costPrice:   variants.length ? null : Number(wrap.querySelector('#pf-cost')?.value) || 0,
        };
        if (!data.id) delete data.id;
        await onSave(data);
        closeModal();
      }},
    ]
  });
}
