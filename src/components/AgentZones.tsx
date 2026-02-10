import { useMemo } from 'react'
import type { City, AgentData } from '../types'
import { AgentCard } from './AgentCard'

interface AgentZonesProps {
  cities: City[]
  agentsByCity: Map<string, AgentData[]>
  currentTime: Date
  tseOpenChatCounts?: Map<string, number> // Map of TSE name (lowercase) to open chat count
}

export function AgentZones({ cities, agentsByCity, currentTime, tseOpenChatCounts }: AgentZonesProps) {
  // Calculate which cities are currently active
  const nowUTC = useMemo(() => {
    return (
      currentTime.getUTCHours() +
      currentTime.getUTCMinutes() / 60 +
      currentTime.getUTCSeconds() / 3600
    )
  }, [currentTime])

  const activeCities = useMemo(() => {
    return cities.filter(c => {
      // Handle endHour > 24 (cities that span midnight)
      if (c.endHour > 24) {
        // City spans midnight: active if nowUTC >= startHour OR nowUTC < (endHour - 24)
        const nextDayEndHour = c.endHour - 24
        return nowUTC >= c.startHour || nowUTC < nextDayEndHour + 1
      } else {
        // Normal case: active if nowUTC is between startHour and endHour
        // endHour represents the closing hour (e.g., 22 = 6pm EDT = 22:00 UTC)
        // City is active until the end of that hour (22:59 UTC), so check < endHour + 1
        return nowUTC >= c.startHour && nowUTC < c.endHour + 1
      }
    })
  }, [cities, nowUTC])

  return (
    <div className="zones">
      {cities.map((city) => {
        const agents = agentsByCity.get(city.timezone) || []
        const isActive = activeCities.includes(city)

        // Sort agents to group by ring color: green → yellow → orange → red → zoom → purple → blue (other)
        const colorPriority: Record<string, number> = {
          green: 0,
          yellow: 1,
          orange: 2,
          red: 3,
          zoom: 4,
          purple: 5,
          blue: 6,
        }
        
        const sortedAgents = [...agents].sort((a, b) => {
          const aPriority = colorPriority[a.ringColor || 'purple'] ?? 5
          const bPriority = colorPriority[b.ringColor || 'purple'] ?? 5
          return aPriority - bPriority
        })

        // Colors that should overlap within their group
        const overlappingColors = ['green', 'yellow', 'orange', 'red', 'blue', 'zoom', 'purple']

        return (
          <div
            key={city.code}
            className={`zone ${isActive ? 'current' : 'inactive'}`}
          >
            <h3>{city.name}</h3>
            <div className="agents">
              {sortedAgents.map((agent, index) => {
                const prevAgent = index > 0 ? sortedAgents[index - 1] : null
                const currentColor = agent.ringColor || 'purple'
                const prevColor = prevAgent?.ringColor || 'purple'
                const isOverlappingColor = overlappingColors.includes(currentColor)
                
                // Check if this is transitioning to a new color group
                const isColorTransition = prevAgent && currentColor !== prevColor
                
                // First in an overlapping color group (needs margin reset)
                const isFirstInGroup = isOverlappingColor && (index === 0 || isColorTransition)
                
                // Need spacing when transitioning between color groups (except for the very first agent)
                const needsSpacing = isColorTransition
                
                // Get open chat count for this agent
                const agentNameLower = agent.name.trim().toLowerCase()
                const firstName = agentNameLower.split(' ')[0]
                const openChatCount = tseOpenChatCounts?.get(agentNameLower) || 
                                     tseOpenChatCounts?.get(firstName) || 
                                     undefined
                
                return (
                  <AgentCard 
                    key={agent.id} 
                    agent={agent}
                    needsSpacing={needsSpacing || undefined}
                    isFirstInGroup={isFirstInGroup || undefined}
                    openChatCount={openChatCount}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

