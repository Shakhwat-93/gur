import crypto from 'crypto';
import { supabaseAdmin } from './supabaseAdmin.js';
import { encryptApiKey, decryptApiKey, maskApiKey } from './secretManager.js';
import { normalizeBdPhone, isValidBdPhone } from '../../src/lib/phoneNormalizer.js';

export const DEFAULT_BASE_URL = 'https://portal.packzy.com/api/v1';
const REQUEST_TIMEOUT_MS = 15000;
const STATUS_CACHE_WINDOW_MS = 60 * 1000; // 60-second API cache limit

const CONFIG_SETTING_ID = 'eshipfirst_config';
const PARCELS_STORE_ID = 'eshipfirst_parcels_store';
const LOGS_STORE_ID = 'eshipfirst_logs_store';
const MAX_STORED_LOGS = 120;

// Official eShipFirst / Packzy delivery statuses
export const DELIVERY_STATUS_META = {
  pending: { label: 'Pending', tone: 'warning', isFinal: false },
  in_review: { label: 'In Review', tone: 'info', isFinal: false },
  hold: { label: 'On Hold', tone: 'warning', isFinal: false },
  delivered_approval_pending: { label: 'Delivered (Approval Pending)', tone: 'info', isFinal: false },
  partial_delivered_approval_pending: { label: 'Partial Delivered (Approval Pending)', tone: 'info', isFinal: false },
  cancelled_approval_pending: { label: 'Cancelled (Approval Pending)', tone: 'warning', isFinal: false },
  unknown_approval_pending: { label: 'Unknown (Approval Pending)', tone: 'warning', isFinal: false },
  delivered: { label: 'Delivered', tone: 'success', isFinal: true },
  partial_delivered: { label: 'Partial Delivered', tone: 'success', isFinal: true },
  cancelled: { label: 'Cancelled', tone: 'danger', isFinal: true },
  exceptional: { label: 'Exceptional', tone: 'danger', isFinal: false }
};

// Official eShipFirst / Packzy return statuses (kept separate from delivery status)
export const RETURN_STATUS_META = {
  partial_delivered_return_proccessing: { label: 'Partial Return Processing', tone: 'warning' },
  partial_delivered_return_rider_assigned: { label: 'Partial Return Rider Assigned', tone: 'info' },
  partial_delivered_return_received: { label: 'Partial Return Received', tone: 'success' },
  cancelled_return_proccessing: { label: 'Cancelled Return Processing', tone: 'warning' },
  cancelled_return_rider_assigned: { label: 'Cancelled Return Rider Assigned', tone: 'info' },
  cancelled_return_received: { label: 'Cancelled Return Received', tone: 'success' }
};

export const CONFIRMED_OUTCOME_STATUSES = new Set(['delivered', 'partial_delivered', 'cancelled']);

/**
 * Redacts any sensitive keys/tokens recursively before logging
 */
export function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (
      lower.includes('secret') ||
      lower.includes('api_key') ||
      lower.includes('api-key') ||
      lower.includes('authorization') ||
      lower.includes('password') ||
      lower.includes('token')
    ) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = redactSensitive(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Normalizes and validates API Base URL (HTTPS required)
 */
export function sanitizeBaseUrl(url) {
  const raw = String(url || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  if (!raw) return DEFAULT_BASE_URL;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Base URL must use https://');
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    throw new Error('Invalid API Base URL format');
  }
}

/**
 * Maps HTTP status codes to clear actionable messages
 */
function buildHttpErrorMessage(status, data, fallbackMsg = '') {
  const apiMsg =
    data?.message ||
    (data?.errors && typeof data.errors === 'object'
      ? Object.values(data.errors).flat().join('; ')
      : '') ||
    fallbackMsg;

  switch (status) {
    case 400:
      return `Invalid request (400): ${apiMsg || 'Check request parameters.'}`;
    case 401:
      return `Invalid credentials or unauthorized resource (401): ${apiMsg || 'Verify your API Key and Secret Key.'}`;
    case 403:
      return `Access denied / Account inactive or KYC pending (403): ${apiMsg || 'Check your eShipFirst merchant account status.'}`;
    case 422:
      return `Validation error (422): ${apiMsg || 'One or more parcel fields are invalid.'}`;
    case 429:
      return `Rate limit exceeded (429): ${apiMsg || 'Too many requests. Please wait 60 seconds before retrying.'}`;
    default:
      if (status >= 500) {
        return `Courier server error (${status}): ${apiMsg || 'eShipFirst API is temporarily unavailable.'}`;
      }
      return apiMsg || `Request failed with HTTP status ${status}`;
  }
}

/* ============================================================================
   PERSISTENT STORAGE HELPERS (Dual-Mode: site_settings + dedicated SQL tables)
   ============================================================================ */

async function readSettingDoc(id, fallback) {
  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('data, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.warn(`[eShipFirst] readSettingDoc(${id}) warning:`, error.message);
    return fallback;
  }
  return data?.data ?? fallback;
}

async function writeSettingDoc(id, payload) {
  const { error } = await supabaseAdmin.from('site_settings').upsert({
    id,
    data: payload,
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(`Failed saving ${id}: ${error.message}`);
}

export async function appendLog({
  action,
  endpoint = '',
  order_id = null,
  consignment_id = null,
  http_status = null,
  success = false,
  message = '',
  request_summary = null,
  response_summary = null
}) {
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    action,
    endpoint,
    order_id: order_id ? String(order_id) : null,
    consignment_id: consignment_id ? String(consignment_id) : null,
    http_status,
    success: Boolean(success),
    message: String(message || '').slice(0, 500),
    request_summary: redactSensitive(request_summary),
    response_summary: redactSensitive(response_summary),
    created_at: new Date().toISOString()
  };

  try {
    // Try native SQL table first if migration has been run
    const { error: tblErr } = await supabaseAdmin.from('eshipfirst_logs').insert([
      {
        action: entry.action,
        endpoint: entry.endpoint,
        order_id: entry.order_id,
        consignment_id: entry.consignment_id,
        http_status: entry.http_status,
        success: entry.success,
        message: entry.message,
        request_summary: entry.request_summary,
        response_summary: entry.response_summary
      }
    ]);
    if (!tblErr) {
      // Also keep ring buffer fresh
    }
  } catch {
    // Native table optional
  }

  try {
    const existing = await readSettingDoc(LOGS_STORE_ID, []);
    const next = [entry, ...(Array.isArray(existing) ? existing : [])].slice(0, MAX_STORED_LOGS);
    await writeSettingDoc(LOGS_STORE_ID, next);
  } catch (err) {
    console.warn('[eShipFirst] Failed to persist log entry:', err.message);
  }

  return entry;
}

export async function getLogs(limit = 50) {
  try {
    const { data, error } = await supabaseAdmin
      .from('eshipfirst_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch {
    // Fallback to ring buffer
  }
  const logs = await readSettingDoc(LOGS_STORE_ID, []);
  return Array.isArray(logs) ? logs.slice(0, limit) : [];
}

/* ============================================================================
   CONFIGURATION MANAGEMENT (AES-256-GCM Encrypted Credentials)
   ============================================================================ */

async function getRawConfig() {
  const doc = await readSettingDoc(CONFIG_SETTING_ID, null);
  return doc || {};
}

export async function getDecryptedCredentials() {
  const raw = await getRawConfig();
  const baseUrl = sanitizeBaseUrl(raw.base_url || DEFAULT_BASE_URL);
  const apiKey = raw.api_key_encrypted
    ? decryptApiKey(raw.api_key_encrypted, raw.api_key_iv, raw.api_key_tag)
    : null;
  const secretKey = raw.secret_key_encrypted
    ? decryptApiKey(raw.secret_key_encrypted, raw.secret_key_iv, raw.secret_key_tag)
    : null;
  const webhookToken = raw.webhook_token_encrypted
    ? decryptApiKey(raw.webhook_token_encrypted, raw.webhook_token_iv, raw.webhook_token_tag)
    : null;

  return {
    is_enabled: Boolean(raw.is_enabled),
    auto_submit_on_confirm: Boolean(raw.auto_submit_on_confirm),
    base_url: baseUrl,
    api_key: apiKey,
    secret_key: secretKey,
    webhook_token: webhookToken,
    default_delivery_charge: Number(raw.default_delivery_charge || 0),
    default_pickup_address: raw.default_pickup_address || '',
    connection_status: raw.connection_status || 'unconfigured',
    connection_message: raw.connection_message || '',
    last_checked_at: raw.last_checked_at || null,
    current_balance: raw.current_balance ?? null
  };
}

/**
 * Returns safe frontend-facing config (NEVER returns plaintext keys or secrets!)
 */
export async function getPublicConfig() {
  const raw = await getRawConfig();
  return {
    is_enabled: Boolean(raw.is_enabled),
    auto_submit_on_confirm: Boolean(raw.auto_submit_on_confirm),
    base_url: raw.base_url || DEFAULT_BASE_URL,
    has_api_key: Boolean(raw.api_key_encrypted),
    has_secret_key: Boolean(raw.secret_key_encrypted),
    masked_api_key: raw.api_key_masked || '',
    masked_secret_key: raw.secret_key_masked || '',
    has_webhook_token: Boolean(raw.webhook_token_encrypted),
    masked_webhook_token: raw.webhook_token_masked || '',
    default_delivery_charge: raw.default_delivery_charge ?? '',
    default_pickup_address: raw.default_pickup_address || '',
    connection_status: raw.connection_status || 'unconfigured',
    connection_message: raw.connection_message || 'Not configured yet',
    last_checked_at: raw.last_checked_at || null,
    current_balance: raw.current_balance ?? null,
    updated_at: raw.updated_at || null
  };
}

/* ============================================================================
   CORE HTTP CLIENT FOR eShipFirst / Packzy API v1
   ============================================================================ */

export async function eshipfirstRequest({
  method = 'GET',
  path,
  body = null,
  credentialsOverride = null,
  allowRetry = false,
  timeoutMs = REQUEST_TIMEOUT_MS
}) {
  const creds = credentialsOverride || (await getDecryptedCredentials());
  const baseUrl = sanitizeBaseUrl(creds.base_url || DEFAULT_BASE_URL);
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (creds.api_key) headers['Api-Key'] = String(creds.api_key).trim();
  if (creds.secret_key) headers['Secret-Key'] = String(creds.secret_key).trim();

  const maxAttempts = allowRetry && method === 'GET' ? 3 : 1;
  let lastResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      clearTimeout(timer);

      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw_text: text.slice(0, 400) };
      }

      // 200 OK — still inspect body status for API-level errors
      const bodyStatus = typeof data?.status === 'number' ? data.status : null;
      const isOk =
        res.status === 200 &&
        (bodyStatus === null || bodyStatus === 200 || bodyStatus === 201) &&
        data?.error === undefined;

      if (isOk) {
        return {
          ok: true,
          httpStatus: res.status,
          data,
          message: data?.message || 'Success',
          timedOut: false
        };
      }

      const effectiveStatus = bodyStatus && bodyStatus >= 400 ? bodyStatus : res.status;
      const errMsg = buildHttpErrorMessage(effectiveStatus, data);
      lastResult = {
        ok: false,
        httpStatus: effectiveStatus,
        data,
        message: errMsg,
        timedOut: false
      };

      // NEVER retry 400, 401, 403, 422
      if ([400, 401, 403, 422].includes(effectiveStatus)) {
        return lastResult;
      }

      // Transient 429 or 5xx — backoff only when allowRetry is enabled (GET)
      if (attempt < maxAttempts && (effectiveStatus === 429 || effectiveStatus >= 500)) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }

      return lastResult;
    } catch (fetchErr) {
      clearTimeout(timer);
      const isTimeout = fetchErr.name === 'AbortError';
      lastResult = {
        ok: false,
        httpStatus: isTimeout ? 408 : 0,
        data: null,
        message: isTimeout
          ? `Request timed out after ${Math.round(timeoutMs / 1000)}s`
          : `Network error: ${fetchErr.message}`,
        timedOut: isTimeout
      };

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }
      return lastResult;
    }
  }

  return lastResult;
}

/* ============================================================================
   CONNECTION TESTING, SAVING, AND DISCONNECTING
   ============================================================================ */

/**
 * Validates connectivity via GET /ping AND authenticates via GET /get_balance.
 * NEVER treats /ping alone as proof of valid API credentials.
 */
export async function testConnection({ api_key, secret_key, base_url } = {}) {
  const stored = await getDecryptedCredentials();
  const effectiveBaseUrl = sanitizeBaseUrl(base_url || stored.base_url || DEFAULT_BASE_URL);
  const effectiveApiKey = (api_key && api_key.trim()) || stored.api_key || '';
  const effectiveSecretKey = (secret_key && secret_key.trim()) || stored.secret_key || '';

  // Step 1: Unauthenticated service reachability check via GET /ping
  const pingRes = await eshipfirstRequest({
    method: 'GET',
    path: '/ping',
    credentialsOverride: { base_url: effectiveBaseUrl },
    allowRetry: false,
    timeoutMs: 10000
  });

  if (!pingRes.ok) {
    const msg = `Service unreachable at ${effectiveBaseUrl}/ping — ${pingRes.message}`;
    await appendLog({
      action: 'test_connection_ping',
      endpoint: '/ping',
      http_status: pingRes.httpStatus,
      success: false,
      message: msg
    });
    return {
      connected: false,
      ping_ok: false,
      auth_ok: false,
      status: 'failed',
      message: msg,
      http_status: pingRes.httpStatus
    };
  }

  // Step 2: Require both API Key and Secret Key for authenticated verification
  if (!effectiveApiKey || !effectiveSecretKey) {
    return {
      connected: false,
      ping_ok: true,
      auth_ok: false,
      status: 'failed',
      message: 'API service is reachable (/ping OK), but API Key and Secret Key are both required to authenticate.'
    };
  }

  // Step 3: Authenticated verification via GET /get_balance
  const authRes = await eshipfirstRequest({
    method: 'GET',
    path: '/get_balance',
    credentialsOverride: {
      base_url: effectiveBaseUrl,
      api_key: effectiveApiKey,
      secret_key: effectiveSecretKey
    },
    allowRetry: false,
    timeoutMs: 12000
  });

  const nowIso = new Date().toISOString();

  if (authRes.ok) {
    const balance = authRes.data?.current_balance ?? authRes.data?.balance ?? null;
    const msg =
      balance !== null
        ? `Connected to eShipFirst API! Current balance: ৳${balance}`
        : 'Connected and authenticated with eShipFirst API!';

    // Update live connection state if testing stored config
    if (!api_key && !secret_key) {
      const raw = await getRawConfig();
      await writeSettingDoc(CONFIG_SETTING_ID, {
        ...raw,
        connection_status: 'connected',
        connection_message: msg,
        current_balance: balance,
        last_checked_at: nowIso,
        updated_at: nowIso
      });
    }

    await appendLog({
      action: 'test_connection',
      endpoint: '/get_balance',
      http_status: authRes.httpStatus,
      success: true,
      message: msg,
      response_summary: { current_balance: balance }
    });

    return {
      connected: true,
      ping_ok: true,
      auth_ok: true,
      status: 'connected',
      message: msg,
      current_balance: balance,
      http_status: authRes.httpStatus,
      ping_info: pingRes.data
    };
  }

  const failMsg = authRes.message || 'Authentication failed. Check API Key and Secret Key.';
  if (!api_key && !secret_key) {
    const raw = await getRawConfig();
    await writeSettingDoc(CONFIG_SETTING_ID, {
      ...raw,
      connection_status: 'failed',
      connection_message: failMsg,
      last_checked_at: nowIso,
      updated_at: nowIso
    });
  }

  await appendLog({
    action: 'test_connection',
    endpoint: '/get_balance',
    http_status: authRes.httpStatus,
    success: false,
    message: failMsg
  });

  return {
    connected: false,
    ping_ok: true,
    auth_ok: false,
    status: 'failed',
    message: failMsg,
    http_status: authRes.httpStatus
  };
}

/**
 * Encrypts and saves eShipFirst configuration, dynamically verifying credentials via API!
 */
export async function saveConfig({
  is_enabled,
  auto_submit_on_confirm,
  api_key,
  secret_key,
  base_url,
  default_delivery_charge,
  default_pickup_address,
  webhook_token
}) {
  const existing = await getRawConfig();
  const cleanBaseUrl = sanitizeBaseUrl(base_url || existing.base_url || DEFAULT_BASE_URL);
  const nowIso = new Date().toISOString();

  const updated = {
    ...existing,
    is_enabled: is_enabled !== undefined ? Boolean(is_enabled) : Boolean(existing.is_enabled),
    auto_submit_on_confirm:
      auto_submit_on_confirm !== undefined
        ? Boolean(auto_submit_on_confirm)
        : Boolean(existing.auto_submit_on_confirm),
    base_url: cleanBaseUrl,
    default_delivery_charge:
      default_delivery_charge !== undefined && default_delivery_charge !== ''
        ? Math.max(0, Number(default_delivery_charge) || 0)
        : existing.default_delivery_charge ?? 0,
    default_pickup_address:
      default_pickup_address !== undefined
        ? String(default_pickup_address || '').trim()
        : existing.default_pickup_address || '',
    updated_at: nowIso
  };

  // Encrypt new API Key if supplied
  if (api_key && typeof api_key === 'string' && api_key.trim().length > 0) {
    const enc = encryptApiKey(api_key.trim());
    updated.api_key_encrypted = enc.encrypted;
    updated.api_key_iv = enc.iv;
    updated.api_key_tag = enc.tag;
    updated.api_key_masked = maskApiKey(api_key.trim());
  }

  // Encrypt new Secret Key if supplied
  if (secret_key && typeof secret_key === 'string' && secret_key.trim().length > 0) {
    const enc = encryptApiKey(secret_key.trim());
    updated.secret_key_encrypted = enc.encrypted;
    updated.secret_key_iv = enc.iv;
    updated.secret_key_tag = enc.tag;
    updated.secret_key_masked = maskApiKey(secret_key.trim());
  }

  // Encrypt Webhook Bearer Token if supplied
  if (webhook_token && typeof webhook_token === 'string' && webhook_token.trim().length > 0) {
    const enc = encryptApiKey(webhook_token.trim());
    updated.webhook_token_encrypted = enc.encrypted;
    updated.webhook_token_iv = enc.iv;
    updated.webhook_token_tag = enc.tag;
    updated.webhook_token_masked = maskApiKey(webhook_token.trim());
  }

  // Dynamically validate credentials whenever we have both keys
  let testResult = null;
  const hasBothKeys = Boolean(updated.api_key_encrypted && updated.secret_key_encrypted);
  if (hasBothKeys) {
    const plainApiKey =
      (api_key && api_key.trim()) ||
      decryptApiKey(updated.api_key_encrypted, updated.api_key_iv, updated.api_key_tag);
    const plainSecretKey =
      (secret_key && secret_key.trim()) ||
      decryptApiKey(updated.secret_key_encrypted, updated.secret_key_iv, updated.secret_key_tag);

    testResult = await testConnection({
      api_key: plainApiKey,
      secret_key: plainSecretKey,
      base_url: cleanBaseUrl
    });

    updated.connection_status = testResult.connected ? 'connected' : 'failed';
    updated.connection_message = testResult.message;
    updated.last_checked_at = nowIso;
    if (testResult.current_balance !== undefined) {
      updated.current_balance = testResult.current_balance;
    }
  } else {
    updated.connection_status = 'unconfigured';
    updated.connection_message = 'Enter both API Key and Secret Key to connect.';
  }

  await writeSettingDoc(CONFIG_SETTING_ID, updated);

  return {
    config: await getPublicConfig(),
    connection_test: testResult
  };
}

/**
 * Disconnects eShipFirst integration and wipes stored encrypted credentials
 */
export async function disconnectConfig() {
  const existing = await getRawConfig();
  const nowIso = new Date().toISOString();

  await writeSettingDoc(CONFIG_SETTING_ID, {
    is_enabled: false,
    auto_submit_on_confirm: false,
    base_url: existing.base_url || DEFAULT_BASE_URL,
    default_delivery_charge: existing.default_delivery_charge ?? 0,
    default_pickup_address: existing.default_pickup_address || '',
    api_key_encrypted: null,
    api_key_iv: null,
    api_key_tag: null,
    api_key_masked: '',
    secret_key_encrypted: null,
    secret_key_iv: null,
    secret_key_tag: null,
    secret_key_masked: '',
    connection_status: 'disconnected',
    connection_message: 'Disconnected by administrator',
    current_balance: null,
    last_checked_at: nowIso,
    updated_at: nowIso
  });

  await appendLog({
    action: 'disconnect',
    endpoint: 'local',
    success: true,
    message: 'eShipFirst credentials cleared and integration disconnected.'
  });

  return getPublicConfig();
}

/* ============================================================================
   PARCEL RECORD STORAGE & ORDER SYNCHRONIZATION
   ============================================================================ */

async function readParcelsMap() {
  const map = await readSettingDoc(PARCELS_STORE_ID, {});
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

async function writeParcelsMap(map) {
  await writeSettingDoc(PARCELS_STORE_ID, map);
}

/**
 * Persists parcel record to:
 * 1. Persistent parcels store (instant, zero-migration guarantee)
 * 2. Native public.eshipfirst_parcels table (if SQL migration has been run)
 * 3. Native public.orders courier columns (if SQL migration has been run)
 */
export async function upsertParcelRecord(record) {
  const key = String(record.order_id);
  const nowIso = new Date().toISOString();
  const merged = {
    courier_provider: 'eshipfirst',
    ...record,
    order_id: key,
    updated_at: nowIso,
    created_at: record.created_at || nowIso
  };

  // 1. Always persist in site_settings store (authoritative fallback)
  const map = await readParcelsMap();
  const existing = map[key] || {};
  const finalRecord = { ...existing, ...merged, created_at: existing.created_at || merged.created_at };
  map[key] = finalRecord;
  await writeParcelsMap(map);

  // 2. Sync to dedicated public.eshipfirst_parcels table if present
  try {
    await supabaseAdmin.from('eshipfirst_parcels').upsert(
      {
        order_id: finalRecord.order_id,
        order_db_id: finalRecord.order_db_id || null,
        courier_provider: finalRecord.courier_provider || 'eshipfirst',
        consignment_id: finalRecord.consignment_id ? String(finalRecord.consignment_id) : null,
        tracking_code: finalRecord.tracking_code || null,
        invoice: finalRecord.invoice || finalRecord.order_id,
        recipient_name: finalRecord.recipient_name || '',
        recipient_phone: finalRecord.recipient_phone || '',
        recipient_address: finalRecord.recipient_address || '',
        cod_amount: Number(finalRecord.cod_amount || 0),
        courier_booking_status: finalRecord.courier_booking_status || 'pending',
        courier_delivery_status: finalRecord.courier_delivery_status || null,
        courier_return_status: finalRecord.courier_return_status || null,
        courier_submitted_at: finalRecord.courier_submitted_at || null,
        last_status_checked_at: finalRecord.last_status_checked_at || null,
        last_error: finalRecord.last_error || null,
        courier_response_reference: finalRecord.courier_response_reference || null,
        updated_at: nowIso
      },
      { onConflict: 'order_id' }
    );
  } catch {
    // Table not migrated yet — safely handled by store
  }

  // 3. Sync courier fields onto public.orders row if columns exist (never overwrites primary key/order_id!)
  try {
    const orderUpdate = {
      courier_provider: 'eshipfirst',
      consignment_id: finalRecord.consignment_id ? String(finalRecord.consignment_id) : null,
      tracking_code: finalRecord.tracking_code || null,
      courier_booking_status: finalRecord.courier_booking_status || null,
      courier_delivery_status: finalRecord.courier_delivery_status || null,
      courier_return_status: finalRecord.courier_return_status || null,
      courier_submitted_at: finalRecord.courier_submitted_at || null,
      last_status_checked_at: finalRecord.last_status_checked_at || null,
      courier_response_reference: finalRecord.courier_response_reference || null,
      updated_at: nowIso
    };

    // Only update final order status when confirmed outcome (NEVER on delivered_approval_pending!)
    if (finalRecord.courier_delivery_status === 'delivered') {
      orderUpdate.status = 'delivered';
    } else if (finalRecord.courier_delivery_status === 'cancelled') {
      orderUpdate.status = 'cancelled';
    }

    await supabaseAdmin.from('orders').update(orderUpdate).eq('order_id', key);
  } catch {
    // Columns not migrated yet — safely handled via merged read
  }

  return finalRecord;
}

export async function getParcelByOrderId(orderId) {
  const key = String(orderId);
  const map = await readParcelsMap();
  if (map[key]) return map[key];

  try {
    const { data } = await supabaseAdmin
      .from('eshipfirst_parcels')
      .select('*')
      .eq('order_id', key)
      .maybeSingle();
    if (data) return data;
  } catch {
    // Optional table
  }
  return null;
}

export async function getParcelByConsignmentId(cid) {
  const target = String(cid);
  const map = await readParcelsMap();
  const found = Object.values(map).find((p) => String(p.consignment_id || '') === target);
  if (found) return found;

  try {
    const { data } = await supabaseAdmin
      .from('eshipfirst_parcels')
      .select('*')
      .eq('consignment_id', target)
      .maybeSingle();
    if (data) return data;
  } catch {
    // Optional table
  }
  return null;
}

/**
 * Returns all courier parcels enriched with original order records + dashboard counts
 */
export async function listAllParcels() {
  const map = await readParcelsMap();
  let tableRows = [];
  try {
    const { data, error } = await supabaseAdmin
      .from('eshipfirst_parcels')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) tableRows = data;
  } catch {
    // Table optional
  }

  // Merge map and SQL rows cleanly keyed by order_id
  const mergedByOrder = { ...map };
  for (const row of tableRows) {
    if (row?.order_id) {
      mergedByOrder[String(row.order_id)] = {
        ...(mergedByOrder[String(row.order_id)] || {}),
        ...row
      };
    }
  }

  // Fetch original orders so parcel records stay enriched with items & order details for printing
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  const orderById = {};
  (orders || []).forEach((o) => {
    const key = String(o.order_id || o.id);
    orderById[key] = o;
    // Also capture any orders that already have consignment_id directly on the orders table
    if (o.consignment_id && !mergedByOrder[key]) {
      mergedByOrder[key] = {
        order_id: key,
        order_db_id: o.id,
        courier_provider: o.courier_provider || 'eshipfirst',
        consignment_id: String(o.consignment_id),
        tracking_code: o.tracking_code || '',
        invoice: key,
        recipient_name: o.name,
        recipient_phone: o.phone,
        recipient_address: o.address,
        cod_amount: Number(o.total_price || 0),
        courier_booking_status: o.courier_booking_status || 'booked',
        courier_delivery_status: o.courier_delivery_status || 'in_review',
        courier_return_status: o.courier_return_status || null,
        courier_submitted_at: o.courier_submitted_at || o.updated_at || o.created_at,
        last_status_checked_at: o.last_status_checked_at || null
      };
    }
  });

  const parcels = Object.values(mergedByOrder)
    .map((p) => {
      const orig = orderById[String(p.order_id)] || null;
      return {
        ...p,
        order: orig
      };
    })
    .sort((a, b) => {
      const tA = new Date(a.courier_submitted_at || a.updated_at || a.created_at || 0).getTime();
      const tB = new Date(b.courier_submitted_at || b.updated_at || b.created_at || 0).getTime();
      return tB - tA;
    });

  // Compute exact real dashboard counts
  const stats = {
    total_submitted: 0,
    pending: 0,
    in_review: 0,
    delivered: 0,
    partial_delivered: 0,
    cancelled: 0,
    returned: 0,
    failed: 0
  };

  for (const p of parcels) {
    if (p.courier_booking_status === 'failed' && !p.consignment_id) {
      stats.failed += 1;
      continue;
    }
    if (p.consignment_id) {
      stats.total_submitted += 1;
    }
    const ds = String(p.courier_delivery_status || 'pending').toLowerCase();
    const rs = String(p.courier_return_status || '').toLowerCase();

    if (ds === 'delivered') stats.delivered += 1;
    else if (ds === 'partial_delivered') stats.partial_delivered += 1;
    else if (ds === 'cancelled') stats.cancelled += 1;
    else if (ds === 'in_review') stats.in_review += 1;
    else stats.pending += 1; // pending, hold, *_approval_pending, exceptional

    if (rs && rs.includes('return')) {
      stats.returned += 1;
    }
  }

  return { parcels, stats };
}

/* ============================================================================
   CREATE PARCEL (POST /create_order) WITH STRICT DUPLICATE PREVENTION
   ============================================================================ */

function sanitizeInvoice(rawId) {
  // Packzy allows alphanumeric, hyphens, underscores
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  return cleaned || `INV-${Date.now()}`;
}

function computeCodAmount(order) {
  const total = Number(order.total_price ?? order.total ?? 0);
  const paidAmount = Number(order.paid_amount ?? 0);
  const method = String(order.payment_method || 'cod').toLowerCase();
  const isPaid =
    order.payment_status === 'paid' ||
    order.paid === true ||
    (method !== 'cod' && method !== 'cash_on_delivery' && method !== '' && paidAmount >= total) ||
    (paidAmount > 0 && paidAmount >= total);

  if (isPaid) return 0;
  return Math.max(0, Math.round(total - paidAmount));
}

export async function createParcelForOrder({ orderId, orderSnapshot = null, forceRetry = false }) {
  const creds = await getDecryptedCredentials();
  if (!creds.is_enabled) {
    return {
      success: false,
      skipped: true,
      error: 'eShipFirst integration is disabled in Courier Settings.'
    };
  }
  if (!creds.api_key || !creds.secret_key) {
    return {
      success: false,
      error: 'eShipFirst API Key and Secret Key are not configured.'
    };
  }

  // 1. Retrieve fresh order from Supabase (or fallback to validated snapshot)
  let order = null;
  if (orderId) {
    const { data } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_id', String(orderId))
      .maybeSingle();
    order = data;
    if (!order && !isNaN(Number(orderId))) {
      const { data: byNumeric } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', Number(orderId))
        .maybeSingle();
      order = byNumeric;
    }
  }
  if (!order && orderSnapshot) {
    order = orderSnapshot;
  }
  if (!order) {
    return { success: false, error: `Order ${orderId} not found in database.` };
  }

  const internalOrderId = String(order.order_id || order.id);
  const invoice = sanitizeInvoice(internalOrderId);

  // 2. DUPLICATE CHECK #1 — Local database / parcel store check
  const existing = await getParcelByOrderId(internalOrderId);
  if (existing && existing.consignment_id) {
    return {
      success: true,
      alreadyBooked: true,
      message: `Order #${internalOrderId} is already booked with eShipFirst (CID: ${existing.consignment_id}). Duplicate prevented.`,
      parcel: existing
    };
  }
  if (existing && existing.courier_booking_status === 'submitting' && !forceRetry) {
    return {
      success: false,
      duplicateInFlight: true,
      error: 'Submission is already in progress for this order. Please wait a moment.'
    };
  }

  // 3. DUPLICATE CHECK #2 — Verify remotely via GET /status_by_invoice/{invoice}
  // Protects against previous timeouts or manual portal bookings!
  const remoteCheck = await eshipfirstRequest({
    method: 'GET',
    path: `/status_by_invoice/${encodeURIComponent(invoice)}`,
    credentialsOverride: creds,
    allowRetry: false,
    timeoutMs: 8000
  });

  if (remoteCheck.ok && remoteCheck.data) {
    const existingCid =
      remoteCheck.data.consignment_id ||
      remoteCheck.data.consignment?.consignment_id ||
      null;
    const existingStatus = remoteCheck.data.delivery_status || remoteCheck.data.status_name || null;

    if (existingCid || (existingStatus && existingStatus !== 'unknown')) {
      const synced = await upsertParcelRecord({
        order_id: internalOrderId,
        order_db_id: order.id || null,
        invoice,
        consignment_id: existingCid ? String(existingCid) : existing?.consignment_id || null,
        tracking_code:
          remoteCheck.data.tracking_code ||
          remoteCheck.data.consignment?.tracking_code ||
          existing?.tracking_code ||
          '',
        recipient_name: order.name,
        recipient_phone: normalizeBdPhone(order.phone || ''),
        recipient_address: order.address,
        cod_amount: computeCodAmount(order),
        courier_booking_status: 'booked',
        courier_delivery_status: existingStatus || 'in_review',
        courier_submitted_at: existing?.courier_submitted_at || new Date().toISOString(),
        last_status_checked_at: new Date().toISOString(),
        last_error: null,
        courier_response_reference: remoteCheck.data
      });

      await appendLog({
        action: 'create_order_duplicate_recovered',
        endpoint: `/status_by_invoice/${invoice}`,
        order_id: internalOrderId,
        consignment_id: synced.consignment_id,
        http_status: 200,
        success: true,
        message: 'Recovered existing parcel from eShipFirst instead of creating a duplicate.'
      });

      return {
        success: true,
        alreadyBooked: true,
        recovered: true,
        message: `Existing eShipFirst parcel found and synchronized${synced.consignment_id ? ` (CID: ${synced.consignment_id})` : ''}. Duplicate prevented.`,
        parcel: synced
      };
    }
  }

  // 4. Validate required parcel fields before calling POST /create_order
  const recipientName = String(order.name || '').trim().slice(0, 100);
  const recipientPhone = normalizeBdPhone(order.phone || '');
  const recipientAddress = String(order.address || '').trim().slice(0, 250);
  const codAmount = computeCodAmount(order);

  if (!recipientName || !recipientAddress || !isValidBdPhone(recipientPhone)) {
    const errMsg = `Invalid parcel details for #${internalOrderId}: name, valid 11-digit BD phone (${order.phone || 'missing'}), and address are required.`;
    await upsertParcelRecord({
      order_id: internalOrderId,
      order_db_id: order.id || null,
      invoice,
      recipient_name: recipientName || order.name || '',
      recipient_phone: recipientPhone || order.phone || '',
      recipient_address: recipientAddress || order.address || '',
      cod_amount: codAmount,
      courier_booking_status: 'failed',
      last_error: errMsg
    });
    return { success: false, error: errMsg };
  }

  // Mark as submitting to prevent concurrent double-click bookings
  await upsertParcelRecord({
    order_id: internalOrderId,
    order_db_id: order.id || null,
    invoice,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    recipient_address: recipientAddress,
    cod_amount: codAmount,
    courier_booking_status: 'submitting',
    last_error: null
  });

  // 5. Build official Packzy / eShipFirst POST /create_order payload
  const payload = {
    invoice,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    recipient_address: recipientAddress,
    cod_amount: codAmount
  };

  if (order.notes && String(order.notes).trim()) {
    payload.note = String(order.notes).trim().slice(0, 250);
  } else if (order.package_name || order.product_name) {
    payload.note = String(order.package_name || order.product_name).trim().slice(0, 200);
  }

  // 6. Execute POST /create_order (NO blind retries!)
  const res = await eshipfirstRequest({
    method: 'POST',
    path: '/create_order',
    body: payload,
    credentialsOverride: creds,
    allowRetry: false
  });

  // If timed out, verify via /status_by_invoice/{invoice} before declaring failure!
  if (res.timedOut) {
    const verifyAfterTimeout = await eshipfirstRequest({
      method: 'GET',
      path: `/status_by_invoice/${encodeURIComponent(invoice)}`,
      credentialsOverride: creds,
      allowRetry: false,
      timeoutMs: 8000
    });

    if (verifyAfterTimeout.ok && (verifyAfterTimeout.data?.consignment_id || verifyAfterTimeout.data?.delivery_status)) {
      const recovered = await upsertParcelRecord({
        order_id: internalOrderId,
        order_db_id: order.id || null,
        invoice,
        consignment_id: verifyAfterTimeout.data.consignment_id ? String(verifyAfterTimeout.data.consignment_id) : null,
        tracking_code: verifyAfterTimeout.data.tracking_code || '',
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        recipient_address: recipientAddress,
        cod_amount: codAmount,
        courier_booking_status: 'booked',
        courier_delivery_status: verifyAfterTimeout.data.delivery_status || 'in_review',
        courier_submitted_at: new Date().toISOString(),
        last_status_checked_at: new Date().toISOString(),
        last_error: null,
        courier_response_reference: verifyAfterTimeout.data
      });

      await appendLog({
        action: 'create_order_timeout_recovered',
        endpoint: '/create_order',
        order_id: internalOrderId,
        consignment_id: recovered.consignment_id,
        http_status: 200,
        success: true,
        message: 'Create request timed out but parcel was verified as booked via /status_by_invoice.'
      });

      return {
        success: true,
        recovered: true,
        message: `Parcel verified in eShipFirst after timeout (CID: ${recovered.consignment_id || invoice})`,
        parcel: recovered
      };
    }
  }

  if (!res.ok) {
    const failedRecord = await upsertParcelRecord({
      order_id: internalOrderId,
      order_db_id: order.id || null,
      invoice,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_address: recipientAddress,
      cod_amount: codAmount,
      courier_booking_status: 'failed',
      last_error: res.message,
      courier_response_reference: res.data
    });

    await appendLog({
      action: 'create_order',
      endpoint: '/create_order',
      order_id: internalOrderId,
      http_status: res.httpStatus,
      success: false,
      message: res.message,
      request_summary: payload,
      response_summary: res.data
    });

    return {
      success: false,
      httpStatus: res.httpStatus,
      error: res.message,
      parcel: failedRecord
    };
  }

  // 7. Extract Consignment ID & Tracking Code from response
  const consignment = res.data?.consignment || res.data || {};
  const consignmentId = consignment.consignment_id ? String(consignment.consignment_id) : null;
  const trackingCode = consignment.tracking_code ? String(consignment.tracking_code) : '';
  const deliveryStatus = consignment.status || consignment.delivery_status || 'in_review';

  if (!consignmentId) {
    const errMsg = res.data?.message || 'API returned 200 OK but no consignment_id was found in response.';
    const failedRecord = await upsertParcelRecord({
      order_id: internalOrderId,
      order_db_id: order.id || null,
      invoice,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_address: recipientAddress,
      cod_amount: codAmount,
      courier_booking_status: 'failed',
      last_error: errMsg,
      courier_response_reference: res.data
    });
    await appendLog({
      action: 'create_order',
      endpoint: '/create_order',
      order_id: internalOrderId,
      http_status: res.httpStatus,
      success: false,
      message: errMsg,
      request_summary: payload,
      response_summary: res.data
    });
    return { success: false, error: errMsg, parcel: failedRecord };
  }

  const nowIso = new Date().toISOString();
  const bookedRecord = await upsertParcelRecord({
    order_id: internalOrderId,
    order_db_id: order.id || null,
    invoice,
    consignment_id: consignmentId,
    tracking_code: trackingCode,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    recipient_address: recipientAddress,
    cod_amount: codAmount,
    courier_booking_status: 'booked',
    courier_delivery_status: deliveryStatus,
    courier_return_status: consignment.return_status || null,
    courier_submitted_at: nowIso,
    last_status_checked_at: nowIso,
    last_error: null,
    courier_response_reference: res.data
  });

  await appendLog({
    action: 'create_order',
    endpoint: '/create_order',
    order_id: internalOrderId,
    consignment_id: consignmentId,
    http_status: res.httpStatus,
    success: true,
    message: `Parcel booked successfully! CID: ${consignmentId}${trackingCode ? ` · Tracking: ${trackingCode}` : ''}`,
    request_summary: payload,
    response_summary: { consignment_id: consignmentId, tracking_code: trackingCode, status: deliveryStatus }
  });

  return {
    success: true,
    message: `eShipFirst Parcel Created! Consignment ID: #${consignmentId}`,
    parcel: bookedRecord
  };
}

/* ============================================================================
   TRACKING & STATUS SYNCHRONIZATION (60-SECOND CACHE RESPECTED)
   ============================================================================ */

export async function refreshParcelStatus({ orderId, consignmentId, trackingCode, invoice }) {
  const creds = await getDecryptedCredentials();
  if (!creds.api_key || !creds.secret_key) {
    return { success: false, error: 'eShipFirst API credentials are not configured.' };
  }

  // Locate stored parcel record
  let parcel = null;
  if (orderId) parcel = await getParcelByOrderId(orderId);
  if (!parcel && consignmentId) parcel = await getParcelByConsignmentId(consignmentId);

  const cid = String(consignmentId || parcel?.consignment_id || '').trim();
  const inv = String(invoice || parcel?.invoice || orderId || '').trim();
  const tc = String(trackingCode || parcel?.tracking_code || '').trim();

  // Enforce 60-second cache rule per parcel
  if (parcel?.last_status_checked_at) {
    const elapsedMs = Date.now() - new Date(parcel.last_status_checked_at).getTime();
    if (elapsedMs >= 0 && elapsedMs < STATUS_CACHE_WINDOW_MS) {
      const remainingSec = Math.ceil((STATUS_CACHE_WINDOW_MS - elapsedMs) / 1000);
      return {
        success: true,
        cached: true,
        cooldown_remaining_seconds: remainingSec,
        message: `Status recently synced. API cache allows refresh again in ${remainingSec}s.`,
        parcel
      };
    }
  }

  let res = null;
  let usedEndpoint = '';

  // Prefer GET /status_with_return_status_by_cid/{cid} when CID is present so both delivery & return statuses sync
  if (cid) {
    usedEndpoint = `/status_with_return_status_by_cid/${encodeURIComponent(cid)}`;
    res = await eshipfirstRequest({ method: 'GET', path: usedEndpoint, credentialsOverride: creds, allowRetry: true });
    if (!res.ok && (res.httpStatus === 404 || res.httpStatus === 400)) {
      usedEndpoint = `/status_by_cid/${encodeURIComponent(cid)}`;
      res = await eshipfirstRequest({ method: 'GET', path: usedEndpoint, credentialsOverride: creds, allowRetry: true });
    }
  } else if (tc) {
    usedEndpoint = `/status_by_trackingcode/${encodeURIComponent(tc)}`;
    res = await eshipfirstRequest({ method: 'GET', path: usedEndpoint, credentialsOverride: creds, allowRetry: true });
  } else if (inv) {
    usedEndpoint = `/status_by_invoice/${encodeURIComponent(inv)}`;
    res = await eshipfirstRequest({ method: 'GET', path: usedEndpoint, credentialsOverride: creds, allowRetry: true });
  } else {
    return { success: false, error: 'Consignment ID, Tracking Code, or Invoice ID is required.' };
  }

  if (!res.ok) {
    await appendLog({
      action: 'refresh_status',
      endpoint: usedEndpoint,
      order_id: parcel?.order_id || orderId,
      consignment_id: cid || null,
      http_status: res.httpStatus,
      success: false,
      message: res.message
    });
    return { success: false, httpStatus: res.httpStatus, error: res.message };
  }

  const deliveryStatus =
    res.data?.delivery_status ||
    res.data?.consignment?.delivery_status ||
    res.data?.status_name ||
    parcel?.courier_delivery_status ||
    'pending';

  const returnStatus =
    res.data?.return_status ||
    res.data?.consignment?.return_status ||
    parcel?.courier_return_status ||
    null;

  const returnedCid = res.data?.consignment_id || res.data?.consignment?.consignment_id || cid;
  const returnedTracking = res.data?.tracking_code || res.data?.consignment?.tracking_code || tc;

  let updatedParcel = parcel;
  if (parcel?.order_id || orderId) {
    updatedParcel = await upsertParcelRecord({
      ...(parcel || {}),
      order_id: String(parcel?.order_id || orderId),
      consignment_id: returnedCid ? String(returnedCid) : parcel?.consignment_id || null,
      tracking_code: returnedTracking || parcel?.tracking_code || '',
      courier_booking_status: returnedCid ? 'booked' : parcel?.courier_booking_status || 'booked',
      courier_delivery_status: deliveryStatus,
      courier_return_status: returnStatus,
      last_status_checked_at: new Date().toISOString(),
      courier_response_reference: {
        ...(parcel?.courier_response_reference || {}),
        latest_status_check: res.data
      }
    });
  }

  await appendLog({
    action: 'refresh_status',
    endpoint: usedEndpoint,
    order_id: updatedParcel?.order_id || orderId,
    consignment_id: returnedCid || null,
    http_status: res.httpStatus,
    success: true,
    message: `Status synced: ${deliveryStatus}${returnStatus ? ` | Return: ${returnStatus}` : ''}`,
    response_summary: res.data
  });

  return {
    success: true,
    cached: false,
    delivery_status: deliveryStatus,
    return_status: returnStatus,
    raw: res.data,
    parcel: updatedParcel
  };
}

/**
 * Fetches rich tracking history via GET /trackings_by_invoice/{invoice} + status endpoints
 */
export async function getParcelTrackingDetails({ invoice, consignmentId, trackingCode }) {
  const creds = await getDecryptedCredentials();
  if (!creds.api_key || !creds.secret_key) {
    return { success: false, error: 'eShipFirst API credentials are not configured.' };
  }

  const results = {};

  if (consignmentId) {
    const r = await eshipfirstRequest({
      method: 'GET',
      path: `/status_with_return_status_by_cid/${encodeURIComponent(consignmentId)}`,
      credentialsOverride: creds,
      allowRetry: true
    });
    results.status_with_return = r.ok ? r.data : { error: r.message };
    if (!r.ok) {
      const r2 = await eshipfirstRequest({
        method: 'GET',
        path: `/status_by_cid/${encodeURIComponent(consignmentId)}`,
        credentialsOverride: creds,
        allowRetry: true
      });
      results.status_by_cid = r2.ok ? r2.data : { error: r2.message };
    }
  }

  if (invoice) {
    const tr = await eshipfirstRequest({
      method: 'GET',
      path: `/trackings_by_invoice/${encodeURIComponent(invoice)}`,
      credentialsOverride: creds,
      allowRetry: true
    });
    results.trackings = tr.ok ? tr.data : { error: tr.message };
  } else if (trackingCode) {
    const tcRes = await eshipfirstRequest({
      method: 'GET',
      path: `/status_by_trackingcode/${encodeURIComponent(trackingCode)}`,
      credentialsOverride: creds,
      allowRetry: true
    });
    results.status_by_trackingcode = tcRes.ok ? tcRes.data : { error: tcRes.message };
  }

  return { success: true, tracking: results };
}

/* ============================================================================
   ADDITIONAL COURIER ENDPOINTS (States, Stats, Balance, Payments, Pickup, Returns, Fraud)
   ============================================================================ */

export async function getLiveCourierStats() {
  const creds = await getDecryptedCredentials();
  if (!creds.api_key || !creds.secret_key) {
    return { success: false, configured: false, error: 'eShipFirst API is not configured.' };
  }

  const [balanceRes, statsRes, statesRes] = await Promise.all([
    eshipfirstRequest({ method: 'GET', path: '/get_balance', credentialsOverride: creds, allowRetry: true }),
    eshipfirstRequest({ method: 'GET', path: '/stats', credentialsOverride: creds, allowRetry: true }),
    eshipfirstRequest({ method: 'GET', path: '/parcel_states', credentialsOverride: creds, allowRetry: true })
  ]);

  return {
    success: balanceRes.ok || statsRes.ok || statesRes.ok,
    configured: true,
    balance: balanceRes.ok ? balanceRes.data : { error: balanceRes.message },
    stats: statsRes.ok ? statsRes.data : { error: statsRes.message },
    parcel_states: statesRes.ok ? statesRes.data : { error: statesRes.message }
  };
}

export async function getParcelStateList(state = '') {
  const creds = await getDecryptedCredentials();
  if (!creds.api_key || !creds.secret_key) {
    return { success: false, error: 'eShipFirst API is not configured.' };
  }
  const path = state ? `/parcel_states/${encodeURIComponent(state)}` : '/parcel_states';
  const res = await eshipfirstRequest({ method: 'GET', path, credentialsOverride: creds, allowRetry: true });
  return res.ok ? { success: true, data: res.data } : { success: false, httpStatus: res.httpStatus, error: res.message };
}

export async function createPickupRequest(body) {
  const creds = await getDecryptedCredentials();
  if (!creds.api_key || !creds.secret_key) {
    return { success: false, error: 'eShipFirst API is not configured.' };
  }
  const payload = {
    ...(creds.default_pickup_address && !body?.address ? { address: creds.default_pickup_address } : {}),
    ...(body || {})
  };
  const res = await eshipfirstRequest({
    method: 'POST',
    path: '/create_pickup_request',
    body: payload,
    credentialsOverride: creds,
    allowRetry: false
  });
  await appendLog({
    action: 'create_pickup_request',
    endpoint: '/create_pickup_request',
    http_status: res.httpStatus,
    success: res.ok,
    message: res.ok ? 'Pickup request created successfully.' : res.message,
    request_summary: payload,
    response_summary: res.data
  });
  return res.ok ? { success: true, data: res.data, message: res.message } : { success: false, httpStatus: res.httpStatus, error: res.message };
}

export async function createReturnRequest(body) {
  const creds = await getDecryptedCredentials();
  if (!creds.api_key || !creds.secret_key) {
    return { success: false, error: 'eShipFirst API is not configured.' };
  }
  const res = await eshipfirstRequest({
    method: 'POST',
    path: '/create_return_request',
    body: body || {},
    credentialsOverride: creds,
    allowRetry: false
  });
  await appendLog({
    action: 'create_return_request',
    endpoint: '/create_return_request',
    consignment_id: body?.consignment_id || null,
    http_status: res.httpStatus,
    success: res.ok,
    message: res.ok ? 'Return request submitted.' : res.message,
    request_summary: body,
    response_summary: res.data
  });
  return res.ok ? { success: true, data: res.data, message: res.message } : { success: false, httpStatus: res.httpStatus, error: res.message };
}

export async function getReturnRequests(id = '') {
  const creds = await getDecryptedCredentials();
  if (!creds.api_key || !creds.secret_key) {
    return { success: false, error: 'eShipFirst API is not configured.' };
  }
  const path = id ? `/get_return_request/${encodeURIComponent(id)}` : '/get_return_requests';
  const res = await eshipfirstRequest({ method: 'GET', path, credentialsOverride: creds, allowRetry: true });
  return res.ok ? { success: true, data: res.data } : { success: false, httpStatus: res.httpStatus, error: res.message };
}

export async function getPayments(paymentId = '') {
  const creds = await getDecryptedCredentials();
  if (!creds.api_key || !creds.secret_key) {
    return { success: false, error: 'eShipFirst API is not configured.' };
  }
  const path = paymentId ? `/payments/${encodeURIComponent(paymentId)}` : '/payments';
  const res = await eshipfirstRequest({ method: 'GET', path, credentialsOverride: creds, allowRetry: true });
  return res.ok ? { success: true, data: res.data } : { success: false, httpStatus: res.httpStatus, error: res.message };
}

export async function getFraudCheckScore(phone) {
  const creds = await getDecryptedCredentials();
  if (!creds.api_key || !creds.secret_key) {
    return { success: false, error: 'eShipFirst API is not configured.' };
  }
  const normalized = normalizeBdPhone(phone || '');
  if (!isValidBdPhone(normalized)) {
    return { success: false, error: 'Please provide a valid 11-digit Bangladesh phone number.' };
  }
  const res = await eshipfirstRequest({
    method: 'GET',
    path: `/fraud_check/score/${encodeURIComponent(normalized)}`,
    credentialsOverride: creds,
    allowRetry: true
  });
  await appendLog({
    action: 'fraud_check_score',
    endpoint: `/fraud_check/score/${normalized}`,
    http_status: res.httpStatus,
    success: res.ok,
    message: res.ok ? `Fraud score retrieved for ${normalized}` : res.message
  });
  return res.ok
    ? { success: true, phone: normalized, data: res.data }
    : { success: false, httpStatus: res.httpStatus, error: res.message };
}

/* ============================================================================
   WEBHOOK RECEIVER VERIFICATION & PROCESSING (Bearer Token)
   ============================================================================ */

export async function verifyWebhookBearer(authHeader) {
  const creds = await getDecryptedCredentials();
  const expected = creds.webhook_token || process.env.ESHIPFIRST_WEBHOOK_TOKEN || '';
  if (!expected) {
    return { valid: false, reason: 'Webhook Bearer token is not configured on the server.' };
  }
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return { valid: false, reason: 'Missing Authorization: Bearer token header.' };
  }
  const provided = authHeader.slice(7).trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'Invalid webhook Bearer token.' };
  }
  return { valid: true };
}

export async function processWebhookEvent(payload) {
  const cid = payload?.consignment_id ? String(payload.consignment_id) : null;
  const invoice = payload?.invoice ? String(payload.invoice) : null;
  const notificationType = String(payload?.notification_type || 'delivery_status').toLowerCase();
  const rawStatus = payload?.status ? String(payload.status).toLowerCase() : null;
  const returnStatus = payload?.return_status ? String(payload.return_status).toLowerCase() : null;

  let parcel = null;
  if (cid) parcel = await getParcelByConsignmentId(cid);
  if (!parcel && invoice) parcel = await getParcelByOrderId(invoice);

  if (!parcel) {
    await appendLog({
      action: 'webhook_unmatched',
      endpoint: '/api/eshipfirst-webhook',
      order_id: invoice,
      consignment_id: cid,
      http_status: 200,
      success: true,
      message: `Webhook received (${notificationType}) for unknown parcel CID=${cid || 'none'} Invoice=${invoice || 'none'}`,
      response_summary: payload
    });
    return { matched: false };
  }

  const updates = {
    ...parcel,
    last_status_checked_at: new Date().toISOString(),
    courier_response_reference: {
      ...(parcel.courier_response_reference || {}),
      last_webhook_event: {
        notification_type: notificationType,
        status: rawStatus,
        tracking_message: payload?.tracking_message || null,
        updated_at: payload?.updated_at || new Date().toISOString()
      }
    }
  };

  if (notificationType === 'delivery_status' && rawStatus) {
    updates.courier_delivery_status = rawStatus;
  }
  if (returnStatus) {
    updates.courier_return_status = returnStatus;
  }

  const saved = await upsertParcelRecord(updates);

  await appendLog({
    action: 'webhook_received',
    endpoint: '/api/eshipfirst-webhook',
    order_id: saved.order_id,
    consignment_id: saved.consignment_id,
    http_status: 200,
    success: true,
    message: `Webhook synced (${notificationType}): ${rawStatus || payload?.tracking_message || 'updated'}`
  });

  return { matched: true, parcel: saved };
}
