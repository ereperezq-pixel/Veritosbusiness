/**
 * settings.js — Configuración de la tienda y cuenta
 */

import { getSetting, setSetting, getAllProducts, getAllPromotions } from '../db.js';
import { toast, showModal, closeModal, confirm, esc } from '../ui.js';
import { downloadBackup, restoreBackup, applyRestore, exportPublicCatalog } from '../utils/backup.js';
import { changePassword } from '../auth.js';

export async function renderSettings(container) {
  const settings = {
    storeName:   await getSetting('storeName',   'VeritosBusiness'),
    storeDesc:   await getSetting('storeDesc',   ''),
    whatsapp:    await getSetting('whatsapp',    ''),
    schedule:    await getSetting('schedule',    ''),
    location:    await getSetting('location',    ''),
    logo:        await getSetting('logo',        ''),
    vipMinSpend: await getSetting('vipMinSpend', 300),
    vipMinOrders:await getSetting('vipMinOrders',10),
  };

  container.innerHTML = `
    <div class="view-settings">
      <div class="view-header">
        <h2 class="view-header__title">Configuración</h2>
      </div>

      <!-- Datos de la tienda -->
      <section class="settings-section">
        <h3 class="settings-section__title">Datos de la tienda</h3>
        <form id="settings-form">
          <div class="field">
            <label class="field__label">Nombre de la tienda *</label>
            <input class="field__input" id="s-name" type="text" value="${esc(settings.storeName)}" required>
          </div>
          <div class="field">
            <label class="field__label">Presentación breve</label>
            <textarea class="field__input" id="s-desc" rows="2">${esc(settings.storeDesc)}</textarea>
          </div>
          <div class="field">
            <label class="field__label">Número de WhatsApp (con prefijo, sin +)</label>
            <input class="field__input" id="s-wa" type="tel" value="${esc(settings.whatsapp)}" placeholder="34600123456">
          </div>
          <div class="field">
            <label class="field__label">Horario de atención</label>
            <input class="field__input" id="s-schedule" type="text" value="${esc(settings.schedule)}" placeholder="Lun-Vie 10:00-20:00">
          </div>
          <div class="field">
            <label class="field__label">Lugar de recogida</label>
            <input class="field__input" id="s-location" type="text" value="${esc(settings.location)}" placeholder="Dirección o punto de recogida">
          </div>
          <div class="field">
            <label class="field__label">Logotipo (URL o carga desde dispositivo)</label>
            <div class="img-preview-wrap">
              <img id="logo-preview" src="${settings.logo||'./assets/placeholder.png'}" alt="Logo" class="img-preview"
                onerror="this.src='./assets/placeholder.png'">
            </div>
            <input class="field__input" id="s-logo" type="url" value="${esc(settings.logo)}" placeholder="https://…">
            <label class="btn btn--secondary" style="cursor:pointer;margin-top:0.5rem">
              📷 Cargar logo
              <input type="file" id="logo-file" accept="image/*" style="display:none">
            </label>
          </div>
          <button type="submit" class="btn btn--primary btn--full">💾 Guardar cambios</button>
        </form>
      </section>

      <!-- Criterios VIP -->
      <section class="settings-section">
        <h3 class="settings-section__title">Criterios para clientes VIP</h3>
        <p class="text-muted">Un cliente VIP cumple al menos uno de estos criterios:</p>
        <div class="field-row">
          <div class="field">
            <label class="field__label">Gasto mínimo (€)</label>
            <input class="field__input" id="s-vip-spend" type="number" min="0" step="1" value="${settings.vipMinSpend}">
          </div>
          <div class="field">
            <label class="field__label">Pedidos mínimos</label>
            <input class="field__input" id="s-vip-orders" type="number" min="1" step="1" value="${settings.vipMinOrders}">
          </div>
        </div>
        <button class="btn btn--primary btn--sm" id="save-vip">Guardar criterios VIP</button>
      </section>

      <!-- Seguridad -->
      <section class="settings-section">
        <h3 class="settings-section__title">Seguridad</h3>
        <div class="settings-notice">
          <strong>⚠️ Nota de seguridad:</strong> La contraseña de VeritosBusiness se guarda en este dispositivo
          y protege contra acceso casual. No es equivalente a una autenticación de servidor.
          La seguridad real de tus datos depende del bloqueo de pantalla de tu teléfono.
        </div>
        <button class="btn btn--secondary" id="btn-change-pass">🔑 Cambiar contraseña</button>
      </section>

      <!-- Copias de seguridad -->
      <section class="settings-section">
        <h3 class="settings-section__title">Copias de seguridad</h3>
        <div class="settings-notice settings-notice--warning">
          <strong>Riesgo de pérdida de datos:</strong> Todos tus datos (clientes, pedidos, productos)
          están almacenados solo en este dispositivo. Si pierdes el teléfono o borras los datos del navegador
          sin haber exportado una copia, <strong>no hay forma de recuperarlos</strong>.
          Exporta una copia con regularidad y guárdala en un lugar seguro.
        </div>
        <div class="settings-actions">
          <button class="btn btn--primary" id="btn-export">📥 Exportar copia de seguridad</button>
          <label class="btn btn--secondary" style="cursor:pointer">
            📤 Importar copia de seguridad
            <input type="file" id="import-file" accept=".json" style="display:none">
          </label>
        </div>
      </section>

      <!-- Catálogo público -->
      <section class="settings-section">
        <h3 class="settings-section__title">Catálogo público</h3>
        <p class="text-muted">Genera el archivo <code>catalog.json</code> para actualizar el catálogo público de «Mi catálogo Herbalife».</p>
        <div class="settings-notice">
          Este archivo <strong>no contiene costes, beneficios ni datos privados</strong>.
          Solo incluye nombres, precios de venta, disponibilidad y promociones activas.
        </div>
        <button class="btn btn--primary" id="btn-export-catalog">🌿 Exportar catalog.json</button>
      </section>
    </div>`;

  // ─── Formulario de tienda ───────────────────────────────────────────────────
  container.querySelector('#s-logo').addEventListener('input', e => {
    container.querySelector('#logo-preview').src = e.target.value || './assets/placeholder.png';
  });
  container.querySelector('#logo-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    new Promise(res => {
      const r = new FileReader();
      r.onload = ev => res(ev.target.result);
      r.readAsDataURL(file);
    }).then(data => {
      container.querySelector('#logo-preview').src = data;
      container.querySelector('#s-logo').value = data;
    });
  });

  container.querySelector('#settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await Promise.all([
      setSetting('storeName',  container.querySelector('#s-name').value.trim()),
      setSetting('storeDesc',  container.querySelector('#s-desc').value.trim()),
      setSetting('whatsapp',   container.querySelector('#s-wa').value.trim()),
      setSetting('schedule',   container.querySelector('#s-schedule').value.trim()),
      setSetting('location',   container.querySelector('#s-location').value.trim()),
      setSetting('logo',       container.querySelector('#s-logo').value.trim()),
    ]);
    toast('Configuración guardada', 'success');
  });

  // ─── VIP ────────────────────────────────────────────────────────────────────
  container.querySelector('#save-vip').addEventListener('click', async () => {
    await Promise.all([
      setSetting('vipMinSpend',  Number(container.querySelector('#s-vip-spend').value)  || 300),
      setSetting('vipMinOrders', Number(container.querySelector('#s-vip-orders').value) || 10),
    ]);
    toast('Criterios VIP guardados', 'success');
  });

  // ─── Contraseña ──────────────────────────────────────────────────────────────
  container.querySelector('#btn-change-pass').addEventListener('click', () => {
    const form = document.createElement('form');
    form.innerHTML = `
      <div class="field"><label class="field__label">Contraseña actual</label>
        <input class="field__input" name="current" type="password" required></div>
      <div class="field"><label class="field__label">Nueva contraseña (mín. 4 caracteres)</label>
        <input class="field__input" name="new" type="password" required minlength="4"></div>
      <div class="field"><label class="field__label">Repetir nueva contraseña</label>
        <input class="field__input" name="repeat" type="password" required minlength="4"></div>
      <div id="pass-err" class="alert alert--danger hidden"></div>`;

    showModal({
      title: 'Cambiar contraseña',
      content: form,
      actions: [
        { label: 'Cancelar', class: 'btn btn--secondary' },
        { label: 'Cambiar', class: 'btn btn--primary', close: false, callback: async () => {
          const cur = form.current.value, nw = form.new.value, rep = form.repeat.value;
          const errEl = form.querySelector('#pass-err');
          errEl.classList.add('hidden');
          if (nw !== rep) { errEl.textContent = 'Las contraseñas no coinciden'; errEl.classList.remove('hidden'); return; }
          try {
            await changePassword(cur, nw);
            toast('Contraseña cambiada', 'success');
            closeModal();
          } catch (err) {
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
          }
        }},
      ]
    });
  });

  // ─── Backup export ───────────────────────────────────────────────────────────
  container.querySelector('#btn-export').addEventListener('click', async () => {
    try {
      await downloadBackup();
      toast('Copia de seguridad descargada', 'success');
    } catch (err) {
      toast('Error al exportar: ' + err.message, 'error');
    }
  });

  // ─── Backup import ───────────────────────────────────────────────────────────
  container.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await restoreBackup(file);
      const date = new Date(data.exportedAt).toLocaleString('es-ES');
      const ok = await confirm(
        `Se va a restaurar una copia del ${date} con ${data.clients.length} clientes, ${data.orders.length} pedidos y ${data.products.length} productos.\n\nSe sobrescribirán todos los datos actuales. ¿Continuar?`,
        { confirmLabel: 'Restaurar', danger: true }
      );
      if (ok) {
        await applyRestore(data);
        toast('Copia de seguridad restaurada. Recarga la página.', 'success');
        setTimeout(() => location.reload(), 2000);
      }
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    }
    e.target.value = '';
  });

  // ─── Catálogo público ─────────────────────────────────────────────────────
  container.querySelector('#btn-export-catalog').addEventListener('click', async () => {
    try {
      const products   = await getAllProducts();
      const promotions = await getAllPromotions();
      const storeSettings = {
        storeName: await getSetting('storeName',''),
        storeDesc: await getSetting('storeDesc',''),
        whatsapp:  await getSetting('whatsapp',''),
        schedule:  await getSetting('schedule',''),
        location:  await getSetting('location',''),
        logo:      await getSetting('logo',''),
      };
      await exportPublicCatalog(products, promotions, storeSettings);
      toast('catalog.json descargado. Súbelo a tu repositorio de Mi catálogo Herbalife.', 'success');
    } catch (err) {
      toast('Error al exportar catálogo: ' + err.message, 'error');
    }
  });
}
