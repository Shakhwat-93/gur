import { performCourierCheck } from './_lib/bdcourierService.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { normalizeBdPhone, isValidBdPhone } from '../src/lib/phoneNormalizer.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch cached record(s) from Supabase
  if (req.method === 'GET') {
    try {
      const { phone } = req.query || {};

      if (phone) {
        const canonical = normalizeBdPhone(phone);
        const { data: record, error } = await supabaseAdmin
          .from('bdcourier_checks')
          .select('*')
          .eq('phone', canonical)
          .maybeSingle();

        if (error) throw error;
        return res.status(200).json({ success: true, record });
      }

      // Return overview map of checks for admin orders list
      const { data: allChecks, error } = await supabaseAdmin
        .from('bdcourier_checks')
        .select('id, phone, status, data, created_at, completed_at, error');

      if (error) throw error;
      return res.status(200).json({ success: true, checks: allChecks || [] });
    } catch (err) {
      console.error('[API courier-check GET] Error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST: Execute lookup with strict atomic deduplication and permanent cache
  if (req.method === 'POST') {
    const { phone, orderId } = req.body || {};

    if (!phone) {
      return res.status(400).json({ error: 'Missing phone number' });
    }

    const normalizedPhone = normalizeBdPhone(phone);
    if (!isValidBdPhone(normalizedPhone)) {
      return res.status(400).json({
        error: 'Invalid Bangladeshi phone number. Must be 11 digits starting with 01.'
      });
    }

    try {
      const result = await performCourierCheck({ phone: normalizedPhone, orderId });
      return res.status(200).json(result);
    } catch (err) {
      console.error('[API courier-check POST] Exception:', err.message);
      return res.status(500).json({
        success: false,
        status: 'error',
        error: 'An internal error occurred during courier lookup'
      });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
