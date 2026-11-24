/**
 * auth.js — Autenticación local para VeritosBusiness
 *
 * ADVERTENCIA DE SEGURIDAD: Esta autenticación es local y basada en el
 * dispositivo. No protege frente a ataques técnicos si alguien accede
 * a los datos del navegador. La seguridad real depende del bloqueo del
 * teléfono Android. No uses esta contraseña para cuentas externas.
 */

import { getSetting, setSetting } from './db.js';

const SESSION_KEY = 'vb_session';
const HASH_ALGO   = 'SHA-256';

async function sha256(str) {
  const buf = await crypto.subtle.digest(HASH_ALGO, new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function isFirstRun() {
  const hash = await getSetting('auth_hash');
  return !hash;
}

export async function setupCredentials(username, password) {
  if (!username || !password || password.length < 4) {
    throw new Error('El usuario y la contraseña (mínimo 4 caracteres) son obligatorios');
  }
  const hash = await sha256(username.toLowerCase().trim() + ':' + password);
  await setSetting('auth_hash', hash);
  await setSetting('auth_user', username.trim());
  _startSession(username.trim());
}

export async function login(username, password) {
  const storedHash = await getSetting('auth_hash');
  if (!storedHash) throw new Error('No hay credenciales configuradas');
  const hash = await sha256(username.toLowerCase().trim() + ':' + password);
  if (hash !== storedHash) throw new Error('Usuario o contraseña incorrectos');
  _startSession(username.trim());
  return true;
}

export async function changePassword(currentPassword, newPassword) {
  const user = await getSetting('auth_user');
  const storedHash = await getSetting('auth_hash');
  const currentHash = await sha256(user.toLowerCase() + ':' + currentPassword);
  if (currentHash !== storedHash) throw new Error('Contraseña actual incorrecta');
  if (!newPassword || newPassword.length < 4) throw new Error('La nueva contraseña debe tener al menos 4 caracteres');
  const newHash = await sha256(user.toLowerCase() + ':' + newPassword);
  await setSetting('auth_hash', newHash);
}

function _startSession(username) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username, at: Date.now() }));
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username, at: Date.now() }));
  } catch {}
}

export function isLoggedIn() {
  try {
    const s = localStorage.getItem(SESSION_KEY);
    if (!s) return false;
    const { at } = JSON.parse(s);
    // Sesión válida durante 90 días de inactividad
    return (Date.now() - at) < 90 * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

export function getSessionUser() {
  try {
    const s = localStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s).username : null;
  } catch { return null; }
}

export function logout() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}
