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
  if (!trimmed) return null

  // Allow explicitly disabling clickjacking protection (use with care).
  // In CSP, `frame-ancestors *` means "allow any site to frame this page".
  if (trimmed === '*') return '*'

  // Support CSP wildcard patterns (e.g. https://*.sigmacomputing.com).
  if (trimmed.includes('*')) return trimmed

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return normalizeOrigin(trimmed)
  }

  // Support host-only values.
  return normalizeOrigin(`https://${trimmed}`)
}

function getAllowedFrameAncestors() {
  // This is a Sigma Computing plugin designed to be embedded in an iframe.
  // Sigma may load plugins through intermediate domains, so we allow all ancestors.
  return ['*']
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
// API Routes
// -------------------------
// Cache the Intercom admin data for 2 minutes to prevent inconsistent
// responses from the Intercom API causing status flickering.
let _tseCacheData = null
let _tseCacheExpiry = 0
const TSE_CACHE_TTL_MS = 2 * 60 * 1000

app.get('/api/intercom/available-tses', async (req, res) => {
  try {
    const now = Date.now()
    if (_tseCacheData && now < _tseCacheExpiry) {
      return res.json(_tseCacheData)
    }

    const apiKey = process.env.INTERCOM_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'INTERCOM_API_KEY is not configured on the server' })
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Intercom-Version': 'Unstable'
    }

    const reasonsRes = await fetch('https://api.intercom.io/away_status_reasons', { headers })
    if (!reasonsRes.ok) throw new Error(`Failed to fetch away reasons: ${reasonsRes.status}`)
    const reasonsData = await reasonsRes.json()

    const teamRes = await fetch('https://api.intercom.io/teams/5480079', { headers })
    if (!teamRes.ok) throw new Error(`Failed to fetch team: ${teamRes.status}`)
    const teamData = await teamRes.json()
    
    const adminIds = teamData.admin_ids || []
    
    const admins = []
    const chunkSize = 10
    
    for (let i = 0; i < adminIds.length; i += chunkSize) {
      const chunk = adminIds.slice(i, i + chunkSize)
      const promises = chunk.map(id => 
        fetch(`https://api.intercom.io/admins/${id}`, { headers })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
      const results = await Promise.all(promises)
      admins.push(...results.filter(Boolean))
    }

    const awayTimes = {}
    try {
      let page = 1
      const allLogs = []
      while (page <= 5) {
        const logRes = await fetch(`https://api.intercom.io/admins/activity_logs?per_page=100&page=${page}`, { headers })
        if (!logRes.ok) break
        const logData = await logRes.json()
        if (!logData.activity_logs || logData.activity_logs.length === 0) break
        allLogs.push(...logData.activity_logs)
        page++
      }
      
      allLogs.reverse().forEach(log => {
        if (log.activity_type === 'admin_away_mode_change') {
          const adminId = String(log.metadata?.update_by || log.performed_by?.id)
          if (log.metadata?.away_mode === true) {
            if (!awayTimes[adminId]) {
              awayTimes[adminId] = log.created_at
            }
          } else {
            awayTimes[adminId] = null
          }
        }
      })
    } catch (e) {
      console.warn("Could not fetch activity logs for minutes away:", e)
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    admins.forEach(admin => {
      if (admin.away_mode_enabled && awayTimes[admin.id]) {
        admin.minutes_away = Math.max(0, Math.floor((nowSeconds - awayTimes[admin.id]) / 60))
      } else {
        admin.minutes_away = null
      }
    })

    const payload = {
      admins: admins || [],
      awayReasons: reasonsData.data || [],
      cachedAt: new Date().toISOString(),
    }

    _tseCacheData = payload
    _tseCacheExpiry = now + TSE_CACHE_TTL_MS

    res.json(payload)
  } catch (err) {
    console.error('Error proxying Intercom API:', err)
    res.status(500).json({ error: 'Failed to fetch data from Intercom' })
  }
})

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

