import { processOrderSubmission } from './_lib/duplicateProtectionService.js';
import { performCourierCheck, getSettings as getCourierSettings } from './_lib/bdcourierService.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const result = await processOrderSubmission(req.body, req);

    if (result.isBlocked) {
      // 429 Too Many Requests with customer-friendly Bengali message
      return res.status(result.statusCode || 429).json(result.response);
    }

    const createdOrder = result.response.order;

    // Asynchronously trigger BD Courier check ONLY if order succeeded and courier integration is active
    if (createdOrder && !result.response.is_idempotent_replay) {
      getCourierSettings().then((courierCfg) => {
        if (courierCfg?.is_enabled && courierCfg?.has_key) {
          performCourierCheck({
            phone: createdOrder.phone,
            orderId: createdOrder.order_id
          }).catch((err) => {
            console.warn('[Auto-Courier-Check background error]:', err.message);
          });
        }
      }).catch(() => {});
    }

    return res.status(200).json(result.response);
  } catch (err) {
    console.error('[API /api/orders error]:', err);
    const statusCode = err.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message || 'অর্ডার সম্পন্ন করতে সমস্যা হয়েছে।'
    });
  }
}
