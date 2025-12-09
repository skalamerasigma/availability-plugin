import type { AgentData, AgentStatus } from '../types'

interface AgentCardProps {
  agent: AgentData
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string }> = {
  away: { label: 'Away', color: '#737373' },
  call: { label: 'On a call', color: '#1e90ff' },
  lunch: { label: 'Lunch Break', color: '#f4b400' },
  chat: { label: 'Chatting', color: '#00c853' },
  closing: { label: 'Closing', color: '#9c27b0' },
}

export function AgentCard({ agent }: AgentCardProps) {
  const statusConfig = STATUS_CONFIG[agent.status]
  
  // Use the actual Intercom emoji if available
  const displayEmoji = agent.statusEmoji
  const displayLabel = agent.statusLabel || statusConfig.label
  
  // Build className with ring color
  const ringClass = agent.ringColor ? `ring-${agent.ringColor}` : 'ring-blue'
  const classNames = ['agent', ringClass].join(' ')
  
  // Add warning indicator for red/yellow rings
  const isWarning = agent.ringColor === 'red' || agent.ringColor === 'yellow'

  return (
    <div
      className={classNames}
      style={{ backgroundImage: `url("${agent.avatar}")` }}
      title={`${agent.name} - ${displayLabel}${isWarning ? ' ⚠️ Scheduled for chat' : ''}`}
    >
      <div
        className="status-badge emoji-badge"
        role="img"
        aria-label={displayLabel}
      >
        {displayEmoji || '🏡'}
      </div>
    </div>
  )
}
