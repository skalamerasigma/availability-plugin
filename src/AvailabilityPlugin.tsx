import { useEffect, useMemo, useState, useCallback, useRef, Component, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  client,
  useConfig,
  useElementColumns,
  useElementData,
} from '@sigmacomputing/plugin'

import { Timeline } from './components/Timeline'
import { getQhmApiBaseUrl, isDebugEnabled } from './config'

const QHM_API_BASE_URL = getQhmApiBaseUrl()
const LOG = isDebugEnabled()

// =================================================================
// ERROR BOUNDARY - Prevents white screen crashes
// =================================================================
interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: string
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: '' }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo.componentStack)
    this.setState({ errorInfo: errorInfo.componentStack || '' })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          margin: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <h2 style={{ color: 'var(--status-red)', margin: '0 0 10px 0' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-primary)', margin: '0 0 15px 0' }}>
            The plugin encountered an error. Try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: 'var(--status-blue)',
              color: 'var(--text-inverse)',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              marginRight: '10px'
            }}
          >
            Refresh Page
          </button>
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: '' })}
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--status-blue)',
              border: '1px solid var(--status-blue)',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Try Again
          </button>
          <details style={{ marginTop: '15px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <summary style={{ cursor: 'pointer' }}>Error Details</summary>
            <pre style={{ 
              backgroundColor: 'var(--bg-card-secondary)', 
              padding: '10px', 
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '200px',
              marginTop: '10px',
              color: 'var(--text-primary)'
            }}>
              {this.state.error?.toString()}
              {this.state.errorInfo}
            </pre>
          </details>
        </div>
      )
    }

    return this.props.children
  }
}
// Legend import removed — legend no longer rendered
import { FallbackGauge } from './components/FallbackGauge'
import { OOOProfilePictures } from './components/OOOProfilePictures'
import { OfficeHours } from './components/OfficeHours'
import { TSEConversationTable } from './components/TSEConversationTable'
import { IncidentBanner } from './components/IncidentBanner'
import { DarkModeToggle } from './components/DarkModeToggle'
import { AudioToggle } from './components/AudioToggle'
import { useAgentDataFromApi } from './hooks/useAgentData'
import { useIntercomData } from './hooks/useIntercomData'
import { useDailyMetrics } from './hooks/useDailyMetrics'
import { useChatsByHour } from './hooks/useChatsByHour'
import { useWebhookAwayStatus } from './hooks/useWebhookAwayStatus'
import { TEAM_MEMBERS } from './data/teamMembers'
import { getTSECapacity } from './data/tseCapacityExceptions'
import type { City, AgentData, AgentStatus } from './types'

/**
 * Sigma Plugin Configuration
 * 
 * This initializes the plugin with Sigma and defines:
 * 1. Data source (columns from a Sigma worksheet)
 * 2. Configuration options (editable in the Sigma editor panel)
 */
client.config.configureEditorPanel([
  // === SCHEDULE DATA SOURCE CONFIGURATION ===
  // Connect to the TSE schedule worksheet
  {
    name: 'scheduleSource',
    type: 'element',
  },
  {
    name: 'scheduleTSE',
    type: 'column',
    source: 'scheduleSource',
    allowMultiple: false,
  },
  {
    name: 'scheduleOOO',
    type: 'column',
    source: 'scheduleSource',
    allowMultiple: false,
  },
  {
    name: 'scheduleHours',
    type: 'column',
    source: 'scheduleSource',
    allowMultiple: true, // This will capture all hour columns (_0 through _18)
  },
  {
    name: 'scheduleCurrentlyOnChat',
    type: 'column',
    source: 'scheduleSource',
    allowMultiple: false,
  },
  {
    name: 'scheduleCurrentlyLunch',
    type: 'column',
    source: 'scheduleSource',
    allowMultiple: false,
  },
  {
    name: 'scheduleCurrentlyOffChat',
    type: 'column',
    source: 'scheduleSource',
    allowMultiple: false,
  },

  // === OOO DATA SOURCE CONFIGURATION ===
  // Connect to the OOO view (SIGMA_ON_SIGMA.SIGMA_WRITABLE.OOO)
  // This view lists TSEs that are OOO for the current day
  {
    name: 'oooSource',
    type: 'element',
  },
  {
    name: 'oooTSE',
    type: 'column',
    source: 'oooSource',
    allowMultiple: false,
  },
  {
    name: 'oooStatus',
    type: 'column',
    source: 'oooSource',
    allowMultiple: false,
  },

  // === LEGACY DATA SOURCE (for non-schedule based status) ===
  {
    name: 'Status Source',
    type: 'element',
  },
  {
    name: 'agentName',
    type: 'column',
    source: 'Status Source',
    allowMultiple: false,
  },
  {
    name: 'agentAvatar',
    type: 'column',
    source: 'Status Source',
    allowMultiple: false,
  },
  {
    name: 'agentStatus',
    type: 'column',
    source: 'Status Source',
    allowMultiple: false,
  },
  {
    name: 'agentMinutesInStatus',
    type: 'column',
    source: 'Status Source',
    allowMultiple: false,
  },
  {
    name: 'agentTimezone',
    type: 'column',
    source: 'Status Source',
    allowMultiple: false,
  },

  // === VISUAL CONFIGURATION ===
  // These appear as configurable options in the Sigma editor panel
  {
    name: 'apiUrl',
    type: 'text',
    defaultValue: '',
  },
  {
    name: 'defaultIntensity',
    type: 'text',
    defaultValue: '35',
  },
  {
    name: 'autoIntensity',
    type: 'text',
    defaultValue: 'true',
  },
  {
    name: 'showLegend',
    type: 'text',
    defaultValue: 'true',
  },
  {
    name: 'simulateTime',
    type: 'text',
    defaultValue: 'false',
  },

  // === OFFICE HOURS DATA SOURCE CONFIGURATION ===
  // Connect to the Office Hours view (SIGMA_ON_SIGMA.SIGMA_WRITABLE.OFFICE_HOURS_TODAY_SUPPORT)
  {
    name: 'officeHoursSource',
    type: 'element',
  },
  {
    name: 'officeHoursTseTopicTime',
    type: 'column',
    source: 'officeHoursSource',
    allowMultiple: false,
  },
  {
    name: 'officeHoursStatus',
    type: 'column',
    source: 'officeHoursSource',
    allowMultiple: false,
  },

  // === TSE CONVERSATION DATA SOURCE CONFIGURATION ===
  // Connect to the TSE Conversation view (with Open, Snoozed, Closed counts per TSE)
  {
    name: 'tseConversationSource',
    type: 'element',
  },
  {
    name: 'tseConversationTSE',
    type: 'column',
    source: 'tseConversationSource',
    allowMultiple: false,
  },
  {
    name: 'tseConversationOpen',
    type: 'column',
    source: 'tseConversationSource',
    allowMultiple: false,
  },
  {
    name: 'tseConversationSnoozed',
    type: 'column',
    source: 'tseConversationSource',
    allowMultiple: false,
  },
  {
    name: 'tseConversationClosed',
    type: 'column',
    source: 'tseConversationSource',
    allowMultiple: false,
  },


  // === CHATS PER HOUR DATA SOURCE CONFIGURATION ===
  // Connect to a worksheet that groups today's conversations by UTC hour
  // Expected columns: hour_bucket (timestamp), chat_count (number)
  {
    name: 'chatsPerHourSource',
    type: 'element',
  },
  {
    name: 'chatsPerHourBucket',
    type: 'column',
    source: 'chatsPerHourSource',
    allowMultiple: false,
  },
  {
    name: 'chatsPerHourCount',
    type: 'column',
    source: 'chatsPerHourSource',
    allowMultiple: false,
  },

  // === TSE STATUS SUMMARY DATA SOURCES ===
  // Connect to the Active TSEs view (SIGMA_ON_SIGMA.SIGMA_WRITABLE.ACTIVE)
  {
    name: 'activeTSEsSource',
    type: 'element',
  },
  // Connect to the Scheduled and Away TSEs view (SIGMA_ON_SIGMA.SIGMA_WRITABLE.SCHEDULED_AND_AWAY)
  {
    name: 'awayTSEsSource',
    type: 'element',
  },

  // === CITY CONFIGURATION ===
  // Allow users to configure which cities/offices to display
  {
    name: 'city1Name',
    type: 'text',
    defaultValue: 'London',
  },
  {
    name: 'city1Code',
    type: 'text',
    defaultValue: 'LON',
  },
  {
    name: 'city1Timezone',
    type: 'text',
    defaultValue: 'Europe/London',
  },
  {
    name: 'city1StartHour',
    type: 'text',
    defaultValue: '8',  // 9am London (BST/UTC+1) = 8:00 UTC
  },
  {
    name: 'city1EndHour',
    type: 'text',
    defaultValue: '17', // 6pm London (BST/UTC+1) = 17:00 UTC
  },
  {
    name: 'city2Name',
    type: 'text',
    defaultValue: 'New York',
  },
  {
    name: 'city2Code',
    type: 'text',
    defaultValue: 'NYC',
  },
  {
    name: 'city2Timezone',
    type: 'text',
    defaultValue: 'America/New_York',
  },
  {
    name: 'city2StartHour',
    type: 'text',
    defaultValue: '13', // 9am NYC (EDT/UTC-4) = 13:00 UTC
  },
  {
    name: 'city2EndHour',
    type: 'text',
    defaultValue: '22', // 6pm NYC (EDT/UTC-4) = 22:00 UTC
  },
  {
    name: 'city3Name',
    type: 'text',
    defaultValue: 'San Francisco',
  },
  {
    name: 'city3Code',
    type: 'text',
    defaultValue: 'SFO',
  },
  {
    name: 'city3Timezone',
    type: 'text',
    defaultValue: 'America/Los_Angeles',
  },
  {
    name: 'city3StartHour',
    type: 'text',
    defaultValue: '16', // 9am SF (PDT/UTC-7) = 16:00 UTC
  },
  {
    name: 'city3EndHour',
    type: 'text',
    defaultValue: '25', // 6pm SF (PDT/UTC-7) = 01:00 UTC next day = 25
  },
])

// Map status strings to our internal status type
function parseStatus(statusStr: string): AgentStatus {
  if (!statusStr) return 'away'
  const normalized = statusStr.toLowerCase().trim()
  
  // Handle emoji-prefixed statuses from Intercom/Snowflake
  if (normalized.includes('available')) return 'chat'
  if (normalized.includes('on a call') || normalized.includes('in a call')) return 'call'
  if (normalized.includes('on a break') || normalized.includes('lunch') || normalized.includes('☕')) return 'lunch'
  if (normalized.includes('off chat hour') || normalized.includes('closing')) return 'closing'
  if (normalized.includes('done for the day') || normalized.includes('out sick') || normalized.includes('out of office')) return 'away'
  
  // Handle emoji-only values
  if (normalized.includes('🟢')) return 'chat'
  if (normalized.includes('☕')) return 'lunch'
  if (normalized.includes('🚫')) return 'closing'
  if (normalized.includes('🏡') || normalized.includes('🤒') || normalized.includes('🌴')) return 'away'
  
  // Fallback mappings
  const statusMap: Record<string, AgentStatus> = {
    'away': 'away',
    'on a call': 'call',
    'call': 'call',
    'on call': 'call',
    'lunch': 'lunch',
    'lunch break': 'lunch',
    'chat': 'chat',
    'chatting': 'chat',
    'online': 'chat',
    'closing': 'closing',
  }
  return statusMap[normalized] || 'away'
}

// Map schedule block values to status
// Y = On Chat, N = Off Chat (working), F = Focus Time, L = Lunch, X = Not working
function parseScheduleBlock(block: string, isOOO: boolean): AgentStatus {
  if (isOOO) return 'away'
  
  const normalized = block?.toUpperCase().trim()
  switch (normalized) {
    case 'Y': return 'chat'      // On Chat - available
    case 'N': return 'closing'   // Off Chat - working but not on chat
    case 'F': return 'call'      // Focus Time - busy
    case 'L': return 'lunch'     // Lunch
    case 'X': return 'away'      // Not working
    default: return 'away'
  }
}

// Get current hour in Pacific Time
function getCurrentPacificHour(): number {
  const now = new Date()
  const pacificTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    hour12: false,
  }).format(now)
  const hour = parseInt(pacificTime, 10)
  console.log(`[Time Debug] Current time: ${now.toISOString()}, Pacific hour: ${hour}`)
  return hour
}

// Extract emoji from status string (first character if it's an emoji)
function extractEmoji(statusStr: string): string | undefined {
  if (!statusStr) return undefined
  // Common Intercom emojis
  const emojiMap: Record<string, string> = {
    '🟢': '🟢',
    '☕': '☕',
    '🍕': '🍕',
    '🚫': '🚫',
    '🏡': '🏡',
    '🤒': '🤒',
    '🌴': '🌴',
    '🎯': '🎯',
    '🖥': '🖥',
  }
  // Check if the string starts with any known emoji
  for (const emoji of Object.keys(emojiMap)) {
    if (statusStr.includes(emoji)) {
      return emoji
    }
  }
  // Fallback: try to match emoji at start
  const firstChar = statusStr.charAt(0)
  if (firstChar && /\p{Emoji}/u.test(firstChar)) {
    return firstChar
  }
  return undefined
}

// Get default emoji based on parsed status
function getStatusEmoji(status: AgentStatus): string {
  const emojiMap: Record<AgentStatus, string> = {
    chat: '🟢',
    closing: '🚫',
    call: '🎯',
    lunch: '🍕',
    away: '🏡',
  }
  return emojiMap[status] || '🏡' // Default to home, not hourglass
}

// Get emoji for schedule block
function getScheduleEmoji(block: string | null | undefined, isOOO: boolean): string {
  if (isOOO) return '🌴'
  if (!block) return '🏡' // Default to away if no block
  const normalized = String(block).toUpperCase().trim()
  switch (normalized) {
    case 'Y': return '🟢'  // On Chat
    case 'N': return '🚫'  // Off Chat
    case 'F': return '🎯'  // Focus Time
    case 'L': return '🍕'  // Lunch/Break
    case 'X': return '🏡'  // Not working
    default: return '🏡'   // Unknown defaults to away, not hourglass
  }
}

// ============================================
// MOCK SCENARIO SELECTOR - Change this to switch scenarios
// ============================================
const MOCK_SCENARIO: 1 | 2 = 2  // 1 = Demo with fly-away, 2 = 9 scattered bubbles (no fly-away)

/** When a mock conversation is "assigned", which TSE to award the coin to (for demo / API) */
const MOCK_ASSIGNEE_BY_CONV: Record<string, { assignedTseId: string; assignedTseName: string }> = {
  'mock-2010': { assignedTseId: 'ankita', assignedTseName: 'Ankita' },
}

function getMockUnassignedConversations(nowSeconds: number): any[] {
  if (MOCK_SCENARIO === 1) {
    // SCENARIO 1: Simple demo - 3 bubbles with fly-away animation
    return [
      // Bubble 1: ~30 seconds from breaching (9.5 min = 570 sec) - will explode
      { id: 'mock-1001', created_at: nowSeconds - 570, waiting_since: nowSeconds - 570, admin_assignee_id: null, admin_assignee: null },  // 9.5 min - breaches in ~30s
      // Bubble 2: 5 min - will fly away after bubble 1 breaches
      { id: 'mock-1002', created_at: nowSeconds - 300, waiting_since: nowSeconds - 300, admin_assignee_id: null, admin_assignee: null },  // 5 min
      // Bubble 3: 4 min - will fly away after bubble 2
      { id: 'mock-1003', created_at: nowSeconds - 240, waiting_since: nowSeconds - 240, admin_assignee_id: null, admin_assignee: null },  // 4 min
    ]
  } else {
    // SCENARIO 2: Start with mix of bubbles - some fresh, some close to breaching
    // Then add 5 more progressively
    return [
      // Coin demo: just over 5 min – will be "assigned" after a few seconds to simulate TSE getting a coin
      { id: 'mock-2003', created_at: nowSeconds - 315, waiting_since: nowSeconds - 315, admin_assignee_id: null, admin_assignee: null }, // 5.25 min
      // Fresh bubble at ~15% (1.5 min = 90 sec)
      { id: 'mock-2001', created_at: nowSeconds - 90, waiting_since: nowSeconds - 90, admin_assignee_id: null, admin_assignee: null },
      // Bubble at ~25% (2.5 min = 150 sec)
      { id: 'mock-2002', created_at: nowSeconds - 150, waiting_since: nowSeconds - 150, admin_assignee_id: null, admin_assignee: null },
      // Bubble close to breaching at ~85% (8.5 min = 510 sec) - 90 seconds from breach
      { id: 'mock-2010', created_at: nowSeconds - 510, waiting_since: nowSeconds - 510, admin_assignee_id: null, admin_assignee: null },
      // Bubble very close to breaching at ~95% (9.5 min = 570 sec) - 30 seconds from breach
      { id: 'mock-2011', created_at: nowSeconds - 570, waiting_since: nowSeconds - 570, admin_assignee_id: null, admin_assignee: null },
    ]
  }
}

// Generate the 5 bubbles that will be added progressively (for SCENARIO 2)
function getPendingMockBubbles(nowSeconds: number): any[] {
  return [
    // Bubble at ~55% (5.5 min = 330 sec)
    { id: 'mock-2005', created_at: nowSeconds - 330, waiting_since: nowSeconds - 330, admin_assignee_id: null, admin_assignee: null },
    // Bubble at ~62% (6.2 min = 372 sec)
    { id: 'mock-2006', created_at: nowSeconds - 372, waiting_since: nowSeconds - 372, admin_assignee_id: null, admin_assignee: null },
    // Bubble at ~70% (7 min = 420 sec)
    { id: 'mock-2007', created_at: nowSeconds - 420, waiting_since: nowSeconds - 420, admin_assignee_id: null, admin_assignee: null },
    // Bubble at ~78% (7.8 min = 468 sec)
    { id: 'mock-2008', created_at: nowSeconds - 468, waiting_since: nowSeconds - 468, admin_assignee_id: null, admin_assignee: null },
    // Bubble at ~98% (9.83 min = 590 sec) - 10 seconds away from breaching
    { id: 'mock-2009', created_at: nowSeconds - 590, waiting_since: nowSeconds - 590, admin_assignee_id: null, admin_assignee: null },
  ]
}

interface ResoQueueBeltProps {
  unassignedConvs: any[]
  chatsTodayCount: number
  isAudioEnabled?: boolean
}

type CoinLeaderboardRow = {
  tseId: string
  tseName: string
  totalCoins: number
  coins5to10: number
  coins10Plus: number
}

interface CoinPodiumCardProps {
  intercomTeamMembers?: Array<{ id: string | number; name: string; avatar?: any }>
}

const COIN_SVG_URL = 'https://res.cloudinary.com/doznvxtja/image/upload/v1771295414/Add_a_subheading_2_kkiweg.svg'
const PODIUM_HEIGHTS = ['52px', '72px', '40px']
const MEDAL_COLORS = ['#c0c0c0', '#f59e0b', '#cd7f32']
const PODIUM_LABELS = ['2nd', '1st', '3rd']

/** Compute a PT date string (YYYY-MM-DD) for a given Date. */
function toPTDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

type DateRangePreset = { label: string; startDate: string; endDate: string }

function getDateRangePresets(): DateRangePreset[] {
  const now = new Date()
  const todayPT = toPTDateString(now)

  // Helper: create a Date in PT by parsing the PT date string
  const ptParts = todayPT.split('-').map(Number)
  const ptYear = ptParts[0], ptMonth = ptParts[1], ptDay = ptParts[2]

  // Day of week in PT (0=Sun, 1=Mon, ..., 6=Sat)
  const ptDow = new Date(ptYear, ptMonth - 1, ptDay).getDay()

  const fmt = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // Yesterday
  const yd = new Date(ptYear, ptMonth - 1, ptDay - 1)
  const yesterdayPT = fmt(yd.getFullYear(), yd.getMonth() + 1, yd.getDate())

  // This Week (Mon-today)
  const daysSinceMon = ptDow === 0 ? 6 : ptDow - 1
  const weekStart = new Date(ptYear, ptMonth - 1, ptDay - daysSinceMon)
  const thisWeekStart = fmt(weekStart.getFullYear(), weekStart.getMonth() + 1, weekStart.getDate())

  // Last Week (Mon-Fri of previous week)
  const lastWeekMon = new Date(ptYear, ptMonth - 1, ptDay - daysSinceMon - 7)
  const lastWeekFri = new Date(ptYear, ptMonth - 1, ptDay - daysSinceMon - 3)
  const lastWeekStart = fmt(lastWeekMon.getFullYear(), lastWeekMon.getMonth() + 1, lastWeekMon.getDate())
  const lastWeekEnd = fmt(lastWeekFri.getFullYear(), lastWeekFri.getMonth() + 1, lastWeekFri.getDate())

  // This Month
  const thisMonthStart = fmt(ptYear, ptMonth, 1)

  // Last Month
  const lmEnd = new Date(ptYear, ptMonth - 1, 0) // last day of prev month
  const lmStart = fmt(lmEnd.getFullYear(), lmEnd.getMonth() + 1, 1)
  const lastMonthEnd = fmt(lmEnd.getFullYear(), lmEnd.getMonth() + 1, lmEnd.getDate())

  // This Quarter (Feb 1 - present)
  const thisQuarterStart = fmt(ptYear, 2, 1)

  return [
    { label: 'Today', startDate: todayPT, endDate: todayPT },
    { label: 'Yesterday', startDate: yesterdayPT, endDate: yesterdayPT },
    { label: 'This Week', startDate: thisWeekStart, endDate: todayPT },
    { label: 'Last Week', startDate: lastWeekStart, endDate: lastWeekEnd },
    { label: 'This Month', startDate: thisMonthStart, endDate: todayPT },
    { label: 'Last Month', startDate: lmStart, endDate: lastMonthEnd },
    { label: 'This Quarter', startDate: thisQuarterStart, endDate: todayPT },
  ]
}

/** Shared podium renderer used by both the card and the modal. */
function renderPodium(
  podiumSlots: Array<CoinLeaderboardRow | undefined>,
  avatarByName: Map<string, string>,
  opts?: { large?: boolean }
) {
  const large = opts?.large ?? false
  const avatarSize = large ? '68px' : '56px'
  const coinSize = large ? '26px' : '22px'
  const fontSize = large ? '16px' : '14px'
  const slotWidth = large ? '140px' : '120px'
  const minH = large ? '180px' : '150px'
  const gap = large ? '18px' : '14px'

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap, minHeight: minH }}>
      {podiumSlots.map((row, idx) => {
        const normalizedName = row?.tseName?.trim().toLowerCase() || ''
        const avatarUrl = normalizedName
          ? (avatarByName.get(normalizedName) || avatarByName.get(normalizedName.split(' ')[0] || ''))
          : ''
        const initial = row?.tseName?.trim()?.charAt(0)?.toUpperCase() || '?'
        return (
          <div key={PODIUM_LABELS[idx]} style={{ width: slotWidth, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: avatarSize, height: avatarSize, borderRadius: '999px', overflow: 'hidden',
              border: `3px solid ${row ? MEDAL_COLORS[idx] : 'rgba(148,163,184,0.35)'}`,
              boxShadow: row ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              backgroundColor: row ? '#ffffff' : 'rgba(148,163,184,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', fontWeight: 800,
              color: row ? '#1f2937' : 'rgba(148,163,184,0.4)',
            }}>
              {row && avatarUrl ? (
                <img src={avatarUrl} alt={row.tseName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : row ? <span>{initial}</span> : <span>?</span>}
            </div>
            {large && row && (
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.2 }}>
                {row.tseName.split(' ')[0]}
              </div>
            )}
            {row && (
              <div style={{ fontSize, fontWeight: 700, color: MEDAL_COLORS[idx] }}>
                {row.totalCoins} <img src={COIN_SVG_URL} alt="Q-coin" style={{ width: coinSize, height: coinSize, verticalAlign: 'middle', marginLeft: '4px' }} />
              </div>
            )}
            <div style={{
              width: '100%', height: PODIUM_HEIGHTS[idx], borderRadius: '8px 8px 4px 4px',
              background: row ? `linear-gradient(180deg, ${MEDAL_COLORS[idx]} 0%, rgba(0,0,0,0.2) 100%)` : 'rgba(148,163,184,0.25)',
              border: row ? `1px solid ${MEDAL_COLORS[idx]}` : '1px dashed rgba(148,163,184,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff', fontWeight: 800, fontSize: '13px',
            }}>
              {PODIUM_LABELS[idx]}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Resolve raw leaderboard rows: merge duplicates, resolve IDs to names. */
function resolveLeaderboard(
  rows: CoinLeaderboardRow[],
  idToInfo: Map<string, { name: string; avatar: string }>,
  optimistic?: Record<string, { total: number; coins5to10: number; coins10Plus: number }>
): CoinLeaderboardRow[] {
  const byName = new Map<string, CoinLeaderboardRow>()
  rows.forEach((row) => {
    const resolvedName = idToInfo.get(row.tseName)?.name || idToInfo.get(row.tseId)?.name || row.tseName
    if (resolvedName.toLowerCase().includes('holly')) return
    const key = resolvedName.toLowerCase()
    const existing = byName.get(key)
    if (existing) {
      byName.set(key, {
        ...existing,
        totalCoins: existing.totalCoins + row.totalCoins,
        coins5to10: existing.coins5to10 + row.coins5to10,
        coins10Plus: existing.coins10Plus + row.coins10Plus,
      })
    } else {
      byName.set(key, { ...row, tseName: resolvedName })
    }
  })
  if (optimistic) {
    Object.entries(optimistic).forEach(([tseName, add]) => {
      if (tseName.toLowerCase().includes('holly')) return
      const key = tseName.toLowerCase()
      const existing = byName.get(key)
      if (existing) {
        byName.set(key, { ...existing, totalCoins: existing.totalCoins + add.total, coins5to10: existing.coins5to10 + add.coins5to10, coins10Plus: existing.coins10Plus + add.coins10Plus })
      } else {
        byName.set(key, { tseId: tseName.toLowerCase().replace(/\s+/g, '-'), tseName, totalCoins: add.total, coins5to10: add.coins5to10, coins10Plus: add.coins10Plus })
      }
    })
  }
  return Array.from(byName.values()).sort((a, b) => b.totalCoins - a.totalCoins)
}

function CoinPodiumCard({ intercomTeamMembers = [] }: CoinPodiumCardProps) {
  const [coinLeaderboard, setCoinLeaderboard] = useState<CoinLeaderboardRow[]>([])
  const [optimisticAwards, setOptimisticAwards] = useState<Record<string, { total: number; coins5to10: number; coins10Plus: number }>>({})
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false)
  const [modalDateRange, setModalDateRange] = useState<DateRangePreset | null>(null)
  const [modalLeaderboard, setModalLeaderboard] = useState<CoinLeaderboardRow[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [modalTotalAwarded, setModalTotalAwarded] = useState(0)

  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  )
  const coinsLeaderboardEndpoint = `${QHM_API_BASE_URL}/api/intercom/coins/leaderboard`

  const getMockCoinLeaderboard = useCallback((): {
    leaderboard: CoinLeaderboardRow[]
    topCoins: number
  } => {
    const leaderboard: CoinLeaderboardRow[] = [
      { tseId: 'mock-tse-1', tseName: 'Nick', totalCoins: 14, coins5to10: 8, coins10Plus: 6 },
      { tseId: 'mock-tse-2', tseName: 'Julia', totalCoins: 11, coins5to10: 9, coins10Plus: 2 },
      { tseId: 'mock-tse-3', tseName: 'Ankita', totalCoins: 9, coins5to10: 7, coins10Plus: 2 },
    ]
    return { leaderboard, topCoins: 14 }
  }, [])

  // --- Modal date-range fetch ---
  const dateRangePresets = useMemo(() => getDateRangePresets(), [])

  const fetchCoinLeaderboard = useCallback(async () => {
    if (isLocalhost) {
      const mock = getMockCoinLeaderboard()
      setCoinLeaderboard(mock.leaderboard)
      return
    }
    try {
      const monthPreset = dateRangePresets.find(p => p.label === 'This Month') || dateRangePresets[0]
      const url = `${coinsLeaderboardEndpoint}?startDate=${monthPreset.startDate}&endDate=${monthPreset.endDate}`
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) return
      const payload = await response.json()
      setCoinLeaderboard(Array.isArray(payload?.leaderboard) ? payload.leaderboard : [])
    } catch (error) {
      console.warn('[CoinPodium] Failed to fetch leaderboard:', error)
    }
  }, [coinsLeaderboardEndpoint, getMockCoinLeaderboard, isLocalhost, dateRangePresets])

  useEffect(() => {
    fetchCoinLeaderboard()
    const interval = setInterval(fetchCoinLeaderboard, 30000)
    return () => clearInterval(interval)
  }, [fetchCoinLeaderboard])

  useEffect(() => {
    const handler = (ev: Event) => {
      const d = (ev as CustomEvent<{ tseName: string; waitBucket: '5_to_10' | '10_plus' }>).detail
      if (!d?.tseName) return
      setOptimisticAwards((prev) => {
        const cur = prev[d.tseName] ?? { total: 0, coins5to10: 0, coins10Plus: 0 }
        return {
          ...prev,
          [d.tseName]: {
            total: cur.total + 1,
            coins5to10: cur.coins5to10 + (d.waitBucket === '5_to_10' ? 1 : 0),
            coins10Plus: cur.coins10Plus + (d.waitBucket === '10_plus' ? 1 : 0),
          },
        }
      })
    }
    window.addEventListener('coin-awarded', handler)
    return () => window.removeEventListener('coin-awarded', handler)
  }, [])

  const idToInfo = useMemo(() => {
    const map = new Map<string, { name: string; avatar: string }>()
    intercomTeamMembers.forEach((member) => {
      const id = String(member.id)
      const name = (member.name || '').trim()
      if (!id || !name) return
      const staticMember = TEAM_MEMBERS.find(m =>
        m.name.toLowerCase() === name.toLowerCase() ||
        m.name.toLowerCase() === name.split(' ')[0].toLowerCase()
      )
      map.set(id, { name, avatar: staticMember?.avatar || '' })
    })
    return map
  }, [intercomTeamMembers])

  const avatarByName = useMemo(() => {
    const map = new Map<string, string>()
    TEAM_MEMBERS.forEach((member) => {
      const rawName = (member?.name || '').trim().toLowerCase()
      if (!rawName || !member?.avatar) return
      map.set(rawName, member.avatar)
      const firstName = rawName.split(' ')[0]
      if (firstName) map.set(firstName, member.avatar)
    })
    idToInfo.forEach((info, id) => {
      if (info.avatar) map.set(id, info.avatar)
    })
    return map
  }, [idToInfo])

  const displayedLeaderboard = useMemo(
    () => resolveLeaderboard(coinLeaderboard, idToInfo, optimisticAwards),
    [coinLeaderboard, optimisticAwards, idToInfo]
  )

  const topThree = displayedLeaderboard.slice(0, 3)
  const podiumSlots: Array<CoinLeaderboardRow | undefined> = [topThree[1], topThree[0], topThree[2]]

  // --- Modal date-range fetch ---

  const fetchModalLeaderboard = useCallback(async (preset: DateRangePreset) => {
    setModalLoading(true)
    try {
      if (isLocalhost) {
        const mock = getMockCoinLeaderboard()
        setModalLeaderboard(mock.leaderboard)
        setModalTotalAwarded(mock.leaderboard.reduce((s, r) => s + r.totalCoins, 0))
        setModalLoading(false)
        return
      }
      const url = `${coinsLeaderboardEndpoint}?startDate=${preset.startDate}&endDate=${preset.endDate}`
      const response = await fetch(url, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      const rows: CoinLeaderboardRow[] = Array.isArray(payload?.leaderboard) ? payload.leaderboard : []
      setModalLeaderboard(rows)
      setModalTotalAwarded(typeof payload?.totalAwarded === 'number' ? payload.totalAwarded : rows.reduce((s, r) => s + r.totalCoins, 0))
    } catch (err) {
      console.warn('[CoinPodium] Modal fetch failed:', err)
      setModalLeaderboard([])
      setModalTotalAwarded(0)
    } finally {
      setModalLoading(false)
    }
  }, [coinsLeaderboardEndpoint, getMockCoinLeaderboard, isLocalhost])

  const handleOpenModal = useCallback(() => {
    const todayPreset = dateRangePresets[0]
    setModalDateRange(todayPreset)
    setIsLeaderboardModalOpen(true)
    fetchModalLeaderboard(todayPreset)
  }, [dateRangePresets, fetchModalLeaderboard])

  const handlePresetClick = useCallback((preset: DateRangePreset) => {
    setModalDateRange(preset)
    fetchModalLeaderboard(preset)
  }, [fetchModalLeaderboard])

  const resolvedModalLeaderboard = useMemo(
    () => resolveLeaderboard(modalLeaderboard, idToInfo),
    [modalLeaderboard, idToInfo]
  )

  const modalTopThree = resolvedModalLeaderboard.slice(0, 3)
  const modalPodiumSlots: Array<CoinLeaderboardRow | undefined> = [modalTopThree[1], modalTopThree[0], modalTopThree[2]]
  const modalRest = resolvedModalLeaderboard.slice(3)

  const hasPodiumData = displayedLeaderboard.length > 0

  return (
    <>
      {hasPodiumData && (
        <div
          onClick={handleOpenModal}
          style={{
            marginBottom: '12px',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <div style={{
            position: 'absolute', 
            top: '8px', 
            left: '8px',
            fontSize: '10px', 
            fontWeight: 700, 
            color: 'var(--text-muted)',
            background: 'rgba(148, 163, 184, 0.1)', 
            padding: '4px 8px', 
            borderRadius: '12px',
            letterSpacing: '0.02em',
            textTransform: 'uppercase'
          }}>
            This Month
          </div>
          {renderPodium(podiumSlots, avatarByName)}
        </div>
      )}

      {/* Leaderboard Modal */}
      {isLeaderboardModalOpen && createPortal(
        <div
          onClick={() => setIsLeaderboardModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card, #1e293b)', borderRadius: '16px',
              width: '480px', maxWidth: '95vw', maxHeight: '90vh',
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border-color-light, rgba(255,255,255,0.1))',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={COIN_SVG_URL} alt="Q-coin" style={{ width: '24px', height: '24px' }} />
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
                  Q-Coin Leaderboard
                </h2>
              </div>
              <button
                onClick={() => setIsLeaderboardModalOpen(false)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)',
                  fontSize: '22px', cursor: 'pointer', padding: '0 4px', lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* Date range pills */}
            <div style={{
              padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: '6px',
              borderBottom: '1px solid var(--border-color-light, rgba(255,255,255,0.1))',
            }}>
              {dateRangePresets.map((preset) => {
                const isActive = modalDateRange?.label === preset.label
                return (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetClick(preset)}
                    style={{
                      padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s ease',
                      border: isActive ? '1px solid #f59e0b' : '1px solid var(--border-color-light, rgba(255,255,255,0.15))',
                      background: isActive ? 'rgba(245,158,11,0.15)' : 'transparent',
                      color: isActive ? '#f59e0b' : 'var(--text-secondary, #94a3b8)',
                    }}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {modalLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted, #94a3b8)' }}>
                  <div style={{ fontSize: '14px' }}>Loading...</div>
                </div>
              ) : resolvedModalLeaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted, #94a3b8)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>0</div>
                  <div style={{ fontSize: '14px' }}>No Q-Coins awarded in this period</div>
                </div>
              ) : (
                <>
                  {/* Total summary */}
                  <div style={{
                    textAlign: 'center', marginBottom: '16px', fontSize: '13px',
                    color: 'var(--text-muted, #94a3b8)',
                  }}>
                    <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '18px' }}>{modalTotalAwarded}</span>
                    {' '}total coins awarded
                  </div>

                  {/* Podium */}
                  {renderPodium(modalPodiumSlots, avatarByName, { large: true })}

                  {/* Ranked list (4th place and below) */}
                  {modalRest.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                      {modalRest.map((row, idx) => {
                        const rank = idx + 4
                        const normalizedName = row.tseName.trim().toLowerCase()
                        const avatarUrl = avatarByName.get(normalizedName) || avatarByName.get(normalizedName.split(' ')[0] || '')
                        const initial = row.tseName.trim().charAt(0).toUpperCase()
                        return (
                          <div
                            key={row.tseId}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '10px 12px', borderRadius: '8px',
                              background: idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                            }}
                          >
                            <span style={{
                              width: '28px', textAlign: 'center', fontSize: '14px', fontWeight: 700,
                              color: 'var(--text-muted, #64748b)',
                            }}>
                              #{rank}
                            </span>
                            <div style={{
                              width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden',
                              border: '2px solid var(--border-color-light, rgba(255,255,255,0.1))',
                              backgroundColor: 'rgba(148,163,184,0.12)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '14px', fontWeight: 700, color: 'var(--text-muted, #94a3b8)',
                              flexShrink: 0,
                            }}>
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={row.tseName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span>{initial}</span>
                              )}
                            </div>
                            <div style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>
                              {row.tseName.split(' ')[0]}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '15px', fontWeight: 700, color: '#f59e0b' }}>
                              {row.totalCoins}
                              <img src={COIN_SVG_URL} alt="Q-coin" style={{ width: '20px', height: '20px' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

function isConversationUnassigned(conversation: any): boolean {
  const adminAssigneeId = conversation?.admin_assignee_id
  const adminAssignee = conversation?.admin_assignee
  const hasAssigneeId = adminAssigneeId !== null && adminAssigneeId !== undefined && adminAssigneeId !== ''
  const hasAssigneeObject = adminAssignee && (typeof adminAssignee === 'object' ? (adminAssignee.id || adminAssignee.name) : true)
  return !hasAssigneeId && !hasAssigneeObject
}

function ResoQueueBelt({ unassignedConvs, chatsTodayCount, isAudioEnabled = true }: ResoQueueBeltProps) {
  const [conveyorBeltCurrentTime, setConveyorBeltCurrentTime] = useState(() => Date.now() / 1000)
  const [showBreachedModal, setShowBreachedModal] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null)
  const [explodingIds, setExplodingIds] = useState<Set<string>>(new Set())
  const [flyingAwayIds, setFlyingAwayIds] = useState<Set<string>>(new Set())
  const [flyingAwayData, setFlyingAwayData] = useState<Map<string, { progress: number, staggerOffset: number, elapsedSeconds?: number }>>(new Map())
  const confirmedBreachedIdsRef = useRef<Set<string>>(new Set())
  const removedIdsRef = useRef<Set<string>>(new Set())
  const checkedIdsRef = useRef<Set<string>>(new Set())
  const checkingIdsRef = useRef<Set<string>>(new Set())
  const lastResetRef = useRef<number | null>(null)
  const previousBreachedIdsRef = useRef<Set<string>>(new Set())
  const previousUnassignedIdsRef = useRef<Set<string>>(new Set())
  const conversationDataRef = useRef<Map<string, { progress: number, staggerOffset: number, elapsedSeconds: number }>>(new Map())
  const queuedCoinAwardIdsRef = useRef<Set<string>>(new Set())
  const buzzerPlayedIdsRef = useRef<Set<string>>(new Set())
  const newBubbleSoundPlayedIdsRef = useRef<Set<string>>(new Set())
  const audioContextRef = useRef<AudioContext | null>(null)
  const assignmentStatusEndpoint = `${QHM_API_BASE_URL}/api/intercom/conversations/assignment-status`
  const coinsAwardEndpoint = `${QHM_API_BASE_URL}/api/intercom/coins/award`

  const awardCoinEvents = useCallback(async (events: Array<{
    conversationId: string
    waitSeconds: number
    waitBucket: '5_to_10' | '10_plus'
    assignedTseId?: string
    assignedTseName?: string
  }>) => {
    if (events.length === 0) return

    try {
      const response = await fetch(coinsAwardEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationEvents: events }),
      })

      if (!response.ok) {
        console.warn('[Reso Queue] Failed to award coins:', response.status)
        return
      }
    } catch (error) {
      console.warn('[Reso Queue] Coin award request failed:', error)
    }
  }, [coinsAwardEndpoint])

  // Initialize audio context and resume on user interaction (required for browser autoplay policies)
  useEffect(() => {
    const initAudio = async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
        
        // Resume audio context if suspended (required after user interaction)
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume()
        }
      } catch (error) {
        console.warn('[ResoQueueBelt] Could not initialize audio context:', error)
      }
    }

    // Resume audio context on any user interaction
    const handleUserInteraction = () => {
      initAudio()
    }

    // Listen for various user interaction events
    window.addEventListener('click', handleUserInteraction, { once: true })
    window.addEventListener('touchstart', handleUserInteraction, { once: true })
    window.addEventListener('keydown', handleUserInteraction, { once: true })

    return () => {
      window.removeEventListener('click', handleUserInteraction)
      window.removeEventListener('touchstart', handleUserInteraction)
      window.removeEventListener('keydown', handleUserInteraction)
    }
  }, [])

  // Play sound when a chat breaches the 10 minute mark
  const buzzerAudioRef = useRef<HTMLAudioElement | null>(null)
  const lastBuzzerPlayTimeRef = useRef<number>(0)
  const playBuzzerSound = useCallback(async () => {
    if (!isAudioEnabled) return

    const now = Date.now()
    if (now - lastBuzzerPlayTimeRef.current < 60000) return
    lastBuzzerPlayTimeRef.current = now

    try {
      // Reuse or create the Audio element
      if (!buzzerAudioRef.current) {
        buzzerAudioRef.current = new Audio('/over_10_min.mp3')
        buzzerAudioRef.current.volume = 0.3
      }

      const audio = buzzerAudioRef.current
      // Reset to start in case it's still playing from a previous trigger
      audio.currentTime = 0
      await audio.play()
    } catch (error) {
      console.warn('[ResoQueueBelt] Could not play buzzer sound:', error)
    }
  }, [isAudioEnabled])

  // Play sound when a coin is awarded
  const coinAudioRef = useRef<HTMLAudioElement | null>(null)
  const playCoinSound = useCallback(async () => {
    if (!isAudioEnabled) return

    try {
      if (!coinAudioRef.current) {
        coinAudioRef.current = new Audio('/coin_sound.mp3')
        coinAudioRef.current.volume = 0.5
      }

      const audio = coinAudioRef.current
      audio.currentTime = 0
      await audio.play()
    } catch (error) {
      console.warn('[ResoQueueBelt] Could not play coin sound:', error)
    }
  }, [isAudioEnabled])

  // Play sound when a new chat bubble is added to the conveyer belt
  const lastNewBubblePlayTimeRef = useRef<number>(0)
  const playNewBubbleSound = useCallback(async () => {
    // Don't play sound if audio is disabled
    if (!isAudioEnabled) {
      return
    }

    const now = Date.now()
    if (now - lastNewBubblePlayTimeRef.current < 60000) return
    lastNewBubblePlayTimeRef.current = now

    try {
      // Ensure audio context exists
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const audioContext = audioContextRef.current

      // Resume audio context if suspended (required for browser autoplay policies)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      // If still suspended, try to resume again (sometimes needs multiple attempts)
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume()
        } catch (e) {
          console.warn('[ResoQueueBelt] Could not resume audio context:', e)
          return
        }
      }

      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // Create a pleasant notification sound (higher frequency, shorter duration)
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.05)
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.15)
    } catch (error) {
      console.warn('[ResoQueueBelt] Could not play new bubble sound:', error)
    }
  }, [isAudioEnabled])

  // Update current time every second for conveyor belt animation
  useEffect(() => {
    const timer = setInterval(() => {
      setConveyorBeltCurrentTime(Date.now() / 1000)
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])

  // Calculate last breach reset timestamp (10:00 AM UTC) - stable, only calculated once
  const lastBreachResetTimestamp = useMemo(() => {
    const now = new Date()
    const resetTime = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      10,
      0,
      0,
      0
    ))
    if (now < resetTime) resetTime.setUTCDate(resetTime.getUTCDate() - 1)
    return resetTime.getTime() / 1000
  }, []) // Empty dependency - only calculate once on mount

  // Calculate cutoff timestamp (2:00 AM UTC of the day after reset)
  const cutoffTimestamp = useMemo(() => {
    const resetDate = new Date(lastBreachResetTimestamp * 1000)
    const cutoffTime = new Date(Date.UTC(
      resetDate.getUTCFullYear(),
      resetDate.getUTCMonth(),
      resetDate.getUTCDate(),
      2,
      0,
      0,
      0
    ))
    // If reset is at 10 AM, cutoff is 2 AM next day
    cutoffTime.setUTCDate(cutoffTime.getUTCDate() + 1)
    return cutoffTime.getTime() / 1000
  }, [lastBreachResetTimestamp])

  // Check if we're currently in the counting window (between 10 AM UTC and 2 AM UTC next day)
  // Note: Currently unused but kept for future use
  // const isInCountingWindow = useMemo(() => {
  //   const now = conveyorBeltCurrentTime
  //   // If current time is between reset (10 AM) and cutoff (2 AM next day), we're in counting window
  //   return now >= lastBreachResetTimestamp && now < cutoffTimestamp
  // }, [conveyorBeltCurrentTime, lastBreachResetTimestamp, cutoffTimestamp])

  useEffect(() => {
    if (lastResetRef.current === lastBreachResetTimestamp) return
    confirmedBreachedIdsRef.current.clear()
    removedIdsRef.current.clear()
    checkedIdsRef.current.clear()
    checkingIdsRef.current.clear()
    previousBreachedIdsRef.current.clear()
    buzzerPlayedIdsRef.current.clear()
    newBubbleSoundPlayedIdsRef.current.clear()
    queuedCoinAwardIdsRef.current.clear()
    lastResetRef.current = lastBreachResetTimestamp
  }, [lastBreachResetTimestamp])

  // TEMPORARILY DISABLED FOR TESTING - Close breached modal if we're outside the counting window
  // useEffect(() => {
  //   if (!isInCountingWindow && showBreachedModal) {
  //     setShowBreachedModal(false)
  //   }
  // }, [isInCountingWindow, showBreachedModal])

  const checkConversationAssignments = useCallback(async (conversationIds: string[]) => {
    if (conversationIds.length === 0) return

    const uniqueIds = Array.from(new Set(conversationIds)).filter(Boolean)
    if (uniqueIds.length === 0) return
    const awardedEvents: Array<{ conversationId: string; waitSeconds: number; waitBucket: '5_to_10' | '10_plus' }> = []

    uniqueIds.forEach((conversationId) => {
      checkingIdsRef.current.add(conversationId)
    })

    try {
      const response = await fetch(assignmentStatusEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationIds: uniqueIds }),
      })

      if (!response.ok) {
        console.warn('[Reso Queue] Failed to fetch assignment status:', response.status)
        return
      }

      const payload = await response.json()
      const results = Array.isArray(payload)
        ? payload
        : (payload.results || payload.conversations || [])

      results.forEach((result: any) => {
        const conversationId = String(result?.id || result?.conversation_id || '')
        if (!conversationId) return

        checkedIdsRef.current.add(conversationId)
        const isUnassigned = typeof result?.isUnassigned === 'boolean'
          ? result.isUnassigned
          : isConversationUnassigned(result)

        if (isUnassigned) {
          // Still unassigned - keep as breached (already marked as breached immediately)
          // Just ensure it's in the breached sets
          confirmedBreachedIdsRef.current.add(conversationId)
          previousBreachedIdsRef.current.add(conversationId)
          removedIdsRef.current.delete(conversationId)
        } else {
          // Has been assigned - remove from breached and mark as removed
          removedIdsRef.current.add(conversationId)
          confirmedBreachedIdsRef.current.delete(conversationId)
          previousBreachedIdsRef.current.delete(conversationId)
          if (!String(conversationId).startsWith('mock-') && !queuedCoinAwardIdsRef.current.has(conversationId)) {
            queuedCoinAwardIdsRef.current.add(conversationId)
            awardedEvents.push({
              conversationId,
              waitSeconds: 600,
              waitBucket: '10_plus',
            })
          }
          // Remove from exploding if it was exploding
          setExplodingIds(prev => {
            const next = new Set(prev)
            next.delete(conversationId)
            return next
          })
        }
      })
    } catch (error) {
      console.error('[Reso Queue] Error fetching assignment status:', error)
    } finally {
      if (awardedEvents.length > 0) {
        await awardCoinEvents(awardedEvents)
      }
      uniqueIds.forEach((conversationId) => {
        checkingIdsRef.current.delete(conversationId)
      })
    }
  }, [awardCoinEvents])

  useEffect(() => {
    const now = conveyorBeltCurrentTime
    const eligibleIds: string[] = []

    unassignedConvs.forEach((conv) => {
      const convId = conv.id || conv.conversation_id
      if (!convId || String(convId).startsWith('mock-')) return
      if (removedIdsRef.current.has(convId)) return
      if (!conv.createdTimestamp) return

      // Use waiting_since for elapsed time calculation, fallback to createdTimestamp
      const waitingSinceTimestamp = conv.waitingSinceTimestamp || conv.waiting_since
        ? (typeof conv.waiting_since === "number" 
            ? (conv.waiting_since > 1e12 ? conv.waiting_since / 1000 : conv.waiting_since)
            : (conv.waitingSinceTimestamp || (conv.waiting_since ? new Date(conv.waiting_since).getTime() / 1000 : null)))
        : null
      
      const waitStartTimestamp = waitingSinceTimestamp || conv.createdTimestamp
      const elapsedSeconds = now - waitStartTimestamp

      // Immediately mark as breached when reaching 10 minutes (don't wait for API call)
      if (elapsedSeconds >= 600) {
        // Check if this is a newly breached conversation
        if (!confirmedBreachedIdsRef.current.has(convId) && !previousBreachedIdsRef.current.has(convId)) {
          // Play buzzer sound when breach occurs
          if (!buzzerPlayedIdsRef.current.has(convId)) {
            playBuzzerSound()
            buzzerPlayedIdsRef.current.add(convId)
          }
          
          // Trigger explosion GIF immediately
          setExplodingIds(prev => new Set(prev).add(convId))
          // Remove from exploding after GIF plays (1 second)
          setTimeout(() => {
            setExplodingIds(prev => {
              const next = new Set(prev)
              next.delete(convId)
              return next
            })
          }, 1000)
        }
        // Mark as breached immediately
        confirmedBreachedIdsRef.current.add(convId)
        previousBreachedIdsRef.current.add(convId)
        
        // Add to eligible IDs for API check (to verify if still unassigned)
        if (!checkedIdsRef.current.has(convId) && !checkingIdsRef.current.has(convId)) {
          eligibleIds.push(String(convId))
        }
      }
    })

    // Only check assignments for conversations that just breached (API call verifies if still unassigned)
    if (eligibleIds.length === 0) return

    const batchSize = 20
    checkConversationAssignments(eligibleIds.slice(0, batchSize))
  }, [unassignedConvs, conveyorBeltCurrentTime, checkConversationAssignments, playBuzzerSound])

  // Automatically mark mock conversations as breached if they're over 10 minutes old
  useEffect(() => {
    const now = conveyorBeltCurrentTime
    
    unassignedConvs.forEach((conv) => {
      const convId = conv.id || conv.conversation_id
      if (!convId || !String(convId).startsWith('mock-')) return
      if (!conv.createdTimestamp) return
      if (removedIdsRef.current.has(convId)) return
      
      // Use waiting_since for elapsed time calculation, fallback to createdTimestamp
      const waitingSinceTimestamp = conv.waitingSinceTimestamp || conv.waiting_since
        ? (typeof conv.waiting_since === "number" 
            ? (conv.waiting_since > 1e12 ? conv.waiting_since / 1000 : conv.waiting_since)
            : (conv.waitingSinceTimestamp || (conv.waiting_since ? new Date(conv.waiting_since).getTime() / 1000 : null)))
        : null
      
      const waitStartTimestamp = waitingSinceTimestamp || conv.createdTimestamp
      const elapsedSeconds = now - waitStartTimestamp

      // Mark as breached when elapsed time reaches 600 seconds (10 minutes)
      if (elapsedSeconds >= 600) {
        // Check if this is a newly breached conversation
        if (!confirmedBreachedIdsRef.current.has(convId) && !previousBreachedIdsRef.current.has(convId)) {
          // Play buzzer sound when breach occurs
          if (!buzzerPlayedIdsRef.current.has(convId)) {
            playBuzzerSound()
            buzzerPlayedIdsRef.current.add(convId)
          }
          
          // Trigger explosion GIF
          setExplodingIds(prev => new Set(prev).add(convId))
          // Remove from exploding after GIF plays (1 second)
          setTimeout(() => {
            setExplodingIds(prev => {
              const next = new Set(prev)
              next.delete(convId)
              return next
            })
          }, 1000)
        }
        // Mark as breached
        confirmedBreachedIdsRef.current.add(convId)
        previousBreachedIdsRef.current.add(convId)
        checkedIdsRef.current.add(convId)
      } else {
        // Remove from breached if under 10 minutes
        confirmedBreachedIdsRef.current.delete(convId)
      }
    })
  }, [unassignedConvs, conveyorBeltCurrentTime, playBuzzerSound])

  // Detect when conversations get assigned (disappear from queue before 10 min mark)
  // Triggers fly-away animation for successfully assigned conversations
  useEffect(() => {
    const currentIds = new Set<string>()
    const awardCandidates: Array<{ conversationId: string; waitSeconds: number; waitBucket: '5_to_10' | '10_plus' }> = []
    
    // Build set of current conversation IDs and store their position data
    unassignedConvs.forEach((conv) => {
      const convId = conv.id || conv.conversation_id
      if (!convId) return
      
      currentIds.add(String(convId))
      
      // Calculate and store current progress for potential fly-away animation
      const createdTimestamp = conv.createdTimestamp
      if (createdTimestamp) {
        const waitingSinceTimestamp = conv.waitingSinceTimestamp || conv.waiting_since
          ? (typeof conv.waiting_since === "number" 
              ? (conv.waiting_since > 1e12 ? conv.waiting_since / 1000 : conv.waiting_since)
              : (conv.waitingSinceTimestamp || (conv.waiting_since ? new Date(conv.waiting_since).getTime() / 1000 : null)))
          : null
        const waitStartTimestamp = waitingSinceTimestamp || createdTimestamp
        const elapsedSeconds = conveyorBeltCurrentTime - waitStartTimestamp
        const progressPercent = Math.min((elapsedSeconds / 600) * 100, 100)
        // Use conversation ID to determine stable offset (consistent with rendering)
        const idHash = String(convId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        const staggerOffset = (idHash % 3 === 0) ? 0 : (idHash % 3 === 1) ? -25 : 25
        
        conversationDataRef.current.set(String(convId), { progress: progressPercent, staggerOffset, elapsedSeconds })
      }
    })
    
    // Check for conversations that were in previous list but not in current (assigned!)
    previousUnassignedIdsRef.current.forEach(prevId => {
      // Skip if still in current list
      if (currentIds.has(prevId)) return
      // Skip if already flying away or exploding
      if (flyingAwayIds.has(prevId)) return
      if (explodingIds.has(prevId)) return
      // Skip if it was breached (explosion handles this)
      if (confirmedBreachedIdsRef.current.has(prevId)) return
      if (previousBreachedIdsRef.current.has(prevId)) return
      // Skip if already removed
      if (removedIdsRef.current.has(prevId)) return
      
      // This conversation was assigned before breaching! Trigger fly-away
      const savedData = conversationDataRef.current.get(prevId)
      const elapsedForAward = savedData?.elapsedSeconds || 0
      // Award coin when assigned after 30+ seconds (include mock IDs so demo can simulate coin reward)
      if (elapsedForAward >= 30 && !queuedCoinAwardIdsRef.current.has(prevId)) {
        queuedCoinAwardIdsRef.current.add(prevId)
        const mockAssignee = MOCK_ASSIGNEE_BY_CONV[prevId]
        awardCandidates.push({
          conversationId: prevId,
          waitSeconds: Math.floor(elapsedForAward),
          waitBucket: elapsedForAward >= 600 ? '10_plus' : '5_to_10',
          ...(mockAssignee && { assignedTseId: mockAssignee.assignedTseId, assignedTseName: mockAssignee.assignedTseName }),
        })
      }

      console.log('[Reso Queue] Checking fly-away for:', prevId, {
        hasSavedData: !!savedData,
        progress: savedData?.progress,
        progressLessThan100: savedData ? savedData.progress < 100 : false,
        isMock: String(prevId).startsWith('mock-')
      })
      
      // For mock conversations, always trigger fly-away if we have data
      // For real conversations, only trigger if progress < 100 (not breached)
      const shouldTriggerFlyAway = savedData && (
        String(prevId).startsWith('mock-') || savedData.progress < 100
      )
      
      if (shouldTriggerFlyAway) {
        console.log('[Reso Queue] Conversation assigned, triggering fly-away:', prevId)
        
        playCoinSound()

        // Store the position data for animation
        setFlyingAwayData(prev => new Map(prev).set(prevId, savedData))
        setFlyingAwayIds(prev => new Set(prev).add(prevId))
        
        // Remove after animation completes (3.5s total: 2s delay + 1.5s animation)
        setTimeout(() => {
          setFlyingAwayIds(prev => {
            const next = new Set(prev)
            next.delete(prevId)
            return next
          })
          setFlyingAwayData(prev => {
            const next = new Map(prev)
            next.delete(prevId)
            return next
          })
          removedIdsRef.current.add(prevId)
        }, 3500)
      }
    })
    
    // Check for new conversations that weren't in the previous list (new bubbles added)
    // Skip on initial load (when previousUnassignedIdsRef is empty)
    if (previousUnassignedIdsRef.current.size > 0) {
      currentIds.forEach(convId => {
        // If this ID wasn't in the previous list, it's a new bubble
        if (!previousUnassignedIdsRef.current.has(convId)) {
          // Skip if we've already played the sound for this ID
          if (!newBubbleSoundPlayedIdsRef.current.has(convId)) {
            // Play sound for new bubble
            playNewBubbleSound()
            newBubbleSoundPlayedIdsRef.current.add(convId)
          }
        }
      })
    }

    if (awardCandidates.length > 0) {
      awardCoinEvents(awardCandidates)
      // Optimistic update: so podium shows +1 for mock assignees (e.g. Ankita) without waiting for API/refetch
      awardCandidates.forEach((e) => {
        const tseName = (e as { assignedTseName?: string }).assignedTseName
        if (tseName) {
          window.dispatchEvent(new CustomEvent('coin-awarded', { detail: { tseName, waitBucket: e.waitBucket } }))
        }
      })
    }
    
    // Update previous IDs for next comparison
    previousUnassignedIdsRef.current = currentIds
  }, [
    unassignedConvs,
    conveyorBeltCurrentTime,
    flyingAwayIds,
    explodingIds,
    playNewBubbleSound,
    playCoinSound,
    awardCoinEvents
  ])

  const confirmedBreachedConvs = useMemo(() => {
    return unassignedConvs.filter((conv) => {
      const convId = conv.id || conv.conversation_id
      if (!convId) return false
      if (removedIdsRef.current.has(convId)) return false
      if (!confirmedBreachedIdsRef.current.has(convId)) return false
      const createdTimestamp = conv.createdTimestamp
      if (!createdTimestamp) return false
      // Skip timestamp filters for mock conversations
      if (String(convId).startsWith('mock-')) return true
      // Must be after reset (10 AM UTC) and before cutoff (2 AM UTC next day)
      if (createdTimestamp < lastBreachResetTimestamp) return false
      if (createdTimestamp >= cutoffTimestamp) return false
      return true
    })
  }, [unassignedConvs, conveyorBeltCurrentTime, lastBreachResetTimestamp, cutoffTimestamp])
  const breachedCount = confirmedBreachedConvs.length

  return (
    <>
      {/* Reso Queue - Waiting Conveyor Belt */}
      <div style={{
        marginBottom: '24px',
        overflow: 'visible'
      }}>
        {(() => {
          // Calculate average wait time for all conversations received during the day
          const conversationsForDay = unassignedConvs.filter((conv) => {
            const convId = conv.id || conv.conversation_id
            const createdTimestamp = conv.createdTimestamp
            if (!createdTimestamp) return false
            // Skip timestamp filters for mock conversations
            if (convId && String(convId).startsWith('mock-')) return true
            // Must be after reset (10 AM UTC) and before cutoff (2 AM UTC next day)
            if (createdTimestamp < lastBreachResetTimestamp) return false
            if (createdTimestamp >= cutoffTimestamp) return false
            return true
          })

          const totalWaitTimeSeconds = conversationsForDay.reduce((sum, conv) => {
            // Use waiting_since for accurate wait time calculation
            const waitingSinceTimestamp = conv.waitingSinceTimestamp || conv.waiting_since
              ? (typeof conv.waiting_since === "number" 
                  ? (conv.waiting_since > 1e12 ? conv.waiting_since / 1000 : conv.waiting_since)
                  : (conv.waitingSinceTimestamp || (conv.waiting_since ? new Date(conv.waiting_since).getTime() / 1000 : null)))
              : null
            
            // Fallback to createdTimestamp if waiting_since is not available
            const waitStartTimestamp = waitingSinceTimestamp || conv.createdTimestamp
            if (!waitStartTimestamp) return sum
            
            const elapsedSeconds = conveyorBeltCurrentTime - waitStartTimestamp
            return sum + elapsedSeconds
          }, 0)

          const averageWaitTimeSeconds = conversationsForDay.length > 0
            ? Math.round(totalWaitTimeSeconds / conversationsForDay.length)
            : 0

          // Format average wait time as "Xm Ys" or "Xs"
          const formatWaitTime = (seconds: number): string => {
            if (seconds < 60) {
              return `${seconds}s`
            }
            const minutes = Math.floor(seconds / 60)
            const remainingSeconds = seconds % 60
            if (remainingSeconds === 0) {
              return `${minutes}m`
            }
            return `${minutes}m ${remainingSeconds}s`
          }

          // Count TOTAL unassigned conversations (includes both belt and breached)
          // This shows all chats waiting to be picked up, regardless of wait time
          // Note: totalUnassignedCount calculation removed as it was unused

          // Color code based on average wait time
          // Green: < 5 minutes, Yellow: 5-10 minutes, Red: > 10 minutes
          const getWaitTimeColor = (seconds: number): string => {
            const minutes = seconds / 60
            if (minutes < 5) {
              return '#4cec8c' // Green
            } else if (minutes <= 10) {
              return '#ffc107' // Yellow
            } else {
              return '#fd8789' // Red
            }
          }

          return (
            <h3 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: getWaitTimeColor(averageWaitTimeSeconds),
              display: 'flex',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              Avg: {formatWaitTime(averageWaitTimeSeconds)}
            </h3>
          )
        })()}
        
        {/* Conveyor Belt Visualization */}
        <div style={{
          width: '100%',
          maxWidth: '100%',
          height: '120px',
          position: 'relative',
          backgroundColor: 'var(--bg-body)',
          overflow: 'visible',
          marginBottom: '32px',
          marginLeft: 0,
          marginRight: 0,
          paddingTop: '20px',
          paddingBottom: '20px',
          paddingLeft: '10px',
          paddingRight: '110px'
        }}>
          {/* Horizontal gradient line (green to red) */}
          <div style={{
            position: 'absolute',
            left: '10px',
            right: '110px',
            top: '50%',
            height: '4px',
            background: 'linear-gradient(to right, #4cec8c 0%, #ffc107 50%, #ff9800 80%, #fd8789 100%)',
            transform: 'translateY(-50%)',
            zIndex: 1,
            borderRadius: '2px'
          }} />
          
          {/* 5-minute threshold line */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '5px',
            bottom: '5px',
            width: '4px',
            backgroundColor: '#ffc107',
            zIndex: 10,
            boxShadow: '0 0 8px rgba(255, 193, 7, 0.3)',
            transform: 'translateX(-50%)'
          }} />
          
          {/* 5-minute threshold label */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '-22px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            backgroundColor: 'rgba(255, 193, 7, 0.3)',
            padding: '3px 8px',
            borderRadius: '4px',
            zIndex: 11,
            whiteSpace: 'nowrap',
            transform: 'translateX(-50%)',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
          }}>
            5 min
          </div>
          
          {/* 10-minute threshold line */}
          <div style={{
            position: 'absolute',
            right: '110px',
            top: '5px',
            bottom: '5px',
            width: '4px',
            backgroundColor: '#fd8789',
            zIndex: 10,
            boxShadow: '0 0 8px rgba(253, 135, 137, 0.3)'
          }} />
          
          {/* 10-minute threshold label */}
          <div style={{
            position: 'absolute',
            right: '110px',
            top: '-22px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            backgroundColor: 'rgba(253, 135, 137, 0.3)',
            padding: '3px 8px',
            borderRadius: '4px',
            zIndex: 11,
            whiteSpace: 'nowrap',
            transform: 'translateX(50%)',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
          }}>
            10 min
          </div>
          
          {/* Conveyor belt items */}
          {unassignedConvs.filter((conv) => {
            const createdTimestamp = conv.createdTimestamp
            if (!createdTimestamp) return false
            const convId = conv.id || conv.conversation_id
            if (convId && removedIdsRef.current.has(convId)) return false
            // Show exploding bubbles during animation, then remove breached ones
            if (convId && explodingIds.has(convId)) return true // Keep showing during explosion
            if (convId && confirmedBreachedIdsRef.current.has(convId)) return false
            return true
          }).map((conv, index) => {
            const convId = conv.id || conv.conversation_id
            const createdTimestamp = conv.createdTimestamp
            
            // Use waiting_since for wait time calculation, fallback to createdTimestamp
            const waitingSinceTimestamp = conv.waitingSinceTimestamp || conv.waiting_since
              ? (typeof conv.waiting_since === "number" 
                  ? (conv.waiting_since > 1e12 ? conv.waiting_since / 1000 : conv.waiting_since)
                  : (conv.waitingSinceTimestamp || (conv.waiting_since ? new Date(conv.waiting_since).getTime() / 1000 : null)))
              : null
            
            const waitStartTimestamp = waitingSinceTimestamp || createdTimestamp
            const elapsedSeconds = waitStartTimestamp ? conveyorBeltCurrentTime - waitStartTimestamp : 0
            const progressPercent = Math.min((elapsedSeconds / 600) * 100, 100)
            
            const isPendingBreachCheck = elapsedSeconds >= 600 && elapsedSeconds < 660
            const isConfirmedBreached = !!(convId && confirmedBreachedIdsRef.current.has(convId))
            const isBreached = elapsedSeconds >= 600
            
            const secondsRemaining = Math.max(0, Math.floor(600 - elapsedSeconds))
            const minutesRemaining = Math.floor(secondsRemaining / 60)
            const secsRemaining = secondsRemaining % 60
            
            // Stagger bubbles vertically to avoid overlap
            // Use conversation ID to determine stable offset (doesn't change when other bubbles are removed)
            const idHash = String(convId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            const staggerOffset = (idHash % 3 === 0) ? 0 : (idHash % 3 === 1) ? -25 : 25
            
            // Determine which SVG to use based on breach status and progress
            // Green: more than 7 minutes remaining (< 30% progress)
            // Yellow: 7, 6, 5, and 4 minutes remaining (30% - 60% progress)
            // Red: less than 4 min remaining or breached (>= 60% progress or breached)
            const getSvgUrl = () => {
              if (isConfirmedBreached || progressPercent >= 60) {
                return 'https://res.cloudinary.com/doznvxtja/image/upload/v1769146409/8_symmfo.svg' // Red
              } else if (progressPercent >= 30) {
                return 'https://res.cloudinary.com/doznvxtja/image/upload/v1769146409/9_nmhwpr.svg' // Yellow
              } else {
                return 'https://res.cloudinary.com/doznvxtja/image/upload/v1769161765/huddle_logo_1_xlram0.svg' // Green
              }
            }
            
            const svgUrl = getSvgUrl()
            const timerText = isConfirmedBreached 
              ? 'BREACHED' 
              : (minutesRemaining > 0 ? `${minutesRemaining}m ${secsRemaining}s` : `${secsRemaining}s`)
            
            // Check if this bubble is currently exploding
            const isExploding = convId && explodingIds.has(convId)
            
            return (
              <div
                key={convId}
                onClick={() => !isExploding && setSelectedConversation(conv)}
                style={{
                  position: 'absolute',
                  // Position using right offset - starts far right, moves toward 10 min marker (110px from right)
                  // At 0% progress: right = calc(100% - 10px) (far left of belt)
                  // At 100% progress: right = 110px (at 10 min marker)
                  right: `calc(110px + (100% - 120px) * ${(100 - Math.min(progressPercent, 100)) / 100})`,
                  top: `calc(50% + ${staggerOffset}px)`,
                  transform: 'translate(50%, -50%)',
                  transition: 'right 1s linear, top 0.3s ease, z-index 0s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  color: 'inherit',
                  zIndex: isExploding ? 200 : 20 + index,  // Exploding bubbles on top
                  cursor: isExploding ? 'default' : 'pointer',
                  outline: 'none',
                  border: 'none',
                  pointerEvents: isExploding ? 'none' : 'auto'
                }}
                onMouseEnter={(e) => {
                  if (!isExploding) {
                    e.currentTarget.style.transform = 'translate(50%, -50%) scale(1.1)'
                    e.currentTarget.style.zIndex = '100'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isExploding) {
                    e.currentTarget.style.transform = 'translate(50%, -50%) scale(1)'
                    e.currentTarget.style.zIndex = String(20 + index)
                  }
                }}
                title={`Conversation ${convId} - ${isBreached ? 'BREACHED' : (isPendingBreachCheck ? 'Pending breach check' : `${minutesRemaining}m ${secsRemaining}s until breach`)}`}
              >
                <div style={{
                  position: 'relative',
                  width: '80px',
                  height: '80px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: 'none',
                  border: 'none'
                }}>
                  {isExploding ? (
                    // Explosion GIF
                    <img 
                      src="https://res.cloudinary.com/doznvxtja/image/upload/v1769461711/huddle_logo_ahdn5q.gif"
                      alt="Explosion"
                      style={{
                        width: '120px',
                        height: '120px',
                        objectFit: 'contain',
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        outline: 'none',
                        border: 'none'
                      }}
                    />
                  ) : (
                    // Normal chat bubble
                    <>
                      <img 
                        src={svgUrl}
                        alt="Chat status"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          outline: 'none',
                          border: 'none'
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#000000',
                        textAlign: 'center',
                        lineHeight: '1.2',
                        whiteSpace: 'nowrap',
                        textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                        zIndex: 1
                      }}>
                        {timerText}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          
          {/* Flying Away Bubbles - Successfully assigned conversations */}
          {Array.from(flyingAwayIds).map((convId) => {
            const data = flyingAwayData.get(convId)
            if (!data) return null
            
            const { progress, staggerOffset } = data
            
            // Always use coin GIF for all assigned chats
            const flyAwayImageUrl = 'https://res.cloudinary.com/doznvxtja/image/upload/v1771896146/q-coin_spin_k0nqod.gif'
            const flyAwaySize = '100px'
            
            return (
              <div
                key={`flying-${convId}`}
                className="bubble-flying-away"
                style={{
                  position: 'absolute',
                  right: `calc(110px + (100% - 120px) * ${(100 - Math.min(progress, 100)) / 100})`,
                  top: `calc(50% + ${staggerOffset}px)`,
                  transform: 'translate(50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 300,
                  pointerEvents: 'none',
                  animation: 'fly-away 1.5s ease-out 2s forwards'
                }}
              >
                {/* Trail particles */}
                <div className="trail-container">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="trail-particle"
                      style={{
                        animationDelay: `${2 + i * 0.08}s`,
                        opacity: 1 - (i * 0.2)
                      }}
                    />
                  ))}
                </div>
                <div style={{
                  position: 'relative',
                  width: flyAwaySize,
                  height: flyAwaySize,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img 
                    src={flyAwayImageUrl}
                    alt="Assigned"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      borderRadius: '50%'
                    }}
                  />
                </div>
              </div>
            )
          })}
          
          {/* Breached stack to the right of the conveyor belt */}
          <div
            onClick={() => breachedCount > 0 && setShowBreachedModal(true)}
            style={{
              position: 'absolute',
              right: '0px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 20,
              width: '96px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: breachedCount > 0 ? 'pointer' : 'default',
              userSelect: 'none'
            }}
            title={
              breachedCount > 0
                ? `${breachedCount} chats are 10+ minutes and still unassigned (${chatsTodayCount} chats today). Click to view.`
                : 'No chats are currently 10+ minutes and unassigned.'
            }
          >
            <div style={{ position: 'relative', width: '56px', height: '46px' }}>
              {[0, 1, 2].map((layer) => {
                const visibleLayers = Math.min(breachedCount, 3)
                const isVisible = layer < visibleLayers
                return (
                  <div
                    key={`breached-stack-${layer}`}
                    style={{
                      position: 'absolute',
                      left: `${layer * 8}px`,
                      top: `${(2 - layer) * 4}px`,
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      backgroundColor: breachedCount === 0
                        ? '#ffffff'
                        : (isVisible ? '#fd8789' : 'rgba(253, 135, 137, 0.15)'),
                      border: breachedCount === 0
                        ? '2px solid #10b981'
                        : (isVisible ? '2px solid #ffffff' : '1px dashed rgba(253, 135, 137, 0.35)'),
                      boxShadow: breachedCount === 0
                        ? '0 0 10px rgba(16, 185, 129, 0.25)'
                        : (isVisible ? '0 0 12px rgba(253, 135, 137, 0.45)' : 'none'),
                      transition: 'all 0.2s ease'
                    }}
                  />
                )
              })}

              <div style={{
                position: 'absolute',
                right: '-10px',
                top: '-12px',
                minWidth: '42px',
                height: '42px',
                borderRadius: '999px',
                backgroundColor: breachedCount === 0 ? '#ffffff' : '#d84c4c',
                color: breachedCount === 0 ? '#10b981' : '#ffffff',
                fontSize: '26px',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 12px',
                border: breachedCount === 0 ? '3px solid #10b981' : '3px solid #ffffff',
                boxShadow: breachedCount === 0
                  ? '0 3px 12px rgba(16,185,129,0.25)'
                  : '0 3px 12px rgba(0,0,0,0.35)',
                lineHeight: 1,
              }}>
                {breachedCount}
              </div>
            </div>

            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              lineHeight: 1.2,
              color: breachedCount > 0 ? '#fd8789' : '#10b981',
              textAlign: 'center',
              maxWidth: '90px'
            }}>
              10+ min unassigned
            </div>
          </div>
        </div>

      </div>
      
      {/* Breached Conversations Modal */}
      {showBreachedModal && (() => {
        const breachedConvs = confirmedBreachedConvs.map((conv) => {
          const createdTimestamp = conv.createdTimestamp
          const elapsedSeconds = conveyorBeltCurrentTime - createdTimestamp
          const waitTimeMinutes = Math.floor(elapsedSeconds / 60)
          const waitTimeHours = Math.floor(waitTimeMinutes / 60)
          const waitTimeDays = Math.floor(waitTimeHours / 24)
          
          let waitTimeDisplay = ''
          if (waitTimeDays > 0) {
            waitTimeDisplay = `${waitTimeDays}d ${waitTimeHours % 24}h`
          } else if (waitTimeHours > 0) {
            waitTimeDisplay = `${waitTimeHours}h ${waitTimeMinutes % 60}m`
          } else {
            waitTimeDisplay = `${waitTimeMinutes}m`
          }
          
          return {
            ...conv,
            waitTimeDisplay,
            elapsedSeconds
          }
        }).sort((a, b) => b.elapsedSeconds - a.elapsedSeconds)
        
        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
            onClick={() => setShowBreachedModal(false)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                border: '1px solid #e0e0e0'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#292929'
                }}>
                  Breached Conversations ({breachedConvs.length})
                </h2>
                <button
                  onClick={() => setShowBreachedModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#666',
                    padding: '0',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0f0f0'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {breachedConvs.map((conv) => {
                  const convId = conv.id || conv.conversation_id
                  return (
                    <div
                      key={convId}
                      style={{
                        padding: '12px',
                        backgroundColor: '#f9f9f9',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0'
                      }}
                    >
                      <a
                        href={`https://app.intercom.com/a/inbox/${convId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '16px',
                          fontWeight: 600,
                          color: '#0066cc',
                          textDecoration: 'none'
                        }}
                      >
                        Conversation {convId}
                      </a>
                      <div style={{
                        fontSize: '14px',
                        color: '#666',
                        marginTop: '4px'
                      }}>
                        Wait time: {conv.waitTimeDisplay}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Individual Conversation Modal */}
      {selectedConversation && (() => {
        const conv = selectedConversation
        const convId = conv.id || conv.conversation_id
        const createdAt = conv.created_at || conv.createdAt || conv.first_opened_at
        const waitingSince = conv.waiting_since || createdAt
        
        // Format timestamps for display
        const formatTimestamp = (ts: any) => {
          if (!ts) return 'N/A'
          const date = typeof ts === 'number' 
            ? new Date(ts > 1e12 ? ts : ts * 1000) 
            : new Date(ts)
          return date.toLocaleString()
        }
        
        const intercomUrl = `https://app.intercom.com/a/inbox/gu1e0q0t/inbox/admin/9110812/conversation/${convId}`
        
        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
            onClick={() => setSelectedConversation(null)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '450px',
                width: '100%',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                border: '1px solid #e0e0e0'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#292929'
                }}>
                  Conversation Details
                </h2>
                <button
                  onClick={() => setSelectedConversation(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#666',
                    padding: '0',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0f0f0'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  ×
                </button>
              </div>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {/* Conversation ID */}
                <div style={{
                  padding: '12px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#666',
                    marginBottom: '4px',
                    textTransform: 'uppercase'
                  }}>
                    Conversation ID
                  </div>
                  <a
                    href={intercomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#0066cc',
                      textDecoration: 'none'
                    }}
                  >
                    {convId}
                  </a>
                </div>
                
                {/* Created At */}
                <div style={{
                  padding: '12px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#666',
                    marginBottom: '4px',
                    textTransform: 'uppercase'
                  }}>
                    Created At
                  </div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: '#292929'
                  }}>
                    {formatTimestamp(createdAt)}
                  </div>
                </div>
                
                {/* Waiting Since */}
                <div style={{
                  padding: '12px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#666',
                    marginBottom: '4px',
                    textTransform: 'uppercase'
                  }}>
                    Waiting Since
                  </div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: '#292929'
                  }}>
                    {formatTimestamp(waitingSince)}
                  </div>
                </div>
              </div>
              
              {/* Open in Intercom Button */}
              <a
                href={intercomUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  marginTop: '20px',
                  padding: '12px 20px',
                  backgroundColor: '#0066cc',
                  color: '#ffffff',
                  textAlign: 'center',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '14px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0052a3'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0066cc'
                }}
              >
                Open in Intercom
              </a>
            </div>
          </div>
        )
      })()}
    </>
  )
}

export function AvailabilityPlugin() {
  // VERSION CHECK - if you don't see this, you're running cached code!
  console.log('🚀 PLUGIN VERSION: 8.15 - Fix sort to not mutate cached array')
  
  // Dark mode state management
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved === 'true'
  })

  useEffect(() => {
    const root = document.documentElement || document.body
    if (isDarkMode) {
      root.classList.add('dark-mode')
    } else {
      root.classList.remove('dark-mode')
    }
    localStorage.setItem('darkMode', String(isDarkMode))
  }, [isDarkMode])

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev)
  }

  // Audio enabled state management (always defaults to disabled, no persistence)
  const [isAudioEnabled, setIsAudioEnabled] = useState(false)

  // Live TSE counts from the AvailableTSEsTable component
  const [liveTseCounts, setLiveTseCounts] = useState({ active: 0, away: 0 })

  const toggleAudio = () => {
    setIsAudioEnabled(prev => !prev)
  }
  
  // Debug: Check if client is available
  console.log('[Client Check] client object:', typeof client)
  console.log('[Client Check] client.elements:', typeof client?.elements)
  console.log('[Client Check] client.elements.subscribeToElementData:', typeof client?.elements?.subscribeToElementData)
  
  // Get configuration from Sigma editor panel
  const config = useConfig()
  
  // Get the element IDs from config
  const sourceElementId = config['Status Source'] as string
  const scheduleElementId = config.scheduleSource as string
  const chatsPerHourElementId = config.chatsPerHourSource as string
  const oooElementId = config.oooSource as string
  const officeHoursElementId = config.officeHoursSource as string
  const activeTSEsElementId = config.activeTSEsSource as string
  const awayTSEsElementId = config.awayTSEsSource as string
  const tseConversationElementId = config.tseConversationSource as string
  
  // Debug: Log element IDs immediately after extraction
  console.log('🔍 [AvailabilityPlugin] Element IDs from config:')
  console.log('🔍   - activeTSEsElementId:', activeTSEsElementId, 'type:', typeof activeTSEsElementId, 'truthy:', !!activeTSEsElementId)
  console.log('🔍   - awayTSEsElementId:', awayTSEsElementId, 'type:', typeof awayTSEsElementId, 'truthy:', !!awayTSEsElementId)
  console.log('🔍   - config.activeTSEsSource:', config.activeTSEsSource)
  console.log('🔍   - config.awayTSEsSource:', config.awayTSEsSource)
  
  // Get column mappings from Sigma using actual element IDs
  const columns = useElementColumns(sourceElementId)
  const scheduleColumns = useElementColumns(scheduleElementId)
  const oooColumns = useElementColumns(oooElementId)
  // const officeHoursColumns = useElementColumns(officeHoursElementId) // Unused but kept for future use
  const activeTSEsColumns = useElementColumns(activeTSEsElementId)
  const awayTSEsColumns = useElementColumns(awayTSEsElementId)
  const tseConversationColumns = useElementColumns(tseConversationElementId)
  
  // Get actual data from the connected Sigma worksheets using element IDs
  // Note: useElementData may return undefined if element ID is undefined, or empty object {} if element is connected but has no data
  // IMPORTANT: Hooks must be called unconditionally (Rules of Hooks). Never wrap useElementData in a conditional.
  const sigmaData = useElementData(sourceElementId)
  const scheduleData = useElementData(scheduleElementId)
  const chatsPerHourSigmaDataRaw = useElementData(chatsPerHourElementId)
  const chatsPerHourSigmaData = chatsPerHourElementId ? chatsPerHourSigmaDataRaw : undefined
  const oooData = useElementData(oooElementId)
  const officeHoursData = useElementData(officeHoursElementId)
  
  const activeTSEsDataRaw = useElementData(activeTSEsElementId)
  const activeTSEsData = activeTSEsElementId ? activeTSEsDataRaw : undefined
  const awayTSEsDataRaw = useElementData(awayTSEsElementId)
  const awayTSEsData = awayTSEsElementId ? awayTSEsDataRaw : undefined
  const tseConversationDataRaw = useElementData(tseConversationElementId)
  const tseConversationData = tseConversationElementId ? tseConversationDataRaw : undefined
  
  // Debug: Log what useElementData returns immediately
  console.log('🔍 [AvailabilityPlugin] useElementData results:')
  console.log('🔍   - activeTSEsData:', activeTSEsData, 'type:', typeof activeTSEsData, 'is null:', activeTSEsData === null, 'is undefined:', activeTSEsData === undefined)
  console.log('🔍   - awayTSEsData:', awayTSEsData, 'type:', typeof awayTSEsData, 'is null:', awayTSEsData === null, 'is undefined:', awayTSEsData === undefined)
  if (activeTSEsData) {
    console.log('🔍   - activeTSEsData keys count:', Object.keys(activeTSEsData).length)
  }
  if (awayTSEsData) {
    console.log('🔍   - awayTSEsData keys count:', Object.keys(awayTSEsData).length)
  }
  
  // Debug: Check columns to verify element connection
  console.log('🔍 [AvailabilityPlugin] Column metadata check:')
  console.log('🔍   - activeTSEsColumns:', activeTSEsColumns, 'keys:', activeTSEsColumns ? Object.keys(activeTSEsColumns).length : 'N/A')
  console.log('🔍   - awayTSEsColumns:', awayTSEsColumns, 'keys:', awayTSEsColumns ? Object.keys(awayTSEsColumns).length : 'N/A')
  
  // Log column names to verify we're connected to the right table
  if (activeTSEsColumns && Object.keys(activeTSEsColumns).length > 0) {
    console.log('🔍   - activeTSEsColumns column names:', Object.values(activeTSEsColumns).map(col => col.name))
    console.log('🔍   - activeTSEsColumns full object:', JSON.stringify(activeTSEsColumns, null, 2))
  }
  if (awayTSEsColumns && Object.keys(awayTSEsColumns).length > 0) {
    console.log('🔍   - awayTSEsColumns column names:', Object.values(awayTSEsColumns).map(col => col.name))
  }
  
  // If columns exist but data is empty, that's suspicious
  if (activeTSEsColumns && Object.keys(activeTSEsColumns).length > 0 && activeTSEsData && Object.keys(activeTSEsData).length === 0) {
    console.warn('⚠️ [AvailabilityPlugin] ACTIVE element has columns but NO DATA - element may be connected but table is empty or not loading')
    console.warn('⚠️   This could mean:')
    console.warn('⚠️   1. The element is connected to ACTIVE table but it has no rows')
    console.warn('⚠️   2. The element is connected to a different table/view')
    console.warn('⚠️   3. There are filters applied that remove all rows')
    console.warn('⚠️   4. Data is still loading (check again in a few seconds)')
  }
  if (awayTSEsColumns && Object.keys(awayTSEsColumns).length > 0 && awayTSEsData && Object.keys(awayTSEsData).length === 0) {
    console.warn('⚠️ [AvailabilityPlugin] AWAY element has columns but NO DATA - element may be connected but table is empty (expected if table is empty)')
  }
  
  // Check if data structure matches column structure
  if (activeTSEsColumns && activeTSEsData) {
    const columnIds = Object.keys(activeTSEsColumns)
    const dataKeys = Object.keys(activeTSEsData)
    console.log('🔍 [AvailabilityPlugin] ACTIVE data structure comparison:')
    console.log('🔍   - Column IDs:', columnIds)
    console.log('🔍   - Data keys:', dataKeys)
    console.log('🔍   - Match?', JSON.stringify(columnIds.sort()) === JSON.stringify(dataKeys.sort()))
    
    // Check if column IDs match data keys
    const missingInData = columnIds.filter(id => !dataKeys.includes(id))
    const extraInData = dataKeys.filter(key => !columnIds.includes(key))
    if (missingInData.length > 0) {
      console.warn('⚠️   - Column IDs missing in data:', missingInData)
    }
    if (extraInData.length > 0) {
      console.warn('⚠️   - Data keys not in columns:', extraInData)
    }
  }
  
  // Debug logging for TSE status summary data
  console.log('🔍🔍🔍 [AvailabilityPlugin] TSE Status Summary Data Sources:')
  console.log('🔍   - activeTSEsElementId:', activeTSEsElementId, typeof activeTSEsElementId)
  console.log('🔍   - awayTSEsElementId:', awayTSEsElementId, typeof awayTSEsElementId)
  console.log('🔍   - activeTSEsData:', activeTSEsData, typeof activeTSEsData)
  console.log('🔍   - awayTSEsData:', awayTSEsData, typeof awayTSEsData)
  console.log('🔍   - activeTSEsColumns:', activeTSEsColumns, typeof activeTSEsColumns)
  console.log('🔍   - awayTSEsColumns:', awayTSEsColumns, typeof awayTSEsColumns)
  
  // Check if element IDs are configured
  if (!activeTSEsElementId) {
    console.warn('⚠️ [AvailabilityPlugin] activeTSEsElementId is NOT configured!')
  }
  if (!awayTSEsElementId) {
    console.warn('⚠️ [AvailabilityPlugin] awayTSEsElementId is NOT configured!')
  }
  
  if (activeTSEsData) {
    const activeKeys = Object.keys(activeTSEsData)
    console.log('🔍   - activeTSEsData keys:', activeKeys, 'count:', activeKeys.length)
    if (activeKeys.length === 0) {
      console.warn('⚠️ [AvailabilityPlugin] activeTSEsData exists but is EMPTY object {} - table may be empty or not connected')
    } else {
      const firstKey = activeKeys[0]
      const firstData = activeTSEsData[firstKey]
      console.log('🔍   - activeTSEsData first column:', firstKey, '=', firstData)
      console.log('🔍   - activeTSEsData first column type:', typeof firstData, 'isArray:', Array.isArray(firstData))
      if (Array.isArray(firstData)) {
        console.log('🔍   - activeTSEsData first column length:', firstData.length)
        if (firstData.length > 0) {
          console.log('🔍   - activeTSEsData first column sample:', firstData.slice(0, 3))
        } else {
          console.warn('⚠️ [AvailabilityPlugin] activeTSEsData first column is empty array []')
        }
      }
    }
  } else {
    console.warn('⚠️ [AvailabilityPlugin] activeTSEsData is undefined/null')
  }
  
  if (awayTSEsData) {
    const awayKeys = Object.keys(awayTSEsData)
    console.log('🔍   - awayTSEsData keys:', awayKeys, 'count:', awayKeys.length)
    if (awayKeys.length === 0) {
      console.warn('⚠️ [AvailabilityPlugin] awayTSEsData exists but is EMPTY object {} - table may be empty or not connected')
    } else {
      const firstKey = awayKeys[0]
      const firstData = awayTSEsData[firstKey]
      console.log('🔍   - awayTSEsData first column:', firstKey, '=', firstData)
      console.log('🔍   - awayTSEsData first column type:', typeof firstData, 'isArray:', Array.isArray(firstData))
      if (Array.isArray(firstData)) {
        console.log('🔍   - awayTSEsData first column length:', firstData.length)
        if (firstData.length > 0) {
          console.log('🔍   - awayTSEsData first column sample:', firstData.slice(0, 3))
        } else {
          console.warn('⚠️ [AvailabilityPlugin] awayTSEsData first column is empty array []')
        }
      }
    }
  } else {
    console.warn('⚠️ [AvailabilityPlugin] awayTSEsData is undefined/null')
  }
  
  // State to hold data from direct subscriptions
  const [directScheduleData, setDirectScheduleData] = useState<Record<string, any[]>>({})
  const [directSourceData, setDirectSourceData] = useState<Record<string, any[]>>({})
  const [directChatsPerHourData, setDirectChatsPerHourData] = useState<Record<string, any[]>>({})
  const [directOooData, setDirectOooData] = useState<Record<string, any[]>>({})
  
  // Flag to track if effect ran
  const [effectRan, setEffectRan] = useState(false)
  
  // Track last refresh time
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  
  // Unassigned conversations state for conveyor belt
  const [unassignedConversationsData, setUnassignedConversationsData] = useState<any[]>([])
  
  // Store mock data in a ref so it doesn't regenerate on every render
  const mockDataRef = useRef<any[] | null>(null)
  
  // Track pending bubbles that will be added progressively (SCENARIO 2)
  const pendingMockBubblesRef = useRef<any[] | null>(null)
  const [addedMockBubbleIds, setAddedMockBubbleIds] = useState<Set<string>>(new Set())
  
  // Track "assigned" mock conversations for local testing of fly-away animation
  const [assignedMockIds, setAssignedMockIds] = useState<Set<string>>(new Set())
  
  // Track assigned mock IDs in a ref to avoid dependency issues
  const assignedMockIdsRef = useRef<Set<string>>(new Set())
  
  // Keep ref in sync with state
  useEffect(() => {
    assignedMockIdsRef.current = assignedMockIds
  }, [assignedMockIds])
  
  // Progressively add pending mock bubbles (SCENARIO 2 only, localhost only)
  useEffect(() => {
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    )
    
    if (!isLocalhost || MOCK_SCENARIO !== 2) return
    
    // Initialize pending bubbles if not already done
    if (!pendingMockBubblesRef.current) {
      const nowSeconds = Date.now() / 1000
      pendingMockBubblesRef.current = getPendingMockBubbles(nowSeconds)
    }
    
    const pendingBubbles = pendingMockBubblesRef.current
    if (pendingBubbles.length === 0) return
    
    // Filter out bubbles that have already been added
    const bubblesToAdd = pendingBubbles.filter(bubble => 
      !addedMockBubbleIds.has(bubble.id)
    )
    
    if (bubblesToAdd.length === 0) return
    
    // Add bubbles progressively with random delays between 5-10 seconds
    const timeouts: number[] = []
    let cumulativeDelay = 0
    
    bubblesToAdd.forEach((bubble) => {
      // Random delay between 5-10 seconds for each bubble
      const delay = cumulativeDelay + (5000 + Math.random() * 5000) // 5-10 seconds
      cumulativeDelay = delay
      
      const timeout = setTimeout(() => {
        const nowSeconds = Date.now() / 1000
        // Update the bubble's timestamps to "now" so it starts fresh at the beginning of the belt
        if (pendingMockBubblesRef.current) {
          const bubbleIndex = pendingMockBubblesRef.current.findIndex(b => b.id === bubble.id)
          if (bubbleIndex !== -1) {
            pendingMockBubblesRef.current[bubbleIndex] = {
              ...bubble,
              created_at: nowSeconds,
              waiting_since: nowSeconds
            }
          }
        }
        console.log(`[Mock] ➕ Adding new bubble: ${bubble.id} (${Math.round(delay / 1000)}s after load)`)
        setAddedMockBubbleIds(prev => new Set(prev).add(bubble.id))
      }, delay)
      
      timeouts.push(timeout)
    })
    
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout))
    }
  }, [addedMockBubbleIds])
  
  // Periodically "assign" mock conversations to test fly-away animation (localhost only)
  useEffect(() => {
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    )
    
    if (!isLocalhost) return
    
    // SCENARIO 2:
    // 1) Assign one pre-breach bubble quickly to show fly-away behavior.
    // 2) Assign one already-breached bubble later so the 10+ min stack count decreases.
    if (MOCK_SCENARIO === 2) {
      // Assign mock-2003 after 4 seconds – chat just over 5 min gets "assigned", TSE gets coin (sound + award)
      const coinDemoTimeout = setTimeout(() => {
        if (!assignedMockIdsRef.current.has('mock-2003')) {
          console.log('[Mock] 🪙 Assigning mock-2003 (5.25 min wait) – simulates chat crossing 5 min then assigned, TSE rewarded with coin')
          setAssignedMockIds(prev => new Set(prev).add('mock-2003'))
        }
      }, 4000)

      // Assign mock-2010 after 6 seconds – assigned to Ankita, coin path (5_to_10, >5 min)
      const ankitaCoinTimeout = setTimeout(() => {
        if (!assignedMockIdsRef.current.has('mock-2010')) {
          console.log('[Mock] 🪙 Assigning mock-2010 (8.5 min wait) to Ankita – coin path')
          setAssignedMockIds(prev => new Set(prev).add('mock-2010'))
        }
      }, 6000)

      // Assign mock-2008 after 10 seconds (pre-breach fly-away)
      const preBreachTimeout = setTimeout(() => {
        if (!assignedMockIdsRef.current.has('mock-2008')) {
          console.log('[Mock] ✈️ Assigning mock-2008 (7.8 min wait) - 10 seconds after start')
          setAssignedMockIds(prev => new Set(prev).add('mock-2008'))
        }
      }, 10000)

      // Assign mock-2011 after 45 seconds (starts at 9.5m, breaches quickly, then gets removed)
      // This demonstrates the stacked 10+ min badge decreasing.
      const breachedTimeout = setTimeout(() => {
        if (!assignedMockIdsRef.current.has('mock-2011')) {
          console.log('[Mock] ✅ Removing breached chat mock-2011 - 45 seconds after start')
          setAssignedMockIds(prev => new Set(prev).add('mock-2011'))
        }
      }, 45000)
      
      return () => {
        clearTimeout(coinDemoTimeout)
        clearTimeout(ankitaCoinTimeout)
        clearTimeout(preBreachTimeout)
        clearTimeout(breachedTimeout)
      }
    }
    
    // SCENARIO 1: Assign mock conversation periodically (simulating TSE picking up chats)
    const assignRandomMock = () => {
      if (!mockDataRef.current) return
      
      // Combine initial bubbles with progressively added bubbles (SCENARIO 2)
      const initialBubbles = mockDataRef.current
      const addedBubbles = pendingMockBubblesRef.current
        ? pendingMockBubblesRef.current.filter(bubble => addedMockBubbleIds.has(bubble.id))
        : []
      const allMockBubbles = [...initialBubbles, ...addedBubbles]
      
      // Find mock conversations that haven't been assigned yet and aren't breached
      const availableMocks = allMockBubbles.filter(conv => {
        const convId = conv.id
        if (!convId) return false
        if (assignedMockIdsRef.current.has(convId)) return false
        
        // Check elapsed time - only assign if under 7 minutes
        // Let conversations 7+ minutes old breach naturally (explode animation)
        const waitingSince = conv.waiting_since || conv.created_at
        const elapsed = (Date.now() / 1000) - waitingSince
        // Only assign if under 7 minutes - older ones will hit threshold and explode
        return elapsed < 420
      })
      
      if (availableMocks.length === 0) return
      
      // Sort by longest wait time first (oldest, closest to breaching 10 min)
      // TSEs pick up conversations from oldest to newest
      const nowSeconds = Date.now() / 1000
      
      // Create a copy to avoid mutating the original array, then sort
      const sortedMocks = [...availableMocks].sort((a, b) => {
        const aWait = nowSeconds - (a.waiting_since || a.created_at)
        const bWait = nowSeconds - (b.waiting_since || b.created_at)
        return bWait - aWait // Descending: longest wait first
      })
      
      // Debug: Log sorted order
      console.log('[Mock] Sorted by wait time (longest first):', 
        sortedMocks.map(c => {
          const wait = Math.round((nowSeconds - (c.waiting_since || c.created_at)) / 60 * 10) / 10
          return `${c.id}(${wait}m)`
        }).join(' → ')
      )
      
      // Pick the oldest one (first after sorting)
      const toAssign = sortedMocks[0]
      const waitTime = Math.round((nowSeconds - (toAssign.waiting_since || toAssign.created_at)) / 60 * 10) / 10
      
      console.log('[Mock] ✈️ Assigning:', toAssign.id, `(${waitTime} min wait) - closest to 10 min threshold`)
      setAssignedMockIds(prev => new Set(prev).add(toAssign.id))
    }
    
    // First assignment after 33 seconds (30s for first bubble to breach + 3s), then every 3 seconds
    const initialTimeout = setTimeout(assignRandomMock, 33000)
    const interval = setInterval(assignRandomMock, 3000)
    
    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [unassignedConversationsData]) // Dependencies for Scenario 2 breach detection
  
  // =================================================================
  // INTERCOM DATA HOOK - Fetches conversations & team members from
  // /api/intercom/conversations/open-team-5480079
  // Same endpoint as queue-health-monitor-plugin
  // =================================================================
  const {
    conversations: intercomConversations,
    teamMembers: intercomTeamMembers,
    loading: intercomLoading,
    error: intercomError,
    lastUpdated: intercomLastUpdated,
  } = useIntercomData({
    skipClosed: true, // Skip closed conversations for faster loading - we get counts from daily-metrics endpoint
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds for fresher avatar/status updates
  })

  // Closed-only view so we can compute "closed today" with OOO-aware filtering.
  const {
    conversations: intercomClosedTodayConversations,
    teamMembers: intercomClosedTodayTeamMembers,
  } = useIntercomData({
    closedOnly: true,
    autoRefresh: true,
    refreshInterval: 30000,
  })
  
  // =================================================================
  // DAILY METRICS HOOK - Fast endpoint for chats today & closed today
  // Uses optimized Intercom search queries instead of loading all conversations
  // =================================================================
  const {
    metrics: dailyMetrics,
    loading: dailyMetricsLoading,
    error: dailyMetricsError,
  } = useDailyMetrics({
    autoRefresh: true,
    refreshInterval: 60000, // 1 minute - faster refresh for real-time counts
  })

  // Real-time chats-by-hour from Intercom API (ET hours) — refreshes every minute
  const {
    chatsByHour: apiChatsByHour,
  } = useChatsByHour({
    autoRefresh: true,
    refreshInterval: 60000, // 1 minute - same cadence as daily metrics
  })

  // Webhook-derived away statuses (real-time when admins change status in Intercom)
  const { data: webhookAwayStatus } = useWebhookAwayStatus(true)

  // Auth is now handled server-side via INTERCOM_TOKEN env var — no OAuth popup needed.
  
  // Debug: Log when daily metrics change
  console.log('📊 [Daily Metrics] Data received:', {
    chatsToday: dailyMetrics?.chatsToday,
    closedToday: dailyMetrics?.closedToday,
    loading: dailyMetricsLoading,
    error: dailyMetricsError,
  })
  
  // Debug: Log when Intercom data changes (avoid logging raw payloads / emails)
  if (LOG) {
    console.log('🔴 [Intercom Hook] Data received:', {
      conversationsCount: intercomConversations.length,
      teamMembersCount: intercomTeamMembers.length,
      loading: intercomLoading,
      error: intercomError,
      hasData: intercomConversations.length > 0,
    })
  }
  
  // Log Intercom data status
  useEffect(() => {
    if (LOG) {
      console.log('[AvailabilityPlugin] Intercom data status:', {
        conversationsCount: intercomConversations.length,
        teamMembersCount: intercomTeamMembers.length,
        loading: intercomLoading,
        error: intercomError,
        lastUpdated: intercomLastUpdated?.toISOString(),
      })
    }
    
    if (intercomConversations.length > 0) {
      const stateCounts = intercomConversations.reduce((acc, conv) => {
        const state = (conv.state || 'unknown').toLowerCase()
        acc[state] = (acc[state] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      if (LOG) console.log('[AvailabilityPlugin] Conversation states:', stateCounts)
    }
    
    if (intercomTeamMembers.length > 0) {
      // Don't log emails; they are PII.
      if (LOG) {
        console.log(
          '[AvailabilityPlugin] Team members sample:',
          intercomTeamMembers.slice(0, 3).map(m => ({ id: m.id, name: m.name, hasEmail: Boolean(m.email) }))
        )
      }
    }
  }, [intercomConversations, intercomTeamMembers, intercomLoading, intercomError, intercomLastUpdated])
  
  // Sync lastUpdated state with intercomLastUpdated when Intercom data refreshes
  useEffect(() => {
    if (intercomLastUpdated) {
      setLastUpdated(intercomLastUpdated)
    }
  }, [intercomLastUpdated])
  
  // =================================================================
  // TOTAL CHATS TAKEN TODAY (from Intercom data)
  // Sum of "Chats Taken" column from TSE conversation table
  // Matches the table's calculation logic exactly
  // =================================================================
  
  // TSEs to exclude from the count (same as TSEConversationTable)
  const EXCLUDED_TSE_NAMES = [
    'Holly',
    'Holly Coxon',
    'Stephen',
    'Stephen Skalamera',
    'Grace',
    'Grace Liu',
    'Grace Sanford',
    'Zen',
    'Zen Lee',
    'Chetana',
    'Chetana Shinde',
    'svc-prd-tse-intercom SVC',
    'TSE 6519361',
    'Zen Junior',
    'Prerit',
    'Prerit Sachdeva',
    'Sanyam',
    'Sanyam Khurana',
    'Nick',
    'Nick Clancey',
  ]

  // Build OOO name set from scheduleSource.daily_ooo-style control.
  // Keep this narrowly scoped to the schedule column so we don't accidentally treat
  // an entire OOO source table as "all OOO" when status metadata is missing.
  const oooTseSet = useMemo(() => {
    const set = new Set<string>()

    const addName = (value: unknown) => {
      if (typeof value !== 'string') return
      const cleaned = value.trim().toLowerCase()
      if (!cleaned) return
      set.add(cleaned)
      const first = cleaned.split(' ')[0]
      if (first && first !== cleaned) set.add(first)
    }

    const effectiveScheduleData = Object.keys(directScheduleData).length > 0 ? directScheduleData : scheduleData
    const scheduleTSECol = config.scheduleTSE as string
    const scheduleOOOCol = config.scheduleOOO as string

    // 1) daily_ooo-style control mapped via scheduleOOO column.
    if (effectiveScheduleData && scheduleTSECol && scheduleOOOCol) {
      const names = effectiveScheduleData[scheduleTSECol] as string[] | undefined
      const statuses = effectiveScheduleData[scheduleOOOCol] as string[] | undefined
      if (names && statuses) {
        names.forEach((name, idx) => {
          const status = statuses[idx]
          if (typeof status === 'string' && status.trim().toLowerCase() === 'yes') {
            addName(name)
          }
        })
      }
    }

    return set
  }, [
    config.scheduleTSE,
    config.scheduleOOO,
    directScheduleData,
    scheduleData,
  ])
  
  const totalChatsTakenToday = useMemo(() => {
    console.log('[AvailabilityPlugin] Calculating totalChatsTakenToday...')
    console.log('[AvailabilityPlugin] intercomConversations.length:', intercomConversations.length)
    console.log('[AvailabilityPlugin] intercomClosedTodayConversations.length:', intercomClosedTodayConversations.length)
    console.log('[AvailabilityPlugin] intercomTeamMembers.length:', intercomTeamMembers.length)
    
    // On localhost, return mock data for demo purposes
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    )
    
    if (!intercomTeamMembers.length) {
      if (isLocalhost) {
        console.log('[AvailabilityPlugin] Localhost detected, returning mock chats today: 47')
        return 47 // Mock value for localhost demo
      }
      console.log('[AvailabilityPlugin] No data available, returning 0')
      return 0
    }
    
    // Build a de-duplicated conversation set across open/snoozed + closed
    // so chats-today is status-agnostic and matches the table logic.
    const conversationsForCounts: any[] = []
    const seenConversationIds = new Set<string>()
    const allConversations = [...intercomConversations, ...intercomClosedTodayConversations]

    allConversations.forEach((conv) => {
      const uniqueId = String(conv.conversation_id || conv.id || '')
      if (!uniqueId || seenConversationIds.has(uniqueId)) return
      seenConversationIds.add(uniqueId)
      conversationsForCounts.push(conv)
    })

    if (!conversationsForCounts.length) {
      if (isLocalhost) {
        console.log('[AvailabilityPlugin] Localhost detected, returning mock chats today: 47')
        return 47
      }
      console.log('[AvailabilityPlugin] No conversations available, returning 0')
      return 0
    }

    // Helper to check if timestamp is today (UTC timezone)
    const isToday = (timestamp: number | undefined): boolean => {
      if (!timestamp) return false
      const timestampMs = timestamp > 1e12 ? timestamp : timestamp * 1000
      const date = new Date(timestampMs)
      const now = new Date()
      const utcFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      return utcFormatter.format(now) === utcFormatter.format(date)
    }
    
    // Match table behavior: count any conversation whose FIRST admin reply is today (UTC),
    // regardless of current conversation status.
    const isChatTakenToday = (conv: any): boolean => {
      return isToday(conv.statistics?.first_admin_reply_at)
    }
    
    // Group by TSE and sum chats taken (matching TSEConversationTable logic)
    const tseMap = new Map<string, { name: string, count: number }>()
    
    conversationsForCounts.forEach(conv => {
      const assigneeId = conv.admin_assignee_id || 
        (conv.admin_assignee && typeof conv.admin_assignee === 'object' ? conv.admin_assignee.id : null)
      
      if (!assigneeId) return
      
      const idStr = String(assigneeId)
      
      // Find team member name
      const teamMember = intercomTeamMembers.find(m => String(m.id) === idStr)
      const name = teamMember?.name || `TSE ${idStr}`
      
      // Skip excluded TSEs
      if (EXCLUDED_TSE_NAMES.includes(name)) return
      const cleanName = name.toLowerCase()
      const firstName = cleanName.split(' ')[0]
      if (oooTseSet.has(cleanName) || oooTseSet.has(firstName)) return
      
      // Initialize TSE entry if not exists
      if (!tseMap.has(idStr)) {
        tseMap.set(idStr, { name, count: 0 })
      }
      
      // Count chats taken today
      if (isChatTakenToday(conv)) {
        const entry = tseMap.get(idStr)!
        entry.count++
      }
    })
    
    // Log per-TSE counts for debugging
    const tseCountsDebug = Array.from(tseMap.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      chatsTaken: data.count
    })).filter(t => t.chatsTaken > 0)
    console.log('[AvailabilityPlugin] Per-TSE chats taken:', tseCountsDebug)
    
    // Sum all chats taken across all TSEs
    const totalCount = Array.from(tseMap.values()).reduce((sum, data) => sum + data.count, 0)
    
    console.log('[AvailabilityPlugin] Total chats taken today (UTC first reply, all statuses):', totalCount)
    return totalCount
  }, [intercomConversations, intercomClosedTodayConversations, intercomTeamMembers, oooTseSet])
  
  // =================================================================
  // TSE CONVERSATION DATA (for capacity calculation)
  // Calculates openCount per TSE from Intercom data
  // =================================================================
  const tseConversationDataForCapacity = useMemo(() => {
    if (!intercomConversations.length || !intercomTeamMembers.length) {
      return []
    }
    
    
    // Helper to check if TSE is excluded
    const isExcludedTSE = (name: string): boolean => {
      if (EXCLUDED_TSE_NAMES.includes(name)) return true
      const firstName = name.split(' ')[0]
      return EXCLUDED_TSE_NAMES.includes(firstName)
    }
    
    // Helper to get first name
    const getFirstName = (name: string): string => {
      return name.split(' ')[0]
    }
    
    // Group conversations by admin_assignee_id
    const tseMap = new Map<string, { 
      name: string
      id: string
      open: number
    }>()
    
    intercomConversations.forEach(conv => {
      const assigneeId = conv.admin_assignee_id || 
        (conv.admin_assignee && typeof conv.admin_assignee === 'object' ? conv.admin_assignee.id : null)
      
      if (!assigneeId) return
      
      const idStr = String(assigneeId)
      
      // Initialize TSE entry if not exists
      if (!tseMap.has(idStr)) {
        const teamMember = intercomTeamMembers.find(m => String(m.id) === idStr)
        const name = teamMember?.name || `TSE ${idStr}`
        
        // Skip excluded TSEs
        if (isExcludedTSE(name)) return
        
        tseMap.set(idStr, { 
          name,
          id: idStr,
          open: 0
        })
      }
      
      const counts = tseMap.get(idStr)
      if (!counts) return // Skip if TSE was excluded
      
      const state = (conv.state || 'open').toLowerCase()
      const isSnoozed = state === 'snoozed' || conv.snoozed_until
      
      // Only count open (non-snoozed) conversations for capacity
      if (state === 'open' && !isSnoozed) {
        counts.open++
      }
    })
    
    // Convert to array format matching ChatCapacityIndicator interface
    return Array.from(tseMap.entries())
      .filter(([_, item]) => !isExcludedTSE(item.name))
      .map(([id, item]) => ({
        tseName: getFirstName(item.name),
        fullName: item.name,
        tseId: id,
        openCount: item.open,
        snoozedCount: 0, // Not needed for capacity calculation
        closedCount: 0, // Not needed for capacity calculation
        chatsTakenCount: 0 // Not needed for capacity calculation
      }))
  }, [intercomConversations, intercomTeamMembers])
  
  // =================================================================
  // TOTAL CLOSED TODAY (from Intercom data)
  // Counts ALL conversations closed today (PT timezone)
  // Matches queue-health-monitor's closedtoday filter
  // =================================================================
  const totalClosedToday = useMemo(() => {
    // On localhost, return mock data for demo purposes
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    )
    
    if (!intercomClosedTodayConversations.length) {
      if (isLocalhost) {
        console.log('[AvailabilityPlugin] Localhost detected, returning mock closed today: 32')
        return 32 // Mock value for localhost demo
      }
      return 0
    }
    
    // Helper to check if timestamp is today (PT timezone)
    const isToday = (timestamp: number | undefined): boolean => {
      if (!timestamp) return false
      const timestampMs = timestamp > 1e12 ? timestamp : timestamp * 1000
      const date = new Date(timestampMs)
      const now = new Date()
      const ptFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      return ptFormatter.format(now) === ptFormatter.format(date)
    }
    
    // Count ALL conversations closed today (regardless of assignee)
    const teamMemberLookup = new Map<string, string>()
    const allTeamMembers = [...intercomTeamMembers, ...intercomClosedTodayTeamMembers]
    allTeamMembers.forEach((member) => {
      teamMemberLookup.set(String(member.id), member.name || '')
    })

    const closedCount = intercomClosedTodayConversations.filter(conv => {
      const state = (conv.state || '').toLowerCase()
      if (state !== 'closed') return false
      
      const closedAt = conv.closed_at
      if (!closedAt) return false

      if (!isToday(closedAt)) return false

      const assigneeId = conv.admin_assignee_id ||
        (conv.admin_assignee && typeof conv.admin_assignee === 'object' ? conv.admin_assignee.id : null)
      if (!assigneeId) return true

      const assigneeName = (teamMemberLookup.get(String(assigneeId)) || '').trim().toLowerCase()
      const firstName = assigneeName.split(' ')[0]
      if (assigneeName && (oooTseSet.has(assigneeName) || oooTseSet.has(firstName))) {
        return false
      }

      return true
    }).length
    
    console.log('[AvailabilityPlugin] Total closed today (all conversations):', closedCount)
    return closedCount
  }, [intercomClosedTodayConversations, intercomTeamMembers, intercomClosedTodayTeamMembers, oooTseSet])

  const shouldUseOooAwareCounts = oooTseSet.size > 0
  const bannerChatsToday = shouldUseOooAwareCounts
    ? totalChatsTakenToday
    : (dailyMetrics?.chatsToday ?? totalChatsTakenToday)
  const bannerClosedToday = shouldUseOooAwareCounts
    ? totalClosedToday
    : (dailyMetrics?.closedToday ?? totalClosedToday)
  
  // =================================================================
  // MEDIAN INITIAL RESPONSE TIME (calculated from Intercom conversations API)
  // Calculates from first_admin_reply_at - created_at for today's conversations
  // =================================================================
  const medianResponseTime = useMemo(() => {
    if (!intercomConversations || intercomConversations.length === 0) {
      console.log('[AvailabilityPlugin] Median IR: No Intercom conversations data')
      return null
    }

    // Get today's date range (UTC, same as Intercom timestamps)
    const now = new Date()
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0))
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59))
    const todayStartTimestamp = Math.floor(todayStart.getTime() / 1000)
    const todayEndTimestamp = Math.floor(todayEnd.getTime() / 1000)

    // Calculate response times for conversations created today with first admin reply
    const responseTimes: number[] = []
    
    intercomConversations.forEach(conv => {
      const createdAt = conv.created_at
      const firstAdminReplyAt = conv.statistics?.first_admin_reply_at

      // Must be created today
      if (!createdAt || createdAt < todayStartTimestamp || createdAt > todayEndTimestamp) {
        return
      }

      // Must have a first admin reply
      if (!firstAdminReplyAt || firstAdminReplyAt <= createdAt) {
        return
      }

      // Calculate response time in seconds
      const responseTimeSeconds = firstAdminReplyAt - createdAt

      // Filter out unreasonable values (more than 24 hours or negative)
      if (responseTimeSeconds > 0 && responseTimeSeconds < 86400) {
        responseTimes.push(responseTimeSeconds)
      }
    })

    console.log('[AvailabilityPlugin] Median IR from Intercom API:', {
      totalConversations: intercomConversations.length,
      validResponseTimes: responseTimes.length
    })

    if (responseTimes.length === 0) {
      return null
    }

    // Sort the response times
    responseTimes.sort((a, b) => a - b)

    // Calculate median
    const mid = Math.floor(responseTimes.length / 2)
    const median = responseTimes.length % 2 === 0
      ? (responseTimes[mid - 1] + responseTimes[mid]) / 2
      : responseTimes[mid]

    console.log('[AvailabilityPlugin] Median response time:', Math.round(median), 'seconds from', responseTimes.length, 'conversations')
    return Math.round(median)
  }, [intercomConversations])
  
  // =================================================================
  // HISTORICAL METRICS - Fetch previous days data for trending
  // Uses /api/response-time-metrics which stores totalConversations per day
  // =================================================================
  const [historicalMetrics, setHistoricalMetrics] = useState<{
    yesterdayChats: number | null
    yesterdayClosed: number | null
    weekAgoChats: number | null
    loading: boolean
  }>({
    yesterdayChats: null,
    yesterdayClosed: null,
    weekAgoChats: null,
    loading: true
  })
  
  // Fetch historical metrics on mount
  useEffect(() => {
    const fetchHistoricalMetrics = async () => {
      try {
        console.log('[AvailabilityPlugin] Fetching historical metrics...')
        
        // Fetch all recent metrics and use the most recent one
        const response = await fetch(`${QHM_API_BASE_URL}/api/response-time-metrics/get?all=true`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const data = await response.json()
        const metrics = data.metrics || []
        
        console.log('[AvailabilityPlugin] Historical metrics received:', metrics.length, 'records')
        
        if (metrics.length > 0) {
          const toPtDateKey = (date: Date) => {
            const formatter = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'America/Los_Angeles',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            })
            return formatter.format(date) // YYYY-MM-DD
          }

          const todayPt = new Date()
          const yesterdayPt = new Date(todayPt)
          yesterdayPt.setDate(yesterdayPt.getDate() - 1)
          const weekAgoPt = new Date(todayPt)
          weekAgoPt.setDate(weekAgoPt.getDate() - 7)

          const yesterdayKey = toPtDateKey(yesterdayPt)
          const weekAgoKey = toPtDateKey(weekAgoPt)

          const metricsByDate = new Map<string, any>()
          metrics.forEach((m: any) => {
            if (m?.date) metricsByDate.set(m.date, m)
          })

          // Primary: exact previous day.
          // Fallback: nearest prior record (avoid showing stale weeks-old values when possible).
          const sortedByDateDesc = [...metrics]
            .filter((m: any) => typeof m?.date === 'string')
            .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))

          const yesterdayMetric =
            metricsByDate.get(yesterdayKey) ||
            sortedByDateDesc.find((m: any) => String(m.date) < yesterdayKey) ||
            null

          const weekAgoMetric =
            metricsByDate.get(weekAgoKey) ||
            sortedByDateDesc.find((m: any) => String(m.date) <= weekAgoKey) ||
            null

          console.log('[AvailabilityPlugin] Selected historical metrics:', {
            yesterdayKey,
            selectedYesterday: yesterdayMetric?.date,
            selectedWeekAgo: weekAgoMetric?.date,
            yesterdayChats: yesterdayMetric?.totalConversations,
            yesterdayClosed: yesterdayMetric?.totalClosed,
          })

          setHistoricalMetrics({
            yesterdayChats: yesterdayMetric?.totalConversations ?? null,
            yesterdayClosed: yesterdayMetric?.totalClosed ?? null,
            weekAgoChats: weekAgoMetric?.totalConversations ?? null,
            loading: false
          })
        } else {
          console.log('[AvailabilityPlugin] No historical metrics available')
          setHistoricalMetrics({
            yesterdayChats: null,
            yesterdayClosed: null,
            weekAgoChats: null,
            loading: false
          })
        }
      } catch (error) {
        console.error('[AvailabilityPlugin] Error fetching historical metrics:', error)
        setHistoricalMetrics({
          yesterdayChats: null,
          yesterdayClosed: null,
          weekAgoChats: null,
          loading: false
        })
      }
    }
    
    fetchHistoricalMetrics()
  }, [])
  
  // Calculate trending data for Chats Today
  const chatsTrending = useMemo(() => {
    console.log('[AvailabilityPlugin] chatsTrending calculation:', {
      loading: historicalMetrics.loading,
      yesterdayChats: historicalMetrics.yesterdayChats,
      totalChatsTakenToday
    })
    
    if (historicalMetrics.loading) {
      return null
    }
    
    // Always return yesterdayValue if we have it, even if it's 0
    const yesterdayChats = historicalMetrics.yesterdayChats
    if (yesterdayChats === null) {
      console.log('[AvailabilityPlugin] No yesterday data available')
      return null
    }
    
    const todayChats = totalChatsTakenToday
    
    if (yesterdayChats === 0) {
      return { 
        direction: 'up' as const, 
        percentage: todayChats > 0 ? 100 : 0,
        yesterdayValue: yesterdayChats 
      }
    }
    
    const percentChange = Math.round(((todayChats - yesterdayChats) / yesterdayChats) * 100)
    
    return {
      direction: percentChange >= 0 ? 'up' as const : 'down' as const,
      percentage: Math.abs(percentChange),
      yesterdayValue: yesterdayChats
    }
  }, [totalChatsTakenToday, historicalMetrics])
  
  // Format timestamp for display
  const formatLastUpdated = (date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins === 1) return '1 min ago'
    if (diffMins < 60) return `${diffMins} mins ago`
    
    // Format as time if more than an hour
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }

  // @ts-ignore
  const formatAgeSeconds = (seconds: number | null): string => {
    if (seconds === null || Number.isNaN(seconds)) return 'n/a'
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const rem = seconds % 60
    return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`
  }

  
  // Fetch unassigned conversations
  const fetchUnassignedConversations = useCallback(async () => {
    try {
      const apiUrl = `${QHM_API_BASE_URL}/api/intercom/conversations/unassigned-only`
      const res = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        console.warn('Timeline Belt Plugin: Failed to fetch unassigned conversations:', res.status)
        return
      }
      
      const response = await res.json()
      const fetchedConversations = Array.isArray(response) ? response : (response.conversations || [])
      
      setUnassignedConversationsData(fetchedConversations)
      setLastUpdated(new Date()) // Update last refresh time
    } catch (error) {
      console.error('Timeline Belt Plugin: Error fetching unassigned conversations:', error)
    }
  }, [])
  
  // Fetch unassigned conversations every 1 minute
  useEffect(() => {
    let isMounted = true
    
    // Initial fetch
    fetchUnassignedConversations()
    
    // Set up refresh every 15 seconds (15000 ms)
    const interval = setInterval(() => {
      if (isMounted) {
        fetchUnassignedConversations()
      }
    }, 15000)
    
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [fetchUnassignedConversations])
  
  // Calculate unassigned conversations for conveyor belt
  const unassignedConvs = useMemo(() => {
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    )
    
    let rawUnassignedConversations: any[]
    
    // On localhost, ALWAYS use mock data (ignore API responses)
    if (isLocalhost) {
      // Use cached mock data if available, otherwise create and cache it
      if (!mockDataRef.current) {
        mockDataRef.current = getMockUnassignedConversations(Date.now() / 1000)
      }
      
      // Initialize pending bubbles if not already done (SCENARIO 2)
      if (MOCK_SCENARIO === 2 && !pendingMockBubblesRef.current) {
        const nowSeconds = Date.now() / 1000
        pendingMockBubblesRef.current = getPendingMockBubbles(nowSeconds)
      }
      
      // Combine initial bubbles with progressively added bubbles
      const initialBubbles = mockDataRef.current
      const addedBubbles = MOCK_SCENARIO === 2 && pendingMockBubblesRef.current
        ? pendingMockBubblesRef.current.filter(bubble => addedMockBubbleIds.has(bubble.id))
        : []
      
      // Combine all bubbles and filter out "assigned" ones to trigger fly-away animation
      rawUnassignedConversations = [...initialBubbles, ...addedBubbles].filter(conv => 
        !assignedMockIds.has(conv.id)
      )
    } else if (unassignedConversationsData?.length) {
      rawUnassignedConversations = unassignedConversationsData
    } else {
      rawUnassignedConversations = []
    }

    if (rawUnassignedConversations.length === 0) return []

    return rawUnassignedConversations.map(conv => {
      // Use waiting_since for wait time calculations, fallback to created_at for filtering by date
      const waitingSince = conv.waiting_since || conv.waitingSince
      const createdAt = conv.created_at || conv.createdAt || conv.first_opened_at
      
      const waitingSinceTimestamp = waitingSince
        ? (typeof waitingSince === "number" ? (waitingSince > 1e12 ? waitingSince / 1000 : waitingSince) : new Date(waitingSince).getTime() / 1000)
        : null
      
      const createdTimestamp = createdAt 
        ? (typeof createdAt === "number" ? (createdAt > 1e12 ? createdAt / 1000 : createdAt) : new Date(createdAt).getTime() / 1000)
        : null
      
      return {
        ...conv,
        createdTimestamp, // Keep for date filtering (10 AM UTC to 2 AM UTC)
        waitingSinceTimestamp // Use for wait time calculations
      }
    })
  }, [unassignedConversationsData, assignedMockIds, addedMockBubbleIds])
  
  // Subscribe directly to element data using client API
  useEffect(() => {
    console.log('⚡ useEffect FIRED!')
    console.log('  scheduleElementId:', scheduleElementId)
    console.log('  sourceElementId:', sourceElementId)
    console.log('  oooElementId:', oooElementId)
    setEffectRan(true)
    
    if (!client?.elements?.subscribeToElementData) {
      console.error('❌ client.elements.subscribeToElementData is not available!')
      return
    }
    
    if (!scheduleElementId && !sourceElementId && !oooElementId) {
      console.log('[Sigma Client] No element IDs yet, skipping subscriptions')
      return
    }
    
    console.log('[Sigma Client] Setting up subscriptions with actual element IDs...')
    
    let unsubSchedule: (() => void) | undefined
    let unsubSource: (() => void) | undefined
    let unsubChatsPerHour: (() => void) | undefined
    let unsubOoo: (() => void) | undefined
    
    if (scheduleElementId) {
      try {
        console.log('[Sigma Client] Subscribing to schedule element:', scheduleElementId)
        unsubSchedule = client.elements.subscribeToElementData(scheduleElementId, (data) => {
          console.log('[Sigma Client] ✓ Received schedule data update:', Object.keys(data))
          setDirectScheduleData(data)
          // Update timestamp when upstream data changes
          setLastUpdated(new Date())
          console.log('[Upstream Refresh] Schedule data updated, refreshing timestamp')
        })
        console.log('[Sigma Client] ✓ Schedule subscription created')
      } catch (e) {
        console.error('[Sigma Client] ❌ Error subscribing to schedule:', e)
      }
    }
    
    if (sourceElementId) {
      try {
        console.log('[Sigma Client] Subscribing to source element:', sourceElementId)
        unsubSource = client.elements.subscribeToElementData(sourceElementId, (data) => {
          console.log('[Sigma Client] ✓ Received source data update:', Object.keys(data))
          setDirectSourceData(data)
          // Update timestamp when upstream data changes
          setLastUpdated(new Date())
          console.log('[Upstream Refresh] Source data updated, refreshing timestamp')
        })
        console.log('[Sigma Client] ✓ Source subscription created')
      } catch (e) {
        console.error('[Sigma Client] ❌ Error subscribing to source:', e)
      }
    }
    
    if (chatsPerHourElementId) {
      try {
        console.log('[Sigma Client] Subscribing to chatsPerHour element:', chatsPerHourElementId)
        unsubChatsPerHour = client.elements.subscribeToElementData(chatsPerHourElementId, (data) => {
          console.log('[Sigma Client] ✓ Received chatsPerHour data update:', Object.keys(data))
          setDirectChatsPerHourData(data)
          setLastUpdated(new Date())
          console.log('[Upstream Refresh] ChatsPerHour data updated, refreshing timestamp')
        })
        console.log('[Sigma Client] ✓ ChatsPerHour subscription created')
      } catch (e) {
        console.error('[Sigma Client] ❌ Error subscribing to chatsPerHour:', e)
      }
    }
    
    if (oooElementId) {
      try {
        console.log('[Sigma Client] Subscribing to OOO element:', oooElementId)
        unsubOoo = client.elements.subscribeToElementData(oooElementId, (data) => {
          console.log('[Sigma Client] ✓ Received OOO data update:', Object.keys(data))
          setDirectOooData(data)
          // Update timestamp when upstream data changes
          setLastUpdated(new Date())
          console.log('[Upstream Refresh] OOO data updated, refreshing timestamp')
        })
        console.log('[Sigma Client] ✓ OOO subscription created')
      } catch (e) {
        console.error('[Sigma Client] ❌ Error subscribing to OOO:', e)
      }
    }
    
    return () => {
      unsubSchedule?.()
      unsubSource?.()
      unsubChatsPerHour?.()
      unsubOoo?.()
    }
  }, [scheduleElementId, sourceElementId, chatsPerHourElementId, oooElementId, client])
  
  // Log effect status
  console.log('[Effect Status] effectRan:', effectRan)
  
  // Debug: Log ALL available information from Sigma
  console.log('=== SIGMA PLUGIN DEBUG ===')
  console.log('[Config] Full config object:', JSON.stringify(config, null, 2))
  console.log('[Config] scheduleSource value:', config.scheduleSource)
  console.log('[Config] Status Source value:', config['Status Source'])
  console.log('[Columns] source columns:', columns)
  console.log('[Columns] scheduleSource columns:', scheduleColumns)
  console.log('[Columns] oooSource columns:', oooColumns)
  console.log('[Data] sigmaData:', sigmaData, 'keys:', Object.keys(sigmaData || {}))
  console.log('[Data] scheduleData:', scheduleData, 'keys:', Object.keys(scheduleData || {}))
  console.log('[Data] oooData:', oooData, 'keys:', Object.keys(oooData || {}))
  console.log('[Data] directOooData:', directOooData, 'keys:', Object.keys(directOooData || {}))
  
  // Try accessing data by column ID directly
  const scheduleTSEId = config.scheduleTSE as string
  const agentNameId = config.agentName as string
  if (scheduleTSEId && scheduleData) {
    console.log('[Data] Trying to access scheduleData by column ID:', scheduleTSEId)
    console.log('[Data] scheduleData[scheduleTSEId]:', scheduleData[scheduleTSEId])
  }
  if (agentNameId && sigmaData) {
    console.log('[Data] Trying to access sigmaData by column ID:', agentNameId)
    console.log('[Data] sigmaData[agentNameId]:', sigmaData[agentNameId])
  }
  
  // Also log direct subscription data
  console.log('[Direct] directScheduleData keys:', Object.keys(directScheduleData))
  console.log('[Direct] directSourceData keys:', Object.keys(directSourceData))
  console.log('[Direct] directOooData keys:', Object.keys(directOooData))
  
  // Debug OOO values
  const oooColId = config.scheduleOOO as string
  if (oooColId && directScheduleData[oooColId]) {
    const oooValues = directScheduleData[oooColId] as string[]
    console.log('[OOO Values] Sample:', oooValues?.slice(0, 10))
    const yesCount = oooValues?.filter(v => v?.toLowerCase() === 'yes').length || 0
    console.log('[OOO Values] Count with "yes":', yesCount)
  }
  console.log('===========================')
  
  // Local state
  const [intensity, setIntensity] = useState(35)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [statusUpdates, setStatusUpdates] = useState<Record<string, AgentStatus>>({})
  const [currentPacificHour, setCurrentPacificHour] = useState(getCurrentPacificHour())

  // Parse configuration values
  const apiUrl = config.apiUrl as string
  const defaultIntensity = parseInt(config.defaultIntensity as string) || 35
  const autoIntensityEnabled = config.autoIntensity !== 'false' // Default to true
  
  // Debug: Log configuration
  console.log('[Auto Intensity] Configuration:', {
    autoIntensityEnabled,
    autoIntensityConfig: config.autoIntensity,
    defaultIntensity,
  })
  
  // Use direct subscription data if available, fall back to hook data
  const effectiveChatsPerHourData = Object.keys(directChatsPerHourData).length > 0 ? directChatsPerHourData : chatsPerHourSigmaData

  // Today's chats-by-hour: compute client-side from intercomConversations (which
  // already contain all open/snoozed/closed conversations for the team).
  // Each conversation has a created_at timestamp — bucket by ET hour.
  // Falls back to the dedicated API endpoint data if available.
  const chatsPerHour = useMemo(() => {
    if (apiChatsByHour.length > 0) return apiChatsByHour

    if (!intercomConversations || intercomConversations.length === 0) return []

    const now = new Date()
    const etFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const todayET = etFormatter.format(now)

    const hourFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    })

    const hourCounts = new Map<number, number>()

    intercomConversations.forEach(conv => {
      const createdAt = conv.created_at
      if (!createdAt) return
      const ms = typeof createdAt === 'number' && createdAt < 1e12 ? createdAt * 1000 : createdAt
      const d = new Date(ms as number)
      const dateET = etFormatter.format(d)
      if (dateET !== todayET) return

      const etHour = parseInt(hourFormatter.format(d), 10)
      hourCounts.set(etHour, (hourCounts.get(etHour) || 0) + 1)
    })

    return Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour)
  }, [apiChatsByHour, intercomConversations])

  // Previous day chats per hour — sourced from Sigma/Snowflake data.
  // Sigma data uses UTC hours; we convert to ET for consistent x-axis alignment.
  // Sanity check: if the Sigma hourly total is wildly different from the known
  // previous-day chat count (from historicalMetrics), the Sigma data is stale
  // or from a different day — suppress it to avoid a misleading comparison line.
  const previousDayChatsPerHour = useMemo(() => {
    const bucketCol = config.chatsPerHourBucket as string
    const countCol = config.chatsPerHourCount as string
    const data = effectiveChatsPerHourData

    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    )

    if (!data || !bucketCol || !countCol) {
      if (isLocalhost) {
        // Mock previous-day data in ET hours
        return [
          { hour: 5, count: 4 }, { hour: 6, count: 6 }, { hour: 7, count: 10 },
          { hour: 8, count: 9 }, { hour: 9, count: 15 }, { hour: 10, count: 20 },
          { hour: 11, count: 18 }, { hour: 12, count: 12 }, { hour: 13, count: 8 },
          { hour: 14, count: 5 }, { hour: 15, count: 3 }, { hour: 16, count: 2 },
          { hour: 17, count: 1 }, { hour: 18, count: 1 }, { hour: 19, count: 0 },
        ]
      }
      return []
    }

    const buckets = data[bucketCol] as any[] | undefined
    const counts = data[countCol] as any[] | undefined
    if (!buckets || !counts) return []

    // Parse Sigma data — these are UTC hour buckets from Snowflake.
    // Convert each UTC hour to ET for consistent x-axis alignment.
    const result: Array<{ hour: number; count: number }> = []
    for (let i = 0; i < buckets.length; i++) {
      const raw = buckets[i]
      if (raw == null) continue
      let utcHour: number
      if (typeof raw === 'string') {
        const match = raw.match(/(\d{2}):\d{2}:\d{2}/)
        utcHour = match ? parseInt(match[1], 10) : NaN
      } else if (typeof raw === 'number') {
        const d = new Date(raw > 1e12 ? raw : raw * 1000)
        utcHour = d.getUTCHours()
      } else if (raw instanceof Date) {
        utcHour = raw.getUTCHours()
      } else {
        utcHour = NaN
      }
      if (isNaN(utcHour)) continue

      // Convert UTC hour to ET using Intl to correctly handle DST
      const probe = new Date(Date.UTC(2026, 0, 15, utcHour, 0, 0)) // use a fixed date to get offset
      const etStr = probe.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false })
      const etHour = parseInt(etStr, 10)

      const count = typeof counts[i] === 'number' ? counts[i] : parseInt(String(counts[i]), 10) || 0
      result.push({ hour: etHour, count })
    }

    return result.sort((a, b) => {
      const aAdj = a.hour < 5 ? a.hour + 24 : a.hour
      const bAdj = b.hour < 5 ? b.hour + 24 : b.hour
      return aAdj - bAdj
    })
  }, [effectiveChatsPerHourData, config.chatsPerHourBucket, config.chatsPerHourCount])
  
  // Intensity: use default when auto-intensity is on (chats source removed); otherwise use configured default
  const calculatedIntensity = useMemo(() => {
    const value = parseInt(String(defaultIntensity), 10) || 35
    return Math.max(0, Math.min(100, value))
  }, [defaultIntensity])
  const simulateTime = config.simulateTime === 'true'

  // Fetch from API if URL is configured
  const { agents: apiAgents, loading: apiLoading } = useAgentDataFromApi(apiUrl || undefined)

  // Update Pacific hour every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPacificHour(getCurrentPacificHour())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Build cities configuration from Sigma config
  const cities: City[] = useMemo(() => {
    const result: City[] = []
    
    for (let i = 1; i <= 3; i++) {
      const name = config[`city${i}Name`] as string
      const code = config[`city${i}Code`] as string
      const timezone = config[`city${i}Timezone`] as string
      const startHour = parseInt(config[`city${i}StartHour`] as string) || 8
      const endHour = parseInt(config[`city${i}EndHour`] as string) || 16

      if (name && code && timezone) {
        result.push({
          name,
          code,
          timezone,
          startHour,
          endHour,
          zoneIdx: i - 1,
        })
      }
    }
    
    // Fallback to default cities for demo mode (when no config is set)
    if (result.length === 0) {
      return [
        {
          name: 'London',
          code: 'LDN',
          timezone: 'Europe/London',
          startHour: 8,  // 8 AM UTC
          endHour: 17,   // 5 PM UTC
          zoneIdx: 0,
        },
        {
          name: 'New York',
          code: 'NYC',
          timezone: 'America/New_York',
          startHour: 13, // 8 AM EST = 13:00 UTC
          endHour: 22,   // 5 PM EST = 22:00 UTC
          zoneIdx: 1,
        },
        {
          name: 'San Francisco',
          code: 'SFO',
          timezone: 'America/Los_Angeles',
          startHour: 16, // 8 AM PST = 16:00 UTC
          endHour: 25,   // 5 PM PST = 01:00 UTC next day (25 = wraps)
          zoneIdx: 2,
        },
      ]
    }
    
    return result
  }, [config])

  // Transform Sigma data into agent data structure
  const agents: AgentData[] = useMemo(() => {
    const avatarRefreshKey = intercomLastUpdated
      ? Math.floor(intercomLastUpdated.getTime() / 30000)
      : null

    const withAvatarRefreshKey = (avatarUrl?: string) => {
      if (!avatarUrl) return ''
      if (avatarRefreshKey === null) return avatarUrl
      const separator = avatarUrl.includes('?') ? '&' : '?'
      return `${avatarUrl}${separator}v=${avatarRefreshKey}`
    }

    // Priority 1: Use API data if apiUrl is configured and we have results
    if (apiUrl && apiAgents.length > 0) {
      return apiAgents
    }

    // Debug: Log what data sources we have
    console.log('[Availability Plugin] scheduleData:', scheduleData)
    console.log('[Availability Plugin] sigmaData:', sigmaData)

    // Priority 2: Combine Schedule data (for who's working) + Intercom status (for real-time status)
    // Check if we have schedule columns mapped
    const scheduleTSECol = config.scheduleTSE as string
    const scheduleOOOCol = config.scheduleOOO as string
    const scheduleHoursCols = config.scheduleHours as string | string[] | undefined
    const scheduleCurrentlyOnChatCol = config.scheduleCurrentlyOnChat as string | undefined
    const scheduleCurrentlyLunchCol = config.scheduleCurrentlyLunch as string | undefined
    
    console.log('[Availability Plugin] Schedule column mappings:')
    console.log('  scheduleTSE:', scheduleTSECol)
    console.log('  scheduleOOO:', scheduleOOOCol)
    console.log('  scheduleHours:', scheduleHoursCols)
    console.log('  scheduleCurrentlyOnChat:', scheduleCurrentlyOnChatCol)
    console.log('  scheduleCurrentlyLunch:', scheduleCurrentlyLunchCol)
    
    // Use direct subscription data if available, fall back to hook data
    const effectiveScheduleData = Object.keys(directScheduleData).length > 0 ? directScheduleData : scheduleData
    const effectiveSourceData = Object.keys(directSourceData).length > 0 ? directSourceData : sigmaData
    const effectiveOooData = Object.keys(directOooData).length > 0 ? directOooData : oooData
    
    console.log('[Availability Plugin] Using effectiveScheduleData with', Object.keys(effectiveScheduleData || {}).length, 'columns')
    console.log('[Availability Plugin] Using effectiveSourceData with', Object.keys(effectiveSourceData || {}).length, 'columns')
    console.log('[Availability Plugin] Using effectiveOooData with', Object.keys(effectiveOooData || {}).length, 'columns')
    
    // Build a Set of TSE names that are OOO (from the dedicated OOO view)
    const oooTseSet = new Set<string>()
    const oooTseCol = config.oooTSE as string
    const oooStatusCol = config.oooStatus as string
    
    if (effectiveOooData && oooTseCol) {
      const tseNames = effectiveOooData[oooTseCol] as string[] | undefined
      const oooStatuses = oooStatusCol ? effectiveOooData[oooStatusCol] as string[] | undefined : undefined
      
      console.log('[OOO Filter] OOO TSE column:', oooTseCol)
      console.log('[OOO Filter] OOO Status column:', oooStatusCol)
      console.log('[OOO Filter] TSE names from OOO view:', tseNames?.slice(0, 10))
      
      if (tseNames) {
        tseNames.forEach((name, idx) => {
          if (!name) return
          // If there's a status column, check if it's "Yes", otherwise assume all entries are OOO
          // (The view already filters to OOO='Yes' based on the view definition)
          const isOoo = oooStatuses ? oooStatuses[idx]?.toLowerCase() === 'yes' : true
          if (isOoo) {
            const cleanName = name.trim().toLowerCase()
            oooTseSet.add(cleanName)
            // Also add first name for matching
            const firstName = cleanName.split(' ')[0]
            if (firstName !== cleanName) {
              oooTseSet.add(firstName)
            }
          }
        })
        console.log('[OOO Filter] OOO TSEs (will be hidden):', Array.from(oooTseSet))
      }
    }
    
    if (effectiveScheduleData && scheduleTSECol) {
      const scheduleColumnKeys = Object.keys(effectiveScheduleData)
      console.log('[Availability Plugin] Schedule data columns received:', scheduleColumnKeys)
      
      // Resolve TSE column: config may store display name (e.g. "Tse") while data keys are column IDs.
      // Use configured value if it exists in data; else find by column name; else use first column with string values.
      let tseCol: string = scheduleTSECol
      const tseDataDirect = effectiveScheduleData[scheduleTSECol] as string[] | undefined
      if (!tseDataDirect || tseDataDirect.length === 0) {
        const byName = scheduleColumns && typeof scheduleColumns === 'object'
          ? Object.entries(scheduleColumns).find(([, meta]: [string, any]) =>
              (meta?.name || meta?.label || '').toLowerCase() === String(scheduleTSECol).toLowerCase())
          : null
        if (byName) {
          tseCol = byName[0]
          console.log('[Availability Plugin] Resolved scheduleTSE by name:', scheduleTSECol, '->', tseCol)
        } else {
          const firstWithStrings = scheduleColumnKeys.find(key => {
            const arr = effectiveScheduleData[key]
            return Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string'
          })
          if (firstWithStrings) {
            tseCol = firstWithStrings
            console.log('[Availability Plugin] Using first name-like column as scheduleTSE:', tseCol)
          }
        }
      }
      
      // Get OOO data directly from mapped columns
      const oooCol = scheduleOOOCol
      
      // Find the hour column from the mapped hours
      // scheduleHours is an array of column IDs in order: _0, _1, _2, ... _18
      // So we just index directly into it based on the current Pacific hour
      let hourCol: string | undefined = undefined
      
      if (scheduleHoursCols) {
        const hourColIds = Array.isArray(scheduleHoursCols) ? scheduleHoursCols : [scheduleHoursCols]
        // The array is ordered by hour (0-18), so index directly
        // Pacific hour 0-18 maps to index 0-18
        if (currentPacificHour >= 0 && currentPacificHour < hourColIds.length) {
          hourCol = hourColIds[currentPacificHour]
        }
        console.log('[Availability Plugin] scheduleHours array length:', hourColIds.length)
        console.log('[Availability Plugin] Trying index', currentPacificHour, '-> column ID:', hourCol)
      }
      
      // Debug logging
      console.log('[Availability Plugin] Pacific Hour:', currentPacificHour)
      console.log('[Availability Plugin] Schedule columns:', scheduleColumnKeys)
      console.log('[Availability Plugin] TSE column:', tseCol)
      console.log('[Availability Plugin] OOO column:', oooCol)
      console.log('[Availability Plugin] Looking for hour column: _' + currentPacificHour)
      console.log('[Availability Plugin] Hour column found:', hourCol)
      
      // Log the actual hour data for Nathan S
      if (tseCol && hourCol && effectiveScheduleData[hourCol]) {
        const tseNames = effectiveScheduleData[tseCol] as string[]
        const hourData = effectiveScheduleData[hourCol] as string[]
        const nathanIndex = tseNames?.findIndex(name => 
          name?.toLowerCase().includes('nathan s') || name?.toLowerCase() === 'nathan s'
        )
        if (nathanIndex >= 0) {
          console.log(`[Nathan Debug] Found Nathan S at index ${nathanIndex}`)
          console.log(`[Nathan Debug] Hour data for Nathan S: "${hourData?.[nathanIndex]}"`)
        } else {
          console.log(`[Nathan Debug] Nathan S not found in TSE column`)
        }
      }
      
      // Log sample data for first few rows
      if (tseCol) {
        const tseData = effectiveScheduleData[tseCol] as string[]
        const hourData = hourCol ? effectiveScheduleData[hourCol] as string[] : undefined
        console.log('[Availability Plugin] Sample schedule data (first 5):')
        for (let i = 0; i < Math.min(5, tseData?.length || 0); i++) {
          console.log(`  ${tseData?.[i]}: block=${hourData?.[i] || 'no hour col'}`)
        }
      }
      
      // Build a map of Intercom statuses if available
      const intercomStatusMap = new Map<string, string>()
      const minutesInStatusMap = new Map<string, number>()
      console.log('[Availability Plugin] Checking Intercom status data...')
      console.log('[Availability Plugin] effectiveSourceData keys:', Object.keys(effectiveSourceData || {}))
      
      // Use config column IDs directly (from the Sigma column configuration)
      const agentNameCol = config.agentName as string
      const agentStatusCol = config.agentStatus as string
      const agentMinutesCol = config.agentMinutesInStatus as string
      
      console.log('[Availability Plugin] Config columns - agentName:', agentNameCol, 'agentStatus:', agentStatusCol, 'agentMinutesInStatus:', agentMinutesCol)
      
      if (effectiveSourceData && agentNameCol && agentStatusCol) {
        const names = effectiveSourceData[agentNameCol] as string[] | undefined
        const statuses = effectiveSourceData[agentStatusCol] as string[] | undefined
        const minutes = agentMinutesCol ? effectiveSourceData[agentMinutesCol] as string[] | number[] | undefined : undefined
        
        console.log('[Availability Plugin] ✓ Status source connected!')
        console.log('[Availability Plugin] Name data sample:', names?.slice(0, 3))
        console.log('[Availability Plugin] Status data sample:', statuses?.slice(0, 3))
        console.log('[Availability Plugin] Minutes data sample:', minutes?.slice(0, 3))
        
        if (names && statuses) {
          names.forEach((name, idx) => {
            if (name) {
              const cleanName = name.trim().toLowerCase()
              intercomStatusMap.set(cleanName, statuses[idx] || '')
              // Also try first name only for matching
              const firstName = cleanName.split(' ')[0]
              if (firstName !== cleanName) {
                intercomStatusMap.set(firstName, statuses[idx] || '')
              }
              
              // Store minutes in status if available
              if (minutes && minutes[idx] !== undefined && minutes[idx] !== null) {
                const minutesValue = typeof minutes[idx] === 'string' ? parseInt(minutes[idx] as string, 10) : minutes[idx] as number
                if (!isNaN(minutesValue)) {
                  minutesInStatusMap.set(cleanName, minutesValue)
                  if (firstName !== cleanName) {
                    minutesInStatusMap.set(firstName, minutesValue)
                  }
                }
              }
            }
          })
          console.log('[Availability Plugin] Built intercomStatusMap with', intercomStatusMap.size, 'entries')
          console.log('[Availability Plugin] Built minutesInStatusMap with', minutesInStatusMap.size, 'entries')
          // Log a few entries for debugging
          const entries = Array.from(intercomStatusMap.entries()).slice(0, 5)
          console.log('[Availability Plugin] Sample intercom statuses:', entries)
        }
      } else {
        console.log('[Availability Plugin] ⚠️ Missing agentName or agentStatus column config')
      }

      // Override with webhook-derived away statuses (real-time from Intercom admin.away_mode_updated)
      if (webhookAwayStatus?.byName && Object.keys(webhookAwayStatus.byName).length > 0) {
        Object.entries(webhookAwayStatus.byName).forEach(([nameKey, entry]) => {
          if (entry?.status) {
            intercomStatusMap.set(nameKey, entry.status)
          }
        })
        console.log('[Availability Plugin] Merged', Object.keys(webhookAwayStatus.byName).length, 'webhook away status overrides')
      }

      // Final guard: if Intercom marks admin as away, never show them as available.
      // This protects against stale source/webhook values that can lag behind.
      if (intercomTeamMembers.length > 0) {
        let enforcedAwayCount = 0
        intercomTeamMembers.forEach((member) => {
          if (!member?.name || !member.away_mode_enabled) return
          const awayLabel =
            member.away_status_reason?.label ||
            member.away_status_reason?.name ||
            'Away'
          const key = member.name.trim().toLowerCase()
          if (!key) return
          intercomStatusMap.set(key, awayLabel)
          const firstName = key.split(' ')[0]
          if (firstName && firstName !== key) intercomStatusMap.set(firstName, awayLabel)
          enforcedAwayCount++
        })
        if (enforcedAwayCount > 0) {
          console.log('[Availability Plugin] Enforced away-mode status for', enforcedAwayCount, 'admins from Intercom team data')
        }
      }
      
      // Parse CURRENTLY_ON_CHAT and CURRENTLY_LUNCH columns to get list of allowed agents
      const allowedAgentsSet = new Set<string>()
      
      // Parse CURRENTLY_ON_CHAT column
      if (scheduleCurrentlyOnChatCol && effectiveScheduleData[scheduleCurrentlyOnChatCol]) {
        const currentlyOnChatData = effectiveScheduleData[scheduleCurrentlyOnChatCol] as string[] | undefined
        if (currentlyOnChatData && currentlyOnChatData.length > 0) {
          let totalNames = 0
          currentlyOnChatData.forEach((value, rowIndex) => {
            if (!value || !value.trim()) {
              return
            }
            
            const agentNames = value
              .split(',')
              .map(name => name.trim())
              .filter(name => name.length > 0)
            
            agentNames.forEach(name => {
              allowedAgentsSet.add(name.toLowerCase())
            })
            
            totalNames += agentNames.length
            console.log(`[Availability Plugin] CURRENTLY_ON_CHAT row ${rowIndex}:`, agentNames)
          })
          
          console.log('[Availability Plugin] CURRENTLY_ON_CHAT total names processed:', totalNames)
        }
      }
      
      // Parse CURRENTLY_LUNCH column (agents on lunch should also be displayed)
      if (scheduleCurrentlyLunchCol && effectiveScheduleData[scheduleCurrentlyLunchCol]) {
        const currentlyLunchData = effectiveScheduleData[scheduleCurrentlyLunchCol] as string[] | undefined
        if (currentlyLunchData && currentlyLunchData.length > 0) {
          let totalNames = 0
          currentlyLunchData.forEach((value, rowIndex) => {
            if (!value || !value.trim()) {
              return
            }
            
            const agentNames = value
              .split(',')
              .map(name => name.trim())
              .filter(name => name.length > 0)
            
            agentNames.forEach(name => {
              allowedAgentsSet.add(name.toLowerCase())
            })
            
            totalNames += agentNames.length
            console.log(`[Availability Plugin] CURRENTLY_LUNCH row ${rowIndex}:`, agentNames)
          })
          
          console.log('[Availability Plugin] CURRENTLY_LUNCH total names processed:', totalNames)
        }
      }
      
      console.log('[Availability Plugin] Allowed agents (unique, combined):', Array.from(allowedAgentsSet))
      
      if (tseCol && effectiveScheduleData[tseCol]) {
        const tseData = effectiveScheduleData[tseCol] as string[] | undefined
        const oooData = oooCol && effectiveScheduleData[oooCol] ? effectiveScheduleData[oooCol] as string[] | undefined : undefined
        const hourData = hourCol && effectiveScheduleData[hourCol] ? effectiveScheduleData[hourCol] as string[] | undefined : undefined
        
        if (tseData) {
          return tseData
            .map((name, idx): AgentData | null => {
              if (!name) return null // Skip empty rows
              
              const cleanName = name?.trim()
              
              // Skip Nathan Parrish - we only want Nathan Simpson
              if (cleanName?.toLowerCase().includes('nathan p') || 
                  cleanName?.toLowerCase() === 'nathan parrish') {
                console.log(`[Availability Plugin] Skipping Nathan Parrish: "${cleanName}"`)
                return null
              }
              
              // Skip Brett Bedevian completely - check multiple variations
              const brettCheckName = cleanName?.toLowerCase() || ''
              if (brettCheckName.includes('brett') || 
                  brettCheckName === 'brett bedevian' ||
                  brettCheckName.startsWith('brett ') ||
                  brettCheckName === 'brett') {
                console.log(`[Availability Plugin] Skipping Brett Bedevian: "${cleanName}"`)
                return null
              }
              
              // Check if TSE is OOO according to the dedicated OOO view
              const cleanNameLowerForOoo = cleanName?.toLowerCase()
              const firstNameForOoo = cleanNameLowerForOoo?.split(' ')[0]
              if (oooTseSet.size > 0 && (oooTseSet.has(cleanNameLowerForOoo) || oooTseSet.has(firstNameForOoo))) {
                console.log(`[OOO Filter] Agent "${cleanName}" is OOO according to OOO view - skipping`)
                return null
              }
              
              const isOOO = oooData?.[idx]?.toLowerCase() === 'yes'
              const hourBlock = hourData?.[idx] || '' // Default to empty if no hour data

              // Never show OOO agents
              if (isOOO) return null
              
              // Filter: Include agents who are either:
              // 1. In the CURRENTLY_ON_CHAT or CURRENTLY_LUNCH list, OR
              // 2. Have an "available" Intercom status (actively available even if not scheduled)
              if (allowedAgentsSet.size > 0) {
                const cleanNameLower = cleanName?.toLowerCase()
                const firstName = cleanNameLower.split(' ')[0]
                let isAllowed = false
                
                // Check if agent has "available" Intercom status
                const agentIntercomStatus = intercomStatusMap.get(cleanNameLower) || 
                                           intercomStatusMap.get(firstName) ||
                                           intercomStatusMap.get(cleanNameLower.replace(/\s+\w+$/, ''))
                
                if (agentIntercomStatus && agentIntercomStatus.toLowerCase().includes('available')) {
                  isAllowed = true
                  console.log(`[Availability Plugin] Agent "${cleanName}" has "available" Intercom status - including`)
                }
                
                // Also check if in the scheduled lists
                if (!isAllowed) {
                  // Try exact match first
                  if (allowedAgentsSet.has(cleanNameLower)) {
                    isAllowed = true
                  } else {
                    // Try matching by first name (most common case)
                    // CURRENTLY_ON_CHAT has "Salman", TSE might have "Salman" or full name
                    if (allowedAgentsSet.has(firstName)) {
                      isAllowed = true
                    } else {
                      // Try reverse: check if any allowed name matches this agent's first name
                      // Handle cases like CURRENTLY_ON_CHAT has "Nathan" but TSE has "Nathan S"
                      for (const allowedName of allowedAgentsSet) {
                        if (firstName === allowedName || cleanNameLower.startsWith(allowedName + ' ')) {
                          isAllowed = true
                          break
                        }
                      }
                    }
                  }
                }
                
                if (!isAllowed) {
                  console.log(`[Availability Plugin] Agent "${cleanName}" not in scheduled lists and not available - skipping`)
                  return null
                }
              }
              
              // Filter: Exclude agents with "X" in current hour block (not working)
              if (hourBlock?.toUpperCase() === 'X') {
                console.log(`[Availability Plugin] Agent "${cleanName}" has "X" in hour block - skipping`)
                return null
              }
              
              // Double-check: Skip Brett Bedevian completely (even if they passed earlier checks)
              const brettFinalCheck = cleanName?.toLowerCase() || ''
              if (brettFinalCheck.includes('brett')) {
                console.log(`[Availability Plugin] Final check - Skipping Brett Bedevian: "${cleanName}"`)
                return null
              }
              
              // Debug logging for Nathan
              if (cleanName?.toLowerCase().includes('nathan')) {
                console.log(`[Nathan Debug] Found Nathan: "${cleanName}"`)
                console.log(`  - Hour block: "${hourBlock}"`)
                console.log(`  - isOOO: ${isOOO}`)
              }
              
              // Look up team member by name to get avatar and timezone
              // Handle "Nathan S" -> "Nathan" matching
              const teamMember = TEAM_MEMBERS.find(m => {
                const memberNameLower = m.name.toLowerCase()
                const cleanNameLower = cleanName?.toLowerCase()
                
                // Exact match
                if (memberNameLower === cleanNameLower) return true
                
                // Handle "Nathan S" matching to "Nathan"
                if (cleanNameLower === 'nathan s' && memberNameLower === 'nathan') {
                  console.log(`[Nathan Debug] Matched "Nathan S" to team member "Nathan"`)
                  return true
                }
                
                // Handle names with initials (e.g., "Hem Kamdar" -> "Hem")
                const cleanNameFirst = cleanNameLower?.split(' ')[0]
                if (memberNameLower === cleanNameFirst) return true
                
                return false
              })

              const intercomTeamMember = intercomTeamMembers.find(member => {
                const memberNameLower = (member.name || '').toLowerCase()
                const cleanNameLower = cleanName?.toLowerCase()
                if (!memberNameLower || !cleanNameLower) return false

                if (memberNameLower === cleanNameLower) return true

                if (cleanNameLower === 'nathan s' && memberNameLower === 'nathan') {
                  return true
                }

                const cleanNameFirst = cleanNameLower.split(' ')[0]
                if (memberNameLower === cleanNameFirst) return true

                return false
              })
              
              if (!teamMember) {
                // Extra debug for Nathan
                if (cleanName?.toLowerCase().includes('nathan')) {
                  console.log(`[Nathan Debug] Not found in team list! Looking for: "${cleanName}"`)
                  const teamNathans = TEAM_MEMBERS.filter(m => m.name.toLowerCase().includes('nathan'))
                  console.log(`[Nathan Debug] Team members with Nathan:`, teamNathans.map(m => m.name))
                }
                return null // Skip if not in our team list
              } else {
                // Log successful Nathan match
                if (cleanName?.toLowerCase().includes('nathan')) {
                  console.log(`[Nathan Debug] Successfully matched "${cleanName}" to team member "${teamMember.name}"`)
                }
              }

              const freshIntercomAvatar = withAvatarRefreshKey(intercomTeamMember?.avatar?.image_url)
              
              // Only show agents who are scheduled for the current hour (have a valid hour block: Y, N, F, or L)
              // During off hours, don't show anyone, including OOO agents
              const validHourBlocks = ['Y', 'N', 'F', 'L']
              const hourBlockUpper = hourBlock?.toUpperCase() || ''
              if (!validHourBlocks.includes(hourBlockUpper)) {
                if (cleanName?.toLowerCase().includes('nathan')) {
                  console.log(`[Nathan Debug] No valid hour block (got "${hourBlock}") - skipping (even if OOO)`)
                }
                return null
              }
              
              // Determine status: Intercom status takes priority (real-time), then OOO, then schedule
              let status: AgentStatus
              let statusEmoji: string
              let statusLabel: string
              let ringColor: 'red' | 'yellow' | 'green' | 'blue' | 'zoom' | 'meeting' | 'purple' | 'orange' = 'purple' // Default to purple
              
              // Try multiple ways to match the name in intercom data
              const nameLower = cleanName.toLowerCase()
              const firstName = nameLower.split(' ')[0]
              const intercomStatus = intercomStatusMap.get(nameLower) || 
                                    intercomStatusMap.get(firstName) ||
                                    // Also try without middle names
                                    intercomStatusMap.get(nameLower.replace(/\s+\w+$/, ''))
              
              // Get minutes in status
              const minutesInStatus = minutesInStatusMap.get(nameLower) || 
                                     minutesInStatusMap.get(firstName) ||
                                     minutesInStatusMap.get(nameLower.replace(/\s+\w+$/, '')) ||
                                     undefined
              
              // Determine ring color based on schedule + Intercom status
              const scheduledForChat = hourBlock?.toUpperCase() === 'Y'
              
              // Debug Nathan's ring color logic
              if (cleanName?.toLowerCase().includes('nathan')) {
                console.log(`  - Scheduled for chat: ${scheduledForChat}`)
                console.log(`  - Intercom status: "${intercomStatus || 'none'}"`)
              }
              
              // Check if agent is on a Zoom call first (takes priority)
              if (intercomStatus && (intercomStatus.toLowerCase().includes('zoom') || intercomStatus.includes('🖥'))) {
                ringColor = 'zoom'
              } else if (intercomStatus && (intercomStatus.toLowerCase().includes('in a meeting') || intercomStatus.includes('🗓️'))) {
                ringColor = 'meeting' // In a meeting (not Zoom)
              } else if (scheduledForChat) {
                // Agent is scheduled for chat this hour
                if (intercomStatus) {
                  const intercomLower = intercomStatus.toLowerCase()
                  if (intercomLower.includes('available')) {
                    ringColor = 'green' // Scheduled and available - good!
                  } else if (intercomLower.includes('break') || intercomLower.includes('lunch')) {
                    ringColor = 'yellow' // Should be chatting but is on break
                  } else if (intercomLower.includes('off chat') || intercomLower.includes('closing')) {
                    ringColor = 'red' // Should be chatting but is off chat -> Scheduled but Away
                  } else if (intercomLower.includes('done for the day') || intercomLower.includes('done for day') || intercomLower.includes('out of office') || intercomLower.includes('out sick') || intercomLower.includes('🏡') || intercomLower.includes('🌴')) {
                    ringColor = 'red' // Scheduled for chat but away/done for day -> Scheduled but Away
                  } else {
                    // Scheduled but unknown status - yellow (away)
                    ringColor = 'yellow'
                  }
                } else {
                  // Scheduled for chat but no Intercom status
                  ringColor = 'yellow' // Warning - can't confirm they're available
                }
              } else {
                // Not scheduled for chat - default ring color
                ringColor = 'purple'
              }
              
              // Priority 1: Use real-time Intercom status if available
              if (intercomStatus) {
                status = parseStatus(intercomStatus)
                statusEmoji = extractEmoji(intercomStatus) || getStatusEmoji(status)
                statusLabel = intercomStatus
              }
              // Priority 2: Check if OOO in schedule
              else if (isOOO) {
                status = 'away'
                statusEmoji = '🌴'
                statusLabel = 'Out of office'
              }
              // Priority 3: Check schedule block
              else if (hourBlock?.toUpperCase() === 'X') {
                status = 'away'
                statusEmoji = '🏡'
                statusLabel = 'Done for day'  // Changed from "Not working" to match legend
              }
              else {
                // Fall back to schedule block
                status = parseScheduleBlock(hourBlock, false)
                statusEmoji = getScheduleEmoji(hourBlock, false)
                statusLabel = hourBlock === 'Y' ? 'Available' : 
                             hourBlock === 'N' ? 'Off Chat' :
                             hourBlock === 'F' ? 'Focus Time' :
                             hourBlock === 'L' ? 'On a break' : 'Done for day'
              }
              
              // Ensure we always have an emoji
              const finalStatusEmoji = statusEmoji || getStatusEmoji(status)
              const finalStatusLabel = statusLabel || 'Unknown'
              
              // Filter: If agent has "Off Chat Hour" status but is NOT scheduled for chat, skip them
              if (intercomStatus && intercomStatus.includes('Off Chat Hour') && !scheduledForChat) {
                return null
              }
              // Done for the day / Out of office / Out sick: only show if scheduled for chat (then they go in "Scheduled but Away")
              const labelLower = finalStatusLabel.toLowerCase()
              if ((labelLower.includes('done for the day') || labelLower.includes('done for day') || labelLower.includes('out of office') || labelLower.includes('out sick')) && !scheduledForChat) {
                return null
              }
              // Always hide "Out sick" agents — even if scheduled, they're not available
              if (labelLower.includes('out sick')) {
                return null
              }
              
              // Debug: log status assignment for first few agents and Nathan
              if (idx < 3 || cleanName?.toLowerCase().includes('nathan')) {
                console.log(`[Availability Plugin] Agent ${cleanName} (idx: ${idx}):`)
                console.log(`  - hourBlock from schedule: "${hourBlock}"`)
                console.log(`  - isOOO: ${isOOO}`)
                console.log(`  - teamMember found: ${teamMember ? 'YES' : 'NO'}`)
                console.log(`  - tried lookup keys: "${nameLower}", "${firstName}"`)
                console.log(`  - intercomStatus found: "${intercomStatus || 'none'}"`)
                console.log(`  - finalStatus: ${status}, emoji: ${finalStatusEmoji}`)
                console.log(`  - ringColor: ${ringColor}`)
                console.log(`  - Will show: YES (returning agent data)`)
              }
              
              return {
                id: `agent-${idx}`,
                name: cleanName,
                avatar: freshIntercomAvatar || teamMember?.avatar || `https://i.pravatar.cc/40?u=${cleanName}`,
                status,
                timezone: teamMember?.timezone || 'America/New_York',
                statusEmoji: finalStatusEmoji,
                statusLabel: finalStatusLabel,
                ringColor,
                minutesInStatus,
              }
            })
            .filter((agent): agent is AgentData => agent !== null)
        }
      }
    }

    // Priority 3: Use legacy Sigma worksheet data if connected
    if (sigmaData && columns) {
      const nameCol = config.agentName as string
      const avatarCol = config.agentAvatar as string
      const statusCol = config.agentStatus as string
      const timezoneCol = config.agentTimezone as string

      if (nameCol && statusCol) {
        const nameData = sigmaData[nameCol] as string[] | undefined
        const avatarData = sigmaData[avatarCol] as string[] | undefined
        const statusData = sigmaData[statusCol] as string[] | undefined
        const timezoneData = sigmaData[timezoneCol] as string[] | undefined

        if (nameData && statusData) {
          return nameData
            .map((name, idx) => {
              // Clean up name (remove trailing spaces)
              const cleanName = name?.trim()
              
              // Skip Brett Bedevian completely
              const brettLegacyCheck = cleanName?.toLowerCase() || ''
              if (brettLegacyCheck.includes('brett')) {
                return null
              }
              
              // Look up team member by name to get avatar and timezone
              const teamMember = TEAM_MEMBERS.find(
                m => m.name.toLowerCase() === cleanName?.toLowerCase()
              )
              
              return {
                id: `agent-${idx}`,
                name: cleanName,
                avatar: avatarData?.[idx] || teamMember?.avatar || `https://i.pravatar.cc/40?u=${cleanName}`,
                status: parseStatus(statusData[idx]),
                // Use timezone from data if available, otherwise look up from team member
                timezone: timezoneData?.[idx] || teamMember?.timezone || 'America/New_York',
              }
            })
            .filter((agent): agent is AgentData => agent !== null)
        }
      }
    }

    // Fallback: Demo data with dynamic status updates
    return generateDemoAgents(cities).map(agent => ({
      ...agent,
      status: statusUpdates[agent.id] || agent.status,
    }))
  }, [sigmaData, columns, scheduleColumns, scheduleData, config, cities, apiUrl, apiAgents, statusUpdates, currentPacificHour, directScheduleData, directSourceData, directOooData, oooData, webhookAwayStatus, intercomTeamMembers, intercomLastUpdated])

  // OOO agents state - will be populated from schedule data (hidden for now)
  const [_oooAgents, setOooAgents] = useState<{ name: string; avatar: string }[]>([])

  // Group agents by city/timezone
  const agentsByCity = useMemo(() => {
    const grouped = new Map<string, AgentData[]>()
    
    cities.forEach(city => {
      grouped.set(city.timezone, [])
    })

    agents.forEach(agent => {
      const existing = grouped.get(agent.timezone)
      if (existing) {
        existing.push(agent)
      } else {
        // Try to match by city name or approximate timezone
        const matchedCity = cities.find(c => 
          c.timezone.toLowerCase().includes(agent.timezone.toLowerCase()) ||
          agent.timezone.toLowerCase().includes(c.name.toLowerCase())
        )
        if (matchedCity) {
          const cityAgents = grouped.get(matchedCity.timezone)
          cityAgents?.push(agent)
        }
      }
    })

    return grouped
  }, [agents, cities])

  
  // Extract OOO agents when schedule data is available
  useEffect(() => {
    const scheduleTSECol = config.scheduleTSE as string
    const scheduleOOOCol = config.scheduleOOO as string
    const effectiveScheduleData = Object.keys(directScheduleData).length > 0 ? directScheduleData : scheduleData
    
    console.log('[OOO Effect] Checking for OOO data...')
    console.log('[OOO Effect] effectiveScheduleData keys:', Object.keys(effectiveScheduleData || {}).length)
    
    if (!effectiveScheduleData || !scheduleTSECol || !scheduleOOOCol) {
      return
    }
    
    const tseData = effectiveScheduleData[scheduleTSECol] as string[] | undefined
    const oooData = effectiveScheduleData[scheduleOOOCol] as string[] | undefined
    
    if (!tseData || !oooData) {
      console.log('[OOO Effect] Missing tseData or oooData')
      return
    }
    
    console.log('[OOO Effect] Found data! TSE count:', tseData.length)
    console.log('[OOO Effect] OOO data sample:', oooData.slice(0, 5))
    
    const oooList: { name: string; avatar: string }[] = []
    
    tseData.forEach((name, idx) => {
      if (!name) return
      const cleanName = name.trim()
      const oooValue = oooData[idx]
      const isOOO = oooValue?.toLowerCase() === 'yes'
      
      if (isOOO) {
        const teamMember = TEAM_MEMBERS.find(
          m => m.name.toLowerCase() === cleanName.toLowerCase()
        )
        if (teamMember) {
          oooList.push({
            name: cleanName,
            avatar: teamMember.avatar || `https://i.pravatar.cc/40?u=${cleanName}`,
          })
        }
      }
    })
    
    console.log('[OOO Effect] Found OOO agents:', oooList.length, oooList.map(a => a.name))
    setOooAgents(oooList)
  }, [config, scheduleData, directScheduleData])

  // Update intensity when calculated intensity changes (if auto-intensity is enabled)
  useEffect(() => {
    if (autoIntensityEnabled) {
      setIntensity(calculatedIntensity)
    } else {
      setIntensity(parseInt(String(defaultIntensity), 10) || 35)
    }
  }, [calculatedIntensity, autoIntensityEnabled, defaultIntensity])

  // Time simulation / real-time updates
  useEffect(() => {
    let simTime = 0
    const simSpeed = 15 / 60 // hours per second

    const interval = setInterval(() => {
      if (simulateTime) {
        simTime += simSpeed
        if (simTime >= 24) simTime = 0
        const h = Math.floor(simTime)
        const m = Math.round((simTime - h) * 60)
        setCurrentTime(new Date(Date.UTC(2025, 0, 1, h, m, 0)))
      } else {
        setCurrentTime(new Date())
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [simulateTime])

  // =================================================================
  // CAPACITY METRICS (TSEs @ Capacity and Available Capacity)
  // =================================================================
  const capacityMetrics = useMemo(() => {
    // Create a map of TSE names (lowercase) to their open chat counts
    const tseOpenChatMap = new Map<string, number>()
    tseConversationDataForCapacity.forEach(tse => {
      const nameLower = tse.fullName.trim().toLowerCase()
      const firstName = nameLower.split(' ')[0]
      tseOpenChatMap.set(nameLower, tse.openCount)
      if (firstName !== nameLower) {
        tseOpenChatMap.set(firstName, tse.openCount)
      }
    })

    // Get list of active TSE names from schedule/status
    const activeTSENames = new Set<string>()
    const effectiveScheduleData = Object.keys(directScheduleData).length > 0 ? directScheduleData : scheduleData
    const scheduleTSECol = config.scheduleTSE as string
    const scheduleOOOCol = config.scheduleOOO as string
    
    if (effectiveScheduleData && scheduleTSECol) {
      const tseData = effectiveScheduleData[scheduleTSECol] as string[] | undefined
      const oooData = scheduleOOOCol && effectiveScheduleData[scheduleOOOCol] 
        ? effectiveScheduleData[scheduleOOOCol] as string[] | undefined 
        : undefined
      
      // Build set of OOO TSEs
      const oooSet = new Set<string>()
      if (oooData) {
        oooData.forEach((value, idx) => {
          if (value && String(value).toLowerCase() === 'yes') {
            const tseName = tseData?.[idx]?.trim().toLowerCase()
            if (tseName) {
              oooSet.add(tseName)
              const firstName = tseName.split(' ')[0]
              if (firstName !== tseName) {
                oooSet.add(firstName)
              }
            }
          }
        })
      }
      
      // Build agent status map
      const agentStatusMap = new Map<string, 'away' | 'call' | 'lunch' | 'chat' | 'closing'>()
      agentsByCity.forEach((agents) => {
        agents.forEach(agent => {
          if (agent.name) {
            const cleanName = agent.name.trim().toLowerCase()
            agentStatusMap.set(cleanName, agent.status)
            const firstName = cleanName.split(' ')[0]
            if (firstName !== cleanName) {
              agentStatusMap.set(firstName, agent.status)
            }
          }
        })
      })
      
      // Get active city timezones
      const nowUTC = (
        currentTime.getUTCHours() +
        currentTime.getUTCMinutes() / 60 +
        currentTime.getUTCSeconds() / 3600
      )
      const activeCities = cities.filter(c => {
        if (c.endHour > 24) {
          const nextDayEndHour = c.endHour - 24
          return nowUTC >= c.startHour || nowUTC < nextDayEndHour + 1
        } else {
          return nowUTC >= c.startHour && nowUTC < c.endHour + 1
        }
      })
      const activeTimezones = new Set(activeCities.map(c => c.timezone))
      
      // Collect active TSE names (use full names to avoid duplicates)
      if (tseData) {
        tseData.forEach((name) => {
          if (!name || !name.trim()) return
          
          const cleanName = name.trim()
          const cleanNameLower = cleanName.toLowerCase()
          const firstName = cleanNameLower.split(' ')[0]
          
          // Skip if OOO
          if (oooSet.has(cleanNameLower) || oooSet.has(firstName)) {
            return
          }
          
          // Find team member to get timezone
          const teamMember = TEAM_MEMBERS.find(m => 
            m.name.toLowerCase() === cleanNameLower ||
            m.name.toLowerCase() === firstName ||
            cleanNameLower.startsWith(m.name.toLowerCase() + ' ') ||
            m.name.toLowerCase().startsWith(firstName + ' ')
          )
          
          // Only count if scheduled in an active city and not away
          if (teamMember && activeTimezones.has(teamMember.timezone)) {
            const agentStatus = agentStatusMap.get(cleanNameLower) || 
                               agentStatusMap.get(firstName) ||
                               null
            
            if (agentStatus !== 'away' && agentStatus !== null) {
              // Use full name as primary key, but also store first name for matching
              activeTSENames.add(cleanNameLower)
            }
          }
        })
      }
    }

    // Calculate capacity metrics
    // Match active TSE names to their open chat counts
    const processedTSEs = new Set<string>()
    let tseAtCapacityCount = 0
    let availableCapacity = 0
    
    activeTSENames.forEach(tseName => {
      // Find matching TSE in conversation data (try full name first, then first name)
      let openCount = tseOpenChatMap.get(tseName) || 0
      let matchedTseName = tseName
      
      // If not found by full name, try first name
      if (openCount === 0) {
        const firstName = tseName.split(' ')[0]
        openCount = tseOpenChatMap.get(firstName) || 0
        if (openCount > 0) {
          // Find the full name from the map
          for (const [key, count] of tseOpenChatMap.entries()) {
            if (key.toLowerCase().startsWith(firstName.toLowerCase() + ' ') || 
                (key.toLowerCase() === firstName.toLowerCase() && count === openCount)) {
              matchedTseName = key
              break
            }
          }
        }
      }
      
      // Skip if we've already processed this TSE (check by first name to avoid duplicates)
      const firstName = tseName.split(' ')[0]
      if (processedTSEs.has(firstName)) {
        return
      }
      processedTSEs.add(firstName)
      
      // Get this TSE's capacity limit (from exceptions or default)
      // Try both the matched name and the original schedule name
      const tseCapacityLimit = getTSECapacity(matchedTseName) || getTSECapacity(tseName)
      
      // Count TSEs at capacity (at or above their limit)
      if (openCount >= tseCapacityLimit) {
        tseAtCapacityCount++
      }
      
      // Calculate available capacity: sum of (capacityLimit - openCount) for all active TSEs
      // This can be negative if some TSEs are over capacity
      const capacityDiff = tseCapacityLimit - openCount
      availableCapacity += capacityDiff
    })

    return {
      tseOpenChatMap,
      tseAtCapacityCount,
      availableCapacity
    }
  }, [
    tseConversationDataForCapacity,
    scheduleData,
    directScheduleData,
    config.scheduleTSE,
    config.scheduleOOO,
    agentsByCity,
    cities,
    currentTime
  ])

  // Random status updates every 10 seconds (demo mode only)
  useEffect(() => {
    if (apiUrl || sigmaData) return // Skip if using real data

    const statuses: AgentStatus[] = ['away', 'call', 'lunch', 'chat', 'closing']
    
    const interval = setInterval(() => {
      // Randomly update ~20% of agents
      const updates: Record<string, AgentStatus> = { ...statusUpdates }
      const agentsToUpdate = TEAM_MEMBERS
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.ceil(TEAM_MEMBERS.length * 0.2))
      
      agentsToUpdate.forEach(agent => {
        updates[agent.id] = statuses[Math.floor(Math.random() * statuses.length)]
      })
      
      setStatusUpdates(updates)
    }, 10000)

    return () => clearInterval(interval)
  }, [apiUrl, sigmaData, statusUpdates])

  // Intensity to color conversion
  const activeColor = useMemo(() => {
    const v = Math.max(0, Math.min(100, intensity))
    let hue: number
    if (v <= 50) {
      hue = 120 - (v / 50) * 60 // green to yellow
    } else {
      hue = 60 - ((v - 50) / 50) * 60 // yellow to red
    }
    return `hsl(${hue} 70% 45%)`
  }, [intensity])

  // Show loading state for API
  if (apiUrl && apiLoading) {
    return (
      <div className="app loading">
        <div className="loading-message">Loading agent data...</div>
      </div>
    )
  }

  // Check if we have any data sources connected
  const hasScheduleData = scheduleData && Object.keys(scheduleData).length > 0
  const hasSigmaData = sigmaData && Object.keys(sigmaData).length > 0
  const hasApiData = apiUrl && apiAgents.length > 0
  const hasAnyData = hasScheduleData || hasSigmaData || hasApiData
  const webhookFetchedAt = webhookAwayStatus?.fetchedAt ? new Date(webhookAwayStatus.fetchedAt) : null
  const webhookAgeSeconds = webhookFetchedAt
    ? Math.max(0, Math.floor((currentTime.getTime() - webhookFetchedAt.getTime()) / 1000))
    : null
  const intercomAgeSeconds = intercomLastUpdated
    ? Math.max(0, Math.floor((currentTime.getTime() - intercomLastUpdated.getTime()) / 1000))
    : null
  const awayFeedAges = [webhookAgeSeconds, intercomAgeSeconds].filter((v): v is number => v !== null)
  const awayStatusMaxAgeSeconds = awayFeedAges.length > 0 ? Math.max(...awayFeedAges) : null
  const awayStatusFreshnessState =
    awayStatusMaxAgeSeconds === null ? 'unknown'
      : awayStatusMaxAgeSeconds <= 20 ? 'live'
      : awayStatusMaxAgeSeconds <= 60 ? 'aging'
      : 'stale'
  // @ts-ignore
  const awayStatusFreshnessColor =
    awayStatusFreshnessState === 'live' ? '#16a34a'
      : awayStatusFreshnessState === 'aging' ? '#d97706'
      : awayStatusFreshnessState === 'stale' ? '#dc2626'
      : '#64748b'

  // Show setup instructions if no data is connected and we're in Sigma
  if (!hasAnyData && agents.length === 0) {
    return (
      <div className="app" style={{ padding: '20px' }}>
        <DarkModeToggle isDarkMode={isDarkMode} onToggle={toggleDarkMode} />
        <AudioToggle isAudioEnabled={isAudioEnabled} onToggle={toggleAudio} />
        <div style={{ 
          background: 'var(--bg-card)', 
          padding: '24px', 
          borderRadius: '8px', 
          maxWidth: '500px',
          margin: '0 auto',
          boxShadow: 'var(--shadow-md)'
        }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>📊 Connect Data Sources</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            To display agent availability, connect your Sigma worksheets in the plugin configuration panel:
          </p>
          <ol style={{ color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li><strong>scheduleSource</strong>: Connect to <code>TSE_SCHEDULE_CURRENT</code> worksheet</li>
            <li><strong>source</strong>: Connect to <code>DASHBOARD_OF_TSES_AND_THEIR_STATUS</code> worksheet</li>
            <li><strong>oooSource</strong>: Connect to <code>SIGMA_ON_SIGMA.SIGMA_WRITABLE.OOO</code> view (for OOO filtering)</li>
          </ol>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '16px' }}>
            Debug: scheduleData keys: {Object.keys(scheduleData || {}).length}, 
            sigmaData keys: {Object.keys(sigmaData || {}).length}
          </p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <div className="app" style={{ '--active-color': activeColor } as React.CSSProperties}>
      <DarkModeToggle isDarkMode={isDarkMode} onToggle={toggleDarkMode} />
      <AudioToggle isAudioEnabled={isAudioEnabled} onToggle={toggleAudio} />
      {/* Auth is handled server-side via INTERCOM_TOKEN — no Connect button needed */}
      <IncidentBanner
        chatCount={bannerChatsToday}
        closedCount={bannerClosedToday}
        chatsTrending={chatsTrending}
        previousClosed={historicalMetrics.yesterdayClosed}
        medianResponseTime={medianResponseTime}
        teamMembers={intercomTeamMembers.length > 0 ? intercomTeamMembers : TEAM_MEMBERS.map(m => ({
          id: m.id,
          name: m.name,
          email: undefined,
          avatar: {
            image_url: m.avatar
          }
        }))}
        unassignedCount={unassignedConvs.length}
        availableCapacity={capacityMetrics.availableCapacity}
      />
      <div className="main-content" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {/* Left sidebar with TSE Conversation Table */}
        <div style={{
          width: '280px',
          flexShrink: 0,
          position: 'sticky',
          top: '20px',
          alignSelf: 'flex-start',
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          marginLeft: '-20px'
        }}>
          <CoinPodiumCard intercomTeamMembers={intercomTeamMembers} />
          <TSEConversationTable
            conversationData={tseConversationData}
            conversationColumns={tseConversationColumns}
            tseColumn={config.tseConversationTSE as string | undefined}
            openColumn={config.tseConversationOpen as string | undefined}
            snoozedColumn={config.tseConversationSnoozed as string | undefined}
            closedColumn={config.tseConversationClosed as string | undefined}
            intercomConversations={intercomConversations}
            intercomClosedConversations={intercomClosedTodayConversations}
            intercomTeamMembers={intercomTeamMembers}
            lastUpdated={intercomLastUpdated}
          />
        </div>

        {/* Main content area */}
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <div className="timeline-section">
            <div style={{ marginBottom: '4px', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                fontSize: '12px',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '2px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ opacity: 0.7 }}>Last updated:</span>
                  <span style={{ fontWeight: 600 }}>{formatLastUpdated(lastUpdated)}</span>
                </div>
              </div>
            </div>
            <ResoQueueBelt
              unassignedConvs={unassignedConvs}
              chatsTodayCount={bannerChatsToday}
              isAudioEnabled={isAudioEnabled}
            />

            {(() => {
              const etDayStr = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                weekday: 'long',
              }).format(currentTime)
              const isWeekend = etDayStr === 'Saturday' || etDayStr === 'Sunday'

              if (isWeekend) {
                return (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 16px',
                    gap: '12px',
                  }}>
                    <div style={{ fontSize: '36px' }}>🏖️</div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#334155',
                      letterSpacing: '-0.01em',
                    }}>
                      It's the weekend!
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#94a3b8',
                      fontWeight: 500,
                      textAlign: 'center',
                      maxWidth: '320px',
                      lineHeight: '1.4',
                    }}>
                      Chat support resumes on Monday. Enjoy your time off!
                    </div>
                  </div>
                )
              }

              return (
                <AvailableTSEsTable 
                  onCountsUpdate={(active, away) => {
                    // Update state only if values changed to prevent loops
                    setLiveTseCounts(prev => {
                      if (prev.active === active && prev.away === away) return prev;
                      return { active, away };
                    });
                  }} 
                />
              )
            })()}

            <Timeline
              cities={cities}
              currentTime={currentTime}
              simulateTime={simulateTime}
              chatsPerHour={chatsPerHour}
              previousDayChatsPerHour={previousDayChatsPerHour}
            />
          </div>
        </div>

        {/* Right sidebar with Fallback Schedule Risk */}
        <div style={{
          width: '280px',
          flexShrink: 0,
          position: 'sticky',
          top: '20px',
          alignSelf: 'flex-start',
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          marginRight: '-20px'
        }}>
          {/* TSE Status Counts */}
          {(liveTseCounts.active !== undefined || liveTseCounts.away !== undefined) && (
            <div className="tse-status-sidebar-counts">
              {liveTseCounts.active !== undefined && (
                <div className="tse-status-sidebar-stat">
                  <div className="tse-status-sidebar-value tse-status-active">
                    {liveTseCounts.active}
                  </div>
                  <div className="tse-status-sidebar-label">ACTIVE</div>
                </div>
              )}
              {liveTseCounts.away !== undefined && (
                <div className="tse-status-sidebar-stat">
                  <div className="tse-status-sidebar-value tse-status-away">
                    {liveTseCounts.away}
                  </div>
                  <div className="tse-status-sidebar-label">AWAY</div>
                </div>
              )}
            </div>
          )}
          
          {/* Combined container for Fallback Gauge, OOO, and Office Hours */}
          <div className="sidebar-components-container">
            <OOOProfilePictures
              oooData={Object.keys(directOooData).length > 0 ? directOooData : oooData}
              oooTSEColumn={config.oooTSE as string | undefined}
              oooStatusColumn={config.oooStatus as string | undefined}
            />
            <FallbackGauge
              cities={cities}
              agentsByCity={agentsByCity}
              scheduleData={Object.keys(directScheduleData).length > 0 ? directScheduleData : scheduleData}
              scheduleTSE={config.scheduleTSE as string | undefined}
              scheduleOOO={config.scheduleOOO as string | undefined}
            />
            <OfficeHours
              officeHoursData={officeHoursData}
              tseTopicTimeColumn={config.officeHoursTseTopicTime as string | undefined}
              statusColumn={config.officeHoursStatus as string | undefined}
            />
          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  )
}

function extractEmojiAndText(reason: string): { emoji: string; text: string } {
  const defaultEmoji = '🟡'
  if (!reason) return { emoji: defaultEmoji, text: 'Away' }
  
  // Simple check for common emojis used in Intercom statuses
  const emojiRegex = /^([\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}])/u;
  const match = reason.match(emojiRegex);
  
  if (match) {
    return { emoji: match[1], text: reason.substring(match[0].length).trim() || 'Away' }
  }
  
  // Infer based on text if no emoji found
  const lower = reason.toLowerCase();
  if (lower.includes('zoom')) return { emoji: '🖥', text: reason }
  if (lower.includes('meeting')) return { emoji: '🗓️', text: reason }
  if (lower.includes('lunch') || lower.includes('break')) return { emoji: '☕', text: reason }
  if (lower.includes('sick') || lower.includes('ooo') || lower.includes('done')) return { emoji: '🏡', text: reason }
  
  return { emoji: defaultEmoji, text: reason }
}

function AvailableTSEsTable({ onCountsUpdate }: { onCountsUpdate?: (active: number, away: number) => void }) {
  const [admins, setAdmins] = useState<any[]>([])
  const [awayReasons, setAwayReasons] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  
  // Bring in the realtime webhook hook
  const { data: webhookData } = useWebhookAwayStatus(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/intercom/available-tses')
        if (!response.ok) {
          throw new Error('Failed to fetch available TSEs')
        }
        
        const data = await response.json()
        
        const reasonsMap = new Map<string, string>()
        if (data.awayReasons) {
          data.awayReasons.forEach((r: any) => {
            reasonsMap.set(String(r.id), `${r.emoji || ''} ${r.label || ''}`.trim())
          })
        }
        
        if (data.admins) {
          const teamAdmins = [...data.admins]
          teamAdmins.sort((a: any, b: any) => a.name.localeCompare(b.name))
          setAdmins(teamAdmins)
        }
        
        setAwayReasons(reasonsMap)
      } catch (err) {
        console.warn('Failed to fetch TSEs', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!loading && onCountsUpdate) {
      // Re-calculate the visible away count to pass up to parent
      // since we must call this hook before any early returns.
      const isExcluded = (name: string) => {
        if (!name) return false
        if (EXCLUDED_TSE_NAMES.includes(name)) return true
        const firstName = name.split(' ')[0]
        return EXCLUDED_TSE_NAMES.includes(firstName)
      }

      let activeCount = 0
      let awayCount = 0
      
      admins.forEach(admin => {
        if (isExcluded(admin.name)) return
        
        const hookStatus = webhookData?.byId?.[admin.id]
        let isAvailable = !admin.away_mode_enabled
        let reasonText = admin.away_status_reason_id ? awayReasons.get(String(admin.away_status_reason_id)) : ''

        if (hookStatus) {
          const hookIsAvailable = hookStatus.status === 'Available'
          if (hookIsAvailable) {
            isAvailable = true
            reasonText = ''
          } else {
            isAvailable = false
            if (hookStatus.status === 'Away' && admin.away_status_reason_id && reasonText) {
              // Keep reasonText from API
            } else {
              reasonText = hookStatus.status
            }
          }
        }

        if (isAvailable) {
          activeCount++
        } else {
          const { text } = extractEmojiAndText(reasonText || 'Away')
          if (text !== 'Off Chat Hour' && text !== 'Done for the day' && text !== 'Out sick' && text !== 'Out of office') {
            awayCount++
          }
        }
      })
      
      onCountsUpdate(activeCount, awayCount)
    }
  }, [admins, webhookData, awayReasons, loading, onCountsUpdate])

  if (loading) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading available TSEs...</div>

  // Process data
  const processedAdmins = admins.map(admin => {
    const hookStatus = webhookData?.byId?.[admin.id]
    let isAvailable = !admin.away_mode_enabled
    let reasonText = admin.away_status_reason_id ? awayReasons.get(String(admin.away_status_reason_id)) : ''
    let minsAway = admin.minutes_away

    if (hookStatus) {
      const hookIsAvailable = hookStatus.status === 'Available'
      if (hookIsAvailable) {
        isAvailable = true
        reasonText = ''
        minsAway = null
      } else {
        isAvailable = false
        // If webhook says generic "Away" but the API has a specific reason, prefer the API's specific reason.
        if (hookStatus.status === 'Away' && admin.away_status_reason_id && reasonText) {
          // Keep reasonText from API
        } else {
          reasonText = hookStatus.status
        }
        
        const nowSeconds = Math.floor(Date.now() / 1000)
        const hookSeconds = Math.floor(hookStatus.updatedAt / 1000)
        minsAway = Math.max(0, Math.floor((nowSeconds - hookSeconds) / 60))
      }
    }

    return { ...admin, calculatedAvailable: isAvailable, calculatedReason: reasonText, calculatedMinsAway: minsAway }
  })

  const availableAdmins = processedAdmins.filter(a => a.calculatedAvailable)
  const awayAdmins = processedAdmins.filter(a => !a.calculatedAvailable)

  // Filter out excluded TSEs
  const EXCLUDED_TSE_NAMES = [
    'Holly',
    'Holly Coxon',
    'Grace',
    'Grace Liu',
    'Grace Sanford',
    'Zen',
    'Zen Lee',
    'Chetana',
    'Chetana Shinde',
    'svc-prd-tse-intercom SVC',
    'TSE 6519361',
    'Zen Junior',
    'Prerit',
    'Prerit Sachdeva',
    'Sanyam',
    'Sanyam Khurana',
  ]

  const isExcluded = (name: string) => {
    if (!name) return false
    if (EXCLUDED_TSE_NAMES.includes(name)) return true
    const firstName = name.split(' ')[0]
    return EXCLUDED_TSE_NAMES.includes(firstName)
  }

  const finalAvailableAdmins = availableAdmins.filter(a => !isExcluded(a.name))
  const finalAwayAdmins = awayAdmins.filter(a => !isExcluded(a.name))

  // Group away admins by reason
  const awayGroups: Record<string, typeof processedAdmins> = {}
  finalAwayAdmins.forEach(admin => {
    const { emoji, text } = extractEmojiAndText(admin.calculatedReason || 'Away')
    const key = `${emoji}|${text}`
    if (!awayGroups[key]) awayGroups[key] = []
    awayGroups[key].push(admin)
  })

  // Format time
  const formatTime = (mins: number | null | undefined) => {
    if (mins == null) return ''
    if (mins >= 60) {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      return m > 0 ? `${h}h${m}m` : `${h}h`
    }
    return `${mins}m`
  }

  // Component for rendering a cluster of avatars
  const AvatarCluster = ({ 
    groupAdmins, 
    borderColor, 
    emojiBadge 
  }: { 
    groupAdmins: typeof processedAdmins, 
    borderColor: string, 
    emojiBadge?: string 
  }) => {
    // Chunk avatars into rows to create a "bunched" honeycomb look
    const MAX_PER_ROW = 4
    const rows = []
    for (let i = 0; i < groupAdmins.length; i += MAX_PER_ROW) {
      rows.push(groupAdmins.slice(i, i + MAX_PER_ROW))
    }

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 8px 24px 8px' 
      }}>
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} style={{ 
            display: 'flex', 
            justifyContent: 'center',
            marginTop: rowIdx > 0 ? '-24px' : '0px',
            zIndex: 10 - rowIdx // ensure top rows are behind bottom rows (or vice versa depending on preference, here top is behind)
          }}>
            {row.map((admin, adminIdx) => (
              <div key={admin.id} 
                style={{ 
                  position: 'relative', 
                  display: 'inline-block',
                  margin: '0 -10px',
                  zIndex: 50 - adminIdx,
                }} 
                title={`${admin.name}${admin.calculatedReason ? ` - ${admin.calculatedReason}` : ''}`}
                className="avatar-cluster-item"
              >
                <div style={{
                  width: '76px', 
                  height: '76px', 
                  borderRadius: '50%',
                  border: `3px solid ${borderColor}`,
                  padding: '2px',
                  background: 'var(--bg-card)',
                  boxShadow: '0 0 0 3px var(--bg-card), 0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  {admin.avatar?.image_url ? (
                    <img src={admin.avatar.image_url} alt={admin.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(148,163,184,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {admin.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                
                {emojiBadge && (
                  <div style={{
                    position: 'absolute', 
                    top: '0px', 
                    right: '-4px',
                    background: '#fff', 
                    borderRadius: '50%', 
                    width: '30px', 
                    height: '30px',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '16px',
                    boxShadow: '0 0 0 2px var(--bg-card), 0 2px 4px rgba(0,0,0,0.1)',
                    zIndex: 2
                  }}>
                    {emojiBadge}
                  </div>
                )}

                {admin.calculatedMinsAway != null ? (
                  <div style={{
                    position: 'absolute', 
                    bottom: '-6px', 
                    left: '50%', 
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.75)', 
                    color: 'white', 
                    fontSize: '11px', 
                    fontWeight: 700,
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    whiteSpace: 'nowrap',
                    border: '2px solid var(--bg-card)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    zIndex: 3
                  }}>
                    {formatTime(admin.calculatedMinsAway)}
                  </div>
                ) : !admin.calculatedAvailable ? (
                  <div style={{
                    position: 'absolute', 
                    bottom: '-12px', 
                    left: '50%', 
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3
                  }}>
                    <img 
                      src="https://res.cloudinary.com/doznvxtja/image/upload/v1771579123/It_s_been_84_years..._1_qgpvqv.svg" 
                      alt="84 years" 
                      style={{ height: '32px', marginBottom: '-6px', zIndex: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} 
                    />
                    <div style={{
                      background: 'rgba(0,0,0,0.85)', 
                      color: 'white', 
                      fontSize: '10px', 
                      fontWeight: 700,
                      padding: '1px 6px', 
                      borderRadius: '12px', 
                      whiteSpace: 'nowrap',
                      border: '2px solid var(--bg-card)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      zIndex: 2
                    }}>
                      It's Been 84 Years...
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  // Calculate the visible away count
  let visibleAwayCount = 0
  Object.entries(awayGroups).forEach(([key, groupAdmins]) => {
    const [_, text] = key.split('|')
    if (text === 'Off Chat Hour' || text === 'Done for the day' || text === 'Out sick' || text === 'Out of office') {
      return
    }
    visibleAwayCount += groupAdmins.length
  })

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(560px, 1.5fr)', gap: '32px' }}>
        
        {/* Available Section */}
        <div>
          <h3 style={{ textAlign: 'center', color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Available ({finalAvailableAdmins.length})
          </h3>
          <div style={{ background: 'rgba(16, 185, 129, 0.05)', borderRadius: '16px', padding: '16px' }}>
            <AvatarCluster 
              groupAdmins={finalAvailableAdmins} 
              borderColor="#22c55e" 
              emojiBadge="🟢" 
            />
          </div>
        </div>

        {/* Away Section */}
        <div>
          <h3 style={{ textAlign: 'center', color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Away
          </h3>
          <div style={{ display: 'flex', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'stretch', gap: '16px' }}>
            {Object.entries(awayGroups).sort((a, b) => b[1].length - a[1].length).map(([key, groupAdmins]) => {
              const [emoji, text] = key.split('|')
              const displayText = text === 'On a Zoom call w/ client' ? 'Zoom' : text
              
              // Hide specific away reasons
              if (text === 'Off Chat Hour' || text === 'Done for the day' || text === 'Out sick' || text === 'Out of office') {
                return null
              }

              // Determine border color based on text
              let borderColor = '#facc15' // yellow default
              const lowerText = text.toLowerCase()
              if (lowerText.includes('zoom') || lowerText.includes('call')) borderColor = '#3b82f6' // blue
              else if (lowerText.includes('meeting')) borderColor = '#64748b' // gray
              else if (lowerText.includes('lunch') || lowerText.includes('break')) borderColor = '#f97316' // orange
              else if (lowerText.includes('sick') || lowerText.includes('ooo') || lowerText.includes('done')) borderColor = '#ef4444' // red
              
              return (
                <div key={key} style={{ background: 'rgba(148, 163, 184, 0.05)', borderRadius: '16px', padding: '16px', flex: '1 1 0', minWidth: '0' }}>
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>
                    {displayText} ({groupAdmins.length})
                  </div>
                  <AvatarCluster 
                    groupAdmins={groupAdmins} 
                    borderColor={borderColor} 
                    emojiBadge={emoji} 
                  />
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

// Generate agents from real team member data with random statuses for demo mode
function generateDemoAgents(_cities: City[]): AgentData[] {
  // Define status configurations with associated emoji, label, and ring colors
  const statusConfigs: Array<{
    status: AgentStatus
    emoji: string
    label: string
    ringColor: 'red' | 'yellow' | 'green' | 'blue' | 'zoom' | 'meeting' | 'purple' | 'orange'
  }> = [
    { status: 'chat', emoji: '🟢', label: 'Available', ringColor: 'green' },
    { status: 'chat', emoji: '🟢', label: 'Available', ringColor: 'green' },
    { status: 'chat', emoji: '🟢', label: 'Available', ringColor: 'green' },
    { status: 'closing', emoji: '🚫', label: 'Off Chat Hour', ringColor: 'red' },
    { status: 'closing', emoji: '🚫', label: 'Off Chat Hour', ringColor: 'red' },
    { status: 'lunch', emoji: '☕', label: '☕ On a break', ringColor: 'yellow' },
    { status: 'lunch', emoji: '🍕', label: '🥪 At Lunch', ringColor: 'yellow' },
    { status: 'call', emoji: '🖥', label: '🖥 Zoom - 1:1 Meeting', ringColor: 'zoom' },
    { status: 'call', emoji: '🗓️', label: '🗓️ In a meeting', ringColor: 'meeting' },
    { status: 'away', emoji: '🏡', label: 'Away', ringColor: 'blue' },
    { status: 'call', emoji: '🐛', label: '🐛 Doing Bug Triage/Escalation', ringColor: 'purple' },
    { status: 'call', emoji: '👨‍🏫', label: '👨‍🏫 Coaching / Shadowing', ringColor: 'purple' },
  ]
  
  return TEAM_MEMBERS.map(member => {
    // Pick a random status configuration
    const config = statusConfigs[Math.floor(Math.random() * statusConfigs.length)]
    // Generate random minutes in status (1-120 minutes)
    const minutesInStatus = Math.floor(Math.random() * 120) + 1
    
    return {
      id: member.id,
      name: member.name,
      avatar: member.avatar,
      status: member.defaultStatus || config.status,
      timezone: member.timezone,
      statusEmoji: config.emoji,
      statusLabel: config.label,
      ringColor: config.ringColor,
      minutesInStatus,
    }
  })
}

