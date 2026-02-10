/**
 * Cloud Run production server (ESM).
 * - Serves the Vite build output.
 * - Provides a small runtime config endpoint (/config.js).
 */

import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.set('trust proxy', 1)

const PORT = Number(process.env.PORT || 8080)

// -------------------------
// Security headers / CSP
// -------------------------

function getRequestProtocol(req) {
  const forwardedProto = req.headers['x-forwarded-proto']
  if (typeof forwardedProto === 'string' && forwardedProto.length > 0) {
    return forwardedProto.split(',')[0].trim()
  }
  return 'http'
}

function applyBaseSecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // Only set HSTS when we know we're behind HTTPS.
  if (getRequestProtocol(req) === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

function normalizeOrigin(value) {
  if (!value || typeof value !== 'string') return null
  try {
    const parsed = new URL(value)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

function normalizeConfiguredOrigin(value) {
  if (!value || typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed || trimmed === '*') return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return normalizeOrigin(trimmed)
  }

  // Support host-only values.
  return normalizeOrigin(`https://${trimmed}`)
}

function getAllowedFrameAncestors() {
  const configured = (process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((value) => normalizeConfiguredOrigin(value))
    .filter(Boolean)

  const fallback = configured.length > 0 ? [] : ['https://app.sigmacomputing.com']
  const localDev =
    process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']

  return ["'self'", ...new Set([...configured, ...fallback, ...localDev])]
}

function buildCsp(req) {
  const qhmBase = normalizeOrigin(process.env.QHM_API_BASE_URL) // queue-health-monitor (Cloud Run)

  const frameAncestors = getAllowedFrameAncestors()

  const connectSrc = ["'self'"]
  if (qhmBase) connectSrc.push(qhmBase)

  // NOTE: We keep style-src 'unsafe-inline' because the app uses many inline styles.
  // Avoid script-src unsafe-inline/unsafe-eval to preserve XSS protections.
  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors ${frameAncestors.join(' ')}`,
    `script-src 'self'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https://res.cloudinary.com https://static.intercomassets.com https://i.pravatar.cc https://ca.slack-edge.com`,
    `connect-src ${connectSrc.join(' ')}`,
  ]

  return directives.join('; ')
}

app.use((req, res, next) => {
  applyBaseSecurityHeaders(req, res)
  res.setHeader('Content-Security-Policy', buildCsp(req))
  next()
})

// Body parsing (needed for /api/*)
app.use(express.json({ limit: '1mb' }))

// -------------------------
// Runtime config endpoint
// -------------------------

function getRuntimeConfig() {
  const cfg = {
    QHM_API_BASE_URL: process.env.QHM_API_BASE_URL || '',
    DEBUG: process.env.DEBUG === '1' || process.env.DEBUG === 'true',
  }
  return cfg
}

app.get('/config.js', (req, res) => {
  const cfg = getRuntimeConfig()
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.send(`window.__APP_CONFIG__ = ${JSON.stringify(cfg)};`)
})

// -------------------------
// Static assets + SPA routes
// -------------------------

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'support-queue-live' })
})

const rootDistDir = join(__dirname, 'dist')
app.use('/assets', express.static(join(rootDistDir, 'assets'), { maxAge: '1y', immutable: true }))

// Serve everything else from dist with conservative caching. We rely on hashed /assets/*
// filenames for long-term caching; HTML should never be cached.
app.use(
  express.static(rootDistDir, {
    maxAge: 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store')
      } else {
        res.setHeader('Cache-Control', 'no-cache')
      }
    },
  })
)

app.get('*', (req, res) => {
  // API routes should never fall through to SPA.
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' })
  // /config.js is handled explicitly above.

  res.setHeader('Cache-Control', 'no-store')
  res.sendFile(join(rootDistDir, 'index.html'), (err) => {
    if (err) {
      res.status(500).send('Error serving application')
    }
  })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

