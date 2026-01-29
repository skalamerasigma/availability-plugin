import { useState, useEffect, useCallback } from 'react'

// API base URL - always use queue-health-monitor since that's where the API is deployed
// The status-plugin is a separate deployment that consumes this API
const getApiBaseUrl = () => {
  // Always use the queue-health-monitor API regardless of where this plugin is hosted
  return 'https://queue-health-monitor.vercel.app'
}

const API_BASE_URL = getApiBaseUrl()

export interface IntercomConversation {
  id: string
  conversation_id?: string
  state: 'open' | 'snoozed' | 'closed'
  admin_assignee_id?: string | number | null
  admin_assignee?: {
    id: string | number
    name?: string
    email?: string
  } | null
  team_assignee_id?: string | number
  created_at?: number
  updated_at?: number
  closed_at?: number
  snoozed_until?: number
  waiting_since?: number
  tags?: Array<{ name: string } | string>
  custom_attributes?: Record<string, any>
  source?: {
    title?: string
    author?: {
      name?: string
      email?: string
    }
  }
  statistics?: {
    state?: string
    last_close_at?: number
    last_admin_reply_at?: number
    first_admin_reply_at?: number
  }
}

export interface IntercomTeamMember {
  id: string | number
  name: string
  email?: string
  avatar?: {
    image_url?: string
  }
  type?: string
}

export interface IntercomDataState {
  conversations: IntercomConversation[]
  teamMembers: IntercomTeamMember[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

export interface UseIntercomDataOptions {
  /** Whether to skip closed conversations in initial fetch (faster load) */
  skipClosed?: boolean
  /** Whether to fetch only closed conversations */
  closedOnly?: boolean
  /** Refresh interval in milliseconds (default: 120000 = 2 minutes) */
  refreshInterval?: number
  /** Whether to automatically refresh */
  autoRefresh?: boolean
  /** Enable debug mode for API */
  debug?: boolean
}

/**
 * Hook to fetch conversation and team member data from the Intercom API
 * Uses the same endpoint as queue-health-monitor-plugin: /api/intercom/conversations/open-team-5480079
 * 
 * @param options Configuration options
 * @returns Conversations, team members, loading state, error, and refresh function
 */
export function useIntercomData(options: UseIntercomDataOptions = {}) {
  const {
    skipClosed = false,
    closedOnly = false,
    refreshInterval = 120000, // 2 minutes default (matches queue-health-monitor)
    autoRefresh = true,
    debug = false,
  } = options

  const [state, setState] = useState<IntercomDataState>({
    conversations: [],
    teamMembers: [],
    loading: true,
    error: null,
    lastUpdated: null,
  })

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setState(prev => ({ ...prev, loading: true, error: null }))
    }

    try {
      // Build API URL with query parameters
      const params = new URLSearchParams()
      if (skipClosed) params.append('skipClosed', 'true')
      if (closedOnly) params.append('closedOnly', 'true')
      if (debug) params.append('debug', '1')
      
      const queryString = params.toString()
      const apiUrl = `${API_BASE_URL}/api/intercom/conversations/open-team-5480079${queryString ? `?${queryString}` : ''}`
      
      console.log('[useIntercomData] Fetching from:', apiUrl)
      const fetchStartTime = performance.now()

      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include', // Important: include cookies for auth
        headers: {
          'Accept': 'application/json',
        },
      })

      const fetchDuration = performance.now() - fetchStartTime
      console.log(`[useIntercomData] API call took ${Math.round(fetchDuration)}ms`)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `HTTP ${response.status}`)
      }

      const data = await response.json()
      
      // Handle both array format (legacy) and object format (current)
      const conversations: IntercomConversation[] = Array.isArray(data) 
        ? data 
        : (data.conversations || [])
      const teamMembers: IntercomTeamMember[] = data.teamMembers || []

      console.log(`[useIntercomData] Received ${conversations.length} conversations, ${teamMembers.length} team members`)
      
      // Log state breakdown
      const stateCounts = conversations.reduce((acc, conv) => {
        const convState = (conv.state || 'unknown').toLowerCase()
        acc[convState] = (acc[convState] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      console.log('[useIntercomData] Conversation states:', stateCounts)

      setState({
        conversations,
        teamMembers,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch (error) {
      console.error('[useIntercomData] Error fetching data:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Intercom data',
      }))
    }
  }, [skipClosed, closedOnly, debug])

  // Initial fetch
  useEffect(() => {
    fetchData(true)
  }, [fetchData])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return

    const interval = setInterval(() => {
      console.log('[useIntercomData] Auto-refreshing data...')
      fetchData(false) // Background refresh without loading state
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchData])

  // Manual refresh function
  const refresh = useCallback(() => {
    return fetchData(true)
  }, [fetchData])

  return {
    ...state,
    refresh,
  }
}

/**
 * Get conversations filtered by TSE (admin assignee)
 */
export function filterConversationsByTSE(
  conversations: IntercomConversation[],
  tseId: string | number
): IntercomConversation[] {
  return conversations.filter(conv => {
    const convTseId = conv.admin_assignee_id || 
      (conv.admin_assignee && typeof conv.admin_assignee === 'object' ? conv.admin_assignee.id : null)
    return String(convTseId) === String(tseId)
  })
}

/**
 * Get conversations by state
 */
export function filterConversationsByState(
  conversations: IntercomConversation[],
  states: Array<'open' | 'snoozed' | 'closed'>
): IntercomConversation[] {
  return conversations.filter(conv => {
    const convState = (conv.state || 'open').toLowerCase() as 'open' | 'snoozed' | 'closed'
    return states.includes(convState)
  })
}

/**
 * Get conversations with specific snooze workflow
 * Checks custom_attributes["Last Snooze Workflow Used"] AND ensures conversation is snoozed
 */
export function filterConversationsByWorkflow(
  conversations: IntercomConversation[],
  workflow: 'Waiting On TSE - Deep Dive' | 'Waiting On Customer - Resolved' | 'Waiting On Customer - Unresolved'
): IntercomConversation[] {
  return conversations.filter(conv => {
    // First check if conversation is actually snoozed
    const isSnoozed = conv.state === 'snoozed' || conv.snoozed_until
    if (!isSnoozed) return false
    
    // Then check the workflow
    const customAttributes = conv.custom_attributes || {}
    const lastSnoozeWorkflow = customAttributes['Last Snooze Workflow Used']
    return lastSnoozeWorkflow === workflow
  })
}

/**
 * Calculate TSE metrics from conversations (matches queue-health-monitor-plugin logic)
 */
export function calculateTSEMetrics(conversations: IntercomConversation[]) {
  const THRESHOLDS = {
    MAX_OPEN_SOFT: 5,
    MAX_WAITING_ON_TSE_SOFT: 5,
    MAX_OPEN_ALERT: 6,
    MAX_WAITING_ON_TSE_ALERT: 7,
  }

  let open = 0
  let waitingOnTSE = 0
  let waitingOnCustomerResolved = 0
  let waitingOnCustomerUnresolved = 0
  let totalSnoozed = 0

  conversations.forEach(conv => {
    const isSnoozed = conv.state === 'snoozed' || conv.snoozed_until
    const customAttributes = conv.custom_attributes || {}
    const lastSnoozeWorkflow = customAttributes['Last Snooze Workflow Used']

    if (conv.state === 'open' && !isSnoozed) {
      open++
    } else if (isSnoozed) {
      totalSnoozed++
      if (lastSnoozeWorkflow === 'Waiting On TSE - Deep Dive') {
        waitingOnTSE++
      } else if (lastSnoozeWorkflow === 'Waiting On Customer - Resolved') {
        waitingOnCustomerResolved++
      } else if (lastSnoozeWorkflow === 'Waiting On Customer - Unresolved') {
        waitingOnCustomerUnresolved++
      }
    }
  })

  const meetsOpen = open <= THRESHOLDS.MAX_OPEN_SOFT
  const meetsWaitingOnTSE = waitingOnTSE <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT
  const isOnTrack = meetsOpen && meetsWaitingOnTSE

  let status: 'on-track' | 'over-limit' = 'on-track'
  if (open >= THRESHOLDS.MAX_OPEN_ALERT || waitingOnTSE >= THRESHOLDS.MAX_WAITING_ON_TSE_ALERT) {
    status = 'over-limit'
  } else if (!isOnTrack) {
    status = 'over-limit'
  }

  return {
    open,
    waitingOnTSE,
    waitingOnCustomerResolved,
    waitingOnCustomerUnresolved,
    totalSnoozed,
    status,
    isOnTrack,
    meetsOpen,
    meetsWaitingOnTSE,
    thresholds: THRESHOLDS,
  }
}

/**
 * Find team member by ID
 */
export function findTeamMemberById(
  teamMembers: IntercomTeamMember[],
  id: string | number
): IntercomTeamMember | undefined {
  return teamMembers.find(member => String(member.id) === String(id))
}

/**
 * Find team member by email (case-insensitive)
 */
export function findTeamMemberByEmail(
  teamMembers: IntercomTeamMember[],
  email: string
): IntercomTeamMember | undefined {
  const normalizedEmail = email.toLowerCase()
  return teamMembers.find(member => 
    member.email && member.email.toLowerCase() === normalizedEmail
  )
}

export default useIntercomData
