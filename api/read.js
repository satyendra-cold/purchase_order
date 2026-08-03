// Vercel serverless function — mirrors the Vite dev proxy for GET requests
import https from 'https';
import http from 'http';

function fetchFollowRedirects(targetUrl, depth = 0) {
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
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/json,*/*;q=0.8',
      },
    };

    const req = transport.request(opts, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const nextUrl = new URL(res.headers.location, targetUrl).href;
        return fetchFollowRedirects(nextUrl, depth + 1)
          .then(resolve)
          .catch(reject);
      }
      const parts = [];
      res.on('data', (c) => parts.push(c));
      res.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
      res.on('error', reject);
    });

    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const scriptUrl = (process.env.VITE_SCRIPT_URL || '').trim();
  if (!scriptUrl) {
    res.status(500).json({ success: false, error: 'VITE_SCRIPT_URL is not configured.' });
    return;
  }

  try {
    const urlObj = new URL(req.url, 'http://localhost');
    const fullTarget = scriptUrl + urlObj.search;

    const text = await fetchFollowRedirects(fullTarget);

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const candidate = start !== -1 && end !== -1 ? text.slice(start, end + 1) : '';

    let parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      res.status(200).json({
        success: false,
        error: 'Apps Script returned non-JSON. Ensure Web App deployment access is set to "Anyone".',
      });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(200).json({ success: false, error: err.message });
  }
}
