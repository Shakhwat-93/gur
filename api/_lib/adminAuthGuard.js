/**
 * Server-Side Admin Request Authorization Guard
 * Validates admin session tokens issued by the admin portal or configured ADMIN_API_SECRET.
 */

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function verifyAdminRequest(req) {
  const headers = req.headers || {};
  const rawAdminToken =
    headers['x-admin-token'] ||
    headers['X-Admin-Token'] ||
    (typeof headers.authorization === 'string' && headers.authorization.startsWith('Bearer ')
      ? headers.authorization.slice(7).trim()
      : '');

  if (!rawAdminToken || typeof rawAdminToken !== 'string') {
    return { authorized: false, reason: 'Missing admin authentication token' };
  }

  const token = rawAdminToken.trim();

  // 1. Optional server-side static secret override for trusted server/CI automation
  if (process.env.ADMIN_API_SECRET && token === process.env.ADMIN_API_SECRET) {
    return { authorized: true, actor: 'server_secret' };
  }

  // 2. Validate session token format: mg_<hash36>_<timestamp36>
  const match = /^mg_([a-z0-9]+)_([a-z0-9]+)$/i.exec(token);
  if (!match) {
    return { authorized: false, reason: 'Invalid admin token format' };
  }

  const issuedAtMs = parseInt(match[2], 36);
  if (!Number.isFinite(issuedAtMs) || issuedAtMs <= 0) {
    return { authorized: false, reason: 'Malformed admin session timestamp' };
  }

  const now = Date.now();
  // Allow slight clock skew (10 min) and enforce 7-day TTL
  if (issuedAtMs > now + 10 * 60 * 1000 || now - issuedAtMs > SESSION_TTL_MS) {
    return { authorized: false, reason: 'Admin session has expired. Please log in again.' };
  }

  return { authorized: true, actor: 'admin_session' };
}

export function requireAdminAuth(req, res) {
  const check = verifyAdminRequest(req);
  if (!check.authorized) {
    res.status(401).json({
      success: false,
      error: check.reason || 'Unauthorized admin access'
    });
    return null;
  }
  return check;
}

export default { verifyAdminRequest, requireAdminAuth };
