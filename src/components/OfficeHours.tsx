import { useMemo } from 'react'

interface OfficeHoursProps {
  officeHoursData: Record<string, unknown> | null | undefined
  tseTopicTimeColumn: string | undefined
  statusColumn: string | undefined
}

interface OfficeHourEntry {
  tseTopicTime: string
  status: string
}

export function OfficeHours({
  officeHoursData,
  tseTopicTimeColumn,
  statusColumn,
}: OfficeHoursProps) {
  const entries = useMemo(() => {
    if (!officeHoursData || !tseTopicTimeColumn) {
      return []
    }

    const tseTopicTimeData = officeHoursData[tseTopicTimeColumn] as string[] | undefined
    const statusData = statusColumn
      ? (officeHoursData[statusColumn] as string[] | undefined)
      : undefined

    if (!tseTopicTimeData || tseTopicTimeData.length === 0) {
      return []
    }

    const result: OfficeHourEntry[] = []
    tseTopicTimeData.forEach((value, index) => {
      if (value && value.trim()) {
        result.push({
          tseTopicTime: value.trim(),
          status: statusData?.[index] || '',
        })
      }
    })

    return result
  }, [officeHoursData, tseTopicTimeColumn, statusColumn])

  // Determine color based on status
  const getStatusColor = (status: string): string => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('active now') || statusLower.includes('🟢')) {
      return '#14b8a6' // teal/greenish-blue for active
    }
    if (statusLower.includes('upcoming') || statusLower.includes('⏰')) {
      return '#14b8a6' // teal/greenish-blue for upcoming
    }
    if (statusLower.includes('completed') || statusLower.includes('✅')) {
      return '#f97316' // orange for completed
    }
    // Default to teal if status is unclear
    return '#14b8a6'
  }

  if (entries.length === 0) {
    return null
  }

  return (
    <div className="office-hours">
      <h3 className="office-hours-title">
        Office Hours (ET)
        <span className="office-hours-dropdown">▼</span>
      </h3>
      <div className="office-hours-list">
        {entries.map((entry, index) => (
          <div
            key={index}
            className="office-hours-item"
            style={{ color: getStatusColor(entry.status) }}
          >
            {entry.tseTopicTime}
          </div>
        ))}
      </div>
    </div>
  )
}
