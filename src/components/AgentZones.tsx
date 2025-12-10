import { useMemo } from 'react'
import type { City, AgentData } from '../types'
import { AgentCard } from './AgentCard'

interface AgentZonesProps {
  cities: City[]
  agentsByCity: Map<string, AgentData[]>
  currentTime: Date
}

export function AgentZones({ cities, agentsByCity, currentTime }: AgentZonesProps) {
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

        // Sort agents to group all green-ring agents together
        const sortedAgents = [...agents].sort((a, b) => {
          const aIsGreen = a.ringColor === 'green'
          const bIsGreen = b.ringColor === 'green'
          
          // Green agents come first
          if (aIsGreen && !bIsGreen) return -1
          if (!aIsGreen && bIsGreen) return 1
          
          // Within same group, maintain original order
          return 0
        })

        return (
          <div
            key={city.code}
            className={`zone ${isActive ? 'current' : 'inactive'}`}
          >
            <h3>{city.name}</h3>
            <div className="agents">
              {sortedAgents.map((agent, index) => {
                const prevAgent = index > 0 ? sortedAgents[index - 1] : null
                const isGreen = agent.ringColor === 'green'
                const prevIsGreen = prevAgent?.ringColor === 'green'
                
                // Add spacing when transitioning from green to non-green or vice versa
                const needsSpacing = prevAgent ? (isGreen !== prevIsGreen) : undefined
                const isFirstGreen = isGreen && index === 0
                const isFirstGreenAfterNonGreen = isGreen && prevAgent ? !prevIsGreen : false
                
                return (
                  <AgentCard 
                    key={agent.id} 
                    agent={agent}
                    needsSpacing={needsSpacing}
                    isFirstInGroup={isFirstGreen || isFirstGreenAfterNonGreen}
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

