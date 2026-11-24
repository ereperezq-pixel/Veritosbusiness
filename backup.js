/**
 * backup.js — Exportar e importar copias de seguridad en formato JSON
 */

import { exportBackup, importBackup } from '../db.js';

/**
 * Descarga una copia de seguridad completa al dispositivo.
 */
export async function downloadBackup() {
  const data = await exportBackup();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `veritosbusiness-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return data;
}

/**
 * Importa una copia de seguridad desde un File seleccionado.
 * Muestra un aviso antes de sobrescribir.
 * @param {File} file
 */
export async function restoreBackup(file) {
  if (!file) throw new Error('No se ha seleccionado ningún archivo');
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido');
  }
  validateBackup(data);
  return data; // Devuelve para que la UI confirme antes de importar
}

export async function applyRestore(data) {
  validateBackup(data);
  await importBackup(data);
}

function validateBackup(data) {
  if (!data || typeof data !== 'object') throw new Error('Formato inválido');
  if (data.version !== 1) throw new Error(`Versión de backup no compatible: ${data.version}`);
  if (!data.exportedAt)   throw new Error('El backup no tiene fecha de exportación');
  const required = ['clients', 'products', 'orders', 'promotions'];
  for (const k of required) {
    if (!Array.isArray(data[k])) throw new Error(`El backup no contiene el campo "${k}"`);
  }
}

/**
 * Exporta el catálogo público (sin datos privados) en formato catalog.json
 * Este archivo es el que se publica en el repositorio de Mi catálogo Herbalife.
 */
export async function exportPublicCatalog(products, promotions, settings) {
  const activePromos = promotions.filter(p => {
    if (!p.enabled) return false;
    const now = new Date();
    if (p.startDate && new Date(p.startDate) > now) return false;
    if (p.endDate   && new Date(p.endDate)   < now) return false;
    return true;
  });

  const catalog = {
    version:     1,
    exportedAt:  new Date().toISOString(),
    store: {
      name:        settings.storeName   || '',
      description: settings.storeDesc  || '',
      whatsapp:    settings.whatsapp    || '',
      schedule:    settings.schedule   || '',
      location:    settings.location   || '',
      logo:        settings.logo        || '',
    },
    categories: [
      'Nutrición y batidos',
      'Bebidas y aloe',
      'Barritas y snacks',
      'Cuidado personal',
      'Nutrición deportiva',
    ],
    products: products
      .filter(p => !p.deleted)
      .map(p => ({
        id:          p.id,
        name:        p.name,
        description: p.description || '',
        category:    p.category,
        image:       p.image || null,
        available:   p.available !== false,
        variants: (p.variants || []).map(v => ({
          id:        v.id,
          name:      v.name,
          flavor:    v.flavor || '',
          format:    v.format || '',
          price:     v.price,
          available: v.available !== false,
          // ⚠️ NUNCA incluir costPrice
        })),
      })),
    promotions: activePromos.map(p => ({
      id:          p.id,
      name:        p.name,
      type:        p.type,
      value:       p.type !== 'bundle' ? p.value : undefined,
      bundleQty:   p.type === 'bundle' ? p.bundleQty   : undefined,
      bundlePrice: p.type === 'bundle' ? p.bundlePrice : undefined,
      productIds:  p.productIds  || [],
      variantIds:  p.variantIds  || [],
      description: p.description || '',
    })),
  };

  const json = JSON.stringify(catalog, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'catalog.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return catalog;
}
