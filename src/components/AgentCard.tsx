import type { AgentData, AgentStatus } from '../types'
import { getTSECapacity } from '../data/tseCapacityExceptions'

interface AgentCardProps {
  agent: AgentData
  needsSpacing?: boolean
  isFirstInGroup?: boolean
  openChatCount?: number // Number of open chats for this TSE
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string }> = {
  away: { label: 'Away', color: '#737373' },
  call: { label: 'On a call', color: '#1e90ff' },
  lunch: { label: 'Lunch Break', color: '#f4b400' },
  chat: { label: 'Chatting', color: '#00c853' },
  closing: { label: 'Closing', color: '#9c27b0' },
}

const ZOOM_SVG_URL = 'https://res.cloudinary.com/doznvxtja/image/upload/v1765391289/1996_Nintendo_16_bbdtpn.svg'

export function AgentCard({ agent, needsSpacing = false, isFirstInGroup = false, openChatCount }: AgentCardProps) {
  const statusConfig = STATUS_CONFIG[agent.status]
  
  // Use the actual Intercom emoji if available, but replace lunch emoji
  let displayEmoji = agent.statusEmoji
  // Replace coffee emoji with pizza ONLY for actual lunch (not breaks)
  // Note: Both "lunch" and "on a break" map to 'lunch' status, so we check the label text
  if (displayEmoji === '☕' && agent.statusLabel?.toLowerCase().includes('lunch')) {
    displayEmoji = '🍕'
  }
  // Replace lunch emoji variations
  if (displayEmoji === '🥪' || (agent.statusLabel?.includes('🥪'))) {
    displayEmoji = '🍕'
  }
  // Replace emoji with calendar for "In a meeting" status
  if (agent.statusLabel?.includes('🗓️ In a meeting') || agent.statusLabel?.includes('In a meeting')) {
    displayEmoji = '🗓️'
  }
  // Replace emoji with bug for "Doing Bug Triage/Escalation" status
  if (agent.statusLabel?.includes('🐛 Doing Bug Triage/Escalation') || agent.statusLabel?.includes('Doing Bug Triage/Escalation')) {
    displayEmoji = '🐛'
  }
  // Replace emoji with teacher for "Coaching / Shadowing" status
  if (agent.statusLabel?.includes('👨‍🏫 Coaching / Shadowing') || agent.statusLabel?.includes('Coaching / Shadowing')) {
    displayEmoji = '👨‍🏫'
  }
  
  const displayLabel = agent.statusLabel || statusConfig.label
  
  // Build className with ring color
  const ringClass = agent.ringColor ? `ring-${agent.ringColor}` : 'ring-purple'
  const classes = ['agent', ringClass]
  if (needsSpacing) classes.push('agent-spacer')
  if (isFirstInGroup) classes.push('agent-first-in-group')
  const classNames = classes.join(' ')
  
  // Add warning indicator for red/yellow rings
  const isWarning = agent.ringColor === 'red' || agent.ringColor === 'yellow'
  
  // Check if this is a Zoom call (use SVG instead of emoji)
  const isZoomCall = agent.ringColor === 'zoom' || 
                     (agent.statusLabel?.toLowerCase().includes('zoom') && agent.statusLabel?.includes('🖥'))

  // Format minutes display
  const formatMinutes = (minutes?: number): string => {
    if (minutes === undefined || minutes === null) return ''
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`
  }

  const minutesText = formatMinutes(agent.minutesInStatus)
  
  // Check if TSE is at capacity (at or above their specific limit)
  const tseCapacityLimit = getTSECapacity(agent.name)
  const isAtCapacity = openChatCount !== undefined && openChatCount >= tseCapacityLimit

  return (
    <div
      className={classNames}
      style={{ backgroundImage: `url("${agent.avatar}")` }}
      title={`${agent.name} - ${displayLabel}${minutesText ? ` (${minutesText})` : ''}${isWarning ? ' ⚠️ Scheduled for chat' : ''}${isAtCapacity ? ' 🚫 @ Capacity' : ''}`}
    >
      <div
        className="status-badge emoji-badge"
        role="img"
        aria-label={displayLabel}
      >
        {isZoomCall ? (
          <img 
            src={ZOOM_SVG_URL} 
            alt="Zoom call" 
            style={{ width: '20px', height: '20px', objectFit: 'contain' }}
          />
        ) : (
          displayEmoji || '🏡'
        )}
      </div>
      {isAtCapacity && (
        <div 
          className="capacity-badge"
          style={{
            position: 'absolute',
            bottom: '-8px',
            right: '-8px',
            background: '#ef4444',
            color: '#fff',
            fontSize: '9px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '10px',
            whiteSpace: 'nowrap',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            border: '2px solid #fff'
          }}
        >
          @ Capacity
        </div>
      )}
      {minutesText && (
        <div className="agent-minutes">
          {minutesText}
        </div>
      )}
    </div>
  )
}
