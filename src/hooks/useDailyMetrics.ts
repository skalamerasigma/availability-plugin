import { useState, useEffect, useCallback } from 'react'

// API base URL - always use queue-health-monitor since that's where the API is deployed
const API_BASE_URL = 'https://queue-health-monitor.vercel.app'

export interface DailyMetrics {
  chatsToday: number
  closedToday: number
  date: string
  timestamp: string
}

export interface UseDailyMetricsState {
  metrics: DailyMetrics | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

export interface UseDailyMetricsOptions {
  /** Refresh interval in milliseconds (default: 60000 = 1 minute) */
  refreshInterval?: number
  /** Whether to automatically refresh */
  autoRefresh?: boolean
}

/**
 * Hook to fetch daily metrics (chats today, closed today) using fast Intercom search
 * This is much faster than fetching all conversations and filtering client-side
 */
export function useDailyMetrics(options: UseDailyMetricsOptions = {}) {
  const {
    refreshInterval = 60000, // 1 minute default (faster refresh for real-time metrics)
    autoRefresh = true,
  } = options

  const [state, setState] = useState<UseDailyMetricsState>({
    metrics: null,
    loading: true,
    error: null,
    lastUpdated: null,
  })

  const fetchMetrics = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setState(prev => ({ ...prev, loading: true, error: null }))
    }

    // On localhost, return mock data for demo purposes
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    )

    if (isLocalhost) {
      console.log('[useDailyMetrics] Localhost detected, returning mock data')
      setState({
        metrics: {
          chatsToday: 47,
          closedToday: 32,
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date().toISOString(),
        },
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
      return
    }

    try {
      const apiUrl = `${API_BASE_URL}/api/intercom/conversations/daily-metrics`
      console.log('[useDailyMetrics] Fetching from:', apiUrl)
      const fetchStartTime = performance.now()

      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      })

      const fetchDuration = performance.now() - fetchStartTime
      console.log(`[useDailyMetrics] API call took ${Math.round(fetchDuration)}ms`)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `HTTP ${response.status}`)
      }

      const data = await response.json()
      
      console.log('[useDailyMetrics] Received metrics:', data)

      setState({
        metrics: {
          chatsToday: data.chatsToday ?? 0,
          closedToday: data.closedToday ?? 0,
          date: data.date,
          timestamp: data.timestamp,
        },
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch (error) {
      console.error('[useDailyMetrics] Error fetching metrics:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch daily metrics',
      }))
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchMetrics(true)
  }, [fetchMetrics])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return

    const interval = setInterval(() => {
      console.log('[useDailyMetrics] Auto-refreshing metrics...')
      fetchMetrics(false) // Background refresh without loading state
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchMetrics])

  // Manual refresh function
  const refresh = useCallback(() => {
    return fetchMetrics(true)
  }, [fetchMetrics])

  return {
    ...state,
    refresh,
  }
}

export default useDailyMetrics
