import { useMemo } from 'react'
import type { City } from '../types'

interface TimelineProps {
  cities: City[]
  currentTime: Date
  simulateTime: boolean
  /** Today's chats per hour — ET hours from Intercom API */
  chatsPerHour: Array<{ hour: number; count: number }>
  /** Previous day's chats per hour — ET hours from Sigma/Snowflake */
  previousDayChatsPerHour?: Array<{ hour: number; count: number }>
}

// Coverage window in ET: 5 AM ET to 9 PM ET (16 hours)
const WINDOW_START_ET = 5
const WINDOW_HOURS = 16
const CHART_HEIGHT = 80
const CHART_PADDING_TOP = 8
const X_AXIS_LABEL_HEIGHT = 22
const Y_AXIS_WIDTH = 30

function formatTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).format(date)
}

/** Convert an ET hour (0-23) into a 0-1 fraction within the coverage window. */
function etHourToFraction(etHour: number): number {
  let adjusted = etHour
  if (adjusted < WINDOW_START_ET) adjusted += 24 // wrap past midnight
  return (adjusted - WINDOW_START_ET) / WINDOW_HOURS
}

/** Build a smooth SVG path using monotone cubic Hermite interpolation (Fritsch-Carlson).
 *  Guarantees the curve never overshoots or loops backwards in x. */
function buildSmoothPath(
  points: Array<{ x: number; y: number }>,
): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M${points[0].x},${points[0].y}`
  if (n === 2) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`

  // 1. Compute slopes (deltas) and secants between consecutive points
  const dx: number[] = []
  const dy: number[] = []
  const m: number[] = []  // tangent slopes at each point

  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x)
    dy.push(points[i + 1].y - points[i].y)
  }

  const slopes: number[] = dx.map((dxi, i) => dxi === 0 ? 0 : dy[i] / dxi)

  // 2. Compute initial tangents as average of adjacent secants
  m.push(slopes[0])
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      m.push(0)
    } else {
      m.push((slopes[i - 1] + slopes[i]) / 2)
    }
  }
  m.push(slopes[n - 2])

  // 3. Fritsch-Carlson monotonicity correction
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
    } else {
      const alpha = m[i] / slopes[i]
      const beta = m[i + 1] / slopes[i]
      const s = alpha * alpha + beta * beta
      if (s > 9) {
        const t = 3 / Math.sqrt(s)
        m[i] = t * alpha * slopes[i]
        m[i + 1] = t * beta * slopes[i]
      }
    }
  }

  // 4. Build cubic Bezier segments from Hermite tangents
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const seg = dx[i] / 3
    const cp1x = points[i].x + seg
    const cp1y = points[i].y + m[i] * seg
    const cp2x = points[i + 1].x - seg
    const cp2y = points[i + 1].y - m[i + 1] * seg
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i + 1].x},${points[i + 1].y}`
  }

  return d
}

/** Get the current ET fractional hour (e.g. 14.5 = 2:30 PM ET) */
function getCurrentETFractionalHour(date: Date): number {
  const etStr = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  // Format: "HH:MM:SS"
  const parts = etStr.split(':')
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const s = parseInt(parts[2], 10)
  return h + m / 60 + s / 3600
}

export function Timeline({ cities: _cities, currentTime, simulateTime: _simulateTime, chatsPerHour, previousDayChatsPerHour = [] }: TimelineProps) {
  // Current ET fractional hour
  const nowET = useMemo(() => {
    return getCurrentETFractionalHour(currentTime)
  }, [currentTime])

  const nowFraction = etHourToFraction(nowET)
  const nowPercent = Math.max(0, Math.min(1, nowFraction)) * 100

  // Max count across both today and previous day for consistent Y scale
  const maxCount = useMemo(() => {
    const todayMax = chatsPerHour.length > 0 ? Math.max(...chatsPerHour.map(d => d.count)) : 0
    const prevMax = previousDayChatsPerHour.length > 0 ? Math.max(...previousDayChatsPerHour.map(d => d.count)) : 0
    return Math.max(todayMax, prevMax, 1)
  }, [chatsPerHour, previousDayChatsPerHour])

  // Filter to only data points up to the current hour (don't plot future)
  const visibleData = useMemo(() => {
    return chatsPerHour.filter(d => {
      const frac = etHourToFraction(d.hour)
      return frac <= nowFraction + 0.02 // tiny buffer so current hour shows
    })
  }, [chatsPerHour, nowFraction])

  // Y-axis ticks: pick 3 nice values (0, mid, max)
  const yTicks = useMemo(() => {
    if (maxCount <= 1) return [0]
    const mid = Math.round(maxCount / 2)
    return [0, mid, maxCount]
  }, [maxCount])

  // Chart area dimensions (shifted right by Y_AXIS_WIDTH)
  const chartLeft = Y_AXIS_WIDTH
  const chartWidth = 1000 - Y_AXIS_WIDTH
  const svgTotalWidth = 1000
  const svgTotalHeight = CHART_HEIGHT + CHART_PADDING_TOP + 20 + X_AXIS_LABEL_HEIGHT

  /** Map a data point (ET hour) to SVG coordinates within the chart area */
  const toPoint = (d: { hour: number; count: number }) => ({
    x: chartLeft + etHourToFraction(d.hour) * chartWidth,
    y: CHART_PADDING_TOP + CHART_HEIGHT - (d.count / maxCount) * (CHART_HEIGHT - 4),
  })

  const baselineY = CHART_HEIGHT + CHART_PADDING_TOP

  // Sort previous day data by adjusted ET hour so the line doesn't zigzag
  const sortedPrevDay = useMemo(() => {
    return [...previousDayChatsPerHour].sort((a, b) => {
      const aAdj = a.hour < WINDOW_START_ET ? a.hour + 24 : a.hour
      const bAdj = b.hour < WINDOW_START_ET ? b.hour + 24 : b.hour
      return aAdj - bAdj
    })
  }, [previousDayChatsPerHour])

  // Build per-segment fill polygons between today and previous day lines.
  // Each pair of consecutive common hours gets its own quad colored by which line is higher.
  const fillSegments = useMemo(() => {
    if (visibleData.length < 2 || sortedPrevDay.length < 2) return null

    const todayHours = new Set(visibleData.map(d => d.hour))
    const prevHours = new Set(sortedPrevDay.map(d => d.hour))
    const commonHours = [...todayHours].filter(h => prevHours.has(h)).sort((a, b) => {
      const aAdj = a < WINDOW_START_ET ? a + 24 : a
      const bAdj = b < WINDOW_START_ET ? b + 24 : b
      return aAdj - bAdj
    })

    if (commonHours.length < 2) return null

    const todayMap = new Map(visibleData.map(d => [d.hour, d.count]))
    const prevMap = new Map(sortedPrevDay.map(d => [d.hour, d.count]))

    const segments: Array<{ d: string; fill: string }> = []

    for (let i = 0; i < commonHours.length - 1; i++) {
      const h1 = commonHours[i]
      const h2 = commonHours[i + 1]
      const t1 = toPoint({ hour: h1, count: todayMap.get(h1) ?? 0 })
      const t2 = toPoint({ hour: h2, count: todayMap.get(h2) ?? 0 })
      const p1 = toPoint({ hour: h1, count: prevMap.get(h1) ?? 0 })
      const p2 = toPoint({ hour: h2, count: prevMap.get(h2) ?? 0 })

      // Average of today vs prev across this segment to pick color
      const todayAvg = ((todayMap.get(h1) ?? 0) + (todayMap.get(h2) ?? 0)) / 2
      const prevAvg = ((prevMap.get(h1) ?? 0) + (prevMap.get(h2) ?? 0)) / 2

      const fill = todayAvg >= prevAvg
        ? 'rgba(56, 189, 248, 0.18)'   // blue tint — today is higher (matches today line)
        : 'rgba(148, 163, 184, 0.15)'  // gray tint — yesterday was higher (matches prev day line)

      // Quad: today-left → today-right → prev-right → prev-left
      const d = `M${t1.x},${t1.y} L${t2.x},${t2.y} L${p2.x},${p2.y} L${p1.x},${p1.y} Z`
      segments.push({ d, fill })
    }

    return segments
  }, [visibleData, sortedPrevDay, toPoint])

  return (
    <div style={{ position: 'relative', width: '100%', padding: '0 0 52px 0', marginTop: '20px' }}>
      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${svgTotalWidth} ${svgTotalHeight}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: `${svgTotalHeight}px`, display: 'block' }}
      >
        {/* Y-axis ticks and labels */}
        {yTicks.map((val) => {
          const y = CHART_PADDING_TOP + CHART_HEIGHT - (val / maxCount) * (CHART_HEIGHT - 4)
          return (
            <g key={`y-${val}`}>
              {val > 0 && (
                <line
                  x1={chartLeft}
                  y1={y}
                  x2={svgTotalWidth}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="0.5"
                  strokeDasharray="4,4"
                />
              )}
              <text
                x={chartLeft - 6}
                y={y + 3}
                textAnchor="end"
                fill="#94a3b8"
                fontSize="9"
                fontWeight="500"
              >
                {val}
              </text>
            </g>
          )
        })}

        {/* X-axis hour ticks and labels (ET hours) */}
        {Array.from({ length: WINDOW_HOURS + 1 }, (_, i) => {
          const x = chartLeft + (i / WINDOW_HOURS) * chartWidth
          const etHour = (WINDOW_START_ET + i) % 24
          // Format as 12-hour with AM/PM for readability
          const ampm = etHour >= 12 ? 'p' : 'a'
          const h12 = etHour === 0 ? 12 : etHour > 12 ? etHour - 12 : etHour
          const label = `${h12}${ampm}`
          const yBase = CHART_HEIGHT + CHART_PADDING_TOP
          return (
            <g key={i}>
              <line
                x1={x}
                y1={yBase}
                x2={x}
                y2={yBase + 5}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text
                x={x}
                y={yBase + 18}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="9"
                fontWeight="500"
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* Baseline (x-axis) */}
        {/* Past portion (blue-gray) */}
        <line
          x1={chartLeft}
          y1={baselineY}
          x2={chartLeft + nowPercent / 100 * chartWidth}
          y2={baselineY}
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        {/* Future portion (light green) */}
        <line
          x1={chartLeft + nowPercent / 100 * chartWidth}
          y1={baselineY}
          x2={svgTotalWidth}
          y2={baselineY}
          stroke="#86efac"
          strokeWidth="1.5"
        />

        {/* Filled area between today and previous day — per-segment coloring */}
        {fillSegments && fillSegments.map((seg, i) => (
          <path key={`fill-${i}`} d={seg.d} fill={seg.fill} stroke="none" />
        ))}

        {/* Previous day line (full, dashed, muted) */}
        {sortedPrevDay.length > 1 && (() => {
          const points = sortedPrevDay.map(toPoint)
          const pathD = buildSmoothPath(points)
          return (
            <path
              d={pathD}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="6,4"
              opacity="0.5"
            />
          )
        })()}

        {/* Today's chat volume line */}
        {visibleData.length > 1 && (() => {
          const points = visibleData.map(toPoint)
          const pathD = buildSmoothPath(points)
          return (
            <path
              d={pathD}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })()}

        {/* Data label on the last visible point (today) */}
        {visibleData.length >= 1 && (() => {
          const last = visibleData[visibleData.length - 1]
          const pt = toPoint(last)
          return (
            <g>
              <circle cx={pt.x} cy={pt.y} r="3.5" fill="#38bdf8" />
              <text
                x={pt.x}
                y={pt.y - 8}
                textAnchor="middle"
                fill="#38bdf8"
                fontSize="9"
                fontWeight="700"
              >
                {last.count}
              </text>
            </g>
          )
        })()}

        {/* Single data point dot (today) */}
        {visibleData.length === 1 && (() => {
          const d = visibleData[0]
          const pt = toPoint(d)
          return <circle cx={pt.x} cy={pt.y} r="3" fill="#38bdf8" />
        })()}

        {/* Red now-indicator line */}
        <line
          x1={chartLeft + nowPercent / 100 * chartWidth}
          y1={0}
          x2={chartLeft + nowPercent / 100 * chartWidth}
          y2={svgTotalHeight}
          stroke="#ef4444"
          strokeWidth="2"
        />
      </svg>

      {/* Axis labels */}
      <div style={{
        position: 'absolute',
        bottom: '4px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '10px',
        fontWeight: 600,
        color: '#94a3b8',
        letterSpacing: '0.03em',
      }}>
        Hour of Day (ET)
      </div>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '-4px',
        transform: 'translateY(-50%) rotate(-90deg)',
        fontSize: '10px',
        fontWeight: 600,
        color: '#94a3b8',
        letterSpacing: '0.03em',
        transformOrigin: 'center center',
      }}>
        Chats
      </div>

      {/* Legend: Today vs Previous Week */}
      {sortedPrevDay.length > 0 && (() => {
        const lastDayName = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York', weekday: 'long',
        }).format(currentTime)
        return (
          <div style={{
            position: 'absolute',
            top: '-14px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '16px',
            fontSize: '10px',
            fontWeight: 500,
            color: '#94a3b8',
            pointerEvents: 'none',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '16px', height: '2px', background: '#38bdf8', display: 'inline-block', borderRadius: '1px' }} />
              Today
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '16px', height: '0', borderTop: '2px dashed #94a3b8', display: 'inline-block', opacity: 0.5 }} />
              Last {lastDayName}
            </span>
          </div>
        )
      })()}

      {/* Signpost timezone indicator at the now-indicator position */}
      <div
        style={{
          position: 'absolute',
          left: `calc(${Y_AXIS_WIDTH / 10}% + ${nowPercent * (100 - Y_AXIS_WIDTH / 10) / 100}%)`,
          top: '-8px',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 2,
          width: '80px',
          height: '120px',
        }}
      >
        {/* Signpost SVG background */}
        <img
          src="https://res.cloudinary.com/doznvxtja/image/upload/v1771075921/3_150_x_150_px_26_eqicrl.svg"
          alt="Timezone signpost"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
        {/* Time labels overlaid on each sign arrow */}
        {[
          { tz: 'Europe/London', top: '15%' },
          { tz: 'America/New_York', top: '40%' },
          { tz: 'America/Los_Angeles', top: '65%' },
        ].map(({ tz, top }) => (
          <div
            key={tz}
            style={{
              position: 'absolute',
              top,
              left: '60%',
              transform: 'translateX(-50%)',
              fontSize: '11px',
              fontWeight: 900,
              color: '#fff',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              lineHeight: '14px',
              textShadow: '0 1px 3px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.4)',
              letterSpacing: '0.04em',
            }}
          >
            {formatTime(currentTime, tz)}
          </div>
        ))}
      </div>

      {/* ET endpoint labels */}
      <div style={{
        position: 'absolute',
        left: '0',
        bottom: '18px',
        fontSize: '11px',
        color: '#94a3b8',
        fontWeight: 500,
      }}>
        5 AM ET
      </div>
      <div style={{
        position: 'absolute',
        right: '0',
        bottom: '18px',
        fontSize: '11px',
        color: '#94a3b8',
        fontWeight: 500,
      }}>
        9 PM ET
      </div>
    </div>
  )
}
