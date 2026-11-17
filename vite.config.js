import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

function localApiMiddleware() {
  return {
    name: 'local-vercel-api-middleware',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        try {
          const parsedUrl = new URL(req.url || '/', 'http://localhost')
          const routeName = parsedUrl.pathname.replace(/^\/+|\/+$/g, '')
          if (!routeName || routeName.includes('..') || routeName.startsWith('_')) {
            return next()
          }

          const filePath = path.resolve(process.cwd(), 'api', `${routeName}.js`)
          if (!fs.existsSync(filePath)) {
            return next()
          }

          // Parse query params
          const query = {}
          for (const [k, v] of parsedUrl.searchParams.entries()) {
            query[k] = v
          }
          req.query = query

          // Parse JSON body for POST/PUT/PATCH
          if (['POST', 'PUT', 'PATCH'].includes((req.method || '').toUpperCase())) {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            const rawBody = Buffer.concat(chunks).toString('utf8')
            try {
              req.body = rawBody ? JSON.parse(rawBody) : {}
            } catch {
              req.body = {}
            }
          }

          // Add Vercel-compatible response helpers
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (payload) => {
            if (!res.getHeader('Content-Type')) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
            }
            res.end(JSON.stringify(payload))
            return res
          }

          // Dynamically import handler (cache-busted by mtime for smooth local dev)
          const stat = fs.statSync(filePath)
          const mod = await import(`${pathToFileURL(filePath).href}?t=${stat.mtimeMs}`)
          if (typeof mod.default === 'function') {
            await mod.default(req, res)
            return
          }
          next()
        } catch (err) {
          console.error('[Vite API Middleware] Error:', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ success: false, error: err.message || 'Local API middleware error' }))
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), localApiMiddleware()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          motion: ['animejs'],
          icons: ['lucide-react']
        }
      }
    }
  }
})
