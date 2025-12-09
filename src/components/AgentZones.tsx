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

        return (
          <div
            key={city.code}
            className={`zone ${isActive ? 'current' : 'inactive'}`}
          >
            <h3>{city.name}</h3>
            <div className="agents">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

