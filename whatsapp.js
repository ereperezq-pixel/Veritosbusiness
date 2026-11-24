/**
 * whatsapp.js — Generación de mensajes y apertura de WhatsApp
 * El envío siempre es manual por parte de la vendedora o el cliente.
 */

/**
 * Abre WhatsApp con un mensaje predefinido.
 * @param {string} phone   — número internacional sin + ni espacios, ej: 34600123456
 * @param {string} message — texto del mensaje
 */
export function openWhatsApp(phone, message) {
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${phone}?text=${encoded}`;
  window.open(url, '_blank');
}

/**
 * Genera el mensaje de cambio de estado de un pedido.
 */
export function orderStatusMessage(order, clientName, storeName, status) {
  const msgs = {
    'confirmed':  `Hola ${clientName} 👋 Tu pedido *${order.orderNumber}* ha sido confirmado. ¡Gracias por tu compra en ${storeName}!`,
    'preparing':  `Hola ${clientName} 👋 Tu pedido *${order.orderNumber}* está siendo preparado. Te avisamos cuando esté listo.`,
    'ready':      `Hola ${clientName} ✅ Tu pedido *${order.orderNumber}* ya está listo para recoger. ¡Te esperamos!`,
    'delivered':  `Hola ${clientName} 🎉 ¡Tu pedido *${order.orderNumber}* ha sido entregado! Esperamos que lo disfrutes. Gracias por confiar en ${storeName} 💚`,
    'cancelled':  `Hola ${clientName} ℹ️ Tu pedido *${order.orderNumber}* ha sido cancelado. Si tienes alguna duda, escríbenos por aquí.`,
  };
  return msgs[status] || `Hola ${clientName}, hay una actualización en tu pedido ${order.orderNumber}.`;
}

/**
 * Genera el mensaje completo de un pedido recibido desde el catálogo público.
 * Lo usa la vendedora para confirmar al cliente si quiere.
 */
export function orderSummaryMessage(order, clientName, storeName) {
  let lines = [`🛒 *Resumen del pedido ${order.orderNumber}*`, `📅 ${formatDate(order.createdAt)}`, ``];
  lines.push(`👤 Cliente: ${clientName}`);
  lines.push(``);
  lines.push(`📦 *Productos:*`);
  for (const l of (order.lines || [])) {
    let line = `• ${l.productName}`;
    if (l.variantName) line += ` (${l.variantName})`;
    line += ` x${l.qty} — ${formatPrice(l.totalPrice)}`;
    if (l.discountAmount > 0) line += ` _(descuento: -${formatPrice(l.discountAmount)})_`;
    lines.push(line);
  }
  lines.push(``);
  if (order.discount > 0) lines.push(`💸 Descuento total: -${formatPrice(order.discount)}`);
  lines.push(`💰 *Total: ${formatPrice(order.total)}*`);
  lines.push(``);
  lines.push(`Pago en efectivo al recoger. ¡Gracias! 💚`);
  return lines.join('\n');
}

function formatPrice(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
