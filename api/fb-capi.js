// Vercel Serverless Function: Facebook Conversions API (CAPI) Proxy
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { pixelId, accessToken, payload } = req.body || {};

  if (!pixelId || !accessToken || !payload) {
    return res.status(400).json({ error: 'Missing pixelId, accessToken, or payload' });
  }

  try {
    // Inject client IP address and User Agent from request headers
    const clientIp =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    const clientUserAgent = req.headers['user-agent'];

    if (payload.data && Array.isArray(payload.data)) {
      payload.data = payload.data.map((item) => ({
        ...item,
        user_data: {
          ...item.user_data,
          client_ip_address: clientIp,
          client_user_agent: clientUserAgent || item.user_data?.client_user_agent
        }
      }));
    }

    const graphUrl = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`;
    const fbResponse = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const fbData = await fbResponse.json();

    if (!fbResponse.ok) {
      console.error('[CAPI Server] Meta Error:', fbData);
      return res.status(fbResponse.status).json(fbData);
    }

    return res.status(200).json({ success: true, ...fbData });
  } catch (error) {
    console.error('[CAPI Server] Unexpected Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
