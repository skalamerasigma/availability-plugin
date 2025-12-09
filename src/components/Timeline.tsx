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
    return cities.filter(c => nowUTC >= c.startHour && nowUTC < c.endHour)
  }, [cities, nowUTC])

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
    <div className="timeline">
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
        const isActive = activeCities.includes(city)
        return (
          <div
            key={`progress-${idx}`}
            className={`progress ${isActive ? 'magnified' : 'dim'}`}
            style={{
              left: `${hourToPercent(city.startHour)}%`,
              width: `${hourToPercent(city.endHour) - hourToPercent(city.startHour)}%`,
            }}
            title={city.name}
          />
        )
      })}

      {/* End-of-shift markers (17:00 / 5 PM) */}
      {cities.map((city, idx) => (
        <div
          key={`marker-${idx}`}
          className="marker"
          style={{ left: `${hourToPercent(city.endHour)}%` }}
          title={`${city.name} ${city.endHour}:00`}
        />
      ))}

      {/* Current time cursor */}
      <div className="cursor" style={{ left: `${hourToPercent(nowUTC)}%` }}>
        <div className="cursor-time top">
          {incomingCity?.code} {formatTime(currentTime, incomingCity?.timezone || 'UTC')}
        </div>
        <div className="cursor-line" />
        <div className="cursor-time bottom">
          {currentCity?.code} {formatTime(currentTime, currentCity?.timezone || 'UTC')}
        </div>
      </div>
    </div>
  )
}

