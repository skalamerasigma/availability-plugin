import { useState, useEffect, useCallback } from 'react'
import { getQhmApiBaseUrl, isDebugEnabled } from '../config'

const API_BASE_URL = getQhmApiBaseUrl()
const LOG = isDebugEnabled()
const POLL_INTERVAL_MS = 10_000 // 10 seconds

export interface WebhookAwayStatusEntry {
  status: string
  updatedAt: number
}

export interface WebhookAwayStatus {
  byId: Record<string, WebhookAwayStatusEntry>
  byName: Record<string, WebhookAwayStatusEntry>
  fetchedAt?: string
}

/**
 * Fetches webhook-derived away statuses from the backend.
 * These override Sigma data for real-time display when admins change status in Intercom.
 */
export function useWebhookAwayStatus(enabled = true) {
  const [data, setData] = useState<WebhookAwayStatus>({ byId: {}, byName: {} })
  const [loading, setLoading] = useState(false)

  const fetchStatuses = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/intercom/away-status`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        if (res.status === 401 && LOG) {
          console.log('[useWebhookAwayStatus] Not authenticated, skipping')
        }
        return
      }
      const json = await res.json()
      setData({
        byId: json.byId || {},
        byName: json.byName || {},
        fetchedAt: json.fetchedAt,
      })
      if (LOG) {
        const nameCount = Object.keys(json.byName || {}).length
        console.log('[useWebhookAwayStatus] Fetched', nameCount, 'status entries')
      }
    } catch (err) {
      if (LOG) console.warn('[useWebhookAwayStatus] Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    fetchStatuses()
    if (!enabled) return
    const interval = setInterval(fetchStatuses, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchStatuses, enabled])

  return { data, loading, refetch: fetchStatuses }
}
