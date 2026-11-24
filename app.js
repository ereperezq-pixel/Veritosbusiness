/**
 * app.js — Router principal y arranque de VeritosBusiness
 */

import { isFirstRun, isLoggedIn, login, setupCredentials, logout } from './auth.js';
import { openDB } from './db.js';
import { toast, showSpinner, hideSpinner } from './ui.js';

import { renderDashboard }   from './views/dashboard.js';
import { renderOrders }      from './views/orders.js';
import { renderClients }     from './views/clients.js';
import { renderProducts }    from './views/products.js';
import { renderPromotions }  from './views/promotions.js';
import { renderStats }       from './views/stats.js';
import { renderSettings }    from './views/settings.js';

// ─── Estado global ────────────────────────────────────────────────────────────
export const App = {
  currentView: null,
};

// ─── Rutas ────────────────────────────────────────────────────────────────────

const ROUTES = {
  dashboard:  renderDashboard,
  orders:     renderOrders,
  clients:    renderClients,
  products:   renderProducts,
  promotions: renderPromotions,
  stats:      renderStats,
  settings:   renderSettings,
};

export async function navigate(view, params = {}) {
  const renderer = ROUTES[view];
  if (!renderer) return;
  App.currentView = view;
  updateNav(view);
  const main = document.getElementById('vb-main');
  main.innerHTML = '<div class="loading-view"><div class="spinner__ring"></div></div>';
  try {
    await renderer(main, params);
  } catch (err) {
    console.error('Error en vista', view, err);
    main.innerHTML = `<div class="error-view"><p>Error al cargar esta sección.</p><pre>${err.message}</pre></div>`;
  }
}

function updateNav(active) {
  document.querySelectorAll('.nav__item').forEach(el => {
    el.classList.toggle('nav__item--active', el.dataset.view === active);
  });
}

// ─── Pantalla de login ────────────────────────────────────────────────────────

function renderLoginScreen(isSetup = false) {
  const root = document.getElementById('vb-root');
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-logo">
          <div class="login-logo__icon">V</div>
          <div>
            <h1 class="login-logo__title">VeritosBusiness</h1>
            <p class="login-logo__sub">Gestión de distribuidora Herbalife</p>
          </div>
        </div>
        ${isSetup ? `
          <div class="login-notice">
            <strong>Primera vez</strong> — Crea tus credenciales de acceso.
          </div>` : ''}
        <form id="login-form" class="login-form">
          <div class="field">
            <label class="field__label" for="f-user">Usuario</label>
            <input class="field__input" id="f-user" type="text" autocomplete="username"
              placeholder="Tu nombre de usuario" required>
          </div>
          <div class="field">
            <label class="field__label" for="f-pass">Contraseña</label>
            <div class="field__password-wrap">
              <input class="field__input" id="f-pass" type="password" autocomplete="${isSetup ? 'new-password' : 'current-password'}"
                placeholder="${isSetup ? 'Mínimo 4 caracteres' : 'Contraseña'}" required minlength="4">
              <button type="button" class="field__eye" id="toggle-pass" aria-label="Mostrar contraseña">👁</button>
            </div>
          </div>
          ${isSetup ? `
            <div class="field">
              <label class="field__label" for="f-pass2">Repetir contraseña</label>
              <input class="field__input" id="f-pass2" type="password" placeholder="Repetir contraseña" required minlength="4">
            </div>` : ''}
          <div id="login-error" class="login-form__error hidden"></div>
          <button type="submit" class="btn btn--primary btn--full">
            ${isSetup ? 'Crear cuenta' : 'Acceder'}
          </button>
        </form>
        <p class="login-security-note">
          ⚠️ La contraseña se guarda en este dispositivo. La seguridad real depende del bloqueo de pantalla de tu teléfono.
        </p>
      </div>
    </div>`;

  document.getElementById('toggle-pass').addEventListener('click', () => {
    const p = document.getElementById('f-pass');
    p.type = p.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user  = document.getElementById('f-user').value.trim();
    const pass  = document.getElementById('f-pass').value;
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    try {
      if (isSetup) {
        const pass2 = document.getElementById('f-pass2').value;
        if (pass !== pass2) throw new Error('Las contraseñas no coinciden');
        await setupCredentials(user, pass);
      } else {
        await login(user, pass);
      }
      await bootApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });
}

// ─── Arranque principal ───────────────────────────────────────────────────────

async function bootApp() {
  const root = document.getElementById('vb-root');

  // Renderizar shell de la app
  root.innerHTML = `
    <div class="app-layout">
      <header class="app-header">
        <button class="app-header__menu-btn" id="menu-btn" aria-label="Menú">☰</button>
        <h1 class="app-header__title">VeritosBusiness</h1>
        <div class="app-header__actions">
          <button class="icon-btn" id="btn-logout" aria-label="Cerrar sesión" title="Cerrar sesión">⏻</button>
        </div>
      </header>
      <div class="app-body">
        <nav class="side-nav" id="side-nav">
          <div class="side-nav__inner">
            <ul class="nav__list">
              ${navItem('dashboard',  '🏠', 'Inicio')}
              ${navItem('orders',     '📦', 'Pedidos')}
              ${navItem('clients',    '👤', 'Clientes')}
              ${navItem('products',   '🌿', 'Productos')}
              ${navItem('promotions', '🏷️',  'Promociones')}
              ${navItem('stats',      '📊', 'Estadísticas')}
              ${navItem('settings',   '⚙️',  'Configuración')}
            </ul>
          </div>
        </nav>
        <main id="vb-main" class="app-main"></main>
      </div>
    </div>`;

  // Eventos de navegación
  document.querySelectorAll('.nav__item').forEach(el => {
    el.addEventListener('click', () => {
      navigate(el.dataset.view);
      closeSideNav();
    });
  });

  // Menú hamburguesa
  document.getElementById('menu-btn').addEventListener('click', toggleSideNav);
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (await import('./ui.js').then(m => m.confirm('¿Cerrar sesión?', { confirmLabel: 'Salir', danger: false }))) {
      logout();
      location.reload();
    }
  });

  await navigate('dashboard');
}

function navItem(view, icon, label) {
  return `<li class="nav__item" data-view="${view}" role="button" tabindex="0">
    <span class="nav__icon">${icon}</span>
    <span class="nav__label">${label}</span>
  </li>`;
}

function toggleSideNav() {
  document.getElementById('side-nav')?.classList.toggle('side-nav--open');
}
function closeSideNav() {
  document.getElementById('side-nav')?.classList.remove('side-nav--open');
}

// ─── Inicialización ───────────────────────────────────────────────────────────

async function init() {
  try {
    await openDB();
    if (!isLoggedIn()) {
      const firstRun = await isFirstRun();
      renderLoginScreen(firstRun);
    } else {
      await bootApp();
    }
  } catch (err) {
    console.error('Error al inicializar la app', err);
    document.body.innerHTML = `<div class="fatal-error">
      <h1>Error al iniciar VeritosBusiness</h1>
      <p>${err.message}</p>
      <p>Recarga la página e inténtalo de nuevo.</p>
    </div>`;
  }
}

// Registrar Service Worker — funciona en raíz y en subcarpeta GitHub Pages
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Calcula la base desde window.location para compatibilidad máxima
    const base = window.location.pathname.replace(/\/[^/]*$/, '/');
    navigator.serviceWorker.register(base + 'sw.js', { scope: base })
      .catch(err => console.warn('SW no registrado:', err));
  });
}

document.addEventListener('DOMContentLoaded', init);
