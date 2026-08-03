import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import https from 'https'
import http from 'http'

function fetchFollowRedirects(targetUrl, method = 'GET', contentType = null, body = null, depth = 0) {
  if (depth > 5) return Promise.reject(new Error('Too many redirects'))
  return new Promise((resolve, reject) => {
    let parsed
    try {
      parsed = new URL(targetUrl)
    } catch (e) {
      return reject(e)
    }
    const transport = parsed.protocol === 'https:' ? https : http

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/json,*/*;q=0.8',
        ...(method === 'POST' && contentType && body ? {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(body),
        } : {})
      },
    }

    const req = transport.request(opts, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        const nextUrl = new URL(res.headers.location, targetUrl).href
        return fetchFollowRedirects(nextUrl, 'GET', null, null, depth + 1)
          .then(resolve)
          .catch(reject)
      }
      const parts = []
      res.on('data', c => parts.push(c))
      res.on('end',  () => resolve(Buffer.concat(parts).toString('utf8')))
      res.on('error', reject)
    })

    req.on('error', reject)
    if (method === 'POST' && body) {
      req.write(body)
    }
    req.end()
  })
}

const proxyGet = (url) => fetchFollowRedirects(url, 'GET')
const proxyPost = (url, type, body) => fetchFollowRedirects(url, 'POST', type, body)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const scriptUrl = env.VITE_SCRIPT_URL || ''

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Server-side GET & POST proxies — avoids CORS issues in dev
      {
        name: 'apps-script-proxy',
        configureServer(server) {
          server.middlewares.use('/api/read', (req, res) => {
            if (!scriptUrl) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'VITE_SCRIPT_URL is not configured.' }))
              return
            }

            const urlObj = new URL(req.url, 'http://localhost')
            const fullTarget = scriptUrl + urlObj.search

            proxyGet(fullTarget)
              .then(text => {
                const start = text.indexOf('{')
                const end   = text.lastIndexOf('}')
                const candidate = start !== -1 && end !== -1 ? text.slice(start, end + 1) : ''

                let parsed
                try {
                  parsed = JSON.parse(candidate)
                } catch {
                  console.error('[proxy GET] Google returned non-JSON (first 500 chars):', text.slice(0, 500))
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({
                    success: false,
                    error: 'Apps Script returned non-JSON. Ensure "Who has access" is set to "Anyone" in Web App deployment.'
                  }))
                  return
                }

                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200
                res.end(JSON.stringify(parsed))
              })
              .catch(err => {
                console.error('[proxy GET] proxyGet failed:', err.message)
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: err.message }))
              })
          })
          server.middlewares.use('/api/upload', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: 'Method not allowed' }))
              return
            }

            const chunks = []
            req.on('data',  chunk => chunks.push(chunk))
            req.on('error', err => {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: err.message }))
            })
            req.on('end', () => {
              const body        = Buffer.concat(chunks)
              const contentType = req.headers['content-type'] || 'application/x-www-form-urlencoded'

              if (!scriptUrl) {
                console.error('[proxy] VITE_SCRIPT_URL is not set — restart the dev server after creating .env')
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'VITE_SCRIPT_URL is not configured. Restart the dev server.' }))
                return
              }

              proxyPost(scriptUrl, contentType, body)
                .then(text => {
                  // Try to extract the outermost JSON object in case Google wraps it in HTML
                  const start = text.indexOf('{')
                  const end   = text.lastIndexOf('}')
                  const candidate = start !== -1 && end !== -1 ? text.slice(start, end + 1) : ''

                  let parsed
                  try {
                    parsed = JSON.parse(candidate)
                  } catch {
                    // Google returned non-JSON (HTML error page, timeout page, etc.)
                    console.error('[proxy] Google returned non-JSON response (first 500 chars):', text.slice(0, 500))
                    res.statusCode = 200
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ success: false, error: 'Apps Script returned an unexpected response. Check the server terminal for details.' }))
                    return
                  }

                  res.setHeader('Content-Type', 'application/json')
                  res.statusCode = 200
                  res.end(JSON.stringify(parsed))
                })
                .catch(err => {
                  console.error('[proxy] proxyPost failed:', err.message)
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: false, error: err.message }))
                })
            })
          })
        },
      },
    ],
    server: {
      port: 5173,
      strictPort: true,
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
  }
})
