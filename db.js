/**
 * db.js — Capa de persistencia IndexedDB para VeritosBusiness
 * Usa la API nativa IndexedDB (sin librerías externas)
 */

const DB_NAME = 'VeritosBusiness';
const DB_VERSION = 1;

let _db = null;

const STORES = {
  settings:   { keyPath: 'key' },
  clients:    { keyPath: 'id', autoIncrement: true },
  products:   { keyPath: 'id', autoIncrement: true },
  orders:     { keyPath: 'id', autoIncrement: true },
  promotions: { keyPath: 'id', autoIncrement: true },
};

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, opts] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: opts.keyPath, autoIncrement: !!opts.autoIncrement });
          if (name === 'clients') {
            store.createIndex('phone', 'phone', { unique: false });
            store.createIndex('name', 'name', { unique: false });
          }
          if (name === 'orders') {
            store.createIndex('clientId', 'clientId', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
            store.createIndex('orderNumber', 'orderNumber', { unique: true });
          }
          if (name === 'promotions') {
            store.createIndex('active', 'active', { unique: false });
          }
        }
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return _db.transaction(storeName, mode).objectStore(storeName);
}

function req2promise(r) {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// ─── Genéricos ────────────────────────────────────────────────────────────────

export async function getAll(storeName) {
  await openDB();
  return req2promise(tx(storeName).getAll());
}

export async function getById(storeName, id) {
  await openDB();
  return req2promise(tx(storeName).get(id));
}

export async function put(storeName, record) {
  await openDB();
  return req2promise(tx(storeName, 'readwrite').put(record));
}

export async function remove(storeName, id) {
  await openDB();
  return req2promise(tx(storeName, 'readwrite').delete(id));
}

export async function clear(storeName) {
  await openDB();
  return req2promise(tx(storeName, 'readwrite').clear());
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(key, defaultValue = null) {
  await openDB();
  const r = await req2promise(tx('settings').get(key));
  return r ? r.value : defaultValue;
}

export async function setSetting(key, value) {
  await openDB();
  return req2promise(tx('settings', 'readwrite').put({ key, value }));
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export async function getAllClients() {
  return getAll('clients');
}

export async function getClientById(id) {
  return getById('clients', id);
}

export async function saveClient(client) {
  if (!client.createdAt) client.createdAt = new Date().toISOString();
  client.updatedAt = new Date().toISOString();
  return put('clients', client);
}

export async function deleteClient(id) {
  return remove('clients', id);
}

export async function findClientByPhone(phone) {
  await openDB();
  return new Promise((res, rej) => {
    const all = [];
    const r = tx('clients').openCursor();
    r.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value.phone === phone) all.push(cursor.value);
        cursor.continue();
      } else { res(all); }
    };
    r.onerror = () => rej(r.error);
  });
}

// ─── Productos ────────────────────────────────────────────────────────────────

export async function getAllProducts() {
  return getAll('products');
}

export async function getProductById(id) {
  return getById('products', id);
}

export async function saveProduct(product) {
  if (!product.createdAt) product.createdAt = new Date().toISOString();
  product.updatedAt = new Date().toISOString();
  return put('products', product);
}

export async function deleteProduct(id) {
  return remove('products', id);
}

// ─── Pedidos ──────────────────────────────────────────────────────────────────

export async function getAllOrders() {
  return getAll('orders');
}

export async function getOrderById(id) {
  return getById('orders', id);
}

export async function getOrdersByClient(clientId) {
  await openDB();
  return new Promise((res, rej) => {
    const all = [];
    const r = tx('orders').index('clientId').openCursor(IDBKeyRange.only(clientId));
    r.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { all.push(cursor.value); cursor.continue(); }
      else res(all);
    };
    r.onerror = () => rej(r.error);
  });
}

export async function getNextOrderNumber() {
  const orders = await getAllOrders();
  if (orders.length === 0) return 'PED-000001';
  const nums = orders.map(o => parseInt(o.orderNumber?.replace('PED-', '') || '0'));
  const max = Math.max(...nums);
  return `PED-${String(max + 1).padStart(6, '0')}`;
}

export async function saveOrder(order) {
  if (!order.createdAt) order.createdAt = new Date().toISOString();
  order.updatedAt = new Date().toISOString();
  return put('orders', order);
}

export async function deleteOrder(id) {
  return remove('orders', id);
}

// ─── Promociones ──────────────────────────────────────────────────────────────

export async function getAllPromotions() {
  return getAll('promotions');
}

export async function getPromotionById(id) {
  return getById('promotions', id);
}

export async function savePromotion(promo) {
  if (!promo.createdAt) promo.createdAt = new Date().toISOString();
  promo.updatedAt = new Date().toISOString();
  return put('promotions', promo);
}

export async function deletePromotion(id) {
  return remove('promotions', id);
}

// ─── Backup ───────────────────────────────────────────────────────────────────

export async function exportBackup() {
  await openDB();
  const [clients, products, orders, promotions] = await Promise.all([
    getAllClients(), getAllProducts(), getAllOrders(), getAllPromotions()
  ]);
  const settings = {};
  await new Promise((res, rej) => {
    const r = tx('settings').openCursor();
    r.onsuccess = (e) => {
      const c = e.target.result;
      if (c) { settings[c.value.key] = c.value.value; c.continue(); }
      else res();
    };
    r.onerror = () => rej(r.error);
  });
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings, clients, products, orders, promotions
  };
}

export async function importBackup(data) {
  if (!data || data.version !== 1) throw new Error('Formato de copia de seguridad no válido');
  await openDB();
  // Importar en orden: settings → products → clients → promotions → orders
  const stores = ['settings', 'clients', 'products', 'orders', 'promotions'];
  for (const s of stores) await clear(s);

  if (data.settings) {
    for (const [key, value] of Object.entries(data.settings)) {
      await setSetting(key, value);
    }
  }
  for (const rec of (data.clients || []))    await put('clients', rec);
  for (const rec of (data.products || []))   await put('products', rec);
  for (const rec of (data.orders || []))     await put('orders', rec);
  for (const rec of (data.promotions || [])) await put('promotions', rec);
}
