import { useState, useEffect, useMemo } from 'react'
import { TEAM_MEMBERS } from '../data/teamMembers'

interface TSEConversationData {
  tseName: string
  openCount: number
  snoozedCount: number
}

interface TSEConversationTableProps {
  scheduleData?: Record<string, any[]>
  scheduleTSE?: string
}

// Generate mock conversation data for TSEs
function generateMockConversationData(): TSEConversationData[] {
  // Use TSE names from team members
  const tseNames = TEAM_MEMBERS.map(member => member.name)
  
  return tseNames.map(name => {
    // Generate random counts with some variety
    // Some TSEs will have high counts (red), some medium (yellow), some low (green)
    const random = Math.random()
    let openCount: number
    let snoozedCount: number
    
    if (random < 0.2) {
      // 20% chance of high counts (red)
      openCount = Math.floor(Math.random() * 4) + 6 // 6-9
      snoozedCount = Math.floor(Math.random() * 3) + 4 // 4-6
    } else if (random < 0.5) {
      // 30% chance of medium counts (yellow)
      openCount = Math.floor(Math.random() * 3) + 3 // 3-5
      snoozedCount = Math.floor(Math.random() * 2) + 2 // 2-3
    } else {
      // 50% chance of low counts (green)
      openCount = Math.floor(Math.random() * 3) // 0-2
      snoozedCount = Math.floor(Math.random() * 2) // 0-1
    }
    
    return {
      tseName: name,
      openCount,
      snoozedCount,
    }
  })
}

export function TSEConversationTable({ scheduleData, scheduleTSE }: TSEConversationTableProps) {
  const [conversationData, setConversationData] = useState<TSEConversationData[]>([])
  const [loading, setLoading] = useState(true)
  
  // Generate mock data
  const mockData = useMemo(() => generateMockConversationData(), [])

  // Use mock data for now
  useEffect(() => {
    // Sort by sum of open + snoozed (descending)
    const sortedData = [...mockData].sort((a, b) => {
      const sumA = a.openCount + a.snoozedCount
      const sumB = b.openCount + b.snoozedCount
      return sumB - sumA
    })
    
    setConversationData(sortedData)
    setLoading(false)
  }, [mockData])

  // Color coding function
  const getValueColor = (value: number): string => {
    if (value > 5) return '#ef4444' // red
    if (value >= 3) return '#eab308' // yellow
    return '#22c55e' // green
  }

  if (loading && conversationData.length === 0) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '16px'
      }}>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading conversation data...</div>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '13px'
      }}>
        <thead>
          <tr style={{
            borderBottom: '2px solid #e5e7eb',
            position: 'sticky',
            top: 0,
            background: '#fff',
            zIndex: 1
          }}>
            <th style={{
              textAlign: 'left',
              padding: '10px 12px',
              fontWeight: 600,
              color: '#374151',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}>
              TSE name
            </th>
            <th style={{
              textAlign: 'right',
              padding: '10px 12px',
              fontWeight: 600,
              color: '#374151',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}>
              Open
            </th>
            <th style={{
              textAlign: 'right',
              padding: '10px 12px',
              fontWeight: 600,
              color: '#374151',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}>
              Snoozed
            </th>
          </tr>
        </thead>
        <tbody>
          {conversationData.map((row, index) => (
            <tr
              key={row.tseName}
              style={{
                borderBottom: index < conversationData.length - 1 ? '1px solid #f3f4f6' : 'none'
              }}
            >
              <td style={{
                padding: '8px 12px',
                color: '#111827',
                fontWeight: 500,
                fontSize: '13px'
              }}>
                {row.tseName}
              </td>
              <td style={{
                padding: '8px 12px',
                textAlign: 'right',
                color: getValueColor(row.openCount),
                fontWeight: 600,
                fontSize: '13px'
              }}>
                {row.openCount}
              </td>
              <td style={{
                padding: '8px 12px',
                textAlign: 'right',
                color: getValueColor(row.snoozedCount),
                fontWeight: 600,
                fontSize: '13px'
              }}>
                {row.snoozedCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
