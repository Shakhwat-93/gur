import { supabaseAdmin } from './supabaseAdmin.js';
import { encryptApiKey, decryptApiKey, maskApiKey } from './secretManager.js';
import { normalizeBdPhone, isValidBdPhone } from '../../src/lib/phoneNormalizer.js';

const BDCOURIER_API_URL = 'https://api.bdcourier.com/courier-check';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Retrieve current BD Courier configuration (safe for admin UI, never reveals plaintext secret)
 */
export async function getSettings() {
  try {
    const { data, error } = await supabaseAdmin
      .from('bdcourier_settings')
      .select('*')
      .eq('id', 'config')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return {
        is_enabled: false,
        has_key: false,
        masked_key: '',
        connection_status: 'unconfigured',
        connection_message: 'Not configured yet',
        last_checked_at: null
      };
    }

    return {
      is_enabled: Boolean(data.is_enabled),
      has_key: Boolean(data.api_key_encrypted),
      masked_key: data.api_key_masked || '',
      connection_status: data.connection_status || 'unconfigured',
      connection_message: data.connection_message || '',
      last_checked_at: data.last_checked_at
    };
  } catch (err) {
    console.error('[BDCourierService] Error fetching settings:', err.message);
    throw err;
  }
}

/**
 * Save settings with authenticated encryption at rest
 */
export async function saveSettings({ is_enabled, api_key }) {
  try {
    const updates = {
      is_enabled: Boolean(is_enabled),
      updated_at: new Date().toISOString()
    };

    // If new API key is provided, encrypt and store
    if (api_key && typeof api_key === 'string' && api_key.trim().length > 0) {
      const encryptedPayload = encryptApiKey(api_key.trim());
      if (encryptedPayload) {
        updates.api_key_encrypted = encryptedPayload.encrypted;
        updates.encryption_iv = encryptedPayload.iv;
        updates.encryption_tag = encryptedPayload.tag;
        updates.api_key_masked = maskApiKey(api_key);
        // Reset connection status on key change so admin can verify
        updates.connection_status = 'unverified';
        updates.connection_message = 'Key updated. Please run "Check Connection".';
      }
    }

    const { data, error } = await supabaseAdmin
      .from('bdcourier_settings')
      .upsert({ id: 'config', ...updates })
      .select()
      .single();

    if (error) throw error;
    return getSettings();
  } catch (err) {
    console.error('[BDCourierService] Error saving settings:', err.message);
    throw err;
  }
}

/**
 * Test BD Courier API connection with official API credentials
 */
export async function testConnection(apiKeyOverride = null) {
  try {
    let keyToTest = apiKeyOverride;

    if (!keyToTest) {
      const { data: settings } = await supabaseAdmin
        .from('bdcourier_settings')
        .select('*')
        .eq('id', 'config')
        .maybeSingle();

      if (!settings?.api_key_encrypted) {
        return {
          connected: false,
          status: 'unconfigured',
          message: 'No API key has been configured yet.'
        };
      }

      keyToTest = decryptApiKey(
        settings.api_key_encrypted,
        settings.encryption_iv,
        settings.encryption_tag
      );
    }

    if (!keyToTest) {
      return {
        connected: false,
        status: 'unconfigured',
        message: 'Could not decrypt API key.'
      };
    }

    // Call BD Courier endpoint with probe phone
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res;
    let resJson;
    try {
      res = await fetch(BDCOURIER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keyToTest.trim()}`
        },
        body: JSON.stringify({ phone: '01700000000' }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      resJson = await res.json().catch(() => ({}));
    } catch (fetchErr) {
      clearTimeout(timeout);
      const isTimeout = fetchErr.name === 'AbortError';
      const msg = isTimeout ? 'Connection timed out (10s)' : `Network error: ${fetchErr.message}`;

      await supabaseAdmin
        .from('bdcourier_settings')
        .update({
          connection_status: 'error',
          connection_message: msg,
          last_checked_at: new Date().toISOString()
        })
        .eq('id', 'config');

      return { connected: false, status: 'error', message: msg };
    }

    // Handle API response
    if (res.status === 200 || (resJson && resJson.status === 'success')) {
      const msg = 'Connected successfully to BD Courier API!';
      await supabaseAdmin
        .from('bdcourier_settings')
        .update({
          connection_status: 'connected',
          connection_message: msg,
          last_checked_at: new Date().toISOString()
        })
        .eq('id', 'config');

      return { connected: true, status: 'connected', message: msg, raw: resJson };
    }

    // Handle 401 or invalid token
    if (res.status === 401 || (resJson && resJson.message && resJson.message.toLowerCase().includes('invalid'))) {
      const msg = resJson.message || 'Invalid Bearer token / API key.';
      await supabaseAdmin
        .from('bdcourier_settings')
        .update({
          connection_status: 'invalid_key',
          connection_message: msg,
          last_checked_at: new Date().toISOString()
        })
        .eq('id', 'config');

      return { connected: false, status: 'invalid_key', message: msg };
    }

    // Other API errors (e.g. rate limit, server error)
    const errorMsg = resJson.message || `API returned HTTP status ${res.status}`;
    await supabaseAdmin
      .from('bdcourier_settings')
      .update({
        connection_status: 'error',
        connection_message: errorMsg,
        last_checked_at: new Date().toISOString()
      })
      .eq('id', 'config');

    return { connected: false, status: 'error', message: errorMsg };
  } catch (err) {
    console.error('[BDCourierService] Test connection error:', err.message);
    return { connected: false, status: 'error', message: err.message };
  }
}

/**
 * Sanitizes and extracts clean courier statistics from BD Courier API response
 */
function sanitizeCourierData(raw, canonicalPhone) {
  if (!raw) return { phone: canonicalPhone, summary: null, couriers: {} };

  const rawData = raw.data || raw;

  // 1. Summary
  let summary = rawData.summary || null;
  if (!summary) {
    // Calculate summary if individual couriers are supplied
    const couriersList = ['pathao', 'steadfast', 'redx', 'parceldex', 'courrierfast', 'paperfly', 'carrybee'];
    let total = 0;
    let success = 0;
    let cancelled = 0;
    let foundCouriers = false;

    couriersList.forEach((c) => {
      const info = rawData[c];
      if (info && typeof info === 'object') {
        foundCouriers = true;
        total += Number(info.total_parcel || 0);
        success += Number(info.success_parcel || 0);
        cancelled += Number(info.cancelled_parcel || 0);
      }
    });

    if (foundCouriers) {
      const ratio = total > 0 ? Number(((success / total) * 100).toFixed(1)) : 0;
      summary = {
        total_parcel: total,
        success_parcel: success,
        cancelled_parcel: cancelled,
        success_ratio: ratio
      };
    } else {
      // Default zero parcels for completely new customer
      summary = {
        total_parcel: 0,
        success_parcel: 0,
        cancelled_parcel: 0,
        success_ratio: 0
      };
    }
  } else {
    // Normalize numeric fields in summary
    summary = {
      total_parcel: Number(summary.total_parcel || 0),
      success_parcel: Number(summary.success_parcel || 0),
      cancelled_parcel: Number(summary.cancelled_parcel || 0),
      success_ratio: Number(summary.success_ratio || 0)
    };
  }

  // 2. Individual Couriers
  const couriers = {};
  const standardCouriers = ['pathao', 'steadfast', 'redx', 'parceldex', 'courrierfast', 'paperfly', 'carrybee'];
  standardCouriers.forEach((c) => {
    if (rawData[c] && typeof rawData[c] === 'object') {
      const item = rawData[c];
      couriers[c] = {
        name: item.name || c.charAt(0).toUpperCase() + c.slice(1),
        logo: item.logo || null,
        total_parcel: Number(item.total_parcel || 0),
        success_parcel: Number(item.success_parcel || 0),
        cancelled_parcel: Number(item.cancelled_parcel || 0),
        success_ratio: Number(item.success_ratio || 0)
      };
    }
  });

  // 3. Reports
  const reports = Array.isArray(raw.reports) ? raw.reports.slice(0, 5) : [];

  return {
    phone: canonicalPhone,
    summary,
    couriers,
    reports,
    risk_level: raw.risk_level || (summary.total_parcel === 0 ? 'new_customer' : summary.success_ratio >= 80 ? 'safe' : summary.success_ratio >= 60 ? 'medium' : 'high_risk'),
    retrieved_at: new Date().toISOString()
  };
}

/**
 * Execute or retrieve courier check with strict AT-MOST-ONCE guarantee per phone number
 */
export async function performCourierCheck({ phone, orderId = null }) {
  const canonicalPhone = normalizeBdPhone(phone);

  if (!isValidBdPhone(canonicalPhone)) {
    return {
      success: false,
      status: 'failed',
      error: 'Invalid Bangladeshi phone number'
    };
  }

  // STEP 1: Check if a cache record already exists in Supabase
  const { data: existingRecord, error: fetchErr } = await supabaseAdmin
    .from('bdcourier_checks')
    .select('*')
    .eq('phone', canonicalPhone)
    .maybeSingle();

  if (fetchErr) {
    console.error('[BDCourierService] Supabase fetch error:', fetchErr.message);
  }

  if (existingRecord) {
    // Link to order if orderId provided and not linked yet
    if (orderId && existingRecord.id) {
      await linkOrderToCourierCheck(orderId, existingRecord.id);
    }

    if (existingRecord.status === 'completed') {
      return {
        success: true,
        source: 'cache',
        status: 'completed',
        data: existingRecord.data,
        record_id: existingRecord.id,
        phone: canonicalPhone
      };
    }

    if (existingRecord.status === 'failed' || existingRecord.status === 'unknown') {
      return {
        success: false,
        source: 'cache',
        status: existingRecord.status,
        error: existingRecord.error || 'Previous lookup attempt failed or was inconclusive',
        record_id: existingRecord.id,
        phone: canonicalPhone
      };
    }

    if (existingRecord.status === 'pending') {
      return {
        success: false,
        source: 'cache',
        status: 'pending',
        message: 'Lookup is currently in progress',
        record_id: existingRecord.id,
        phone: canonicalPhone
      };
    }
  }

  // STEP 2: Verify if integration is enabled
  const settings = await getSettings();
  if (!settings.is_enabled) {
    return {
      success: false,
      source: 'skipped',
      status: 'disabled',
      message: 'BD Courier integration is not enabled in settings'
    };
  }

  // STEP 3: Atomic reservation / claim via Postgres RPC
  const { data: claimResult, error: rpcErr } = await supabaseAdmin.rpc('claim_courier_check', {
    p_phone: canonicalPhone
  });

  if (rpcErr) {
    console.error('[BDCourierService] RPC claim error:', rpcErr.message);
    return {
      success: false,
      status: 'error',
      error: `Atomic claim error: ${rpcErr.message}`
    };
  }

  // If another concurrent request already claimed it, reuse its state
  if (!claimResult?.claimed) {
    const record = claimResult?.record;
    if (orderId && record?.id) {
      await linkOrderToCourierCheck(orderId, record.id);
    }

    if (record?.status === 'completed') {
      return {
        success: true,
        source: 'cache',
        status: 'completed',
        data: record.data,
        record_id: record.id,
        phone: canonicalPhone
      };
    }

    return {
      success: false,
      source: 'cache',
      status: record?.status || 'pending',
      error: record?.error || 'Concurrent lookup in progress or completed',
      record_id: record?.id,
      phone: canonicalPhone
    };
  }

  // STEP 4: WE HAVE THE EXCLUSIVE CLAIM.
  // Execute the SINGLE permitted external API call.
  const recordId = claimResult.record.id;

  if (orderId) {
    await linkOrderToCourierCheck(orderId, recordId);
  }

  // Retrieve and decrypt API key
  const { data: rawSettings } = await supabaseAdmin
    .from('bdcourier_settings')
    .select('*')
    .eq('id', 'config')
    .maybeSingle();

  const apiKey = rawSettings?.api_key_encrypted
    ? decryptApiKey(rawSettings.api_key_encrypted, rawSettings.encryption_iv, rawSettings.encryption_tag)
    : null;

  if (!apiKey) {
    await supabaseAdmin
      .from('bdcourier_checks')
      .update({
        status: 'failed',
        error: 'BD Courier API key not configured',
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId);

    return {
      success: false,
      source: 'api',
      status: 'failed',
      error: 'BD Courier API key not configured',
      record_id: recordId,
      phone: canonicalPhone
    };
  }

  // External call with 10s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const apiRes = await fetch(BDCOURIER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({ phone: canonicalPhone }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const jsonBody = await apiRes.json().catch(() => ({}));

    if (apiRes.ok && (jsonBody.status === 'success' || jsonBody.data)) {
      const sanitized = sanitizeCourierData(jsonBody, canonicalPhone);

      await supabaseAdmin
        .from('bdcourier_checks')
        .update({
          status: 'completed',
          data: sanitized,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error: null
        })
        .eq('id', recordId);

      return {
        success: true,
        source: 'api',
        status: 'completed',
        data: sanitized,
        record_id: recordId,
        phone: canonicalPhone
      };
    } else {
      // API returned error (e.g. 401, 403, 429)
      const errorMsg = jsonBody.message || `BD Courier returned HTTP ${apiRes.status}`;

      await supabaseAdmin
        .from('bdcourier_checks')
        .update({
          status: 'failed',
          error: errorMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordId);

      return {
        success: false,
        source: 'api',
        status: 'failed',
        error: errorMsg,
        record_id: recordId,
        phone: canonicalPhone
      };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    const errorMsg = isTimeout
      ? 'BD Courier request timed out (10s)'
      : `Network failure: ${err.message}`;

    // Mark as unknown so that we DO NOT retry automatically
    await supabaseAdmin
      .from('bdcourier_checks')
      .update({
        status: 'unknown',
        error: errorMsg,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId);

    return {
      success: false,
      source: 'api',
      status: 'unknown',
      error: errorMsg,
      record_id: recordId,
      phone: canonicalPhone
    };
  }
}

/**
 * Link an order to its cached courier check record
 */
async function linkOrderToCourierCheck(orderId, courierCheckId) {
  if (!orderId || !courierCheckId) return;
  try {
    await supabaseAdmin
      .from('orders')
      .update({ courier_check_id: courierCheckId })
      .eq('order_id', orderId);
  } catch (err) {
    console.warn('[BDCourierService] Order linking notice:', err.message);
  }
}

export default {
  getSettings,
  saveSettings,
  testConnection,
  performCourierCheck
};
