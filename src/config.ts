export type AppConfig = {
  QHM_API_BASE_URL?: string
  DEBUG?: boolean
}

declare global {
  interface Window {
    __APP_CONFIG__?: AppConfig
  }
}

function normalizeBaseUrl(value: string | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

export function getAppConfig(): AppConfig {
  if (typeof window === 'undefined') return {}
  return window.__APP_CONFIG__ || {}
}

export function isDebugEnabled(): boolean {
  const cfg = getAppConfig()
  // Vite's DEV flag is compile-time; config.js is runtime.
  return Boolean(import.meta.env.DEV || cfg.DEBUG)
}

export function getQhmApiBaseUrl(): string {
  const cfg = getAppConfig()
  const fromRuntime = normalizeBaseUrl(cfg.QHM_API_BASE_URL)
  const fromBuild = normalizeBaseUrl(import.meta.env.VITE_QHM_API_BASE_URL as string | undefined)

  const resolved = fromRuntime || fromBuild

  // In production we intentionally do NOT silently fall back to Vercel:
  // if this isn't configured, we'd accidentally keep using the old endpoints.
  if (!resolved) {
    if (import.meta.env.DEV) {
      return 'https://queue-health-monitor.vercel.app'
    }
    throw new Error('Missing QHM_API_BASE_URL (set Cloud Run env var QHM_API_BASE_URL)')
  }

  return resolved
}

