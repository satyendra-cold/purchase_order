// Vercel serverless function — mirrors the Vite dev proxy for POST requests
// Uses native fetch() which handles redirects automatically and works reliably on Vercel

const SCRIPT_URL_FALLBACK =
  'https://script.google.com/macros/s/AKfycbxD549icyeMVBH7fzfba0nUDhGn4ZfjL3hv0AjMDp18zhT5zIo3Lp3JH9Mi5OQCHRcm/exec';

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

  const scriptUrl =
    (process.env.VITE_SCRIPT_URL || '').trim() || SCRIPT_URL_FALLBACK;

  try {
    // Read the incoming request body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || 'text/plain;charset=utf-8';

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body: body,
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
        '[api/upload] Non-JSON response (first 500 chars):',
        text.slice(0, 500)
      );
      res.status(200).json({
        success: false,
        error: 'Apps Script returned an unexpected response.',
      });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    console.error('[api/upload] fetch error:', err);
    res.status(200).json({ success: false, error: err.message });
  }
}
