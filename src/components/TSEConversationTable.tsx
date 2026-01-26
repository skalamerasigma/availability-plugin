import { useState, useEffect, useMemo, useCallback } from 'react'
import { TEAM_MEMBERS } from '../data/teamMembers'

interface TSEConversationData {
  tseName: string
  openCount: number
  snoozedCount: number
  closedCount: number
  chatsTakenCount: number
}

// Intercom conversation type (from useIntercomData hook)
interface IntercomConversation {
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
  statistics?: {
    state?: string
    last_close_at?: number
    last_admin_reply_at?: number
    first_admin_reply_at?: number
  }
}

interface IntercomTeamMember {
  id: string | number
  name: string
  email?: string
}

interface TSEConversationTableProps {
  conversationData?: Record<string, any[]> | null | undefined
  conversationColumns?: Record<string, { name: string }> | undefined
  tseColumn?: string
  openColumn?: string
  snoozedColumn?: string
  closedColumn?: string
  // New props for Intercom data integration
  intercomConversations?: IntercomConversation[]
  intercomTeamMembers?: IntercomTeamMember[]
  lastUpdated?: Date | null
}

// TSEs to exclude from the table
const EXCLUDED_TSE_NAMES = [
  'Stephen',
  'Grace',
  'Zen',
  'Chetana',
  'Chetana Shinde',
  'svc-prd-tse-intercom SVC',
  'TSE 6519361',
  'Zen Junior',
]

/**
 * Extract first name from a full name
 */
function getFirstName(fullName: string): string {
  if (!fullName) return fullName
  return fullName.split(' ')[0]
}

/**
 * Check if a conversation has a "waiting on customer" tag
 * These should be excluded from the snoozed count
 */
function hasWaitingOnCustomerTag(conv: IntercomConversation): boolean {
  const tags = conv.tags || []
  return tags.some(tag => {
    const tagName = typeof tag === 'string' ? tag : tag.name
    if (!tagName) return false
    const lowerTag = tagName.toLowerCase()
    return lowerTag === 'snooze.waiting-on-customer-resolved' || 
           lowerTag === 'snooze.waiting-on-customer-unresolved'
  })
}

/**
 * Check if a timestamp is from today (in PT timezone)
 */
function isToday(timestamp: number | undefined): boolean {
  if (!timestamp) return false
  
  // Convert to milliseconds if needed
  const timestampMs = timestamp > 1e12 ? timestamp : timestamp * 1000
  const date = new Date(timestampMs)
  
  // Get today's date in PT timezone
  const now = new Date()
  const ptFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  
  const todayPT = ptFormatter.format(now)
  const datePT = ptFormatter.format(date)
  
  return todayPT === datePT
}

/**
 * Check if a conversation was closed today (in PT timezone)
 */
function isClosedToday(conv: IntercomConversation): boolean {
  return isToday(conv.closed_at)
}

/**
 * Check if a conversation was "taken" today
 * A chat is "taken" if it was created today AND has an admin reply today
 */
function isChatTakenToday(conv: IntercomConversation): boolean {
  const createdToday = isToday(conv.created_at)
  if (!createdToday) return false
  
  // Check if there's an admin reply (first or last)
  const adminReplyAt = conv.statistics?.first_admin_reply_at || conv.statistics?.last_admin_reply_at
  const repliedToday = isToday(adminReplyAt)
  
  return repliedToday
}

/**
 * Calculate TSE counts from Intercom conversations
 * - Open: count of open conversations
 * - Snoozed: count of snoozed conversations (excluding waiting-on-customer tags)
 * - Closed: count of closed conversations for current day
 * - Chats Taken: count of conversations created today and responded to today
 */
function calculateTSECountsFromIntercom(
  conversations: IntercomConversation[],
  teamMembers: IntercomTeamMember[]
): TSEConversationData[] {
  // Group conversations by admin_assignee_id
  const tseMap = new Map<string, { 
    name: string
    open: number
    snoozed: number
    closed: number
    chatsTaken: number
  }>()
  
  conversations.forEach(conv => {
    const assigneeId = conv.admin_assignee_id || 
      (conv.admin_assignee && typeof conv.admin_assignee === 'object' ? conv.admin_assignee.id : null)
    
    if (!assigneeId) return
    
    const idStr = String(assigneeId)
    
    // Initialize TSE entry if not exists
    if (!tseMap.has(idStr)) {
      const teamMember = teamMembers.find(m => String(m.id) === idStr)
      const name = teamMember?.name || `TSE ${idStr}`
      
      // Skip excluded TSEs
      if (EXCLUDED_TSE_NAMES.includes(name)) return
      
      tseMap.set(idStr, { 
        name,
        open: 0, 
        snoozed: 0, 
        closed: 0,
        chatsTaken: 0
      })
    }
    
    const counts = tseMap.get(idStr)
    if (!counts) return // Skip if TSE was excluded
    
    const state = (conv.state || 'open').toLowerCase()
    const isSnoozed = state === 'snoozed' || conv.snoozed_until
    
    if (state === 'open' && !isSnoozed) {
      // Open: count of open conversations
      counts.open++
    } else if (isSnoozed) {
      // Snoozed: exclude conversations with waiting-on-customer tags
      if (!hasWaitingOnCustomerTag(conv)) {
        counts.snoozed++
      }
    } else if (state === 'closed') {
      // Closed: only count if closed today
      if (isClosedToday(conv)) {
        counts.closed++
      }
    }
    
    // Chats Taken: conversations created today and responded to today
    if (isChatTakenToday(conv)) {
      counts.chatsTaken++
    }
  })
  
  // Convert to array
  const result: TSEConversationData[] = Array.from(tseMap.values())
    .filter(item => !EXCLUDED_TSE_NAMES.includes(item.name))
    .map(item => ({
      tseName: getFirstName(item.name),
      openCount: item.open,
      snoozedCount: item.snoozed,
      closedCount: item.closed,
      chatsTakenCount: item.chatsTaken
    }))
  
  // Sort by open + snoozed descending
  result.sort((a, b) => (b.openCount + b.snoozedCount) - (a.openCount + a.snoozedCount))
  
  return result
}

// Generate mock conversation data for TSEs (fallback)
function generateMockConversationData(): TSEConversationData[] {
  const tseNames = TEAM_MEMBERS
    .map(member => member.name)
    .filter(name => !EXCLUDED_TSE_NAMES.includes(name))
  
  return tseNames.map(name => {
    const random = Math.random()
    let openCount: number
    let snoozedCount: number
    let closedCount: number
    
    if (random < 0.2) {
      openCount = Math.floor(Math.random() * 4) + 6
      snoozedCount = Math.floor(Math.random() * 3) + 4
      closedCount = Math.floor(Math.random() * 10) + 15
    } else if (random < 0.5) {
      openCount = Math.floor(Math.random() * 3) + 3
      snoozedCount = Math.floor(Math.random() * 2) + 2
      closedCount = Math.floor(Math.random() * 8) + 10
    } else {
      openCount = Math.floor(Math.random() * 3)
      snoozedCount = Math.floor(Math.random() * 2)
      closedCount = Math.floor(Math.random() * 8) + 5
    }
    
    const chatsTakenCount = Math.floor(Math.random() * 5) + closedCount
    
    return {
      tseName: name,
      openCount,
      snoozedCount,
      closedCount,
      chatsTakenCount,
    }
  })
}

export function TSEConversationTable({ 
  // Legacy props kept for backwards compatibility
  conversationData: _propsConversationData,
  conversationColumns: _conversationColumns,
  tseColumn: _tseColumn,
  openColumn: _openColumn,
  snoozedColumn: _snoozedColumn,
  closedColumn: _closedColumn,
  // New Intercom data props
  intercomConversations,
  intercomTeamMembers,
  lastUpdated,
}: TSEConversationTableProps) {
  const [conversationData, setConversationData] = useState<TSEConversationData[]>([])
  const [loading, setLoading] = useState(true)
  const [currentHalf, setCurrentHalf] = useState<0 | 1>(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [_error, setError] = useState<string | null>(null)
  
  // Generate mock data as fallback
  const mockData = useMemo(() => generateMockConversationData(), [])

  // Calculate data from Intercom conversations when available
  const intercomData = useMemo(() => {
    if (!intercomConversations?.length || !intercomTeamMembers?.length) {
      return null
    }
    
    console.log('[TSEConversationTable] Calculating counts from Intercom data:', {
      conversationsCount: intercomConversations.length,
      teamMembersCount: intercomTeamMembers.length
    })
    
    const counts = calculateTSECountsFromIntercom(intercomConversations, intercomTeamMembers)
    
    console.log('[TSEConversationTable] Calculated TSE counts:', counts)
    return counts
  }, [intercomConversations, intercomTeamMembers])

  // Use Intercom data if available, otherwise fetch from API
  useEffect(() => {
    if (intercomData && intercomData.length > 0) {
      console.log('[TSEConversationTable] Using Intercom data')
      setConversationData(intercomData)
      setLoading(false)
      setError(null)
    }
  }, [intercomData])

  // Fetch from API only if Intercom data is not provided
  const fetchConversationCounts = useCallback(async () => {
    // Skip API fetch if we have Intercom data
    if (intercomData && intercomData.length > 0) {
      return
    }
    
    try {
      const apiUrl = 'https://queue-health-monitor.vercel.app/api/intercom/conversations/tse-counts'
      const response = await fetch(apiUrl)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      // Process API data
      const processedData: TSEConversationData[] = []
      
      data.forEach((item: any) => {
        if (!item.tse || !item.tse.trim()) return
        
        const cleanName = item.tse.trim()
        if (EXCLUDED_TSE_NAMES.includes(cleanName)) return
        
        processedData.push({
          tseName: cleanName,
          openCount: item.open || 0,
          snoozedCount: item.snoozed || 0,
          closedCount: item.closed || 0,
          chatsTakenCount: item.chatsTaken || 0,
        })
      })
      
      const sortedData = processedData.sort((a, b) => {
        const sumA = a.openCount + a.snoozedCount
        const sumB = b.openCount + b.snoozedCount
        return sumB - sumA
      })
      
      setConversationData(sortedData)
      setLoading(false)
      setError(null)
    } catch (err) {
      console.error('[TSEConversationTable] Error fetching conversation counts:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch')
      
      // Fallback to mock data on error
      const filteredData = mockData.filter(row => !EXCLUDED_TSE_NAMES.includes(row.tseName))
      const sortedData = filteredData.sort((a, b) => {
        const sumA = a.openCount + a.snoozedCount
        const sumB = b.openCount + b.snoozedCount
        return sumB - sumA
      })
      setConversationData(sortedData)
      setLoading(false)
    }
  }, [mockData, intercomData])

  // Fetch data on mount and set up polling (only if no Intercom data)
  useEffect(() => {
    // Skip if we have Intercom data
    if (intercomData && intercomData.length > 0) {
      return
    }
    
    // Initial fetch
    fetchConversationCounts()
    
    // Poll every 30 seconds for live updates
    const interval = setInterval(() => {
      fetchConversationCounts()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [fetchConversationCounts, intercomData])

  // Split data into two halves
  const [firstHalf, secondHalf] = useMemo(() => {
    const midpoint = Math.ceil(conversationData.length / 2)
    return [
      conversationData.slice(0, midpoint),
      conversationData.slice(midpoint)
    ]
  }, [conversationData])

  // Rotate between halves every 10 seconds
  useEffect(() => {
    if (conversationData.length === 0 || firstHalf.length === 0 || secondHalf.length === 0) return

    const interval = setInterval(() => {
      // Start fade out
      setIsTransitioning(true)
      
      // After fade out completes, switch to the other half
      setTimeout(() => {
        setCurrentHalf(prev => (prev === 0 ? 1 : 0) as 0 | 1)
        
        // Start fade in
        setTimeout(() => {
          setIsTransitioning(false)
        }, 50) // Small delay to ensure DOM update
      }, 300) // Match CSS transition duration
    }, 10000) // 10 seconds between shifts

    return () => clearInterval(interval)
  }, [conversationData.length, firstHalf.length, secondHalf.length])

  // Get the currently displayed half
  const displayedData = currentHalf === 0 ? firstHalf : secondHalf

  // Color coding function
  const getValueColor = (value: number): string => {
    if (value > 5) return '#ef4444' // red
    if (value >= 3) return '#eab308' // yellow
    return '#22c55e' // green
  }

  if (loading && conversationData.length === 0) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '16px'
      }}>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading conversation data...</div>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'auto'
      }}>
        <table style={{
          width: '100%',
          minWidth: '300px',
          borderCollapse: 'collapse',
          fontSize: '16px'
        }}>
        <thead>
          <tr style={{
            borderBottom: '2px solid #e5e7eb',
            position: 'sticky',
            top: 0,
            background: '#fff',
            zIndex: 1
          }}>
            <th style={{
              textAlign: 'left',
              padding: '10px 8px',
              fontWeight: 600,
              color: '#374151',
              fontSize: '15px',
              whiteSpace: 'nowrap',
              minWidth: '70px',
              maxWidth: '80px'
            }}>
              TSE
            </th>
            <th style={{
              textAlign: 'right',
              padding: '10px 8px',
              fontWeight: 600,
              color: '#374151',
              fontSize: '15px',
              whiteSpace: 'nowrap',
              minWidth: '50px'
            }}>
              Open
            </th>
            <th style={{
              textAlign: 'right',
              padding: '10px 8px',
              fontWeight: 600,
              color: '#374151',
              fontSize: '15px',
              whiteSpace: 'nowrap',
              minWidth: '60px'
            }}>
              Snoozed
            </th>
            <th style={{
              textAlign: 'right',
              padding: '10px 8px',
              fontWeight: 600,
              color: '#374151',
              fontSize: '15px',
              whiteSpace: 'nowrap',
              minWidth: '60px'
            }}>
              Closed
            </th>
            <th style={{
              textAlign: 'right',
              padding: '10px 8px',
              fontWeight: 600,
              color: '#374151',
              fontSize: '15px',
              whiteSpace: 'nowrap',
              minWidth: '60px'
            }}>
              Taken
            </th>
          </tr>
        </thead>
        <tbody>
          {displayedData.map((row, index) => (
            <tr
              key={row.tseName}
              style={{
                borderBottom: index < displayedData.length - 1 ? '1px solid #f3f4f6' : 'none',
                opacity: isTransitioning ? 0 : 1,
                transition: 'opacity 0.3s ease-in-out'
              }}
            >
              <td style={{
                padding: '8px 8px',
                color: '#111827',
                fontWeight: 500,
                fontSize: '16px',
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {row.tseName}
              </td>
              <td style={{
                padding: '8px 8px',
                textAlign: 'right',
                color: getValueColor(row.openCount),
                fontWeight: 600,
                fontSize: '16px'
              }}>
                {row.openCount}
              </td>
              <td style={{
                padding: '8px 8px',
                textAlign: 'right',
                color: getValueColor(row.snoozedCount),
                fontWeight: 600,
                fontSize: '16px'
              }}>
                {row.snoozedCount}
              </td>
              <td style={{
                padding: '8px 8px',
                textAlign: 'right',
                color: '#6b7280',
                fontWeight: 600,
                fontSize: '16px'
              }}>
                {row.closedCount}
              </td>
              <td style={{
                padding: '8px 8px',
                textAlign: 'right',
                color: '#3b82f6',
                fontWeight: 600,
                fontSize: '16px'
              }}>
                {row.chatsTakenCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {/* Last updated indicator */}
      {lastUpdated && (
        <div style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid #f3f4f6',
          fontSize: '11px',
          color: '#9ca3af',
          textAlign: 'right'
        }}>
          Updated {formatLastUpdated(lastUpdated)}
        </div>
      )}
    </div>
  )
}

/**
 * Format the last updated time in a human-readable way
 */
function formatLastUpdated(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  
  if (diffSecs < 60) {
    return 'just now'
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  } else {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }
}
