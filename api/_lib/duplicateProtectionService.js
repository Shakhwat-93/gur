import { supabaseAdmin } from './supabaseAdmin.js';
import { normalizeBdPhone, isValidBdPhone } from '../../src/lib/phoneNormalizer.js';

/**
 * Safely extracts and normalizes the client IP address from server headers & socket.
 * Handles reverse proxies (Vercel, Cloudflare) and local development.
 */
export function getClientIp(req) {
  if (!req) return 'unknown';

  // 1. Direct header precedence: x-real-ip (Vercel edge authoritative real IP)
  let rawIp = req.headers?.['x-real-ip'];

  // 2. Cloudflare Connecting IP (when behind Cloudflare)
  if (!rawIp && req.headers?.['cf-connecting-ip']) {
    rawIp = req.headers['cf-connecting-ip'];
  }

  // 3. Vercel specific IP header
  if (!rawIp && req.headers?.['x-vercel-ip']) {
    rawIp = req.headers['x-vercel-ip'];
  }

  // 4. X-Forwarded-For: Take the first (client) hop
  if (!rawIp && req.headers?.['x-forwarded-for']) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      rawIp = forwarded.split(',')[0].trim();
    }
  }

  // 5. Raw socket remoteAddress
  if (!rawIp) {
    rawIp = req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
  }

  // Normalize IPv6 mapped IPv4 and localhost
  if (typeof rawIp === 'string') {
    rawIp = rawIp.trim();
    if (rawIp.startsWith('::ffff:')) {
      rawIp = rawIp.slice(7);
    }
    if (rawIp === '::1') {
      rawIp = '127.0.0.1';
    }
  }

  return rawIp || 'unknown';
}

/**
 * Fetch current duplicate protection settings
 */
export async function getDuplicateSettings() {
  const { data, error } = await supabaseAdmin
    .from('duplicate_order_settings')
    .select('*')
    .eq('id', 'config')
    .maybeSingle();

  if (error || !data) {
    return {
      id: 'config',
      is_enabled: true,
      block_same_phone: true,
      block_same_ip: true,
      duration_minutes: 10,
      updated_at: new Date().toISOString(),
      updated_by: 'system'
    };
  }

  return data;
}

/**
 * Persistently update duplicate protection settings
 */
export async function updateDuplicateSettings({
  is_enabled,
  block_same_phone,
  block_same_ip,
  duration_minutes,
  updated_by = 'admin'
}) {
  const duration = parseInt(duration_minutes, 10);
  if (isNaN(duration) || duration < 1 || duration > 1440) {
    throw new Error('Duration must be a valid number between 1 and 1440 minutes (24 hours).');
  }

  const payload = {
    id: 'config',
    is_enabled: Boolean(is_enabled),
    block_same_phone: Boolean(block_same_phone),
    block_same_ip: Boolean(block_same_ip),
    duration_minutes: duration,
    updated_at: new Date().toISOString(),
    updated_by
  };

  const { data, error } = await supabaseAdmin
    .from('duplicate_order_settings')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Database error saving settings: ${error.message}`);
  }

  return data;
}

/**
 * Retrieve recent blocked attempt logs and summary statistics
 */
export async function getDuplicateLogs(limit = 20) {
  // 1. Get total count
  const { count: totalBlocked, error: countErr } = await supabaseAdmin
    .from('duplicate_order_logs')
    .select('*', { count: 'exact', head: true });

  // 2. Get recent records
  const { data: logs, error: logsErr } = await supabaseAdmin
    .from('duplicate_order_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (countErr || logsErr) {
    console.error('Error fetching duplicate logs:', countErr || logsErr);
  }

  return {
    totalBlocked: totalBlocked || 0,
    logs: logs || []
  };
}

/**
 * Bengali numeral converter helper
 */
export function toBengaliNumerals(num) {
  const bnNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, (digit) => bnNumerals[Number(digit)]);
}

/**
 * Execute order submission through atomic PostgreSQL RPC
 */
export async function processOrderSubmission(orderData, req) {
  const {
    order_id,
    name,
    phone,
    address,
    area,
    package_name,
    quantity,
    unit_price,
    subtotal,
    delivery_fee,
    total_price,
    items
  } = orderData || {};

  // 1. Validate required fields
  if (!name || !name.trim()) {
    throw { status: 400, message: 'কাস্টমার নাম আবশ্যক' };
  }
  if (!phone) {
    throw { status: 400, message: 'ফোন নম্বর আবশ্যক' };
  }
  if (!address || !address.trim()) {
    throw { status: 400, message: 'সম্পূর্ণ ডেলিভারি ঠিকানা আবশ্যক' };
  }

  // 2. Phone normalization & validation
  const canonicalPhone = normalizeBdPhone(phone);
  if (!isValidBdPhone(canonicalPhone)) {
    throw {
      status: 400,
      message: 'অনুগ্রহ করে সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)'
    };
  }

  // 3. Resolve client IP and user agent
  const clientIp = getClientIp(req);
  const userAgent = req.headers?.['user-agent'] || 'unknown';

  let parsedQty = parseInt(quantity, 10) || 1;
  const parsedUnitPrice = Number(unit_price) || 0;
  const parsedTotal = Number(total_price) || parsedUnitPrice * parsedQty;

  const finalOrderId =
    order_id || `KB-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

  // 4. Call atomic database RPC function
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('submit_order_secure', {
    p_order_id: finalOrderId,
    p_name: name.trim(),
    p_phone: canonicalPhone,
    p_address: address.trim(),
    p_area: area || 'ঢাকার ভিতরে',
    p_package_name: package_name || 'প্যাকেজ',
    p_quantity: parsedQty,
    p_unit_price: parsedUnitPrice,
    p_subtotal: Number(subtotal) || parsedUnitPrice * parsedQty,
    p_delivery_fee: Number(delivery_fee) || 0,
    p_total_price: parsedTotal,
    p_ip_address: clientIp,
    p_user_agent: userAgent,
    p_items: items || []
  });

  if (rpcError) {
    console.error('[submit_order_secure RPC Error]:', rpcError);
    throw { status: 500, message: 'অর্ডার সংরক্ষণ করতে সমস্যা হয়েছে।' };
  }

  // 5. If blocked by duplicate protection, format customer-friendly response
  if (rpcResult && rpcResult.success === false && rpcResult.code === 'DUPLICATE_ORDER_BLOCKED') {
    const minsLeft = Math.ceil((rpcResult.retry_after_seconds || 60) / 60);
    const bnMins = toBengaliNumerals(minsLeft);

    const friendlyMessage = `আপনার তথ্য দিয়ে সম্প্রতি একটি অর্ডার করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন। (আবার অর্ডার করতে পারবেন: প্রায় ${bnMins} মিনিট পরে)`;

    return {
      isBlocked: true,
      statusCode: 429,
      response: {
        success: false,
        code: 'DUPLICATE_ORDER_BLOCKED',
        message: friendlyMessage,
        retry_after_seconds: rpcResult.retry_after_seconds,
        duration_minutes: rpcResult.duration_minutes
      }
    };
  }

  return {
    isBlocked: false,
    statusCode: 200,
    response: {
      success: true,
      order: rpcResult.order,
      is_idempotent_replay: rpcResult.is_idempotent_replay || false
    }
  };
}

export default {
  getClientIp,
  getDuplicateSettings,
  updateDuplicateSettings,
  getDuplicateLogs,
  toBengaliNumerals,
  processOrderSubmission
};
