import { useEffect, useMemo, useState, useCallback, useRef } from 'react'

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

interface TeamMember {
  id: string | number
  name: string
  email?: string
  avatar?: {
    image_url?: string
  }
}

interface IncidentBannerProps {
  incidentsData: Record<string, unknown> | null | undefined
  incidentsColumns: Record<string, { name: string }> | undefined
  incidentDetailsColumn: string | undefined
  sevStatusColumn: string | undefined
  incidentCreatedAtColumn: string | undefined
  incidentUpdatedAtColumn: string | undefined
  chatCount?: number
  closedCount?: number
  chatsTrending?: TrendingData | null
  previousClosed?: number | null
  zoomCallCount?: number
  medianResponseTime?: number | null
  teamMembers?: TeamMember[]
}

interface Incident {
  incidentDetails: string
  sevStatus: string
  incidentCreatedAt: string
  incidentUpdatedAt: string
}

const INCIDENT_IO_LOGO_URL = 'https://res.cloudinary.com/doznvxtja/image/upload/v1769535474/Untitled_design_30_w9bwzy.svg'
const INCIDENT_IO_LOGO_URL_DARK = 'https://res.cloudinary.com/doznvxtja/image/upload/v1769843507/SQL_16_lighjh.svg'
const DASHBOARD_LOGO_URL = 'https://res.cloudinary.com/doznvxtja/image/upload/v1769680535/SQL_14_ielazn.svg'
const DASHBOARD_LOGO_URL_DARK = 'https://res.cloudinary.com/doznvxtja/image/upload/v1769843414/SQL_15_upfjgr.svg'
const ZOOM_ICON_URL = 'https://res.cloudinary.com/doznvxtja/image/upload/v1769458061/1996_Nintendo_22_oorusp.svg'
const ROTATION_INTERVAL_MS = 10000 // 10 seconds

export function IncidentBanner({
  incidentsData,
  incidentsColumns,
  incidentDetailsColumn,
  sevStatusColumn,
  incidentCreatedAtColumn,
  incidentUpdatedAtColumn,
  chatCount,
  closedCount,
  chatsTrending,
  previousClosed,
  zoomCallCount,
  medianResponseTime,
  teamMembers = [],
}: IncidentBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [onCallData, setOnCallData] = useState<OnCallPerson[]>([])
  const onCallScrollRef = useRef<HTMLDivElement>(null)
  const scrollIntervalRef = useRef<number | null>(null)
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
      const response = await fetch('https://queue-health-monitor.vercel.app/api/incident-io/on-call')
      if (!response.ok) {
        console.error('[IncidentBanner] Failed to fetch on-call data:', response.status)
        return
      }
      const data = await response.json()
      console.log('[IncidentBanner] On-call data:', data)
      console.log('[IncidentBanner] On-call count:', data.onCall?.length || 0)
      console.log('[IncidentBanner] On-call schedules:', data.onCall?.map((p: OnCallPerson) => p.scheduleName) || [])
      setOnCallData(data.onCall || [])
    } catch (error) {
      console.error('[IncidentBanner] Error fetching on-call data:', error)
    }
  }, [])

  // Fetch on-call data on mount and every 5 minutes
  useEffect(() => {
    fetchOnCallData()
    const interval = setInterval(fetchOnCallData, 5 * 60 * 1000) // 5 minutes
    return () => clearInterval(interval)
  }, [fetchOnCallData])

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

  // Process incidents (data is already filtered by date range in the source)
  const activeIncidents = useMemo(() => {
    console.log('[IncidentBanner] Processing incidents data:', {
      hasIncidentsData: !!incidentsData,
      incidentsDataKeys: incidentsData ? Object.keys(incidentsData) : [],
      incidentsColumnsKeys: incidentsColumns ? Object.keys(incidentsColumns) : [],
      incidentsColumnsNames: incidentsColumns 
        ? Object.entries(incidentsColumns).map(([id, col]) => `${id}: "${col.name}"`)
        : [],
      incidentDetailsColumn,
      sevStatusColumn,
      incidentCreatedAtColumn,
      incidentUpdatedAtColumn,
    })

    if (!incidentsData) {
      console.log('[IncidentBanner] No incidentsData provided')
      return []
    }

    if (!incidentDetailsColumn) {
      console.log('[IncidentBanner] No incidentDetailsColumn configured')
      return []
    }

    // Helper to find column ID from column name or use the value directly if it's already an ID
    const findColumnId = (columnNameOrId: string | undefined): string | undefined => {
      if (!columnNameOrId) return undefined
      if (!incidentsColumns) return columnNameOrId // If no columns mapping, assume it's already an ID
      
      // First try direct match (in case it's already an ID)
      if (incidentsData[columnNameOrId]) {
        console.log(`[IncidentBanner] Found direct match for "${columnNameOrId}"`)
        return columnNameOrId
      }
      
      // Try exact column name match
      let found = Object.entries(incidentsColumns).find(
        ([_, col]) => col.name === columnNameOrId
      )
      if (found) {
        console.log(`[IncidentBanner] Found exact name match: "${columnNameOrId}" -> "${found[0]}"`)
        return found[0]
      }
      
      // Try case-insensitive match
      found = Object.entries(incidentsColumns).find(
        ([_, col]) => col.name.toLowerCase() === columnNameOrId.toLowerCase()
      )
      if (found) {
        console.log(`[IncidentBanner] Found case-insensitive match: "${columnNameOrId}" -> "${found[0]}"`)
        return found[0]
      }
      
      // Try partial match (for cases like "INCIDENT DETAILS" matching "Incident Details")
      const normalizedSearch = columnNameOrId.toLowerCase().replace(/[^a-z0-9]/g, '')
      found = Object.entries(incidentsColumns).find(
        ([_, col]) => col.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSearch
      )
      if (found) {
        console.log(`[IncidentBanner] Found normalized match: "${columnNameOrId}" -> "${found[0]}" (${found[1].name})`)
        return found[0]
      }
      
      console.log(`[IncidentBanner] No match found for "${columnNameOrId}". Available columns:`, 
        Object.entries(incidentsColumns).map(([id, col]) => `${id}: "${col.name}"`))
      return columnNameOrId // Return as-is, might work if it's an ID
    }

    const incidentDetailsId = findColumnId(incidentDetailsColumn)
    const sevStatusId = findColumnId(sevStatusColumn)
    const createdAtId = findColumnId(incidentCreatedAtColumn)
    const updatedAtId = findColumnId(incidentUpdatedAtColumn)

    console.log('[IncidentBanner] Resolved column IDs:', {
      incidentDetailsId,
      sevStatusId,
      createdAtId,
      updatedAtId,
    })
    
    // Log what column names these IDs correspond to
    if (incidentsColumns) {
      console.log('[IncidentBanner] Column ID to name mapping:', {
        incidentDetails: incidentDetailsId && incidentsColumns[incidentDetailsId] 
          ? incidentsColumns[incidentDetailsId].name 
          : 'NOT FOUND',
        sevStatus: sevStatusId && incidentsColumns[sevStatusId] 
          ? incidentsColumns[sevStatusId].name 
          : 'NOT FOUND',
        createdAt: createdAtId && incidentsColumns[createdAtId] 
          ? incidentsColumns[createdAtId].name 
          : 'NOT FOUND',
        updatedAt: updatedAtId && incidentsColumns[updatedAtId] 
          ? incidentsColumns[updatedAtId].name 
          : 'NOT FOUND',
      })
    }

    // Column IDs are used as keys in incidentsData
    const incidentDetailsData = incidentDetailsId
      ? (incidentsData[incidentDetailsId] as string[] | undefined)
      : undefined
    const sevStatusData = sevStatusId
      ? (incidentsData[sevStatusId] as string[] | undefined)
      : undefined
    const createdAtData = createdAtId
      ? (incidentsData[createdAtId] as string[] | undefined)
      : undefined
    const updatedAtData = updatedAtId
      ? (incidentsData[updatedAtId] as string[] | undefined)
      : undefined

    console.log('[IncidentBanner] Column data:', {
      incidentDetailsLength: incidentDetailsData?.length || 0,
      incidentDetailsSample: incidentDetailsData?.slice(0, 2),
      sevStatusLength: sevStatusData?.length || 0,
      sevStatusSample: sevStatusData?.slice(0, 2),
      createdAtLength: createdAtData?.length || 0,
      createdAtSample: createdAtData?.slice(0, 2),
      updatedAtLength: updatedAtData?.length || 0,
      updatedAtSample: updatedAtData?.slice(0, 2),
    })

    if (!incidentDetailsData || incidentDetailsData.length === 0) {
      console.log('[IncidentBanner] No incident details data found. Available data keys:', Object.keys(incidentsData))
      return []
    }

    const result: Incident[] = []

    incidentDetailsData.forEach((details, index) => {
      // Convert to string and check if it's not empty
      const detailsStr = details ? String(details).trim() : ''
      if (!detailsStr) {
        console.log(`[IncidentBanner] Skipping row ${index}: empty details`)
        return
      }

      const incident = {
        incidentDetails: detailsStr,
        sevStatus: sevStatusData?.[index] ? String(sevStatusData[index]).trim() : '',
        incidentCreatedAt: createdAtData?.[index] ? String(createdAtData[index]).trim() : '',
        incidentUpdatedAt: updatedAtData?.[index] ? String(updatedAtData[index]).trim() : '',
      }

      console.log(`[IncidentBanner] Processing incident ${index}:`, {
        details: incident.incidentDetails.substring(0, 50) + '...',
        sevStatus: incident.sevStatus,
        createdAt: incident.incidentCreatedAt,
        updatedAt: incident.incidentUpdatedAt,
      })

      result.push(incident)
    })

    console.log('[IncidentBanner] Processed incidents:', result.length)
    return result
  }, [
    incidentsData,
    incidentsColumns,
    incidentDetailsColumn,
    sevStatusColumn,
    incidentCreatedAtColumn,
    incidentUpdatedAtColumn,
  ])

  // Rotate through incidents every 10 seconds
  useEffect(() => {
    if (activeIncidents.length <= 1) {
      return // No need to rotate if 0 or 1 incident
    }

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeIncidents.length)
    }, ROTATION_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [activeIncidents.length])

  console.log('[IncidentBanner] Rendering banner with', activeIncidents.length, 'incidents')

  const currentIncident = activeIncidents.length > 0 ? activeIncidents[currentIndex] : null
  const hasIncidents = activeIncidents.length > 0

  // Format timestamps for display
  const formatTimestamp = (timestampStr: string | number): string => {
    if (!timestampStr && timestampStr !== 0) return ''
    try {
      let date: Date
      
      // Handle numeric timestamps (Unix milliseconds)
      if (typeof timestampStr === 'number' || (!isNaN(Number(timestampStr)) && String(timestampStr).match(/^\d+$/))) {
        const timestamp = typeof timestampStr === 'number' ? timestampStr : Number(timestampStr)
        // Check if it's in seconds (less than year 2000) or milliseconds
        date = new Date(timestamp > 946684800000 ? timestamp : timestamp * 1000)
      } else {
        // Handle string timestamps
        let dateStr = String(timestampStr).trim()
        
        // Handle Snowflake timestamp format: "2026-01-15 13:24:13.292 -0800"
        const timestampRegex = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+([+-]\d{4})$/
        const match = dateStr.match(timestampRegex)
        
        if (match) {
          // Convert to ISO format: YYYY-MM-DDTHH:MM:SS.SSS-HH:MM
          const [, datePart, timePart, tzPart] = match
          const tzFormatted = `${tzPart.slice(0, 3)}:${tzPart.slice(3)}`
          dateStr = `${datePart}T${timePart}${tzFormatted}`
        }
        
        date = new Date(dateStr)
      }
      
      if (isNaN(date.getTime())) {
        console.warn('[IncidentBanner] Invalid date:', timestampStr)
        return String(timestampStr)
      }
      
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch (error) {
      console.warn('[IncidentBanner] Error parsing date:', timestampStr, error)
      return String(timestampStr)
    }
  }

  // Get severity color based on SEV_STATUS
  const getSeverityColor = (sevStatus: string): string => {
    const statusLower = sevStatus.toLowerCase()
    if (statusLower.includes('sev 1') || statusLower.includes('sev1') || statusLower.includes('𝗦𝗘𝗩 𝟏')) {
      return '#ef4444' // red
    }
    if (statusLower.includes('sev 2') || statusLower.includes('sev2')) {
      return '#f59e0b' // orange/amber
    }
    if (statusLower.includes('sev 3') || statusLower.includes('sev3')) {
      return '#eab308' // yellow
    }
    return '#6366f1' // default purple/blue
  }

  const severityColor = currentIncident ? getSeverityColor(currentIncident.sevStatus) : '#10b981'

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

        {/* Median Response Time */}
        {medianResponseTime !== undefined && medianResponseTime !== null && (
          <>
            <div className="incident-banner-divider"></div>
            <div className="response-time-section">
              <div className="response-time-value">
                {formatResponseTime(medianResponseTime)}
              </div>
              <div className="response-time-label">Median Response</div>
            </div>
          </>
        )}

        {/* Zoom Call Count */}
        {zoomCallCount !== undefined && (
          <>
            <div className="incident-banner-divider"></div>
            <div className="zoom-call-section">
              <div className="zoom-icon-container">
                <img
                  src={ZOOM_ICON_URL}
                  alt="Zoom calls"
                  className="zoom-icon"
                  style={{
                    opacity: zoomCallCount === 0 ? 0.4 : 1,
                    filter: zoomCallCount === 0 ? 'grayscale(100%)' : 'none',
                    transition: 'opacity 0.3s ease, filter 0.3s ease'
                  }}
                />
                {zoomCallCount > 0 && (
                  <span className="zoom-badge">{zoomCallCount}</span>
                )}
              </div>
              <div className="zoom-label">On Zoom</div>
            </div>
          </>
        )}

        {/* Incident Section - Right Aligned */}
        <div className="incident-banner-incident-section-wrapper">
          <div className="incident-banner-divider"></div>
          <div className="incident-banner-incident-section">
          {/* Incident Info */}
          <div className="incident-banner-details">
            {hasIncidents && currentIncident ? (
              <>
                <div className="incident-banner-header">
                  <span
                    className="incident-banner-severity"
                    style={{ backgroundColor: severityColor }}
                  >
                    {currentIncident.sevStatus || 'ACTIVE INCIDENT'}
                  </span>
                  {activeIncidents.length > 1 && (
                    <span className="incident-banner-counter">
                      {currentIndex + 1} / {activeIncidents.length}
                    </span>
                  )}
                </div>
                <div className="incident-banner-title">{currentIncident.incidentDetails}</div>
                <div className="incident-banner-meta">
                  {currentIncident.incidentCreatedAt && (
                    <span className="incident-meta-item">
                      Created: {formatTimestamp(currentIncident.incidentCreatedAt)}
                    </span>
                  )}
                  {currentIncident.incidentCreatedAt && currentIncident.incidentUpdatedAt && (
                    <span className="incident-meta-separator">•</span>
                  )}
                  {currentIncident.incidentUpdatedAt && (
                    <span className="incident-meta-item">
                      Updated: {formatTimestamp(currentIncident.incidentUpdatedAt)}
                    </span>
                  )}
                </div>
              </>
            ) : (
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
            )}
          </div>

          {/* Progress indicator for rotation */}
          {hasIncidents && activeIncidents.length > 1 && (
            <div className="incident-banner-progress">
              {activeIncidents.map((_, index) => (
                <div
                  key={index}
                  className={`incident-progress-dot ${
                    index === currentIndex ? 'active' : ''
                  }`}
                />
              ))}
            </div>
          )}

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
