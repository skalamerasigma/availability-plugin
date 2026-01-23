import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  client,
  useConfig,
  useElementColumns,
  useElementData,
} from '@sigmacomputing/plugin'

import { Timeline } from './components/Timeline'
import { AgentZones } from './components/AgentZones'
import { Legend } from './components/Legend'
import { FallbackGauge } from './components/FallbackGauge'
import { useAgentDataFromApi } from './hooks/useAgentData'
import { TEAM_MEMBERS } from './data/teamMembers'
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
    name: 'source',
    type: 'element',
  },
  {
    name: 'agentName',
    type: 'column',
    source: 'source',
    allowMultiple: false,
  },
  {
    name: 'agentAvatar',
    type: 'column',
    source: 'source',
    allowMultiple: false,
  },
  {
    name: 'agentStatus',
    type: 'column',
    source: 'source',
    allowMultiple: false,
  },
  {
    name: 'agentMinutesInStatus',
    type: 'column',
    source: 'source',
    allowMultiple: false,
  },
  {
    name: 'agentTimezone',
    type: 'column',
    source: 'source',
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
    name: 'chatsSource',
    type: 'element',
  },
  {
    name: 'chatsTriggerColumn',
    type: 'column',
    source: 'chatsSource',
    allowMultiple: false,
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

function getMockUnassignedConversations(nowSeconds: number): any[] {
  return [
    { id: 'mock-1001', created_at: nowSeconds - 90, admin_assignee_id: null, admin_assignee: null },
    { id: 'mock-1002', created_at: nowSeconds - 240, admin_assignee_id: null, admin_assignee: null },
    { id: 'mock-1003', created_at: nowSeconds - 420, admin_assignee_id: null, admin_assignee: null },
    { id: 'mock-1004', created_at: nowSeconds - 610, admin_assignee_id: null, admin_assignee: null },
    { id: 'mock-1005', created_at: nowSeconds - 700, admin_assignee_id: null, admin_assignee: null },
    { id: 'mock-1006', created_at: nowSeconds - 980, admin_assignee_id: null, admin_assignee: null },
  ]
}

interface ResoQueueBeltProps {
  unassignedConvs: any[]
}

function isConversationUnassigned(conversation: any): boolean {
  const adminAssigneeId = conversation?.admin_assignee_id
  const adminAssignee = conversation?.admin_assignee
  const hasAssigneeId = adminAssigneeId !== null && adminAssigneeId !== undefined && adminAssigneeId !== ''
  const hasAssigneeObject = adminAssignee && (typeof adminAssignee === 'object' ? (adminAssignee.id || adminAssignee.name) : true)
  return !hasAssigneeId && !hasAssigneeObject
}

function ResoQueueBelt({ unassignedConvs }: ResoQueueBeltProps) {
  const [conveyorBeltCurrentTime, setConveyorBeltCurrentTime] = useState(() => Date.now() / 1000)
  const [showBreachedModal, setShowBreachedModal] = useState(false)
  const confirmedBreachedIdsRef = useRef<Set<string>>(new Set())
  const removedIdsRef = useRef<Set<string>>(new Set())
  const checkedIdsRef = useRef<Set<string>>(new Set())
  const checkingIdsRef = useRef<Set<string>>(new Set())
  const lastResetRef = useRef<number | null>(null)
  const assignmentStatusEndpoint = 'https://queue-health-monitor.vercel.app/api/intercom/conversations/assignment-status'

  // Update current time every second for conveyor belt animation
  useEffect(() => {
    const timer = setInterval(() => {
      setConveyorBeltCurrentTime(Date.now() / 1000)
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])

  // Calculate last breach reset timestamp (2:00 AM UTC)
  const lastBreachResetTimestamp = useMemo(() => {
    const now = new Date(conveyorBeltCurrentTime * 1000)
    const resetTime = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      2,
      0,
      0,
      0
    ))
    if (now < resetTime) resetTime.setUTCDate(resetTime.getUTCDate() - 1)
    return resetTime.getTime() / 1000
  }, [conveyorBeltCurrentTime])

  useEffect(() => {
    if (lastResetRef.current === lastBreachResetTimestamp) return
    confirmedBreachedIdsRef.current.clear()
    removedIdsRef.current.clear()
    checkedIdsRef.current.clear()
    checkingIdsRef.current.clear()
    lastResetRef.current = lastBreachResetTimestamp
  }, [lastBreachResetTimestamp])

  const checkConversationAssignments = useCallback(async (conversationIds: string[]) => {
    if (conversationIds.length === 0) return

    const uniqueIds = Array.from(new Set(conversationIds)).filter(Boolean)
    if (uniqueIds.length === 0) return

    uniqueIds.forEach((conversationId) => {
      checkingIdsRef.current.add(conversationId)
    })

    try {
      const response = await fetch(assignmentStatusEndpoint, {
        method: 'POST',
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
          confirmedBreachedIdsRef.current.add(conversationId)
          removedIdsRef.current.delete(conversationId)
        } else {
          removedIdsRef.current.add(conversationId)
          confirmedBreachedIdsRef.current.delete(conversationId)
        }
      })
    } catch (error) {
      console.error('[Reso Queue] Error fetching assignment status:', error)
    } finally {
      uniqueIds.forEach((conversationId) => {
        checkingIdsRef.current.delete(conversationId)
      })
    }
  }, [])

  useEffect(() => {
    const now = conveyorBeltCurrentTime
    const eligibleIds: string[] = []

    unassignedConvs.forEach((conv) => {
      const convId = conv.id || conv.conversation_id
      if (!convId || String(convId).startsWith('mock-')) return
      if (checkedIdsRef.current.has(convId)) return
      if (checkingIdsRef.current.has(convId)) return
      if (removedIdsRef.current.has(convId)) return
      if (confirmedBreachedIdsRef.current.has(convId)) return
      if (!conv.createdTimestamp) return

      const elapsedSeconds = now - conv.createdTimestamp
      if (elapsedSeconds < 600) return

      eligibleIds.push(String(convId))
    })

    if (eligibleIds.length === 0) return

    const batchSize = 20
    checkConversationAssignments(eligibleIds.slice(0, batchSize))
  }, [unassignedConvs, conveyorBeltCurrentTime, checkConversationAssignments])

  return (
    <>
      {/* Reso Queue - Waiting Conveyor Belt */}
      <div style={{
        marginBottom: '24px',
        overflow: 'visible'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: '#333',
            display: 'flex',
            alignItems: 'center'
          }}>
            Reso Queue - Waiting
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '10px',
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: unassignedConvs.length > 10 
                ? 'rgba(253, 135, 137, 0.15)'
                : unassignedConvs.length > 5
                ? 'rgba(255, 193, 7, 0.2)'
                : 'rgba(76, 236, 140, 0.2)',
              color: unassignedConvs.length > 10 
                ? '#fd8789'
                : unassignedConvs.length > 5
                ? '#ffc107'
                : '#4cec8c',
              fontSize: '13px',
              fontWeight: 700,
              lineHeight: 1
            }}>
              {unassignedConvs.length}
            </span>
          </h3>
        </div>
        
        {/* Conveyor Belt Visualization */}
        <div style={{
          width: '100%',
          maxWidth: '1350px',
          height: '120px',
          position: 'relative',
          backgroundColor: 'transparent',
          overflow: 'visible',
          marginBottom: '12px',
          marginLeft: 'auto',
          marginRight: 'auto',
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
          
          {/* 10-minute threshold line */}
          <div style={{
            position: 'absolute',
            right: '110px',
            top: '20px',
            bottom: '20px',
            width: '4px',
            backgroundColor: '#fd8789',
            zIndex: 10,
            boxShadow: '0 0 8px rgba(253, 135, 137, 0.3)'
          }} />
          
          {/* Threshold label */}
          <div style={{
            position: 'absolute',
            right: '118px',
            top: '8px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#fd8789',
            backgroundColor: 'rgba(253, 135, 137, 0.1)',
            padding: '2px 6px',
            borderRadius: '4px',
            zIndex: 11,
            whiteSpace: 'nowrap'
          }}>
            10 min
          </div>
          
          {/* Conveyor belt items */}
          {unassignedConvs.filter((conv) => {
            const createdTimestamp = conv.createdTimestamp
            if (!createdTimestamp) return false
            const convId = conv.id || conv.conversation_id
            if (convId && removedIdsRef.current.has(convId)) return false
            if (convId && confirmedBreachedIdsRef.current.has(convId)) return false
            return true
          }).map((conv) => {
            const convId = conv.id || conv.conversation_id
            const createdTimestamp = conv.createdTimestamp
            
            const elapsedSeconds = conveyorBeltCurrentTime - createdTimestamp
            const progressPercent = Math.min((elapsedSeconds / 600) * 100, 100)
            const adjustedProgressPercent = Math.min(progressPercent * 0.90, 90)
            
            const isPendingBreachCheck = elapsedSeconds >= 600 && elapsedSeconds < 660
            const isConfirmedBreached = !!(convId && confirmedBreachedIdsRef.current.has(convId))
            const isBreached = elapsedSeconds >= 600
            
            // Calculate color based on progress
            const getColor = (percent: number) => {
              if (percent >= 100) {
                return { bg: '#fd8789', border: '#d84c4c', text: '#ffffff' }
              } else if (percent >= 80) {
                const factor = (percent - 80) / 20
                return {
                  bg: `rgb(${255 - Math.floor(57 * factor)}, ${193 - Math.floor(105 * factor)}, ${7 - Math.floor(7 * factor)})`,
                  border: `rgb(${245 - Math.floor(161 * factor)}, ${124 - Math.floor(76 * factor)}, ${0})`,
                  text: '#ffffff'
                }
              } else if (percent >= 50) {
                const factor = (percent - 50) / 30
                return {
                  bg: `rgb(${255 - Math.floor(0 * factor)}, ${193 - Math.floor(41 * factor)}, ${7 + Math.floor(113 * factor)})`,
                  border: `rgb(${245 - Math.floor(0 * factor)}, ${124 + Math.floor(31 * factor)}, ${0})`,
                  text: '#292929'
                }
              } else {
                const factor = percent / 50
                return {
                  bg: `rgb(${76 + Math.floor(179 * factor)}, ${236 + Math.floor(-43 * factor)}, ${140 - Math.floor(133 * factor)})`,
                  border: `rgb(${51 + Math.floor(194 * factor)}, ${153 + Math.floor(-29 * factor)}, ${51 - Math.floor(51 * factor)})`,
                  text: '#292929'
                }
              }
            }
            
            const colors = getColor(progressPercent)
            const secondsRemaining = Math.max(0, Math.floor(600 - elapsedSeconds))
            const minutesRemaining = Math.floor(secondsRemaining / 60)
            const secsRemaining = secondsRemaining % 60
            
            return (
              <a
                key={convId}
                href={`https://app.intercom.com/a/inbox/${convId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  position: 'absolute',
                  left: isBreached 
                    ? `${Math.min(95 + (elapsedSeconds - 600) / 60 * 2, 98)}%`
                    : `${Math.min(adjustedProgressPercent, 90)}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  transition: 'left 1s linear, z-index 0s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  color: 'inherit',
                  zIndex: isBreached ? 5 : 1,
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.1)'
                  e.currentTarget.style.zIndex = '100'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'
                  e.currentTarget.style.zIndex = isBreached ? '5' : '1'
                }}
                title={`Conversation ${convId} - ${isBreached ? 'BREACHED' : (isPendingBreachCheck ? 'Pending breach check' : `${minutesRemaining}m ${secsRemaining}s until breach`)}`}
              >
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '12px',
                  backgroundColor: colors.bg,
                  border: `3px solid ${colors.border}`,
                  color: colors.text,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: `0 2px 8px rgba(0,0,0,0.2)`,
                  transition: 'all 0.3s ease',
                  padding: '6px'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: colors.text,
                    lineHeight: '1.2',
                    textAlign: 'center'
                  }}>
                    {convId.toString().slice(-4)}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: isConfirmedBreached ? '#fd8789' : colors.text,
                    textAlign: 'center',
                    lineHeight: '1.2',
                    whiteSpace: 'nowrap'
                  }}>
                    {isConfirmedBreached ? (
                      <span style={{ color: '#fd8789', fontWeight: 700 }}>BREACHED</span>
                    ) : (
                      <>
                        {minutesRemaining > 0 ? `${minutesRemaining}m ` : ''}{secsRemaining}s
                      </>
                    )}
                  </div>
                </div>
              </a>
            )
          })}
          
          {/* Breached Section */}
          {(() => {
            const confirmedBreachedConvs = unassignedConvs.filter((conv) => {
              const convId = conv.id || conv.conversation_id
              if (!convId) return false
              if (removedIdsRef.current.has(convId)) return false
              if (!confirmedBreachedIdsRef.current.has(convId)) return false
              const createdTimestamp = conv.createdTimestamp
              if (!createdTimestamp) return false
              if (createdTimestamp < lastBreachResetTimestamp) return false
              return true
            })

            if (confirmedBreachedConvs.length === 0) return null

            return (
              <div
                onClick={() => setShowBreachedModal(true)}
                style={{
                  position: 'absolute',
                  right: '0px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  zIndex: 15
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
                }}
                title={`${confirmedBreachedConvs.length} breached conversation${confirmedBreachedConvs.length !== 1 ? 's' : ''} - Click to view`}
              >
                <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                  {confirmedBreachedConvs.slice(0, 3).map((conv, idx) => (
                    <div
                      key={conv.id || conv.conversation_id}
                      style={{
                        position: 'absolute',
                        width: '80px',
                        height: '80px',
                        borderRadius: '12px',
                        backgroundColor: '#fd8789',
                        border: '3px solid #d84c4c',
                        color: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: `0 2px 8px rgba(0,0,0,0.2)`,
                        transform: `translate(${idx * 4}px, ${idx * 4}px)`,
                        transition: 'all 0.3s ease',
                        zIndex: 15 - idx,
                        padding: '6px'
                      }}
                    >
                      {idx === 0 && (
                        <>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: 700,
                            color: '#ffffff',
                            textAlign: 'center',
                            lineHeight: '1.2'
                          }}>
                          {confirmedBreachedConvs.length}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#ffffff',
                            textAlign: 'center',
                            lineHeight: '1.2',
                            marginTop: '0px'
                          }}>
                            BREACHED
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
      
      {/* Breached Conversations Modal */}
      {showBreachedModal && (() => {
        const breachedConvs = unassignedConvs.filter((conv) => {
          const convId = conv.id || conv.conversation_id
          if (!convId) return false
          if (removedIdsRef.current.has(convId)) return false
          if (!confirmedBreachedIdsRef.current.has(convId)) return false
          const createdTimestamp = conv.createdTimestamp
          if (!createdTimestamp) return false
          if (createdTimestamp < lastBreachResetTimestamp) return false
          return true
        }).map((conv) => {
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
    </>
  )
}

export function AvailabilityPlugin() {
  // VERSION CHECK - if you don't see this, you're running cached code!
  console.log('🚀 PLUGIN VERSION: 8.11 - Added dedicated OOO view support for filtering TSEs who are OOO')
  
  // Debug: Check if client is available
  console.log('[Client Check] client object:', typeof client)
  console.log('[Client Check] client.elements:', typeof client?.elements)
  console.log('[Client Check] client.elements.subscribeToElementData:', typeof client?.elements?.subscribeToElementData)
  
  // Get configuration from Sigma editor panel
  const config = useConfig()
  
  // Get the element IDs from config
  const sourceElementId = config.source as string
  const scheduleElementId = config.scheduleSource as string
  const chatsElementId = config.chatsSource as string
  const oooElementId = config.oooSource as string
  
  // Get column mappings from Sigma using actual element IDs
  const columns = useElementColumns(sourceElementId)
  const scheduleColumns = useElementColumns(scheduleElementId)
  const chatsColumns = useElementColumns(chatsElementId)
  const oooColumns = useElementColumns(oooElementId)
  
  // Get actual data from the connected Sigma worksheets using element IDs
  const sigmaData = useElementData(sourceElementId)
  const scheduleData = useElementData(scheduleElementId)
  const chatsData = useElementData(chatsElementId)
  const oooData = useElementData(oooElementId)
  
  // State to hold data from direct subscriptions
  const [directScheduleData, setDirectScheduleData] = useState<Record<string, any[]>>({})
  const [directSourceData, setDirectSourceData] = useState<Record<string, any[]>>({})
  const [directChatsData, setDirectChatsData] = useState<Record<string, any[]>>({})
  const [directOooData, setDirectOooData] = useState<Record<string, any[]>>({})
  
  // Flag to track if effect ran
  const [effectRan, setEffectRan] = useState(false)
  
  // Track last refresh time
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  
  // Unassigned conversations state for conveyor belt
  const [unassignedConversationsData, setUnassignedConversationsData] = useState<any[]>([])
  
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

  
  // Fetch unassigned conversations
  const fetchUnassignedConversations = useCallback(async () => {
    try {
      const apiBaseUrl = 'https://queue-health-monitor.vercel.app/api/intercom/conversations/unassigned-only'
      const res = await fetch(apiBaseUrl)
      if (!res.ok) {
        console.warn('Timeline Belt Plugin: Failed to fetch unassigned conversations:', res.status)
        return
      }
      
      const response = await res.json()
      const fetchedConversations = Array.isArray(response) ? response : (response.conversations || [])
      
      setUnassignedConversationsData(fetchedConversations)
    } catch (error) {
      console.error('Timeline Belt Plugin: Error fetching unassigned conversations:', error)
    }
  }, [])
  
  // Fetch unassigned conversations every 1 minute
  useEffect(() => {
    let isMounted = true
    
    // Initial fetch
    fetchUnassignedConversations()
    
    // Set up refresh every 1 minute (60000 ms)
    const interval = setInterval(() => {
      if (isMounted) {
        fetchUnassignedConversations()
      }
    }, 60000)
    
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
    const rawUnassignedConversations = unassignedConversationsData?.length
      ? unassignedConversationsData
      : (isLocalhost ? getMockUnassignedConversations(Date.now() / 1000) : [])

    if (rawUnassignedConversations.length === 0) return []

    return rawUnassignedConversations.map(conv => {
      const createdAt = conv.created_at || conv.createdAt || conv.first_opened_at
      const createdTimestamp = createdAt 
        ? (typeof createdAt === "number" ? (createdAt > 1e12 ? createdAt / 1000 : createdAt) : new Date(createdAt).getTime() / 1000)
        : null
      
      return {
        ...conv,
        createdTimestamp
      }
    })
  }, [unassignedConversationsData])
  
  // Subscribe directly to element data using client API
  useEffect(() => {
    console.log('⚡ useEffect FIRED!')
    console.log('  scheduleElementId:', scheduleElementId)
    console.log('  sourceElementId:', sourceElementId)
    console.log('  chatsElementId:', chatsElementId)
    console.log('  oooElementId:', oooElementId)
    setEffectRan(true)
    
    if (!client?.elements?.subscribeToElementData) {
      console.error('❌ client.elements.subscribeToElementData is not available!')
      return
    }
    
    if (!scheduleElementId && !sourceElementId && !chatsElementId && !oooElementId) {
      console.log('[Sigma Client] No element IDs yet, skipping subscriptions')
      return
    }
    
    console.log('[Sigma Client] Setting up subscriptions with actual element IDs...')
    
    let unsubSchedule: (() => void) | undefined
    let unsubSource: (() => void) | undefined
    let unsubChats: (() => void) | undefined
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
    
    if (chatsElementId) {
      try {
        console.log('[Sigma Client] Subscribing to chats element:', chatsElementId)
        unsubChats = client.elements.subscribeToElementData(chatsElementId, (data) => {
          console.log('[Sigma Client] ✓ Received chats data update:', Object.keys(data))
          setDirectChatsData(data)
          // Update timestamp when upstream data changes
          setLastUpdated(new Date())
          console.log('[Upstream Refresh] Chats data updated, refreshing timestamp')
        })
        console.log('[Sigma Client] ✓ Chats subscription created')
      } catch (e) {
        console.error('[Sigma Client] ❌ Error subscribing to chats:', e)
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
      unsubChats?.()
      unsubOoo?.()
    }
  }, [scheduleElementId, sourceElementId, chatsElementId, oooElementId, client])
  
  // Log effect status
  console.log('[Effect Status] effectRan:', effectRan)
  
  // Debug: Log ALL available information from Sigma
  console.log('=== SIGMA PLUGIN DEBUG ===')
  console.log('[Config] Full config object:', JSON.stringify(config, null, 2))
  console.log('[Config] scheduleSource value:', config.scheduleSource)
  console.log('[Config] source value:', config.source)
  console.log('[Columns] source columns:', columns)
  console.log('[Columns] scheduleSource columns:', scheduleColumns)
  console.log('[Columns] chatsSource columns:', chatsColumns)
  console.log('[Columns] oooSource columns:', oooColumns)
  console.log('[Data] sigmaData:', sigmaData, 'keys:', Object.keys(sigmaData || {}))
  console.log('[Data] scheduleData:', scheduleData, 'keys:', Object.keys(scheduleData || {}))
  console.log('[Data] chatsData:', chatsData, 'keys:', Object.keys(chatsData || {}))
  console.log('[Data] directChatsData:', directChatsData, 'keys:', Object.keys(directChatsData || {}))
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
    chatsElementId,
    defaultIntensity,
  })
  
  // Debug: Log chats data (moved after effectiveChatsData calculation)
  
  // Use direct subscription data if available, fall back to hook data
  const effectiveChatsData = Object.keys(directChatsData).length > 0 ? directChatsData : chatsData
  
  // Calculate row count from chats data
  const chatsRowCount = useMemo(() => {
    console.log('[Chats Row Count] Calculating...')
    console.log('[Chats Row Count] effectiveChatsData present:', !!effectiveChatsData)
    
    if (!effectiveChatsData) {
      console.log('[Chats Row Count] No data, returning 0')
      return 0
    }
    
    const keys = Object.keys(effectiveChatsData)
    console.log('[Chats Row Count] Keys found:', keys)
    
    // Priority: Use the explicitly configured trigger column
    const triggerCol = config.chatsTriggerColumn as string
    if (triggerCol && effectiveChatsData[triggerCol]) {
       const count = effectiveChatsData[triggerCol].length
       console.log('[Chats Row Count] Using trigger column:', triggerCol, 'Count:', count)
       return count
    }
    
    if (keys.length === 0) {
      console.log('[Chats Row Count] No keys, returning 0')
      return 0
    }
    
    const firstColumnKey = keys[0]
    const count = effectiveChatsData[firstColumnKey]?.length || 0
    console.log('[Chats Row Count] First column:', firstColumnKey, 'Length:', count)
    return count
  }, [effectiveChatsData])
  
  // Debug: Log column names for verification
  useEffect(() => {
    if (chatsColumns) {
      const mapping = Object.entries(chatsColumns).reduce((acc, [id, col]) => {
        acc[id] = col.name
        return acc
      }, {} as Record<string, string>)
      console.log('[Columns] Chats Column Mapping:', mapping)
    }
  }, [chatsColumns])

  // Debug: Log calculated row count
  console.log('[Render] Current chatsRowCount:', chatsRowCount)
  
  // Calculate intensity from chats row count
  const calculatedIntensity = useMemo(() => {
    console.log('[Auto Intensity] Calculating intensity...')
    console.log('[Auto Intensity] autoIntensityEnabled:', autoIntensityEnabled)
    console.log('[Auto Intensity] effectiveChatsData exists:', !!effectiveChatsData)
    console.log('[Auto Intensity] effectiveChatsData keys length:', effectiveChatsData ? Object.keys(effectiveChatsData).length : 0)
    console.log('[Auto Intensity] directChatsData keys:', Object.keys(directChatsData))
    console.log('[Auto Intensity] chatsData keys:', chatsData ? Object.keys(chatsData) : [])
    
    if (!autoIntensityEnabled) {
      console.log('[Auto Intensity] Auto-intensity is disabled, using defaultIntensity:', defaultIntensity)
      return defaultIntensity
    }
    
    // If chatsData exists but has no keys, treat it as 0 rows (empty table)
    // If chatsData doesn't exist at all, use defaultIntensity
    if (!effectiveChatsData) {
      console.log('[Auto Intensity] No chats data object available, using defaultIntensity:', defaultIntensity)
      return defaultIntensity
    }
    
    const keys = Object.keys(effectiveChatsData)
    console.log('[Auto Intensity] Available column keys:', keys)
    
    // If there are no columns, treat as 0 rows
    if (keys.length === 0) {
      console.log('[Auto Intensity] No columns found (empty table), setting intensity to 0%')
      return 0
    }
    
    // Use the pre-calculated row count
    const rowCount = chatsRowCount
    
    console.log('[Auto Intensity] Row count:', rowCount)
    
    // Calculate intensity based on thresholds:
    // 0 rows = 0%
    // 1 row = 5%
    // 6 rows = 90%
    // 7+ rows = 100%
    let calculatedValue: number
    if (rowCount === 0) {
      calculatedValue = 0
      console.log('[Auto Intensity] Row count is 0, setting intensity to 0%')
    } else if (rowCount >= 7) {
      calculatedValue = 100
      console.log('[Auto Intensity] Row count >= 7, setting intensity to 100%')
    } else if (rowCount >= 1 && rowCount <= 6) {
      // Linear interpolation: 5% at 1 row, 90% at 6 rows
      const intensity = 5 + (rowCount - 1) * ((90 - 5) / (6 - 1))
      calculatedValue = Math.round(intensity)
      console.log('[Auto Intensity] Row count is', rowCount, ', calculated intensity:', calculatedValue, '%')
    } else {
      calculatedValue = defaultIntensity
      console.log('[Auto Intensity] Unexpected row count, using defaultIntensity:', defaultIntensity)
    }
    
    console.log('[Auto Intensity] Final calculated intensity:', calculatedValue)
    return calculatedValue
  }, [chatsRowCount, autoIntensityEnabled, defaultIntensity])
  const showLegend = config.showLegend === 'true'
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
    
    return result
  }, [config])

  // Transform Sigma data into agent data structure
  const agents: AgentData[] = useMemo(() => {
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
      
      // Get TSE and OOO data directly from mapped columns
      const tseCol = scheduleTSECol
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
              let ringColor: 'red' | 'yellow' | 'green' | 'blue' | 'zoom' | 'purple' | 'orange' = 'purple' // Default to purple
              
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
              } else if (scheduledForChat) {
                // Agent is scheduled for chat this hour
                if (intercomStatus) {
                  const intercomLower = intercomStatus.toLowerCase()
                  if (intercomLower.includes('available')) {
                    ringColor = 'green' // Scheduled and available - good!
                  } else if (intercomLower.includes('break') || intercomLower.includes('lunch')) {
                    ringColor = 'yellow' // Should be chatting but is on break
                  } else if (intercomLower.includes('off chat') || intercomLower.includes('closing')) {
                    ringColor = 'red' // Should be chatting but is off chat
                  } else {
                    // Scheduled but unknown status - orange warning
                    ringColor = 'orange'
                  }
                } else {
                  // Scheduled for chat but no Intercom status
                  ringColor = 'orange' // Warning - can't confirm they're available
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
              // We only want to show "Off Chat Hour" agents if they SHOULD be on chat (to highlight the issue)
              if (intercomStatus && intercomStatus.includes('Off Chat Hour') && !scheduledForChat) {
                console.log(`[Availability Plugin] Agent "${cleanName}" has "Off Chat Hour" status but not scheduled for chat - skipping`)
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
                avatar: teamMember?.avatar || `https://i.pravatar.cc/40?u=${cleanName}`,
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
  }, [sigmaData, columns, scheduleData, config, cities, apiUrl, apiAgents, statusUpdates, currentPacificHour, directScheduleData, directSourceData, directOooData, oooData])

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
    console.log('[Auto Intensity Effect] Running effect')
    console.log('[Auto Intensity Effect] autoIntensityEnabled:', autoIntensityEnabled)
    console.log('[Auto Intensity Effect] calculatedIntensity:', calculatedIntensity)
    console.log('[Auto Intensity Effect] defaultIntensity:', defaultIntensity)
    console.log('[Auto Intensity Effect] Current intensity state:', intensity)
    console.log('[Auto Intensity Effect] Has effectiveChatsData:', !!effectiveChatsData)
    console.log('[Auto Intensity Effect] effectiveChatsData keys:', effectiveChatsData ? Object.keys(effectiveChatsData) : [])
    console.log('[Auto Intensity Effect] directChatsData keys:', Object.keys(directChatsData))
    
    if (autoIntensityEnabled) {
      // Always use calculated intensity when auto-intensity is enabled
      console.log('[Auto Intensity Effect] Auto-intensity enabled, setting intensity to:', calculatedIntensity)
      setIntensity(calculatedIntensity)
    } else {
      // Only use default intensity if auto-intensity is disabled
      console.log('[Auto Intensity Effect] Auto-intensity disabled, setting intensity to default:', defaultIntensity)
      setIntensity(defaultIntensity)
    }
  }, [calculatedIntensity, autoIntensityEnabled, defaultIntensity, effectiveChatsData, directChatsData])

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

  // Show setup instructions if no data is connected and we're in Sigma
  if (!hasAnyData && agents.length === 0) {
    return (
      <div className="app" style={{ padding: '20px' }}>
        <div style={{ 
          background: '#fff', 
          padding: '24px', 
          borderRadius: '8px', 
          maxWidth: '500px',
          margin: '0 auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#333' }}>📊 Connect Data Sources</h3>
          <p style={{ color: '#666', marginBottom: '16px' }}>
            To display agent availability, connect your Sigma worksheets in the plugin configuration panel:
          </p>
          <ol style={{ color: '#666', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li><strong>scheduleSource</strong>: Connect to <code>TSE_SCHEDULE_CURRENT</code> worksheet</li>
            <li><strong>source</strong>: Connect to <code>DASHBOARD_OF_TSES_AND_THEIR_STATUS</code> worksheet</li>
            <li><strong>oooSource</strong>: Connect to <code>SIGMA_ON_SIGMA.SIGMA_WRITABLE.OOO</code> view (for OOO filtering)</li>
          </ol>
          <p style={{ color: '#888', fontSize: '12px', marginTop: '16px' }}>
            Debug: scheduleData keys: {Object.keys(scheduleData || {}).length}, 
            sigmaData keys: {Object.keys(sigmaData || {}).length}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app" style={{ '--active-color': activeColor } as React.CSSProperties}>
      <div className="main-content">
        <div className="timeline-section">
          <div style={{ marginBottom: '8px', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              fontSize: '11px',
              color: '#6b7280',
              fontWeight: 400
            }}>
              Last updated: {formatLastUpdated(lastUpdated)}
            </div>
          </div>
          <ResoQueueBelt unassignedConvs={unassignedConvs} />

          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Timeline
                cities={cities}
                currentTime={currentTime}
                simulateTime={simulateTime}
              />

              <AgentZones
                cities={cities}
                agentsByCity={agentsByCity}
                currentTime={currentTime}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <FallbackGauge
                cities={cities}
                agentsByCity={agentsByCity}
                scheduleData={Object.keys(directScheduleData).length > 0 ? directScheduleData : scheduleData}
                scheduleTSE={config.scheduleTSE as string | undefined}
                scheduleOOO={config.scheduleOOO as string | undefined}
              />
            </div>
          </div>

          {showLegend && <Legend />}
        </div>
      </div>
    </div>
  )
}

// Generate agents from real team member data
function generateDemoAgents(_cities: City[]): AgentData[] {
  const statuses: AgentStatus[] = ['away', 'call', 'lunch', 'chat', 'closing']
  
  return TEAM_MEMBERS.map(member => ({
    id: member.id,
    name: member.name,
    avatar: member.avatar,
    status: member.defaultStatus || statuses[Math.floor(Math.random() * statuses.length)],
    timezone: member.timezone,
  }))
}

