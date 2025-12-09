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
    return cities.filter(c => nowUTC >= c.startHour && nowUTC < c.endHour)
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

