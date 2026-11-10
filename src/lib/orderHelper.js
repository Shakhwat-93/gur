/**
 * Order Quantity & Courier Formatting Utilities
 * Standardizes calculation of package items, quantities, and courier clipboards.
 */

export function getEffectiveOrderQty(ord) {
  if (!ord) return 1;
  const rawQty = Number(ord.quantity);
  return rawQty > 0 ? rawQty : 1;
}

export function formatOrderCourierText(ord) {
  if (!ord) return '';

  const name = String(ord.name || '').trim();
  const address = String(ord.address || '').trim();
  const phone = String(ord.phone || '').trim();
  const qty = getEffectiveOrderQty(ord);
  const unit = ord.unit || 'প্যাক';
  const price = Math.round(Number(ord.total_price || ord.total || 0));
  const product = ord.product_name || ord.package_name || 'খাঁটি খেজুরের গুড়';
  const productLine = product.includes('(') ? product : `${product} (${qty} ${unit})`;

  return `${name}\n${address}\n${phone}\n${productLine} = ${price} taka`;
}

export default {
  getEffectiveOrderQty,
  formatOrderCourierText
};
