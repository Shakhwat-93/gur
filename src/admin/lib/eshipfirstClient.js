import { getAdminAuthHeaders } from '../authService';

export const DELIVERY_STATUS_META = {
  pending: { label: 'Pending', bg: '#fef3c7', color: '#92400e', border: '#fde68a', isFinal: false },
  in_review: { label: 'In Review', bg: '#e0f2fe', color: '#075985', border: '#bae6fd', isFinal: false },
  hold: { label: 'On Hold', bg: '#ffedd5', color: '#9a3412', border: '#fed7aa', isFinal: false },
  delivered_approval_pending: { label: 'Delivered (Approval Pending)', bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe', isFinal: false },
  partial_delivered_approval_pending: { label: 'Partial Del. (Approval Pending)', bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe', isFinal: false },
  cancelled_approval_pending: { label: 'Cancelled (Approval Pending)', bg: '#ffedd5', color: '#9a3412', border: '#fed7aa', isFinal: false },
  unknown_approval_pending: { label: 'Unknown (Approval Pending)', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', isFinal: false },
  delivered: { label: 'Delivered', bg: '#dcfce7', color: '#166534', border: '#bbf7d0', isFinal: true },
  partial_delivered: { label: 'Partial Delivered', bg: '#d1fae5', color: '#065f46', border: '#a7f3d0', isFinal: true },
  cancelled: { label: 'Cancelled', bg: '#fee2e2', color: '#991b1b', border: '#fecaca', isFinal: true },
  exceptional: { label: 'Exceptional', bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8', isFinal: false }
};

export const RETURN_STATUS_META = {
  partial_delivered_return_proccessing: { label: 'Partial Return Processing', bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  partial_delivered_return_rider_assigned: { label: 'Partial Return Rider Assigned', bg: '#e0f2fe', color: '#075985', border: '#bae6fd' },
  partial_delivered_return_received: { label: 'Partial Return Received', bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  cancelled_return_proccessing: { label: 'Cancelled Return Processing', bg: '#ffedd5', color: '#9a3412', border: '#fed7aa' },
  cancelled_return_rider_assigned: { label: 'Cancelled Return Rider Assigned', bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' },
  cancelled_return_received: { label: 'Cancelled Return Received', bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
};

export function getDeliveryStatusInfo(rawStatus) {
  const key = String(rawStatus || 'pending').toLowerCase().trim();
  return (
    DELIVERY_STATUS_META[key] || {
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      bg: '#f1f5f9',
      color: '#334155',
      border: '#cbd5e1',
      isFinal: false
    }
  );
}

export function getReturnStatusInfo(rawStatus) {
  if (!rawStatus) return null;
  const key = String(rawStatus).toLowerCase().trim();
  return (
    RETURN_STATUS_META[key] || {
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      bg: '#f3e8ff',
      color: '#6b21a8',
      border: '#e9d5ff'
    }
  );
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: getAdminAuthHeaders(options.headers || {})
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function fetchEShipFirstConfig() {
  return apiFetch(`/api/eshipfirst-config?_t=${Date.now()}`);
}

export async function saveEShipFirstConfig(payload) {
  return apiFetch('/api/eshipfirst-config', {
    method: 'POST',
    body: JSON.stringify({ action: 'save', ...payload })
  });
}

export async function testEShipFirstConnection(payload = {}) {
  return apiFetch('/api/eshipfirst-config', {
    method: 'POST',
    body: JSON.stringify({ action: 'test', ...payload })
  });
}

export async function disconnectEShipFirst() {
  return apiFetch('/api/eshipfirst-config', {
    method: 'POST',
    body: JSON.stringify({ action: 'disconnect' })
  });
}

export async function fetchEShipFirstParcels() {
  return apiFetch(`/api/eshipfirst?action=parcels&_t=${Date.now()}`);
}

export async function createEShipFirstParcel(orderId, orderSnapshot = null, forceRetry = false) {
  return apiFetch('/api/eshipfirst', {
    method: 'POST',
    body: JSON.stringify({
      action: 'create_order',
      order_id: String(orderId),
      order: orderSnapshot,
      force_retry: forceRetry
    })
  });
}

export async function refreshEShipFirstParcelStatus({ orderId, consignmentId, trackingCode, invoice }) {
  return apiFetch('/api/eshipfirst', {
    method: 'POST',
    body: JSON.stringify({
      action: 'refresh_status',
      order_id: orderId,
      consignment_id: consignmentId,
      tracking_code: trackingCode,
      invoice
    })
  });
}

export async function bulkRefreshEShipFirstParcels(parcels) {
  return apiFetch('/api/eshipfirst', {
    method: 'POST',
    body: JSON.stringify({ action: 'bulk_refresh', parcels })
  });
}

export async function fetchEShipFirstTracking({ invoice, consignmentId, trackingCode }) {
  const params = new URLSearchParams({ action: 'track' });
  if (invoice) params.set('invoice', invoice);
  if (consignmentId) params.set('consignment_id', consignmentId);
  if (trackingCode) params.set('tracking_code', trackingCode);
  return apiFetch(`/api/eshipfirst?${params.toString()}`);
}

export async function fetchEShipFirstLiveStats() {
  return apiFetch(`/api/eshipfirst?action=stats&_t=${Date.now()}`);
}

export async function fetchEShipFirstParcelStates(state = '') {
  const params = new URLSearchParams({ action: 'parcel_states' });
  if (state) params.set('state', state);
  return apiFetch(`/api/eshipfirst?${params.toString()}`);
}

export async function createEShipFirstPickup(payload) {
  return apiFetch('/api/eshipfirst', {
    method: 'POST',
    body: JSON.stringify({ action: 'create_pickup_request', payload })
  });
}

export async function createEShipFirstReturn(payload) {
  return apiFetch('/api/eshipfirst', {
    method: 'POST',
    body: JSON.stringify({ action: 'create_return_request', payload })
  });
}

export async function fetchEShipFirstReturnRequests(id = '') {
  const params = new URLSearchParams({ action: 'return_requests' });
  if (id) params.set('id', id);
  return apiFetch(`/api/eshipfirst?${params.toString()}`);
}

export async function fetchEShipFirstPayments(paymentId = '') {
  const params = new URLSearchParams({ action: 'payments' });
  if (paymentId) params.set('payment_id', paymentId);
  return apiFetch(`/api/eshipfirst?${params.toString()}`);
}

export async function fetchEShipFirstFraudScore(phone) {
  const params = new URLSearchParams({ action: 'fraud_score', phone: String(phone || '') });
  return apiFetch(`/api/eshipfirst?${params.toString()}`);
}

export async function fetchEShipFirstLogs(limit = 60) {
  return apiFetch(`/api/eshipfirst?action=logs&limit=${limit}&_t=${Date.now()}`);
}
