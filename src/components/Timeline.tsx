import { useMemo } from 'react'
import type { City } from '../types'

interface TimelineProps {
  cities: City[]
  currentTime: Date
  simulateTime: boolean
}

const TIMELINE_HOURS = 24

function hourToPercent(h: number): number {
  return (h / TIMELINE_HOURS) * 100
}

function formatTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).format(date)
}

export function Timeline({ cities, currentTime, simulateTime }: TimelineProps) {
  // Calculate current UTC hour
  const nowUTC = useMemo(() => {
    if (simulateTime) {
      return currentTime.getUTCHours() + currentTime.getUTCMinutes() / 60
    }
    return (
      currentTime.getUTCHours() +
      currentTime.getUTCMinutes() / 60 +
      currentTime.getUTCSeconds() / 3600
    )
  }, [currentTime, simulateTime])

  // Calculate overlaps between consecutive cities
  const overlaps = useMemo(() => {
    const result: { start: number; end: number }[] = []
    for (let i = 0; i < cities.length - 1; i++) {
      const current = cities[i]
      const next = cities[i + 1]
      const overlapStart = Math.max(current.startHour, next.startHour)
      const overlapEnd = Math.min(current.endHour, next.endHour)
      if (overlapStart < overlapEnd) {
        result.push({ start: overlapStart, end: overlapEnd })
      }
    }
    return result
  }, [cities])

  // Determine active cities
  const activeCities = useMemo(() => {
    return cities.filter(c => {
      const endHour = Math.min(c.endHour, 24) // Cap at 24
      return nowUTC >= c.startHour && nowUTC < endHour
    })
  }, [cities, nowUTC])

  // Check if we're in night mode (no active cities)
  const isNightMode = activeCities.length === 0

  // Get incoming and current city for cursor display
  const incomingCity = useMemo(() => {
    const after = cities.filter(c => nowUTC < c.startHour).sort((a, b) => a.startHour - b.startHour)
    return after.length ? after[0] : cities[0]
  }, [cities, nowUTC])

  const currentCity = useMemo(() => {
    if (activeCities.length) {
      return activeCities.slice().sort((a, b) => b.startHour - a.startHour)[0]
    }
    return cities
      .map(c => ({ c, score: c.startHour <= nowUTC ? c.startHour : c.startHour - 24 }))
      .sort((a, b) => b.score - a.score)[0]?.c || cities[0]
  }, [activeCities, cities, nowUTC])

  return (
    <div className={`timeline-wrapper ${isNightMode ? 'night-mode' : ''}`}>
      {/* Current time cursor - outside timeline for visibility */}
      <div className={`cursor ${isNightMode ? 'night' : ''}`} style={{ left: `${hourToPercent(nowUTC)}%` }}>
        <div className="cursor-time top">
          {isNightMode ? '🌙' : ''} {incomingCity?.code} {formatTime(currentTime, incomingCity?.timezone || 'UTC')}
        </div>
        <div className="cursor-line" />
        <div className="cursor-time bottom">
          {currentCity?.code} {formatTime(currentTime, currentCity?.timezone || 'UTC')} {isNightMode ? '💤' : ''}
        </div>
      </div>

      <div className="timeline">
        {/* Night mode indicator */}
        {isNightMode && (
          <div className="night-indicator">
            🌙 Off Hours
          </div>
        )}

        {/* Overlap bands */}
        {overlaps.map((overlap, idx) => (
          <div
            key={`overlap-${idx}`}
            className="overlap-band"
            style={{
              left: `${hourToPercent(overlap.start)}%`,
              width: `${hourToPercent(overlap.end) - hourToPercent(overlap.start)}%`,
            }}
          />
        ))}

        {/* Shift progress bars */}
        {cities.map((city, idx) => {
          // A city is "highlighted" only if it's actually active (not in night mode)
          const isActive = activeCities.includes(city)
          // In night mode (no active cities), don't highlight any bar
          const isHighlighted = isActive
          const className = `progress ${isHighlighted ? 'magnified' : 'dim'}`
          const endHour = Math.min(city.endHour, 24) // Cap at 24
          
          return (
            <div
              key={`progress-${idx}`}
              className={className}
              style={{
                left: `${hourToPercent(city.startHour)}%`,
                width: `${hourToPercent(endHour) - hourToPercent(city.startHour)}%`,
              }}
              title={city.name}
            />
          )
        })}

        {/* End-of-shift markers */}
        {cities.map((city, idx) => {
          const endHour = Math.min(city.endHour, 24) // Cap at 24
          return (
            <div
              key={`marker-${idx}`}
              className="marker"
              style={{ left: `${hourToPercent(endHour)}%` }}
              title={`${city.name} ${endHour}:00`}
            />
          )
        })}
      </div>
    </div>
  )
}
