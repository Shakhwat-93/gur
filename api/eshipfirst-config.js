import { requireAdminAuth } from './_lib/adminAuthGuard.js';
import {
  getPublicConfig,
  saveConfig,
  testConnection,
  disconnectConfig,
  getLogs
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
      const [config, logs] = await Promise.all([getPublicConfig(), getLogs(20)]);
      return res.status(200).json({ success: true, config, logs });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = String(body.action || 'save').toLowerCase();

      if (action === 'test') {
        const testResult = await testConnection({
          api_key: body.api_key,
          secret_key: body.secret_key,
          base_url: body.base_url
        });
        const config = await getPublicConfig();
        return res.status(200).json({
          success: true,
          ...testResult,
          config
        });
      }

      if (action === 'disconnect') {
        const config = await disconnectConfig();
        return res.status(200).json({
          success: true,
          message: 'eShipFirst integration disconnected successfully.',
          config
        });
      }

      // Default action: save configuration & verify credentials dynamically
      const result = await saveConfig({
        is_enabled: body.is_enabled,
        auto_submit_on_confirm: body.auto_submit_on_confirm,
        api_key: body.api_key,
        secret_key: body.secret_key,
        base_url: body.base_url,
        default_delivery_charge: body.default_delivery_charge,
        default_pickup_address: body.default_pickup_address,
        webhook_token: body.webhook_token
      });

      return res.status(200).json({
        success: true,
        message: result.connection_test
          ? result.connection_test.connected
            ? 'Configuration saved and connected to eShipFirst!'
            : `Configuration saved, but connection failed: ${result.connection_test.message}`
          : 'Configuration saved.',
        config: result.config,
        connection_test: result.connection_test
      });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[API eshipfirst-config] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error handling eShipFirst configuration'
    });
  }
}
