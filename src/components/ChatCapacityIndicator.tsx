import { useMemo } from 'react'

interface TSEConversationData {
  tseName: string
  fullName: string
  tseId: string
  openCount: number
  snoozedCount: number
  closedCount: number
  chatsTakenCount: number
}

interface ChatCapacityIndicatorProps {
  tseConversationData: TSEConversationData[]
  unassignedConversations: any[]
  activeTSEsCount: number // Number of currently active TSEs (from schedule/status)
}

const MAX_CHATS_PER_TSE = 6

export function ChatCapacityIndicator({ 
  tseConversationData, 
  unassignedConversations,
  activeTSEsCount
}: ChatCapacityIndicatorProps) {
  const capacityMetrics = useMemo(() => {
    // Use the active TSEs count from schedule/status (not just those with conversations)
    // This represents TSEs who are currently scheduled and not away
    const totalActiveTSEs = activeTSEsCount
    
    // Calculate total capacity (active TSEs * 6)
    const totalCapacity = totalActiveTSEs * MAX_CHATS_PER_TSE
    
    // Calculate used capacity (sum of all open chats)
    const usedCapacity = tseConversationData.reduce((sum, tse) => sum + tse.openCount, 0)
    
    // Calculate available capacity
    // Note: This can be negative if away TSEs have many chats assigned
    // Negative means we're over capacity and can't assign new chats
    const availableCapacity = totalCapacity - usedCapacity
    
    // Get unassigned queue size
    const unassignedQueueSize = unassignedConversations.length
    
    // Calculate how many chats can be assigned right now
    const canAssignNow = Math.min(availableCapacity, unassignedQueueSize)
    
    // Calculate how many chats are waiting (can't be assigned due to capacity)
    const waitingDueToCapacity = Math.max(0, unassignedQueueSize - availableCapacity)
    
    // Calculate capacity utilization percentage
    // Can exceed 100% if away TSEs have many chats assigned
    const utilizationPercent = totalCapacity > 0 
      ? (usedCapacity / totalCapacity) * 100
      : usedCapacity > 0 ? 100 : 0
    
    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (waitingDueToCapacity > 0 || availableCapacity < 0) {
      status = 'critical'
    } else if (utilizationPercent >= 80 || availableCapacity <= 2) {
      status = 'warning'
    }
    
    return {
      totalActiveTSEs,
      totalCapacity,
      usedCapacity,
      availableCapacity,
      unassignedQueueSize,
      canAssignNow,
      waitingDueToCapacity,
      utilizationPercent,
      status
    }
  }, [tseConversationData, unassignedConversations])

  const { 
    totalActiveTSEs,
    totalCapacity,
    usedCapacity,
    availableCapacity,
    unassignedQueueSize,
    canAssignNow,
    waitingDueToCapacity,
    utilizationPercent,
    status
  } = capacityMetrics

  // Don't render if no active TSEs
  if (totalActiveTSEs === 0) {
    return null
  }

  // Color scheme based on status
  const getStatusColor = () => {
    switch (status) {
      case 'critical':
        return '#ef4444' // red
      case 'warning':
        return '#f59e0b' // amber
      case 'healthy':
        return '#10b981' // green
    }
  }

  const getStatusBgColor = () => {
    switch (status) {
      case 'critical':
        return '#fee2e2' // light red
      case 'warning':
        return '#fef3c7' // light amber
      case 'healthy':
        return '#d1fae5' // light green
    }
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '24px',
      border: `2px solid ${getStatusColor()}`,
      boxShadow: 'var(--shadow-md)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>📊</span>
          Chat Capacity
        </h3>
        <div style={{
          padding: '4px 12px',
          borderRadius: '12px',
          background: getStatusBgColor(),
          color: getStatusColor(),
          fontSize: '12px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {status === 'critical' ? '⚠️ Critical' : status === 'warning' ? '⚡ Warning' : '✓ Healthy'}
        </div>
      </div>

      {/* Capacity Bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
          fontSize: '13px',
          color: 'var(--text-secondary)'
        }}>
          <span>Capacity Utilization</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {usedCapacity} / {totalCapacity} ({Math.round(utilizationPercent)}%)
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '24px',
          background: 'var(--border-color-light)',
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            width: `${utilizationPercent}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${getStatusColor()} 0%, ${getStatusColor()}dd 100%)`,
            transition: 'width 0.3s ease',
            borderRadius: '12px'
          }} />
          {/* Capacity markers */}
          {[0, 25, 50, 75, 100].map(percent => (
            <div
              key={percent}
              style={{
                position: 'absolute',
                left: `${percent}%`,
                top: 0,
                width: '1px',
                height: '100%',
                background: percent === 0 || percent === 100 ? 'transparent' : 'rgba(0, 0, 0, 0.1)',
                pointerEvents: 'none'
              }}
            />
          ))}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        marginBottom: '12px'
      }}>
        {/* Available Capacity */}
        <div style={{
          padding: '12px',
          background: 'var(--bg-card-secondary)',
          borderRadius: '6px',
          border: '1px solid var(--border-color-light)'
        }}>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginBottom: '4px',
            fontWeight: 500
          }}>
            Available Capacity
          </div>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: availableCapacity > 5 ? '#10b981' : availableCapacity > 2 ? '#f59e0b' : availableCapacity >= 0 ? '#ef4444' : '#dc2626'
          }}>
            {availableCapacity >= 0 ? availableCapacity : `-${Math.abs(availableCapacity)}`}
          </div>
          <div style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            marginTop: '2px'
          }}>
            {totalActiveTSEs} active TSE{totalActiveTSEs !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Unassigned Queue */}
        <div style={{
          padding: '12px',
          background: 'var(--bg-card-secondary)',
          borderRadius: '6px',
          border: '1px solid var(--border-color-light)'
        }}>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginBottom: '4px',
            fontWeight: 500
          }}>
            Unassigned Queue
          </div>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: unassignedQueueSize === 0 ? '#10b981' : unassignedQueueSize > availableCapacity ? '#ef4444' : '#6366f1'
          }}>
            {unassignedQueueSize}
          </div>
          <div style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            marginTop: '2px'
          }}>
            waiting for assignment
          </div>
        </div>
      </div>

      {/* Assignment Status */}
      {waitingDueToCapacity > 0 ? (
        <div style={{
          padding: '12px',
          background: '#fee2e2',
          borderRadius: '6px',
          border: '1px solid #ef4444',
          marginTop: '8px'
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#991b1b',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>🚨</span>
            Capacity Exceeded
          </div>
          <div style={{
            fontSize: '12px',
            color: '#991b1b',
            lineHeight: '1.5'
          }}>
            <strong>{waitingDueToCapacity}</strong> chat{waitingDueToCapacity !== 1 ? 's' : ''} cannot be assigned right now because all TSEs are at capacity (6 chats each). Wait times will increase until capacity becomes available.
          </div>
        </div>
      ) : canAssignNow > 0 ? (
        <div style={{
          padding: '12px',
          background: '#d1fae5',
          borderRadius: '6px',
          border: '1px solid #10b981',
          marginTop: '8px'
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#065f46',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>✓</span>
            Capacity Available
          </div>
          <div style={{
            fontSize: '12px',
            color: '#065f46',
            lineHeight: '1.5'
          }}>
            <strong>{canAssignNow}</strong> chat{canAssignNow !== 1 ? 's' : ''} can be assigned immediately.
          </div>
        </div>
      ) : unassignedQueueSize === 0 ? (
        <div style={{
          padding: '12px',
          background: '#dbeafe',
          borderRadius: '6px',
          border: '1px solid #3b82f6',
          marginTop: '8px'
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#1e40af',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>✓</span>
            No unassigned chats in queue
          </div>
        </div>
      ) : null}

      {/* Breakdown */}
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid var(--border-color-light)',
        fontSize: '11px',
        color: 'var(--text-muted)',
        lineHeight: '1.6'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Total Capacity:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {totalCapacity} chats ({totalActiveTSEs} TSEs × {MAX_CHATS_PER_TSE})
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Currently Used:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {usedCapacity} chats
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Available:</span>
          <span style={{ fontWeight: 600, color: availableCapacity > 0 ? '#10b981' : availableCapacity >= 0 ? '#ef4444' : '#dc2626' }}>
            {availableCapacity >= 0 ? `${availableCapacity} chats` : `-${Math.abs(availableCapacity)} chats (over capacity)`}
          </span>
        </div>
      </div>
    </div>
  )
}
