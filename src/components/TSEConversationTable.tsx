import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { TEAM_MEMBERS } from '../data/teamMembers'

interface TSEConversationData {
  tseName: string
  fullName: string
  tseId: string
  openCount: number
  snoozedCount: number
  closedCount: number
  chatsTakenCount: number
}

interface TSEDetailData {
  name: string
  fullName: string
  id: string
  avatar: string
  region: string
  open: IntercomConversation[]
  allSnoozed: IntercomConversation[]
  waitingOnCustomerResolved: IntercomConversation[]
  waitingOnCustomerUnresolved: IntercomConversation[]
  waitingOnTSE: IntercomConversation[]
  closed: IntercomConversation[]
  taken: IntercomConversation[]
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
  'Holly',
  'Holly Coxon',
  'Stephen',
  'Stephen Skalamera',
  'Grace',
  'Grace Liu',
  'Zen',
  'Zen Lee',
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
 * Check if a name should be excluded (checks both full name and first name)
 */
function isExcludedTSE(name: string): boolean {
  if (!name) return false
  // Check exact match
  if (EXCLUDED_TSE_NAMES.includes(name)) return true
  // Check first name match
  const firstName = getFirstName(name)
  if (EXCLUDED_TSE_NAMES.includes(firstName)) return true
  return false
}

/**
 * Get the snooze workflow type from custom attributes
 * Returns the value of "Last Snooze Workflow Used" or null if not set
 */
function getSnoozeWorkflow(conv: IntercomConversation): string | null {
  const customAttributes = conv.custom_attributes || {}
  return customAttributes['Last Snooze Workflow Used'] || null
}

/**
 * Check if a conversation has a "waiting on customer" workflow
 * These should be excluded from the snoozed count
 */
function hasWaitingOnCustomerWorkflow(conv: IntercomConversation): boolean {
  const workflow = getSnoozeWorkflow(conv)
  return workflow === 'Waiting On Customer - Resolved' || 
         workflow === 'Waiting On Customer - Unresolved'
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
 * - Snoozed: count of snoozed conversations (excluding waiting-on-customer workflows)
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
    id: string
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
      if (isExcludedTSE(name)) return
      
      tseMap.set(idStr, { 
        name,
        id: idStr,
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
      // Snoozed: exclude conversations with waiting-on-customer workflows
      if (!hasWaitingOnCustomerWorkflow(conv)) {
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
  const result: TSEConversationData[] = Array.from(tseMap.entries())
    .filter(([_, item]) => !isExcludedTSE(item.name))
    .map(([id, item]) => ({
      tseName: getFirstName(item.name),
      fullName: item.name,
      tseId: id,
      openCount: item.open,
      snoozedCount: item.snoozed,
      closedCount: item.closed,
      chatsTakenCount: item.chatsTaken
    }))
  
  // Sort by open + snoozed descending
  result.sort((a, b) => (b.openCount + b.snoozedCount) - (a.openCount + a.snoozedCount))
  
  return result
}

/**
 * Get TSE conversations grouped by category
 */
function getTSEConversations(
  tseId: string,
  tseName: string,
  conversations: IntercomConversation[]
): TSEDetailData {
  const teamMember = TEAM_MEMBERS.find(m => 
    m.name.toLowerCase() === tseName.toLowerCase() ||
    m.name.toLowerCase() === getFirstName(tseName).toLowerCase()
  )
  
  const avatar = teamMember?.avatar || ''
  const timezone = teamMember?.timezone || ''
  let region = 'Other'
  if (timezone.includes('New_York')) region = 'New York'
  else if (timezone.includes('Los_Angeles')) region = 'San Francisco'
  else if (timezone.includes('London')) region = 'UK'
  
  const open: IntercomConversation[] = []
  const allSnoozed: IntercomConversation[] = []
  const waitingOnCustomerResolved: IntercomConversation[] = []
  const waitingOnCustomerUnresolved: IntercomConversation[] = []
  const waitingOnTSE: IntercomConversation[] = []
  const closed: IntercomConversation[] = []
  const taken: IntercomConversation[] = []
  
  conversations.forEach(conv => {
    const assigneeId = conv.admin_assignee_id || 
      (conv.admin_assignee && typeof conv.admin_assignee === 'object' ? conv.admin_assignee.id : null)
    
    if (String(assigneeId) !== tseId) return
    
    const state = (conv.state || 'open').toLowerCase()
    const isSnoozed = state === 'snoozed' || conv.snoozed_until
    
    if (state === 'open' && !isSnoozed) {
      open.push(conv)
    } else if (isSnoozed) {
      // All snoozed conversations
      allSnoozed.push(conv)
      
      // Categorize by "Last Snooze Workflow Used" custom attribute
      const workflow = getSnoozeWorkflow(conv)
      
      if (workflow === 'Waiting On Customer - Resolved') {
        waitingOnCustomerResolved.push(conv)
      } else if (workflow === 'Waiting On Customer - Unresolved') {
        waitingOnCustomerUnresolved.push(conv)
      } else if (workflow === 'Waiting On TSE - Deep Dive') {
        waitingOnTSE.push(conv)
      } else {
        // If no workflow is set or it's an unknown value, treat as "Waiting On TSE"
        // This handles untagged snoozed conversations
        waitingOnTSE.push(conv)
      }
    } else if (state === 'closed' && isClosedToday(conv)) {
      closed.push(conv)
    }
    
    if (isChatTakenToday(conv)) {
      taken.push(conv)
    }
  })
  
  return {
    name: getFirstName(tseName),
    fullName: tseName,
    id: tseId,
    avatar,
    region,
    open,
    allSnoozed,
    waitingOnCustomerResolved,
    waitingOnCustomerUnresolved,
    waitingOnTSE,
    closed,
    taken
  }
}

// Intercom base URL for linking conversations
const INTERCOM_BASE_URL = "https://app.intercom.com/a/inbox/gu1e0q0t/inbox/admin/8857114/conversation/"

/**
 * Format a timestamp for display
 */
function formatConversationDate(timestamp: number | undefined): string {
  if (!timestamp) return '-'
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000
  const date = new Date(ms)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  }) + ' UTC'
}

/**
 * TSE Details Modal Component
 */
function TSEDetailsModal({ 
  tseData, 
  onClose 
}: { 
  tseData: TSEDetailData
  onClose: () => void 
}) {
  const { 
    name, 
    fullName, 
    avatar, 
    region, 
    open, 
    allSnoozed, 
    waitingOnCustomerResolved, 
    waitingOnCustomerUnresolved, 
    waitingOnTSE, 
    closed, 
    taken 
  } = tseData
  
  // Get author email from conversation
  const getAuthorEmail = (conv: IntercomConversation): string => {
    const source = conv as any
    return source.source?.author?.email || 
           source.source?.email || 
           source.author?.email ||
           source.conversation_message?.author?.email ||
           '-'
  }
  
  // Render conversation list
  const renderConversationList = (convs: IntercomConversation[], emptyMessage: string) => {
    if (!convs || convs.length === 0) {
      return <div className="tse-modal-empty">{emptyMessage}</div>
    }
    
    return (
      <div className="tse-modal-conversation-list">
        {convs.map((conv, idx) => {
          const convId = conv.id || conv.conversation_id
          const authorEmail = getAuthorEmail(conv)
          const created = formatConversationDate(conv.created_at)
          
          return (
            <div key={convId || idx} className="tse-modal-conversation-item">
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '4px',
                padding: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img 
                  src="https://res.cloudinary.com/doznvxtja/image/upload/v1767370490/Untitled_design_14_wkkhe3.svg"
                  alt="Intercom"
                  className="tse-modal-conv-icon"
                />
              </div>
              <div className="tse-modal-conv-content">
                <div className="tse-modal-conv-header">
                  <a 
                    href={`${INTERCOM_BASE_URL}${convId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tse-modal-conv-id-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {convId}
                  </a>
                  <span className="tse-modal-conv-date">{created}</span>
                </div>
                <div className="tse-modal-conv-email">{authorEmail}</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="tse-modal-overlay" onClick={onClose}>
      <div className="tse-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tse-modal-header">
          <div className="tse-modal-header-left">
            {avatar && (
              <img src={avatar} alt={name} className="tse-modal-avatar" />
            )}
            <div className="tse-modal-header-info">
              <h2 className="tse-modal-title">{fullName}</h2>
              <div className="tse-modal-region">
                <span className="tse-modal-region-text">{region}</span>
              </div>
            </div>
          </div>
          <button className="tse-modal-close" onClick={onClose}>×</button>
        </div>
        
        {/* Stats Summary */}
        <div className="tse-modal-stats">
          <div className="tse-modal-stat">
            <div className="tse-modal-stat-value" style={{ color: open.length > 5 ? 'var(--status-red)' : open.length >= 3 ? 'var(--status-yellow)' : 'var(--status-green)' }}>
              {open.length}
            </div>
            <div className="tse-modal-stat-label">Open</div>
          </div>
          <div className="tse-modal-stat">
            <div className="tse-modal-stat-value" style={{ color: allSnoozed.length > 5 ? '#ef4444' : allSnoozed.length >= 3 ? '#eab308' : '#22c55e' }}>
              {allSnoozed.length}
            </div>
            <div className="tse-modal-stat-label">All Snoozed</div>
          </div>
          <div className="tse-modal-stat">
            <div className="tse-modal-stat-value" style={{ color: waitingOnCustomerResolved.length > 5 ? '#ef4444' : waitingOnCustomerResolved.length >= 3 ? '#eab308' : '#22c55e' }}>
              {waitingOnCustomerResolved.length}
            </div>
            <div className="tse-modal-stat-label">Waiting On Customer - Resolved</div>
          </div>
          <div className="tse-modal-stat">
            <div className="tse-modal-stat-value" style={{ color: waitingOnCustomerUnresolved.length > 5 ? '#ef4444' : waitingOnCustomerUnresolved.length >= 3 ? '#eab308' : '#22c55e' }}>
              {waitingOnCustomerUnresolved.length}
            </div>
            <div className="tse-modal-stat-label">Waiting On Customer - Unresolved</div>
          </div>
          <div className="tse-modal-stat">
            <div className="tse-modal-stat-value" style={{ color: waitingOnTSE.length > 5 ? '#ef4444' : waitingOnTSE.length >= 3 ? '#eab308' : '#22c55e' }}>
              {waitingOnTSE.length}
            </div>
            <div className="tse-modal-stat-label">Waiting On TSE</div>
          </div>
          <div className="tse-modal-stat">
            <div className="tse-modal-stat-value" style={{ color: 'var(--status-gray)' }}>
              {closed.length}
            </div>
            <div className="tse-modal-stat-label">Closed Today</div>
          </div>
          <div className="tse-modal-stat">
            <div className="tse-modal-stat-value" style={{ color: 'var(--status-blue)' }}>
              {taken.length}
            </div>
            <div className="tse-modal-stat-label">Assigned Today</div>
          </div>
        </div>
        
        {/* Conversation Lists */}
        <div className="tse-modal-body">
          <div className="tse-modal-section">
            <h3 className="tse-modal-section-title">
              Open Conversations <span className="tse-modal-section-count">({open.length})</span>
            </h3>
            {renderConversationList(open, 'No conversations')}
          </div>
          
          <div className="tse-modal-section">
            <h3 className="tse-modal-section-title">
              All Snoozed <span className="tse-modal-section-count">({allSnoozed.length})</span>
            </h3>
            {renderConversationList(allSnoozed, 'No conversations')}
          </div>
          
          <div className="tse-modal-section">
            <h3 className="tse-modal-section-title">
              Waiting On Customer - Resolved <span className="tse-modal-section-count">({waitingOnCustomerResolved.length})</span>
            </h3>
            {renderConversationList(waitingOnCustomerResolved, 'No conversations')}
          </div>
          
          <div className="tse-modal-section">
            <h3 className="tse-modal-section-title">
              Waiting On Customer - Unresolved <span className="tse-modal-section-count">({waitingOnCustomerUnresolved.length})</span>
            </h3>
            {renderConversationList(waitingOnCustomerUnresolved, 'No conversations')}
          </div>
          
          <div className="tse-modal-section">
            <h3 className="tse-modal-section-title">
              Waiting On TSE - Deep Dive <span className="tse-modal-section-count">({waitingOnTSE.length})</span>
            </h3>
            {renderConversationList(waitingOnTSE, 'No conversations')}
          </div>
        </div>
      </div>
    </div>
  )
}

// Generate mock conversation data for TSEs (fallback)
function generateMockConversationData(): TSEConversationData[] {
  const tseNames = TEAM_MEMBERS
    .filter(member => !isExcludedTSE(member.name))
  
  return tseNames.map((member, idx) => {
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
      tseName: member.name,
      fullName: member.name,
      tseId: member.id || `mock-${idx}`,
      openCount,
      snoozedCount,
      closedCount,
      chatsTakenCount,
    }
  })
}

type SortColumn = 'tse' | 'open' | 'snoozed' | 'closed' | 'assigned'
type SortDirection = 'asc' | 'desc'

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
  const [selectedTSE, setSelectedTSE] = useState<TSEDetailData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  
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
        if (isExcludedTSE(cleanName)) return
        
        processedData.push({
          tseName: getFirstName(cleanName),
          fullName: cleanName,
          tseId: item.id || `api-${cleanName}`,
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
      const filteredData = mockData.filter(row => !isExcludedTSE(row.tseName) && !isExcludedTSE(row.fullName))
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

  // Sort data based on current sort column and direction
  const sortedData = useMemo(() => {
    if (!sortColumn) {
      // Default sort: by open + snoozed descending
      return [...conversationData].sort((a, b) => {
        const sumA = a.openCount + a.snoozedCount
        const sumB = b.openCount + b.snoozedCount
        return sumB - sumA
      })
    }

    const sorted = [...conversationData].sort((a, b) => {
      let comparison = 0

      switch (sortColumn) {
        case 'tse':
          // Alphabetical sort for TSE names
          comparison = a.tseName.localeCompare(b.tseName)
          break
        case 'open':
          comparison = a.openCount - b.openCount
          break
        case 'snoozed':
          comparison = a.snoozedCount - b.snoozedCount
          break
        case 'closed':
          comparison = a.closedCount - b.closedCount
          break
        case 'assigned':
          comparison = a.chatsTakenCount - b.chatsTakenCount
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [conversationData, sortColumn, sortDirection])

  // Split data into two halves
  const [firstHalf, secondHalf] = useMemo(() => {
    const midpoint = Math.ceil(sortedData.length / 2)
    return [
      sortedData.slice(0, midpoint),
      sortedData.slice(midpoint)
    ]
  }, [sortedData])

  // Rotate between halves every 10 seconds
  useEffect(() => {
    if (sortedData.length === 0 || firstHalf.length === 0 || secondHalf.length === 0) return

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
  }, [sortedData.length, firstHalf.length, secondHalf.length])

  // Get the currently displayed half
  const displayedData = currentHalf === 0 ? firstHalf : secondHalf

  // Color coding function
  const getValueColor = (value: number): string => {
    if (value > 5) return '#ef4444' // red
    if (value >= 3) return '#eab308' // yellow
    return '#22c55e' // green
  }
  
  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column and default to descending for numeric columns, ascending for TSE
      setSortColumn(column)
      setSortDirection(column === 'tse' ? 'asc' : 'desc')
    }
  }

  // Handle TSE name click
  const handleTSEClick = (row: TSEConversationData) => {
    if (!intercomConversations) return
    
    const tseData = getTSEConversations(
      row.tseId,
      row.fullName || row.tseName,
      intercomConversations
    )
    
    setSelectedTSE(tseData)
    setIsModalOpen(true)
  }
  
  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedTSE(null)
  }

  // Render sort indicator
  const renderSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) {
      return (
        <span style={{ 
          marginLeft: '4px', 
          color: 'var(--text-muted)',
          fontSize: '12px',
          opacity: 0.5
        }}>↕</span>
      )
    }
    return (
      <span style={{ 
        marginLeft: '4px', 
        color: 'var(--text-primary)',
        fontSize: '12px',
        fontWeight: 600
      }}>
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  if (loading && conversationData.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '16px'
      }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading conversation data...</div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: 'var(--shadow-sm)',
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
            borderBottom: '2px solid var(--border-color)',
            position: 'sticky',
            top: 0,
            background: 'var(--bg-card)',
            zIndex: 1
          }}>
            <th 
              onClick={() => handleSort('tse')}
              style={{
                textAlign: 'left',
                padding: '10px 8px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontSize: '15px',
                whiteSpace: 'nowrap',
                minWidth: '70px',
                maxWidth: '80px',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card)'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                TSE
                {renderSortIndicator('tse')}
              </span>
            </th>
            <th 
              onClick={() => handleSort('open')}
              style={{
                textAlign: 'right',
                padding: '10px 8px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontSize: '15px',
                whiteSpace: 'nowrap',
                minWidth: '50px',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card)'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                Open
                {renderSortIndicator('open')}
              </span>
            </th>
            <th 
              onClick={() => handleSort('snoozed')}
              style={{
                textAlign: 'right',
                padding: '10px 8px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontSize: '15px',
                whiteSpace: 'nowrap',
                minWidth: '60px',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card)'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                Snoozed
                {renderSortIndicator('snoozed')}
              </span>
            </th>
            <th 
              onClick={() => handleSort('closed')}
              style={{
                textAlign: 'right',
                padding: '10px 8px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontSize: '15px',
                whiteSpace: 'nowrap',
                minWidth: '60px',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card)'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                Closed
                {renderSortIndicator('closed')}
              </span>
            </th>
            <th 
              onClick={() => handleSort('assigned')}
              style={{
                textAlign: 'right',
                padding: '10px 8px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontSize: '15px',
                whiteSpace: 'nowrap',
                minWidth: '60px',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card)'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                Assigned
                {renderSortIndicator('assigned')}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {displayedData.map((row, index) => (
            <tr
              key={row.tseName}
              style={{
                borderBottom: index < displayedData.length - 1 ? '1px solid var(--border-color-light)' : 'none',
                opacity: isTransitioning ? 0 : 1,
                transition: 'opacity 0.3s ease-in-out'
              }}
            >
              <td 
                style={{
                  padding: '8px 8px',
                  color: 'var(--status-blue)',
                  fontWeight: 500,
                  fontSize: '16px',
                  maxWidth: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: intercomConversations ? 'pointer' : 'default',
                  transition: 'color 0.15s ease'
                }}
                onClick={() => handleTSEClick(row)}
                onMouseEnter={(e) => {
                  if (intercomConversations) {
                    e.currentTarget.style.color = '#1d4ed8'
                    e.currentTarget.style.textDecoration = 'underline'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--status-blue)'
                  e.currentTarget.style.textDecoration = 'none'
                }}
              >
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
                color: 'var(--status-gray)',
                fontWeight: 600,
                fontSize: '16px'
              }}>
                {row.closedCount}
              </td>
              <td style={{
                padding: '8px 8px',
                textAlign: 'right',
                color: 'var(--status-blue)',
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
          borderTop: '1px solid var(--border-color-light)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          textAlign: 'right'
        }}>
          Updated {formatLastUpdated(lastUpdated)}
        </div>
      )}
      
      {/* TSE Details Modal - Rendered via Portal to escape stacking contexts */}
      {isModalOpen && selectedTSE && createPortal(
        <TSEDetailsModal 
          tseData={selectedTSE}
          onClose={handleCloseModal}
        />,
        document.body
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
