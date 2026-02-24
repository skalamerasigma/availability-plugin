import { useEffect, useState, useCallback, useRef } from 'react'
import { getQhmApiBaseUrl, isDebugEnabled } from '../config'

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

interface TeamMember {
  id: string | number
  name: string
  email?: string
  avatar?: {
    image_url?: string
  }
}

interface IncidentBannerProps {
  chatCount?: number
  closedCount?: number
  chatsTrending?: TrendingData | null
  previousClosed?: number | null
  medianResponseTime?: number | null
  teamMembers?: TeamMember[]
  unassignedCount?: number
  availableCapacity?: number
}

const INCIDENT_IO_LOGO_URL = 'https://res.cloudinary.com/doznvxtja/image/upload/v1769535474/Untitled_design_30_w9bwzy.svg'
const INCIDENT_IO_LOGO_URL_DARK = 'https://res.cloudinary.com/doznvxtja/image/upload/v1769843507/SQL_16_lighjh.svg'
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
  teamMembers = [],
  unassignedCount,
  availableCapacity,
}: IncidentBannerProps) {
  const [onCallData, setOnCallData] = useState<OnCallPerson[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [incidentIndex, setIncidentIndex] = useState(0)
  const onCallScrollRef = useRef<HTMLDivElement>(null)
  const scrollIntervalRef = useRef<number | null>(null)
  const incidentDescScrollRef = useRef<HTMLDivElement>(null)
  const incidentAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isScrollingPaused, setIsScrollingPaused] = useState(false)
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

  // Get first name from full name
  const getFirstName = (fullName: string): string => {
    if (!fullName) return fullName
    return fullName.split(' ')[0]
  }

  // Status badge background color (special badge style like SEV 1)
  const getStatusBadgeColor = (status?: string, statusCategory?: string): string => {
    const s = (status || '').toLowerCase()
    const cat = (statusCategory || '').toLowerCase()
    if (s.includes('progress') || cat === 'live') return '#3b82f6' // blue - In Progress
    if (s.includes('triage') || cat === 'triage') return '#8b5cf6' // purple
    if (s.includes('learning') || cat === 'learning') return '#06b6d4' // cyan
    if (s.includes('closed') || cat === 'closed') return '#6b7280' // gray
    if (s.includes('resolved')) return '#10b981' // green
    if (s.includes('canceled') || s.includes('cancelled') || cat === 'canceled') return '#9ca3af' // light gray
    if (s.includes('declined') || cat === 'declined') return '#ef4444' // red
    return '#6366f1' // default indigo
  }

  // Map schedule name to badge label
  const getBadgeLabel = (scheduleName: string): string => {
    if (scheduleName === 'TSE Manager - Escalations') {
      return 'ESCALATIONS'
    }
    if (scheduleName === 'TSE Manager - Incidents') {
      return 'INCIDENTS'
    }
    if (scheduleName === '3 - Support On-Call Primary 24x7') {
      return 'PRIMARY'
    }
    if (scheduleName === '4 - Support On-Call Backup 24x7') {
      return 'BACKUP'
    }
    if (scheduleName === 'TSE - Tier 3') {
      return 'TIER3'
    }
    // Fallback for any other schedules
    return 'ON-CALL'
  }

  // Direct avatar overrides for on-call people with ambiguous first names
  const ON_CALL_AVATAR_OVERRIDES: Record<string, string> = {
    'Nathan Parrish': 'https://ca.slack-edge.com/E07M25LCK1V-U056CEX10HE-6c588ca5f698-512',
  }

  // Find team member by email or name to get avatar
  const getTeamMemberAvatar = (person: OnCallPerson): string | undefined => {
    // Check for direct avatar overrides first (for people with ambiguous first names)
    const override = ON_CALL_AVATAR_OVERRIDES[person.name]
    if (override) {
      console.log(`[IncidentBanner] Using avatar override for ${person.name}:`, override)
      return override
    }

    if (!teamMembers || teamMembers.length === 0) {
      console.log('[IncidentBanner] No team members available for avatar lookup')
      return undefined
    }
    
    // Try to find by email first (most reliable)
    if (person.email) {
      const member = teamMembers.find(m => 
        m.email && m.email.toLowerCase() === person.email?.toLowerCase()
      )
      if (member?.avatar?.image_url) {
        console.log(`[IncidentBanner] Found avatar for ${person.name} by email:`, member.avatar.image_url)
        return member.avatar.image_url
      }
    }
    
    // Fallback: try to find by name (first name match)
    const firstName = getFirstName(person.name)
    const member = teamMembers.find(m => {
      const memberFirstName = getFirstName(m.name)
      return memberFirstName.toLowerCase() === firstName.toLowerCase()
    })
    
    if (member?.avatar?.image_url) {
      console.log(`[IncidentBanner] Found avatar for ${person.name} by name:`, member.avatar.image_url)
      return member.avatar.image_url
    }
    
    console.log(`[IncidentBanner] No avatar found for ${person.name}. Available team members:`, teamMembers.map(m => ({ name: m.name, email: m.email, hasAvatar: !!m.avatar?.image_url })))
    return undefined
  }

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


  return (
    <div className="incident-banner">
      <div className="incident-banner-content">
        {/* Incident.io Logo - Top Right Corner */}
        <div className="incident-banner-logo-icon">
          <img
            src={isDarkMode ? INCIDENT_IO_LOGO_URL_DARK : INCIDENT_IO_LOGO_URL}
            alt="Incident.io"
          />
        </div>

        {/* Left side: logo, counts, reso queue - fixed width, no grow */}
        <div className="incident-banner-left">
        {/* Dashboard Logo */}
        <div className="dashboard-logo">
          <img
            src={isDarkMode ? DASHBOARD_LOGO_URL_DARK : DASHBOARD_LOGO_URL}
            alt="Dashboard"
          />
        </div>

        {/* Chat & Closed Counts */}
        {(chatCount !== undefined || closedCount !== undefined) && (
          <>
            <div className="incident-banner-divider"></div>
            <div className="tse-status-banner-counts">
              {chatCount !== undefined && (
                <div className="tse-status-banner-stat">
                  <div className="tse-status-banner-value tse-status-chat">
                    {chatCount}
                  </div>
                  <div className="tse-status-banner-label">Chats Today</div>
                  {chatsTrending?.yesterdayValue !== undefined && (
                    <div className="tse-status-banner-yesterday">
                      {chatsTrending.yesterdayValue} prev day
                    </div>
                  )}
                </div>
              )}
              {closedCount !== undefined && (
                <div className="tse-status-banner-stat">
                  <div className="tse-status-banner-value tse-status-closed">
                    {closedCount}
                  </div>
                  <div className="tse-status-banner-label">Closed Today</div>
                  {previousClosed !== undefined && previousClosed !== null && (
                    <div className="tse-status-banner-yesterday">
                      {previousClosed} prev day
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Reso Queue Container */}
        {(unassignedCount !== undefined || availableCapacity !== undefined || (medianResponseTime !== undefined && medianResponseTime !== null)) && (
          <>
            <div className="incident-banner-divider"></div>
            <div style={{
              display: 'flex',
              flex: '1 1 0%',
              justifyContent: 'center',
              alignItems: 'center',
              minWidth: 0
            }}>
              <div className="zoom-call-section">
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '4px' 
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    fontWeight: 600, 
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Reso Queue
                  </div>
                  <div className="zoom-icon-container" style={{ 
                    position: 'relative', 
                    display: 'flex', 
                    flexDirection: 'row',
                    alignItems: 'flex-start', 
                    justifyContent: 'space-between',
                    width: '100%',
                    maxWidth: '500px',
                    margin: '0 auto',
                    gap: '16px'
                  }}>
                  {unassignedCount !== undefined && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      flex: '0 1 auto',
                      minWidth: '80px'
                    }}>
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
                        fontSize: '24px',
                        fontWeight: 700,
                        lineHeight: 1
                      }}>
                        {unassignedCount}
                        </span>
                        <div style={{
                        fontSize: '10px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        whiteSpace: 'nowrap'
                      }}>
                        Chats Waiting
                        </div>
                      </div>
                  )}
                  {availableCapacity !== undefined && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      flex: '0 1 auto',
                      minWidth: '80px'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        lineHeight: 1,
                        color: availableCapacity > 0 ? '#10b981' : '#ef4444'
                      }}>
                        {availableCapacity > 0 ? `+${availableCapacity}` : availableCapacity}
                      </div>
                      <div style={{
                        fontSize: '10px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        lineHeight: 1.3
                      }}>
                        <div>Open Chat</div>
                        <div>Slots</div>
                      </div>
                    </div>
                  )}
                  {medianResponseTime !== undefined && medianResponseTime !== null && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      flex: '0 1 auto',
                      minWidth: '80px'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        lineHeight: 1,
                        color: 'var(--text-primary)'
                      }}>
                        {formatResponseTime(medianResponseTime)}
                      </div>
                      <div style={{
                        fontSize: '10px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        whiteSpace: 'nowrap'
                      }}>
                        Median Response
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
            <div className="incident-banner-divider"></div>
          </>
        )}

        </div>
        {/* Incident & On-Call Section - Takes all remaining space */}
        <div className="incident-banner-incident-section-wrapper">
          <div className="incident-banner-incident-section">
            {/* Incident Status */}
            <div className="incident-banner-details">
              {incidents.length === 0 ? (
                <div className="incident-banner-no-incidents">
                  <div className="no-incidents-badge">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C12.42 16 16 12.42 16 8C16 3.58 12.42 0 8 0ZM7 11.4L3.6 8L5 6.6L7 8.6L11 4.6L12.4 6L7 11.4Z" fill="currentColor"/>
                    </svg>
                    <span>All Clear</span>
                  </div>
                  <div className="no-incidents-message">
                    No SEV1 Incidents Reported Within The Last 72hrs
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  {incidents.length > 1 && (
                    <span style={{
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      {incidentIndex + 1}/{incidents.length}
                    </span>
                  )}
                  {(() => {
                    const inc = incidents[incidentIndex]
                    if (!inc) return null
                    const isSev1 = inc.severity?.toLowerCase().includes('sev1') || inc.severity?.toLowerCase().includes('sev 1') || inc.severity?.toLowerCase().includes('critical')
                    return (
                      <a
                        href={inc.permalink || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: isSev1 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          border: `1px solid ${isSev1 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                          textDecoration: 'none',
                          color: 'inherit',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isSev1 ? '#ef4444' : '#f59e0b',
                          color: '#fff',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}>
                          {inc.severity}
                        </span>
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          flex: 1,
                          minWidth: 0,
                        }}>
                          <div
                            ref={incidentDescScrollRef}
                            style={{
                              fontSize: '11px',
                              fontWeight: 500,
                              overflowX: 'auto',
                              overflowY: 'hidden',
                              whiteSpace: 'nowrap',
                              flex: 1,
                              minWidth: 0,
                            }}
                            className="incident-desc-scroll"
                          >
                            <span style={{ display: 'inline-block' }}>{inc.name}</span>
                          </div>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: getStatusBadgeColor(inc.status, inc.statusCategory),
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}>
                            {inc.status}
                          </span>
                        </span>
                      </a>
                    )
                  })()}
                </div>
              )}
            </div>

          {/* On-Call Display - Bottom of Incident Section */}
          {onCallData.length > 0 && (
            <div className="on-call-section">
              <div 
                ref={onCallScrollRef}
                className="on-call-people"
                onMouseEnter={() => setIsScrollingPaused(true)}
                onMouseLeave={() => setIsScrollingPaused(false)}
              >
                {/* Render items twice for seamless looping */}
                {[...onCallData, ...onCallData].map((person, idx) => {
                  const avatar = getTeamMemberAvatar(person)
                  const badgeLabel = getBadgeLabel(person.scheduleName)
                  return (
                    <div key={idx} className="on-call-person">
                      {avatar ? (
                        <img 
                          src={avatar} 
                          alt={person.name}
                          className="on-call-avatar"
                          onError={(e) => {
                            console.error(`[IncidentBanner] Failed to load avatar for ${person.name}:`, avatar)
                            // Hide image on error
                            e.currentTarget.style.display = 'none'
                          }}
                          onLoad={() => {
                            console.log(`[IncidentBanner] Successfully loaded avatar for ${person.name}`)
                          }}
                        />
                      ) : (
                        <div className="on-call-avatar" style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: '#e5e7eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-secondary)',
                          fontSize: '12px',
                          fontWeight: 600,
                          flexShrink: 0
                        }}>
                          {getFirstName(person.name).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="on-call-name">{getFirstName(person.name)}</span>
                      <span className="on-call-type">
                        {badgeLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
