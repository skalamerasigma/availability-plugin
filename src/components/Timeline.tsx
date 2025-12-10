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
      // Normalize endHours for comparison (handle > 24 case)
      const currentEnd = current.endHour > 24 ? current.endHour - 24 : current.endHour
      const nextEnd = next.endHour > 24 ? next.endHour - 24 : next.endHour
      const overlapStart = Math.max(current.startHour, next.startHour)
      const overlapEnd = Math.min(currentEnd, nextEnd)
      if (overlapStart < overlapEnd) {
        result.push({ start: overlapStart, end: overlapEnd })
      }
    }
    return result
  }, [cities])

  // Determine active cities
  const activeCities = useMemo(() => {
    const active = cities.filter(c => {
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
    return active
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
          // A city is "highlighted" only if it's actually active
          const isActive = activeCities.includes(city)
          const isHighlighted = isActive
          // Apply night mode class to inactive city bars, except for SF which should always be colored
          // For display, cap endHour at 24 (visual representation)
          const displayEndHour = city.endHour > 24 ? 24 : city.endHour
          const isSF = city.name === 'San Francisco' || city.code === 'SFO' || city.code === 'SF'
          const className = `progress ${isHighlighted ? 'magnified' : 'dim'} ${!isActive && !isSF ? 'night-mode-bar' : ''} ${isSF ? 'sf-bar' : ''}`
          
          const style: { left: string; width: string } = {
            left: `${hourToPercent(city.startHour)}%`,
            width: `${hourToPercent(displayEndHour) - hourToPercent(city.startHour)}%`,
          }
          
          return (
            <div
              key={`progress-${idx}`}
              className={className}
              style={style}
              title={city.name}
            />
          )
        })}

        {/* End-of-shift markers */}
        {cities.map((city, idx) => {
          // For markers, show the actual end hour (capped at 24 for display)
          const displayEndHour = city.endHour > 24 ? 24 : city.endHour
          const localEndHour = city.endHour > 24 ? city.endHour - 24 : city.endHour
          return (
            <div
              key={`marker-${idx}`}
              className="marker"
              style={{ left: `${hourToPercent(displayEndHour)}%` }}
              title={`${city.name} ${localEndHour}:00`}
            />
          )
        })}
      </div>
    </div>
  )
}
