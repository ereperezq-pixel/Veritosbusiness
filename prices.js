/**
 * prices.js — Lógica de precios y aplicación de promociones
 */

/**
 * Devuelve las promociones activas en este momento
 */
export function getActivePromotions(allPromotions) {
  const now = new Date();
  return allPromotions.filter(p => {
    if (!p.enabled) return false;
    if (p.startDate && new Date(p.startDate) > now) return false;
    if (p.endDate   && new Date(p.endDate)   < now) return false;
    return true;
  });
}

/**
 * Calcula el precio final de una variante dado un contexto de promociones.
 * No acumula descuentos por defecto; aplica el más favorable.
 *
 * @param {object} variant  — { price, productId, variantId? }
 * @param {number} qty      — cantidad pedida
 * @param {array}  activePromos — promociones ya filtradas como activas
 * @returns { unitPrice, totalPrice, discountAmount, promoApplied }
 */
export function calcLinePrice(variant, qty, activePromos) {
  const basePrice = Number(variant.price) || 0;

  let bestDiscount = 0;
  let bestPromo = null;

  for (const p of activePromos) {
    // Comprobar si esta promo aplica a este producto/variante
    if (!promoAppliesToVariant(p, variant)) continue;

    let discount = 0;

    if (p.type === 'percent') {
      // Descuento porcentual sobre el precio unitario
      discount = basePrice * qty * (Number(p.value) / 100);
    } else if (p.type === 'fixed') {
      // Descuento fijo por unidad
      discount = Number(p.value) * qty;
    } else if (p.type === 'bundle') {
      // Oferta por cantidad: X unidades a precio especial
      // p.bundleQty = unidades del pack, p.bundlePrice = precio del pack
      const packs = Math.floor(qty / Number(p.bundleQty));
      const rest  = qty % Number(p.bundleQty);
      const normalTotal = basePrice * qty;
      const promoTotal  = packs * Number(p.bundlePrice) + rest * basePrice;
      discount = normalTotal - promoTotal;
    }

    if (discount > bestDiscount) {
      bestDiscount = discount;
      bestPromo = p;
    }
  }

  const totalPrice = Math.max(0, basePrice * qty - bestDiscount);

  return {
    unitPrice:      basePrice,
    totalPrice:     round2(totalPrice),
    discountAmount: round2(bestDiscount),
    promoApplied:   bestPromo ? bestPromo.name : null,
    promoId:        bestPromo ? bestPromo.id   : null,
  };
}

function promoAppliesToVariant(promo, variant) {
  // Si no tiene restricciones de producto, aplica a todos
  if (!promo.productIds || promo.productIds.length === 0) return true;
  if (!promo.productIds.includes(variant.productId)) return false;
  // Si hay restricción de variante concreta
  if (promo.variantIds && promo.variantIds.length > 0) {
    return promo.variantIds.includes(variant.variantId || variant.id);
  }
  return true;
}

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el total de un pedido a partir de sus líneas (ya calculadas)
 */
export function calcOrderTotal(lines) {
  let subtotal = 0, discount = 0;
  for (const l of lines) {
    subtotal += (l.unitPrice || 0) * (l.qty || 0);
    discount += l.discountAmount || 0;
  }
  return {
    subtotal:  round2(subtotal),
    discount:  round2(discount),
    total:     round2(subtotal - discount),
  };
}

/**
 * Calcula el beneficio bruto de una línea
 */
export function calcLineMargin(line) {
  const cost = (Number(line.costPrice) || 0) * (line.qty || 0);
  return round2((line.totalPrice || 0) - cost);
}
