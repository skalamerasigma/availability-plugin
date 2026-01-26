import { useEffect, useMemo, useState } from 'react'

interface TrendingData {
  direction: 'up' | 'down'
  percentage: number
  yesterdayValue?: number
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
}

interface Incident {
  incidentDetails: string
  sevStatus: string
  incidentCreatedAt: string
  incidentUpdatedAt: string
}

const INCIDENT_IO_LOGO_URL = 'https://res.cloudinary.com/doznvxtja/image/upload/v1769419778/Untitled_design_29_jomb69.svg'
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
}: IncidentBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

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

  // Don't render if no active incidents
  if (activeIncidents.length === 0) {
    console.log('[IncidentBanner] No active incidents, not rendering')
    return null
  }

  console.log('[IncidentBanner] Rendering banner with', activeIncidents.length, 'incidents')

  const currentIncident = activeIncidents[currentIndex]

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

  const severityColor = getSeverityColor(currentIncident.sevStatus)

  return (
    <div className="incident-banner">
      <div className="incident-banner-content">
        {/* Dashboard Logo */}
        <div className="dashboard-logo">
          <img
            src="https://res.cloudinary.com/doznvxtja/image/upload/v1769422949/SQL_13_oeoajg.svg"
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
                </div>
              )}
            </div>
          </>
        )}

        {/* Vertical Divider */}
        <div className="incident-banner-divider"></div>

        {/* Incident Section - Right Aligned */}
        <div className="incident-banner-incident-section">
          {/* Incident.io Logo */}
          <div className="incident-banner-logo">
            <img
              src={INCIDENT_IO_LOGO_URL}
              alt="Incident.io"
            />
          </div>

          {/* Incident Info */}
          <div className="incident-banner-details">
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
          </div>

          {/* Progress indicator for rotation */}
          {activeIncidents.length > 1 && (
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
        </div>
      </div>
    </div>
  )
}
