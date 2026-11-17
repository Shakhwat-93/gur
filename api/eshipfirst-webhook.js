import { verifyWebhookBearer, processWebhookEvent } from './_lib/eshipfirstService.js';

/**
 * eShipFirst / Packzy Webhook Receiver
 * Verifies Authorization: Bearer <token> configured in Admin Courier Settings.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const verification = await verifyWebhookBearer(authHeader);

    if (!verification.valid) {
      return res.status(401).json({
        status: 'error',
        message: verification.reason || 'Unauthorized webhook request'
      });
    }

    const payload = req.body || {};
    const result = await processWebhookEvent(payload);

    return res.status(200).json({
      status: 'success',
      message: result.matched
        ? 'Webhook processed and parcel synchronized.'
        : 'Webhook received (no local parcel matched).'
    });
  } catch (err) {
    console.error('[API eshipfirst-webhook] Error:', err.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process webhook payload'
    });
  }
}
