import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { getQhmApiBaseUrl, isDebugEnabled } from '../config'
import { TEAM_MEMBERS } from '../data/teamMembers'

interface TrendingData {
  direction: 'up' | 'down'
  percentage: number
  yesterdayValue?: number
}

interface OnCallPerson {
  name: string
  email?: string
  scheduleName: string
  scheduleType: 'escalations' | 'incidents'
  endAt?: string
}

interface Incident {
  id: string
  name: string
  severity: string
  status: string
  statusCategory: string
  createdAt: string
  updatedAt: string
  permalink?: string
  incidentLead?: string | null
}

interface OOOTSEBanner {
  name: string
  avatar: string
}

interface IncidentBannerProps {
  chatCount?: number
  closedCount?: number
  chatsTrending?: TrendingData | null
  previousClosed?: number | null
  medianResponseTime?: number | null
  unassignedCount?: number
  availableCapacity?: number
  activeTSEs?: number
  awayTSEs?: number
  oooData?: Record<string, unknown> | null
  oooTSEColumn?: string
  oooStatusColumn?: string
}

const DASHBOARD_LOGO_URL = 'https://res.cloudinary.com/doznvxtja/image/upload/v1769680535/SQL_14_ielazn.svg'
const DASHBOARD_LOGO_URL_DARK = 'https://res.cloudinary.com/doznvxtja/image/upload/v1769843414/SQL_15_upfjgr.svg'
const QHM_API_BASE_URL = getQhmApiBaseUrl()
const LOG = isDebugEnabled()

export function IncidentBanner({
  chatCount,
  closedCount,
  chatsTrending,
  previousClosed,
  medianResponseTime,
  unassignedCount,
  availableCapacity,
  activeTSEs,
  awayTSEs,
  oooData,
  oooTSEColumn,
  oooStatusColumn,
}: IncidentBannerProps) {
  const [onCallData, setOnCallData] = useState<OnCallPerson[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [incidentIndex, setIncidentIndex] = useState(0)
  const onCallScrollRef = useRef<HTMLDivElement>(null)
  const scrollIntervalRef = useRef<number | null>(null)
  const incidentDescScrollRef = useRef<HTMLDivElement>(null)
  const incidentAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isScrollingPaused, _setIsScrollingPaused] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark-mode')
  })

  // Listen for dark mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark-mode'))
    })
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    
    return () => observer.disconnect()
  }, [])

  const oooTSEs = useMemo(() => {
    if (!oooData || !oooTSEColumn) return []
    const tseNames = oooData[oooTSEColumn] as string[] | undefined
    const statuses = oooStatusColumn ? (oooData[oooStatusColumn] as string[] | undefined) : undefined
    if (!tseNames || tseNames.length === 0) return []
    const result: OOOTSEBanner[] = []
    const seen = new Set<string>()
    tseNames.forEach((name, i) => {
      if (!name?.trim()) return
      const clean = name.trim()
      if (statuses) {
        const s = statuses[i]?.toString().toLowerCase()
        if (s !== 'yes' && s !== 'true' && s !== '1') return
      }
      const key = clean.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      const member = TEAM_MEMBERS.find((m) => {
        const ml = m.name.toLowerCase()
        const cl = clean.toLowerCase()
        if (ml === cl) return true
        if (ml === cl.split(' ')[0]) return true
        if (cl.startsWith(ml + ' ') || ml.startsWith(cl + ' ')) return true
        return false
      })
      result.push({ name: clean, avatar: member?.avatar || `https://i.pravatar.cc/40?u=${clean}` })
    })
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }, [oooData, oooTSEColumn, oooStatusColumn])

  // Fetch on-call data from Incident.io
  const fetchOnCallData = useCallback(async () => {
    try {
      const response = await fetch(`${QHM_API_BASE_URL}/api/incident-io/on-call`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })
      if (!response.ok) {
        if (LOG) console.error('[IncidentBanner] Failed to fetch on-call data:', response.status)
        return
      }
      const data = await response.json()
      // Avoid logging raw payloads (can include emails).
      if (LOG) console.log('[IncidentBanner] On-call count:', data.onCall?.length || 0)
      setOnCallData(data.onCall || [])
    } catch (error) {
      if (LOG) console.error('[IncidentBanner] Error fetching on-call data:', error)
    }
  }, [])

  // Fetch active incidents from Incident.io
  const fetchIncidents = useCallback(async () => {
    try {
      const response = await fetch(`${QHM_API_BASE_URL}/api/incident-io/incidents`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })
      if (!response.ok) {
        if (LOG) console.error('[IncidentBanner] Failed to fetch incidents:', response.status)
        return
      }
      const data = await response.json()
      if (LOG) console.log('[IncidentBanner] Incidents count:', data.incidents?.length || 0)
      setIncidents(data.incidents || [])
    } catch (error) {
      if (LOG) console.error('[IncidentBanner] Error fetching incidents:', error)
    }
  }, [])

  // Fetch on-call + incidents on mount and every 5 minutes
  useEffect(() => {
    fetchOnCallData()
    fetchIncidents()
    const interval = setInterval(() => {
      fetchOnCallData()
      fetchIncidents()
    }, 5 * 60 * 1000) // 5 minutes
    return () => clearInterval(interval)
  }, [fetchOnCallData])

  // Reset incident index when incidents list changes
  useEffect(() => {
    setIncidentIndex(0)
  }, [incidents])

  // Advance to next incident only after description scroll completes (or min display time for short text)
  const SCROLL_SPEED_PX_PER_MS = 0.02 // ~20px per second (half speed)
  const MIN_DISPLAY_MS = 4000
  const PAUSE_AT_END_MS = 1500

  useEffect(() => {
    if (incidents.length <= 1) return

    let cancelled = false

    const advanceToNext = () => {
      if (!cancelled) setIncidentIndex((prev) => (prev + 1) % incidents.length)
    }

    const scheduleAdvance = () => {
      if (!cancelled) {
        incidentAdvanceTimeoutRef.current = setTimeout(advanceToNext, PAUSE_AT_END_MS)
      }
    }

    const el = incidentDescScrollRef.current
    if (!el) {
      incidentAdvanceTimeoutRef.current = setTimeout(advanceToNext, MIN_DISPLAY_MS)
      return () => {
        cancelled = true
        if (incidentAdvanceTimeoutRef.current) clearTimeout(incidentAdvanceTimeoutRef.current)
      }
    }

    const scrollAmount = el.scrollWidth - el.clientWidth
    if (scrollAmount <= 0) {
      incidentAdvanceTimeoutRef.current = setTimeout(advanceToNext, MIN_DISPLAY_MS)
      return () => {
        cancelled = true
        if (incidentAdvanceTimeoutRef.current) clearTimeout(incidentAdvanceTimeoutRef.current)
      }
    }

    el.scrollLeft = 0
    const durationMs = scrollAmount / SCROLL_SPEED_PX_PER_MS
    const startTime = performance.now()

    const animate = () => {
      if (cancelled) return
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      el.scrollLeft = scrollAmount * progress

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        scheduleAdvance()
      }
    }
    requestAnimationFrame(animate)

    return () => {
      cancelled = true
      if (incidentAdvanceTimeoutRef.current) clearTimeout(incidentAdvanceTimeoutRef.current)
    }
  }, [incidentIndex, incidents.length])

  // Auto-scroll on-call people horizontally with seamless loop
  useEffect(() => {
    if (!onCallScrollRef.current || onCallData.length === 0 || isScrollingPaused) {
      return
    }

    const scrollContainer = onCallScrollRef.current
    const scrollWidth = scrollContainer.scrollWidth
    const clientWidth = scrollContainer.clientWidth

    // Only scroll if content overflows
    if (scrollWidth <= clientWidth) {
      return
    }

    // Calculate the width of one set of items (for seamless looping)
    const firstItem = scrollContainer.firstElementChild as HTMLElement
    if (!firstItem) return
    
    const itemWidth = firstItem.offsetWidth + 12 // 12px gap
    const itemsPerSet = onCallData.length
    const setWidth = itemWidth * itemsPerSet

    let scrollPosition = scrollContainer.scrollLeft
    const scrollSpeed = 0.5 // pixels per frame

    const scroll = () => {
      scrollPosition += scrollSpeed
      
      // Reset to start when reaching the end of first set (seamless loop)
      if (scrollPosition >= setWidth) {
        scrollPosition = scrollPosition - setWidth
        scrollContainer.scrollLeft = scrollPosition
      } else {
        scrollContainer.scrollLeft = scrollPosition
      }
    }

    // Use requestAnimationFrame for smooth scrolling
    const animate = () => {
      if (!isScrollingPaused && scrollContainer) {
        scroll()
        scrollIntervalRef.current = requestAnimationFrame(animate) as unknown as number
      }
    }

    scrollIntervalRef.current = requestAnimationFrame(animate) as unknown as number

    return () => {
      if (scrollIntervalRef.current !== null) {
        cancelAnimationFrame(scrollIntervalRef.current)
      }
    }
  }, [onCallData.length, isScrollingPaused])

  // Format response time in seconds to human-readable format
  const formatResponseTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (remainingSeconds === 0) {
      return `${minutes}m`
    }
    return `${minutes}m ${remainingSeconds}s`
  }


  const metricStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    flexShrink: 0,
  }

  const metricLabel: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
    textAlign: 'center',
  }

  const metricValue: React.CSSProperties = {
    fontSize: '26px',
    fontWeight: 700,
    lineHeight: 1,
  }

  return (
    <div className="incident-banner">
      <div className="incident-banner-content" style={{ gap: 0 }}>
        {/* Logo — fixed left */}
        <div className="dashboard-logo" style={{ flexShrink: 0 }}>
          <img
            src={isDarkMode ? DASHBOARD_LOGO_URL_DARK : DASHBOARD_LOGO_URL}
            alt="Dashboard"
          />
        </div>

        <div className="incident-banner-divider"></div>

        {/* Metrics — fill remaining space, evenly distributed */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          minWidth: 0,
        }}>
          {/* Chats Today */}
          {chatCount !== undefined && (
            <div style={metricStyle}>
              <div className="tse-status-banner-value tse-status-chat" style={metricValue}>
                {chatCount}
              </div>
              <div style={metricLabel}>Chats Today</div>
              {chatsTrending?.yesterdayValue !== undefined && (
                <div style={{ fontSize: '9px', color: 'var(--text-secondary)', opacity: 0.7 }}>
                  {chatsTrending.yesterdayValue} prev day
                </div>
              )}
            </div>
          )}

          {/* Closed Today */}
          {closedCount !== undefined && (
            <div style={metricStyle}>
              <div className="tse-status-banner-value tse-status-closed" style={metricValue}>
                {closedCount}
              </div>
              <div style={metricLabel}>Closed Today</div>
              {previousClosed !== undefined && previousClosed !== null && (
                <div style={{ fontSize: '9px', color: 'var(--text-secondary)', opacity: 0.7 }}>
                  {previousClosed} prev day
                </div>
              )}
            </div>
          )}

          {/* Chats Waiting */}
          {unassignedCount !== undefined && (
            <div style={metricStyle}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 10px',
                borderRadius: '999px',
                backgroundColor: unassignedCount > 10 
                  ? 'rgba(253, 135, 137, 0.15)'
                  : unassignedCount > 5
                  ? 'rgba(255, 193, 7, 0.2)'
                  : 'rgba(76, 236, 140, 0.2)',
                color: unassignedCount > 10 
                  ? '#fd8789'
                  : unassignedCount > 5
                  ? '#ffc107'
                  : '#4cec8c',
                ...metricValue,
              }}>
                {unassignedCount}
              </span>
              <div style={metricLabel}>Chats Waiting</div>
            </div>
          )}

          {/* Open Chat Slots */}
          {availableCapacity !== undefined && (
            <div style={metricStyle}>
              <div style={{
                ...metricValue,
                color: availableCapacity > 0 ? '#10b981' : '#ef4444',
              }}>
                {availableCapacity > 0 ? `+${availableCapacity}` : availableCapacity}
              </div>
              <div style={{ ...metricLabel, lineHeight: 1.3 }}>
                <div>Open Chat</div>
                <div>Slots</div>
              </div>
            </div>
          )}

          {/* Median Response */}
          {medianResponseTime !== undefined && medianResponseTime !== null && (
            <div style={metricStyle}>
              <div style={{ ...metricValue, color: 'var(--text-primary)' }}>
                {formatResponseTime(medianResponseTime)}
              </div>
              <div style={metricLabel}>Median Response</div>
            </div>
          )}

          {/* Active TSEs */}
          {activeTSEs !== undefined && (
            <div style={metricStyle}>
              <div style={{ ...metricValue, fontSize: '28px', fontWeight: 800, color: '#4cec8c' }}>
                {activeTSEs}
              </div>
              <div style={metricLabel}>Active</div>
            </div>
          )}

          {/* Away TSEs */}
          {awayTSEs !== undefined && (
            <div style={metricStyle}>
              <div style={{ ...metricValue, fontSize: '28px', fontWeight: 800, color: '#fd8789' }}>
                {awayTSEs}
              </div>
              <div style={metricLabel}>Away</div>
            </div>
          )}

          {/* OOO Today */}
          {oooTSEs.length > 0 && (
            <div style={metricStyle}>
              <div style={metricLabel}>OOO Today</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {oooTSEs.map((tse, i) => (
                  <img
                    key={tse.name}
                    src={tse.avatar}
                    alt={tse.name}
                    title={tse.name}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--bg-card, #fff)',
                      marginLeft: i === 0 ? 0 : '-10px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://i.pravatar.cc/48?u=${tse.name}`
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
