import {
  getDuplicateSettings,
  updateDuplicateSettings,
  getDuplicateLogs
} from './_lib/duplicateProtectionService.js';

export default async function handler(req, res) {
  // CORS & No-Cache headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET: Retrieve configuration and blocked logs
    if (req.method === 'GET') {
      const config = await getDuplicateSettings();
      const logsSummary = await getDuplicateLogs(25);

      const duration = parseInt(config?.duration_minutes || 10, 10);
      const normalizedConfig = {
        ...config,
        duration_minutes: duration,
        phone_window_minutes: duration,
        ip_window_minutes: duration
      };

      return res.status(200).json({
        success: true,
        config: normalizedConfig,
        totalBlocked: logsSummary.totalBlocked,
        logs: logsSummary.logs
      });
    }

    // POST: Update configuration
    if (req.method === 'POST') {
      const {
        is_enabled,
        block_same_phone,
        block_same_ip,
        duration_minutes,
        phone_window_minutes
      } = req.body || {};

      const finalDuration = duration_minutes !== undefined ? duration_minutes : phone_window_minutes;

      const updated = await updateDuplicateSettings({
        is_enabled,
        block_same_phone,
        block_same_ip,
        duration_minutes: finalDuration
      });

      const normalizedUpdated = {
        ...updated,
        duration_minutes: parseInt(updated.duration_minutes || 10, 10),
        phone_window_minutes: parseInt(updated.duration_minutes || 10, 10),
        ip_window_minutes: parseInt(updated.duration_minutes || 10, 10)
      };

      return res.status(200).json({
        success: true,
        message: 'ডুপ্লিকেট অর্ডার প্রতিরোধ সেটিংস সফলভাবে সংরক্ষিত হয়েছে',
        config: normalizedUpdated
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[API admin-duplicate-config error]:', err.message);
    return res.status(400).json({
      success: false,
      error: err.message || 'Error processing request'
    });
  }
}
