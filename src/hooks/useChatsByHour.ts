import { useState, useEffect, useCallback } from 'react'
import { getQhmApiBaseUrl, isDebugEnabled } from '../config'

const API_BASE_URL = getQhmApiBaseUrl()
const LOG = isDebugEnabled()

export interface ChatsByHourEntry {
  hour: number   // ET hour (0-23)
  count: number
}

export interface UseChatsByHourState {
  chatsByHour: ChatsByHourEntry[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

export interface UseChatsByHourOptions {
  /** Refresh interval in milliseconds (default: 60000 = 1 minute) */
  refreshInterval?: number
  /** Whether to automatically refresh */
  autoRefresh?: boolean
}

/**
 * Hook to fetch today's chats grouped by ET hour from the Intercom API.
 * Refreshes on the same cadence as useDailyMetrics (1 minute by default).
 */
export function useChatsByHour(options: UseChatsByHourOptions = {}) {
  const {
    refreshInterval = 60000,
    autoRefresh = true,
  } = options

  const [state, setState] = useState<UseChatsByHourState>({
    chatsByHour: [],
    loading: true,
    error: null,
    lastUpdated: null,
  })

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setState(prev => ({ ...prev, loading: true, error: null }))
    }

    // On localhost, return mock data
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    )

    if (isLocalhost) {
      if (LOG) console.log('[useChatsByHour] Localhost detected, returning mock data')
      // Mock data in ET hours
      setState({
        chatsByHour: [
          { hour: 5, count: 2 }, { hour: 6, count: 8 }, { hour: 7, count: 5 },
          { hour: 8, count: 12 }, { hour: 9, count: 18 }, { hour: 10, count: 25 },
          { hour: 11, count: 22 }, { hour: 12, count: 15 },
        ],
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
      return
    }

    try {
      const apiUrl = `${API_BASE_URL}/api/intercom/conversations/chats-by-hour`
      if (LOG) console.log('[useChatsByHour] Fetching from:', apiUrl)
      const fetchStartTime = performance.now()

      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      })

      const fetchDuration = performance.now() - fetchStartTime
      if (LOG) console.log(`[useChatsByHour] API call took ${Math.round(fetchDuration)}ms`)

      if (response.status === 401) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'AUTH_REQUIRED',
        }))
        return
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `HTTP ${response.status}`)
      }

      const data = await response.json()

      if (LOG) console.log('[useChatsByHour] Received data:', data)

      setState({
        chatsByHour: (data.chatsByHour || []).map((d: { hour: number; count: number }) => ({
          hour: d.hour,
          count: d.count,
        })),
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch (error) {
      if (LOG) console.error('[useChatsByHour] Error:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch chats by hour',
      }))
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchData(true)
  }, [fetchData])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return
    const interval = setInterval(() => {
      if (LOG) console.log('[useChatsByHour] Auto-refreshing...')
      fetchData(false)
    }, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchData])

  const refresh = useCallback(() => fetchData(true), [fetchData])

  return { ...state, refresh }
}

export default useChatsByHour
