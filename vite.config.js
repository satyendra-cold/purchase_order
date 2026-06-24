import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import https from 'https'
import http from 'http'

// POST to Apps Script → Google returns 302 → we follow as GET to echo URL → JSON response
function proxyPost(targetUrl, contentType, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl)
    const transport = parsed.protocol === 'https:' ? https : http

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Content-Length': body.length,
      },
    }

    const req = transport.request(opts, (res) => {
      if ([301, 302, 303].includes(res.statusCode) && res.headers.location) {
        res.resume() // drain redirect body
        const loc = new URL(res.headers.location)
        const t2  = loc.protocol === 'https:' ? https : http
        const g   = t2.get(loc.href, (res2) => {
          const parts = []
          res2.on('data', c => parts.push(c))
          res2.on('end',  () => resolve(Buffer.concat(parts).toString('utf8')))
          res2.on('error', reject)
        })
        g.on('error', reject)
        return
      }
      const parts = []
      res.on('data',  c => parts.push(c))
      res.on('end',   () => resolve(Buffer.concat(parts).toString('utf8')))
      res.on('error', reject)
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const scriptUrl = env.VITE_SCRIPT_URL || ''

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Server-side POST proxy — avoids CORS for file uploads in dev
      {
        name: 'apps-script-post-proxy',
        configureServer(server) {
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
