import { getSettings, saveSettings, testConnection } from './_lib/bdcourierService.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const config = await getSettings();
      return res.status(200).json({ success: true, config });
    }

    if (req.method === 'POST') {
      const { action, is_enabled, api_key } = req.body || {};

      if (action === 'test') {
        const testResult = await testConnection(api_key);
        return res.status(200).json({ success: true, ...testResult });
      }

      // Default action: save settings
      const updatedConfig = await saveSettings({
        is_enabled,
        api_key
      });

      return res.status(200).json({
        success: true,
        message: 'BD Courier settings saved successfully',
        config: updatedConfig
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[API admin-courier-config] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error processing settings'
    });
  }
}
