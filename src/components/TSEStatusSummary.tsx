import { useMemo, useState, useEffect } from 'react'
import type { City, AgentData } from '../types'
import { TEAM_MEMBERS } from '../data/teamMembers'

interface TSEStatusSummaryProps {
  cities: City[]
  agentsByCity: Map<string, AgentData[]>
  currentTime: Date
  scheduleData?: Record<string, any[]> // Schedule data with scheduleTSE and scheduleOOO columns
  scheduleTSE?: string // Column ID for scheduleTSE
  scheduleOOO?: string // Column ID for scheduleOOO
}

export function TSEStatusSummary({
  cities,
  agentsByCity,
  currentTime,
  scheduleData,
  scheduleTSE,
  scheduleOOO,
}: TSEStatusSummaryProps) {
  // Update every minute to refresh counts
  const [minuteTick, setMinuteTick] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMinuteTick(prev => prev + 1)
    }, 60000) // Update every minute (60000ms)
    
    return () => clearInterval(interval)
  }, [])
  
  const counts = useMemo(() => {
    // Calculate current UTC hour (same logic as Timeline/AgentZones)
    const nowUTC = (
      currentTime.getUTCHours() +
      currentTime.getUTCMinutes() / 60 +
      currentTime.getUTCSeconds() / 3600
    )

    // Determine active cities (same logic as Timeline/AgentZones)
    const activeCities = cities.filter(c => {
      // Handle endHour > 24 (cities that span midnight)
      if (c.endHour > 24) {
        const nextDayEndHour = c.endHour - 24
        return nowUTC >= c.startHour || nowUTC < nextDayEndHour + 1
      } else {
        return nowUTC >= c.startHour && nowUTC < c.endHour + 1
      }
    })

    // Count scheduled TSEs: Active = non-away status, Away = away status
    let activeCount = 0
    let awayCount = 0
    
    // Build a map of agent names to their status from agentsByCity
    const agentStatusMap = new Map<string, 'away' | 'call' | 'lunch' | 'chat' | 'closing'>()
    agentsByCity.forEach((agents) => {
      agents.forEach(agent => {
        if (agent.name) {
          const cleanName = agent.name.trim().toLowerCase()
          agentStatusMap.set(cleanName, agent.status)
          // Also store by first name for matching
          const firstName = cleanName.split(' ')[0]
          if (firstName !== cleanName) {
            agentStatusMap.set(firstName, agent.status)
          }
        }
      })
    })
    
    if (scheduleData && scheduleTSE) {
      const tseData = scheduleData[scheduleTSE] as string[] | undefined
      const oooData = scheduleOOO && scheduleData[scheduleOOO] 
        ? scheduleData[scheduleOOO] as string[] | undefined 
        : undefined
      
      // Build set of OOO TSEs for filtering
      const oooSet = new Set<string>()
      if (oooData) {
        oooData.forEach((value, idx) => {
          if (value && String(value).toLowerCase() === 'yes') {
            const tseName = tseData?.[idx]?.trim().toLowerCase()
            if (tseName) {
              oooSet.add(tseName)
              // Also add first name for matching
              const firstName = tseName.split(' ')[0]
              if (firstName !== tseName) {
                oooSet.add(firstName)
              }
            }
          }
        })
      }
      
      // Get active city timezones
      const activeTimezones = new Set(activeCities.map(c => c.timezone))
      
      // Count scheduled TSEs in active cities
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
          
          // Only count if scheduled in an active city
          if (teamMember && activeTimezones.has(teamMember.timezone)) {
            // Get agent status
            const agentStatus = agentStatusMap.get(cleanNameLower) || 
                               agentStatusMap.get(firstName) ||
                               null
            
            // Active = scheduled TSEs who do NOT have "away" status
            // Away = scheduled TSEs who DO have "away" status
            if (agentStatus === 'away') {
              awayCount++
            } else if (agentStatus !== null) {
              // Has a status that's not "away" (chat, lunch, call, closing)
              activeCount++
            }
            // If no status found, don't count them (they might not be in agentsByCity)
          }
        })
      }
    } else {
      // Fallback: count agents in active cities from agentsByCity
      activeCities.forEach(city => {
        const agents = agentsByCity.get(city.timezone) || []
        agents.forEach(agent => {
          if (agent.status === 'away') {
            awayCount++
          } else {
            activeCount++
          }
        })
      })
    }

    return {
      active: activeCount,
      awayButShouldBeActive: awayCount,
    }
  }, [
    cities,
    agentsByCity,
    currentTime,
    scheduleData,
    scheduleTSE,
    scheduleOOO,
    minuteTick, // Include minuteTick to trigger recalculation every minute
  ])

  return (
    <div className="tse-status-summary">
      <div className="tse-status-summary-content">
        <div className="tse-status-stat">
          <div className="tse-status-stat-value tse-status-active">{counts.active}</div>
          <div className="tse-status-stat-label">TSEs Active</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {scheduleData && scheduleTSE 
              ? '(Scheduled TSEs without "away" status)' 
              : '(Counted from active cities on timeline)'}
          </div>
        </div>
        <div className="tse-status-stat">
          <div className="tse-status-stat-value tse-status-away">{counts.awayButShouldBeActive}</div>
          <div className="tse-status-stat-label">Away (Should Be Active)</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            (Scheduled TSEs with "away" status)
          </div>
        </div>
      </div>
    </div>
  )
}
