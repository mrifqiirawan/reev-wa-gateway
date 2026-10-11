/** Node.js backend only. Never embed API keys in Flutter/browser bundles. */
export async function sendReevWA(recipient, message) {
  const origin = process.env.REEV_GATEWAY_URL?.replace(/\/+$/, '');
  const apiKey = process.env.REEV_API_KEY;
  if (!origin || !apiKey) throw new Error('Set REEV_GATEWAY_URL and REEV_API_KEY');
  const response = await fetch(origin + '/api/messages/send', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: {'Content-Type':'application/json', Authorization:'Bearer '+apiKey},
    body: JSON.stringify({recipient, message, deviceId:'device_primary'})
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || 'HTTP '+response.status);
  return data;
}
