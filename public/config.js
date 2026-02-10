// Dev/standalone default config.
// In Cloud Run, `/config.js` is served dynamically by `server.mjs`.
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {
  // Local dev fallback; production should set QHM_API_BASE_URL via Cloud Run env.
  QHM_API_BASE_URL: 'https://queue-health-monitor.vercel.app',
  DEBUG: true,
}

