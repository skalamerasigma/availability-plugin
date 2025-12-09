import { useState, useEffect } from 'react'
import type { AgentData, AgentStatus } from '../types'

interface ApiAgent {
  id: string
  name: string
  avatar?: string
  status: string
  timezone: string
}

/**
 * Hook to fetch agent data from an external API
 * Replace the URL with your actual API endpoint
 */
export function useAgentDataFromApi(apiUrl: string | undefined, refreshInterval = 30000) {
  const [agents, setAgents] = useState<AgentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiUrl) {
      setLoading(false)
      return
    }

    async function fetchAgents() {
      if (!apiUrl) return
      try {
        const response = await fetch(apiUrl)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        
        const data: ApiAgent[] = await response.json()
        
        const mapped: AgentData[] = data.map((agent) => ({
          id: agent.id,
          name: agent.name,
          avatar: agent.avatar || `https://i.pravatar.cc/40?u=${agent.id}`,
          status: normalizeStatus(agent.status),
          timezone: agent.timezone,
        }))

        setAgents(mapped)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch')
      } finally {
        setLoading(false)
      }
    }

    // Initial fetch
    fetchAgents()

    // Poll for updates
    const interval = setInterval(fetchAgents, refreshInterval)
    return () => clearInterval(interval)
  }, [apiUrl, refreshInterval])

  return { agents, loading, error }
}

function normalizeStatus(status: string): AgentStatus {
  const normalized = status?.toLowerCase().trim()
  const statusMap: Record<string, AgentStatus> = {
    'away': 'away',
    'offline': 'away',
    'busy': 'away',
    'on a call': 'call',
    'call': 'call',
    'on call': 'call',
    'in call': 'call',
    'lunch': 'lunch',
    'lunch break': 'lunch',
    'break': 'lunch',
    'chat': 'chat',
    'chatting': 'chat',
    'available': 'chat',
    'online': 'chat',
    'closing': 'closing',
    'wrap-up': 'closing',
    'after call': 'closing',
  }
  return statusMap[normalized] || 'away'
}

