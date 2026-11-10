const PRINTED_ORDERS_STORAGE_KEY = 'mg_thermal_printed_orders';

/**
 * Retrieves the set of order IDs that have already been printed.
 */
export function getPrintedOrderIds() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PRINTED_ORDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map(String));
      }
    }
  } catch (err) {
    console.warn('[ThermalPrintStorage] Failed to read printed orders:', err);
  }
  return new Set();
}

/**
 * Marks one or more orders as printed in local storage.
 */
export function markOrdersAsPrinted(orderIds) {
  if (typeof window === 'undefined' || !orderIds) return;
  try {
    const currentSet = getPrintedOrderIds();
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    ids.forEach((id) => {
      if (id) currentSet.add(String(id).trim());
    });
    // Retain up to 2000 most recent printed IDs
    const arrayToSave = Array.from(currentSet).slice(-2000);
    localStorage.setItem(PRINTED_ORDERS_STORAGE_KEY, JSON.stringify(arrayToSave));
  } catch (err) {
    console.warn('[ThermalPrintStorage] Failed to save printed orders:', err);
  }
}

/**
 * Checks whether an order has been printed before.
 */
export function isOrderPrinted(orderId) {
  if (!orderId) return false;
  return getPrintedOrderIds().has(String(orderId).trim());
}
