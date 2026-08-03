// Vercel serverless function — mirrors the Vite dev proxy for POST requests
import https from 'https';
import http from 'http';

function fetchFollowRedirects(targetUrl, method = 'POST', contentType = null, body = null, depth = 0) {
  if (depth > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return reject(e);
    }
    const transport = parsed.protocol === 'https:' ? https : http;

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: method,
      headers: method === 'POST' && contentType && body ? {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(body),
      } : {},
    };

    const req = transport.request(opts, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const nextUrl = new URL(res.headers.location, targetUrl).href;
        // After initial POST, redirects follow with GET
        return fetchFollowRedirects(nextUrl, 'GET', null, null, depth + 1)
          .then(resolve)
          .catch(reject);
      }
      const parts = [];
      res.on('data', (c) => parts.push(c));
      res.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
      res.on('error', reject);
    });

    req.on('error', reject);
    if (method === 'POST' && body) {
      req.write(body);
    }
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

  const scriptUrl = (process.env.VITE_SCRIPT_URL || '').trim();
  if (!scriptUrl) {
    res.status(500).json({ success: false, error: 'VITE_SCRIPT_URL is not configured.' });
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || 'text/plain;charset=utf-8';

    const text = await fetchFollowRedirects(scriptUrl, 'POST', contentType, body);

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
    res.status(200).json({ success: false, error: err.message });
  }
}
