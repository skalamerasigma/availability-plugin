import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  client,
  useConfig,
  useElementColumns,
  useElementData,
} from '@sigmacomputing/plugin'

import { Timeline } from './components/Timeline'
import { AgentZones } from './components/AgentZones'
import { Legend } from './components/Legend'
import { IntensitySlider } from './components/IntensitySlider'
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
  return parseInt(pacificTime, 10)
}

// Extract emoji from status string (first character if it's an emoji)
function extractEmoji(statusStr: string): string | undefined {
  if (!statusStr) return undefined
  // Common Intercom emojis
  const emojiMap: Record<string, string> = {
    '🟢': '🟢',
    '☕': '☕',
    '🚫': '🚫',
    '🏡': '🏡',
    '🤒': '🤒',
    '🌴': '🌴',
    '🎯': '🎯',
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
    lunch: '☕',
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
    case 'L': return '☕'  // Lunch/Break
    case 'X': return '🏡'  // Not working
    default: return '🏡'   // Unknown defaults to away, not hourglass
  }
}

export function AvailabilityPlugin() {
  // VERSION CHECK - if you don't see this, you're running cached code!
  console.log('🚀 PLUGIN VERSION: 7.8 - City titles moved down!')
  
  // Debug: Check if client is available
  console.log('[Client Check] client object:', typeof client)
  console.log('[Client Check] client.elements:', typeof client?.elements)
  console.log('[Client Check] client.elements.subscribeToElementData:', typeof client?.elements?.subscribeToElementData)
  
  // Get configuration from Sigma editor panel
  const config = useConfig()
  
  // Get the element IDs from config
  const sourceElementId = config.source as string
  const scheduleElementId = config.scheduleSource as string
  
  // Get column mappings from Sigma using actual element IDs
  const columns = useElementColumns(sourceElementId)
  const scheduleColumns = useElementColumns(scheduleElementId)
  
  // Get actual data from the connected Sigma worksheets using element IDs
  const sigmaData = useElementData(sourceElementId)
  const scheduleData = useElementData(scheduleElementId)
  
  // State to hold data from direct subscriptions
  const [directScheduleData, setDirectScheduleData] = useState<Record<string, any[]>>({})
  const [directSourceData, setDirectSourceData] = useState<Record<string, any[]>>({})
  
  // Flag to track if effect ran
  const [effectRan, setEffectRan] = useState(false)
  
  // Subscribe directly to element data using client API
  useEffect(() => {
    console.log('⚡ useEffect FIRED!')
    console.log('  scheduleElementId:', scheduleElementId)
    console.log('  sourceElementId:', sourceElementId)
    setEffectRan(true)
    
    if (!client?.elements?.subscribeToElementData) {
      console.error('❌ client.elements.subscribeToElementData is not available!')
      return
    }
    
    if (!scheduleElementId && !sourceElementId) {
      console.log('[Sigma Client] No element IDs yet, skipping subscriptions')
      return
    }
    
    console.log('[Sigma Client] Setting up subscriptions with actual element IDs...')
    
    let unsubSchedule: (() => void) | undefined
    let unsubSource: (() => void) | undefined
    
    if (scheduleElementId) {
      try {
        console.log('[Sigma Client] Subscribing to schedule element:', scheduleElementId)
        unsubSchedule = client.elements.subscribeToElementData(scheduleElementId, (data) => {
          console.log('[Sigma Client] ✓ Received schedule data:', Object.keys(data))
          setDirectScheduleData(data)
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
          console.log('[Sigma Client] ✓ Received source data:', Object.keys(data))
          setDirectSourceData(data)
        })
        console.log('[Sigma Client] ✓ Source subscription created')
      } catch (e) {
        console.error('[Sigma Client] ❌ Error subscribing to source:', e)
      }
    }
    
    return () => {
      unsubSchedule?.()
      unsubSource?.()
    }
  }, [scheduleElementId, sourceElementId])
  
  // Log effect status
  console.log('[Effect Status] effectRan:', effectRan)
  
  // Debug: Log ALL available information from Sigma
  console.log('=== SIGMA PLUGIN DEBUG ===')
  console.log('[Config] Full config object:', JSON.stringify(config, null, 2))
  console.log('[Config] scheduleSource value:', config.scheduleSource)
  console.log('[Config] source value:', config.source)
  console.log('[Columns] source columns:', columns)
  console.log('[Columns] scheduleSource columns:', scheduleColumns)
  console.log('[Data] sigmaData:', sigmaData, 'keys:', Object.keys(sigmaData || {}))
  console.log('[Data] scheduleData:', scheduleData, 'keys:', Object.keys(scheduleData || {}))
  
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
    
    console.log('[Availability Plugin] Schedule column mappings:')
    console.log('  scheduleTSE:', scheduleTSECol)
    console.log('  scheduleOOO:', scheduleOOOCol)
    console.log('  scheduleHours:', scheduleHoursCols)
    
    // Use direct subscription data if available, fall back to hook data
    const effectiveScheduleData = Object.keys(directScheduleData).length > 0 ? directScheduleData : scheduleData
    const effectiveSourceData = Object.keys(directSourceData).length > 0 ? directSourceData : sigmaData
    
    console.log('[Availability Plugin] Using effectiveScheduleData with', Object.keys(effectiveScheduleData || {}).length, 'columns')
    console.log('[Availability Plugin] Using effectiveSourceData with', Object.keys(effectiveSourceData || {}).length, 'columns')
    
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
      console.log('[Availability Plugin] Checking Intercom status data...')
      console.log('[Availability Plugin] effectiveSourceData keys:', Object.keys(effectiveSourceData || {}))
      
      // Use config column IDs directly (from the Sigma column configuration)
      const agentNameCol = config.agentName as string
      const agentStatusCol = config.agentStatus as string
      
      console.log('[Availability Plugin] Config columns - agentName:', agentNameCol, 'agentStatus:', agentStatusCol)
      
      if (effectiveSourceData && agentNameCol && agentStatusCol) {
        const names = effectiveSourceData[agentNameCol] as string[] | undefined
        const statuses = effectiveSourceData[agentStatusCol] as string[] | undefined
        
        console.log('[Availability Plugin] ✓ Status source connected!')
        console.log('[Availability Plugin] Name data sample:', names?.slice(0, 3))
        console.log('[Availability Plugin] Status data sample:', statuses?.slice(0, 3))
        
        if (names && statuses) {
          names.forEach((name, idx) => {
            if (name && statuses[idx]) {
              const cleanName = name.trim().toLowerCase()
              intercomStatusMap.set(cleanName, statuses[idx])
              // Also try first name only for matching
              const firstName = cleanName.split(' ')[0]
              if (firstName !== cleanName) {
                intercomStatusMap.set(firstName, statuses[idx])
              }
            }
          })
          console.log('[Availability Plugin] Built intercomStatusMap with', intercomStatusMap.size, 'entries')
          // Log a few entries for debugging
          const entries = Array.from(intercomStatusMap.entries()).slice(0, 5)
          console.log('[Availability Plugin] Sample intercom statuses:', entries)
        }
      } else {
        console.log('[Availability Plugin] ⚠️ Missing agentName or agentStatus column config')
      }
      
      if (tseCol && effectiveScheduleData[tseCol]) {
        const tseData = effectiveScheduleData[tseCol] as string[] | undefined
        const oooData = oooCol && effectiveScheduleData[oooCol] ? effectiveScheduleData[oooCol] as string[] | undefined : undefined
        const hourData = hourCol && effectiveScheduleData[hourCol] ? effectiveScheduleData[hourCol] as string[] | undefined : undefined
        
        if (tseData) {
          return tseData
            .map((name, idx) => {
              if (!name) return null // Skip empty rows
              
              const cleanName = name?.trim()
              const isOOO = oooData?.[idx]?.toLowerCase() === 'yes'
              const hourBlock = hourData?.[idx] || '' // Default to empty if no hour data
              
              // Only show TSEs who have "Y" in their hourly chat block
              if (hourBlock?.toUpperCase() !== 'Y') return null
              
              // Look up team member by name to get avatar and timezone
              const teamMember = TEAM_MEMBERS.find(
                m => m.name.toLowerCase() === cleanName?.toLowerCase()
              )
              
              if (!teamMember) return null // Skip if not in our team list
              
              // Determine status: Intercom status takes priority (real-time), then OOO, then schedule
              let status: AgentStatus
              let statusEmoji: string
              let statusLabel: string
              let ringColor: 'red' | 'yellow' | 'green' | 'blue' = 'blue' // Default to blue
              
              // Try multiple ways to match the name in intercom data
              const nameLower = cleanName.toLowerCase()
              const firstName = nameLower.split(' ')[0]
              const intercomStatus = intercomStatusMap.get(nameLower) || 
                                    intercomStatusMap.get(firstName) ||
                                    // Also try without middle names
                                    intercomStatusMap.get(nameLower.replace(/\s+\w+$/, ''))
              
              // Determine ring color based on schedule + Intercom status
              const scheduledForChat = hourBlock?.toUpperCase() === 'Y'
              if (scheduledForChat && intercomStatus) {
                const intercomLower = intercomStatus.toLowerCase()
                if (intercomLower.includes('off chat')) {
                  ringColor = 'red' // Should be chatting but is off chat
                } else if (intercomLower.includes('break')) {
                  ringColor = 'yellow' // Should be chatting but is on break
                } else if (intercomLower.includes('available')) {
                  ringColor = 'green' // Scheduled and available - good!
                }
                // Otherwise stays blue (default)
              } else if (scheduledForChat && !intercomStatus) {
                // Scheduled for chat but no Intercom status - assume available based on schedule
                ringColor = 'green'
              }
              // All other cases stay blue (default)
              
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
              if (!statusEmoji) {
                statusEmoji = getStatusEmoji(status)
              }
              
              // Debug: log status assignment for first few agents
              if (idx < 5) {
                console.log(`[Availability Plugin] Agent ${cleanName}:`)
                console.log(`  - hourBlock from schedule: "${hourBlock}"`)
                console.log(`  - isOOO: ${isOOO}`)
                console.log(`  - tried lookup keys: "${nameLower}", "${firstName}"`)
                console.log(`  - intercomStatus found: "${intercomStatus || 'none'}"`)
                console.log(`  - finalStatus: ${status}, emoji: ${statusEmoji}`)
              }
              
              return {
                id: `agent-${idx}`,
                name: cleanName,
                avatar: teamMember?.avatar || `https://i.pravatar.cc/40?u=${cleanName}`,
                status,
                timezone: teamMember?.timezone || 'America/New_York',
                statusEmoji,
                statusLabel,
                ringColor,
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
          return nameData.map((name, idx) => {
            // Clean up name (remove trailing spaces)
            const cleanName = name?.trim()
            
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
        }
      }
    }

    // Fallback: Demo data with dynamic status updates
    return generateDemoAgents(cities).map(agent => ({
      ...agent,
      status: statusUpdates[agent.id] || agent.status,
    }))
  }, [sigmaData, columns, scheduleData, config, cities, apiUrl, apiAgents, statusUpdates, currentPacificHour, directScheduleData, directSourceData])

  // OOO agents state - will be populated from schedule data
  const [oooAgents, setOooAgents] = useState<{ name: string; avatar: string }[]>([])

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

  // Initialize intensity from config
  useEffect(() => {
    setIntensity(defaultIntensity)
  }, [defaultIntensity])

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

  // Handle intensity change and optionally trigger Sigma action
  const handleIntensityChange = useCallback((value: number) => {
    setIntensity(value)
    
    // You can trigger Sigma actions when values change
    // This allows other Sigma elements to react to this plugin
    // client.triggerAction('intensityChanged', { value })
  }, [])

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

          {showLegend && <Legend />}
        </div>
        
        <div className="sidebar-controls">
          <aside className="intensity-control">
            <IntensitySlider
              value={intensity}
              onChange={handleIntensityChange}
            />
          </aside>
          
          {/* OOO Box */}
          {oooAgents.length > 0 && (
            <aside className="ooo-box">
              <h4>🌴 OOO</h4>
              <div className="ooo-agents">
                {oooAgents.map((agent, idx) => (
                  <div
                    key={`ooo-${idx}`}
                    className="ooo-agent"
                    style={{ backgroundImage: `url("${agent.avatar}")` }}
                    title={`${agent.name} - Out of Office`}
                  />
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}

// Generate agents from real team member data
function generateDemoAgents(cities: City[]): AgentData[] {
  const statuses: AgentStatus[] = ['away', 'call', 'lunch', 'chat', 'closing']
  
  return TEAM_MEMBERS.map(member => ({
    id: member.id,
    name: member.name,
    avatar: member.avatar,
    status: member.defaultStatus || statuses[Math.floor(Math.random() * statuses.length)],
    timezone: member.timezone,
  }))
}

