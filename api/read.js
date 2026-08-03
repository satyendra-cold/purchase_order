// Vercel serverless function — mirrors the Vite dev proxy for GET requests
// Uses native fetch() which handles redirects automatically and works reliably on Vercel

const SCRIPT_URL_FALLBACK =
  'https://script.google.com/macros/s/AKfycbw29a7GH4YEEVSsZLRvFGmN89CBaz66HSfVw-8-S6KkfyDjUUTgA7XYrfaVyr5affalaA/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const scriptUrl =
    (process.env.VITE_SCRIPT_URL || '').trim() || SCRIPT_URL_FALLBACK;

  try {
    const urlObj = new URL(req.url, 'http://localhost');
    // Ensure the action=read param is present (Apps Script needs it)
    if (!urlObj.searchParams.has('action')) {
      urlObj.searchParams.set('action', 'read');
    }
    const fullTarget = scriptUrl + '?' + urlObj.searchParams.toString();

    const response = await fetch(fullTarget, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/html, */*',
      },
      redirect: 'follow', // automatically follow Google's 302 redirects
    });

    const text = await response.text();

    // Google sometimes wraps JSON in HTML — extract the outermost JSON object
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const candidate =
      start !== -1 && end !== -1 ? text.slice(start, end + 1) : '';

    let parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      console.error(
        '[api/read] Non-JSON response (first 500 chars):',
        text.slice(0, 500)
      );
      res.status(200).json({
        success: false,
        error:
          'Apps Script returned non-JSON. Ensure Web App deployment access is set to "Anyone".',
      });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    console.error('[api/read] fetch error:', err);
    res.status(200).json({ success: false, error: err.message });
  }
}
