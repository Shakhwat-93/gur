import { requireAdminAuth } from './_lib/adminAuthGuard.js';
import {
  listAllParcels,
  createParcelForOrder,
  refreshParcelStatus,
  getParcelTrackingDetails,
  getLiveCourierStats,
  getParcelStateList,
  createPickupRequest,
  createReturnRequest,
  getReturnRequests,
  getPayments,
  getFraudCheckScore,
  getLogs,
  getPublicConfig
} from './_lib/eshipfirstService.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const auth = requireAdminAuth(req, res);
  if (!auth) return;

  try {
    if (req.method === 'GET') {
      const q = req.query || {};
      const action = String(q.action || 'parcels').toLowerCase();

      switch (action) {
        case 'parcels': {
          const [result, config] = await Promise.all([listAllParcels(), getPublicConfig()]);
          return res.status(200).json({
            success: true,
            parcels: result.parcels,
            stats: result.stats,
            config
          });
        }

        case 'stats': {
          const live = await getLiveCourierStats();
          return res.status(200).json(live);
        }

        case 'parcel_states': {
          const data = await getParcelStateList(q.state || '');
          return res.status(200).json(data);
        }

        case 'track': {
          const data = await getParcelTrackingDetails({
            invoice: q.invoice || '',
            consignmentId: q.consignment_id || '',
            trackingCode: q.tracking_code || ''
          });
          return res.status(200).json(data);
        }

        case 'payments': {
          const data = await getPayments(q.payment_id || '');
          return res.status(200).json(data);
        }

        case 'return_requests': {
          const data = await getReturnRequests(q.id || '');
          return res.status(200).json(data);
        }

        case 'fraud_score': {
          const data = await getFraudCheckScore(q.phone || '');
          return res.status(200).json(data);
        }

        case 'logs': {
          const limit = Math.min(120, Math.max(10, parseInt(q.limit, 10) || 60));
          const logs = await getLogs(limit);
          return res.status(200).json({ success: true, logs });
        }

        default:
          return res.status(400).json({ success: false, error: `Unknown GET action: ${action}` });
      }
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = String(body.action || '').toLowerCase();

      switch (action) {
        case 'create_order': {
          const result = await createParcelForOrder({
            orderId: body.order_id,
            orderSnapshot: body.order || null,
            forceRetry: Boolean(body.force_retry)
          });
          const statusCode = result.success || result.skipped ? 200 : result.httpStatus && result.httpStatus >= 400 ? result.httpStatus : 400;
          return res.status(statusCode).json(result);
        }

        case 'refresh_status': {
          const result = await refreshParcelStatus({
            orderId: body.order_id,
            consignmentId: body.consignment_id,
            trackingCode: body.tracking_code,
            invoice: body.invoice
          });
          return res.status(result.success ? 200 : 400).json(result);
        }

        case 'bulk_refresh': {
          const items = Array.isArray(body.parcels) ? body.parcels.slice(0, 25) : [];
          const results = [];
          for (const item of items) {
            const r = await refreshParcelStatus({
              orderId: item.order_id,
              consignmentId: item.consignment_id,
              trackingCode: item.tracking_code,
              invoice: item.invoice
            });
            results.push({
              order_id: item.order_id,
              consignment_id: item.consignment_id,
              ...r
            });
          }
          return res.status(200).json({
            success: true,
            refreshed_count: results.filter((r) => r.success && !r.cached).length,
            cached_count: results.filter((r) => r.cached).length,
            failed_count: results.filter((r) => !r.success).length,
            results
          });
        }

        case 'create_pickup_request': {
          const result = await createPickupRequest(body.payload || body);
          return res.status(result.success ? 200 : 400).json(result);
        }

        case 'create_return_request': {
          const result = await createReturnRequest(body.payload || body);
          return res.status(result.success ? 200 : 400).json(result);
        }

        default:
          return res.status(400).json({ success: false, error: `Unknown POST action: ${action}` });
      }
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[API eshipfirst] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error processing eShipFirst request'
    });
  }
}
