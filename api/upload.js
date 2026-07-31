// Vercel serverless function — mirrors the Vite dev proxy so PDF uploads
// work in production without CORS issues (browser → this function → GAS).
import https from 'https';
import http from 'http';

function proxyPost(targetUrl, contentType, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const transport = parsed.protocol === 'https:' ? https : http;

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = transport.request(opts, (res) => {
      if ([301, 302, 303].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const loc = new URL(res.headers.location);
        const t2 = loc.protocol === 'https:' ? https : http;
        const g = t2.get(loc.href, (res2) => {
          const parts = [];
          res2.on('data', (c) => parts.push(c));
          res2.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
          res2.on('error', reject);
        });
        g.on('error', reject);
        return;
      }
      const parts = [];
      res.on('data', (c) => parts.push(c));
      res.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const scriptUrl = process.env.VITE_SCRIPT_URL;
  if (!scriptUrl) {
    res.status(500).json({ success: false, error: 'VITE_SCRIPT_URL is not configured.' });
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || 'text/plain;charset=utf-8';

    const text = await proxyPost(scriptUrl, contentType, body);

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const candidate = start !== -1 && end !== -1 ? text.slice(start, end + 1) : '';

    let parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      res.status(200).json({ success: false, error: 'Apps Script returned an unexpected response.' });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
