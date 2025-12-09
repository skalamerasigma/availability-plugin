export type AgentStatus = 'away' | 'call' | 'lunch' | 'chat' | 'closing'

export interface City {
  name: string
  code: string
  timezone: string
  startHour: number
  endHour: number
  zoneIdx: number
}

export interface AgentData {
  id: string
  name: string
  avatar: string
  status: AgentStatus
  timezone: string
  statusEmoji?: string // Actual emoji from Intercom (🟢, ☕, 🚫, etc.)
  statusLabel?: string // Full status text from Intercom
}

export interface Overlap {
  start: number
  end: number
}

export interface StatusConfig {
  key: AgentStatus
  label: string
  color: string
  icon: string
}

