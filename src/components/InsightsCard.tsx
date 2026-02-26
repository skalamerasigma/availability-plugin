import { useState, useEffect, useCallback, useRef } from 'react'
import { getQhmApiBaseUrl } from '../config'

const QHM_API_BASE_URL = getQhmApiBaseUrl()
const REFRESH_INTERVAL_MS = 5 * 60 * 1000
const GEMINI_BADGE_URL = 'https://res.cloudinary.com/doznvxtja/image/upload/v1772048237/Untitled_design_36_nddnlz.svg'

interface Insight {
  category: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  metric: string
}

export interface MetricsSnapshot {
  unassignedCount?: number
  avgWaitSeconds?: number
  breachedCount?: number
  chatsToday?: number
  closedToday?: number
  yesterdayChats?: number
  yesterdayClosed?: number
  activeTSEs?: number
  awayTSEs?: number
  totalCapacity?: number
  usedCapacity?: number
  availableCapacity?: number
  capacityUtilization?: number
  tsesAtCapacity?: number
  chatsByHour?: Array<{ hour: number; count: number }>
  medianResponseTime?: number | null
  activeIncidents?: Array<{ name: string; severity: string }>
  coinLeaderboard?: Array<{ tseName: string; totalCoins: number; coins5to10: number; coins10Plus: number }>
  tagBreakdown?: Array<{ tag: string; count: number }>
  customAttributeBreakdown?: Record<string, Array<{ value: string; count: number }>>
  repeatCustomers?: Array<{ email: string; name: string; count: number }>
  conversationTitles?: string[]
  conversationBodies?: string[]
  previousDayChatsByHour?: Array<{ hour: number; count: number }>
  currentETHour?: number
  enrichedAnalysis?: {
    mainQuestions?: string[]
    problemStatements?: Array<{ value: string; count: number }>
    featureGroups?: Array<{ value: string; count: number }>
    issueClassification?: Array<{ value: string; count: number }>
    sentimentStats?: { avg: number; positive: number; neutral: number; negative: number; total: number }
    complexityStats?: { avg: number; high: number; medium: number; low: number; total: number }
    highComplexityQuestions?: string[]
  }
}

interface InsightsCardProps {
  snapshot: MetricsSnapshot
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
}

export function InsightsCard({ snapshot }: InsightsCardProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(false)
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const tickerRef = useRef<HTMLDivElement>(null)

  const fetchInsights = useCallback(async (forceRefresh = false) => {
    if (!QHM_API_BASE_URL) return

    setLoading(true)

    try {
      const url = `${QHM_API_BASE_URL}/api/insights/gemini${forceRefresh ? '?refresh=true' : ''}`
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ snapshot: snapshotRef.current }),
      })

      if (!response.ok) return

      const data = await response.json()
      setInsights(data.insights || [])
    } catch (err: any) {
      console.warn('[InsightsCard] Fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const hasData = (s: MetricsSnapshot) =>
      (s.activeTSEs != null && s.activeTSEs > 0) ||
      (s.chatsToday != null && s.chatsToday > 0) ||
      (s.closedToday != null && s.closedToday > 0)

    if (hasData(snapshotRef.current)) {
      fetchInsights()
    } else {
      const waitForData = setInterval(() => {
        if (hasData(snapshotRef.current)) {
          clearInterval(waitForData)
          fetchInsights()
        }
      }, 5000)
      setTimeout(() => clearInterval(waitForData), 120_000)
    }

    const interval = setInterval(() => fetchInsights(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchInsights])

  if (insights.length === 0 && !loading) return null

  const tickerContent = insights.map((insight, idx) => {
    const color = SEVERITY_COLORS[insight.severity] || '#64748b'
    return (
      <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', marginRight: '100px' }}>
        <span style={{
          fontSize: '24px',
          fontWeight: 800,
          color,
          letterSpacing: '-0.01em',
        }}>
          {insight.title}
        </span>
        {insight.metric && (
          <span style={{
            fontSize: '20px',
            fontWeight: 700,
            color,
            background: `${color}15`,
            padding: '2px 10px',
            borderRadius: '6px',
            marginLeft: '10px',
          }}>
            {insight.metric}
          </span>
        )}
        <span style={{
          fontSize: '20px',
          color: 'var(--text-secondary, #64748b)',
          marginLeft: '10px',
          fontWeight: 500,
        }}>
          {insight.detail}
        </span>
      </span>
    )
  })

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--bg-card, rgba(255,255,255,0.6))',
        borderRadius: '8px',
        border: '1px solid var(--border-color, #e2e8f0)',
        padding: '6px 0',
        marginTop: '8px',
        cursor: 'pointer',
      }}
      onClick={() => fetchInsights(true)}
      title="Click to refresh insights"
    >
      {loading && insights.length === 0 ? (
        <div style={{
          height: '24px',
          margin: '0 12px',
          borderRadius: '4px',
          background: 'linear-gradient(90deg, var(--bg-secondary, #f1f5f9) 25%, var(--bg-card, #ffffff) 50%, var(--bg-secondary, #f1f5f9) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Gemini badge */}
          <div style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px 0 12px',
            borderRight: '1px solid var(--border-color, #e2e8f0)',
            marginRight: '12px',
          }}>
            <img
              src={GEMINI_BADGE_URL}
              alt="Powered by Gemini"
              style={{ height: '20px', width: 'auto', opacity: 0.85 }}
            />
          </div>
          {/* Scrolling ticker */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div
              ref={tickerRef}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                animation: `ticker-scroll ${Math.max(30, insights.length * 12)}s linear infinite`,
              }}
            >
              {tickerContent}
              {tickerContent}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
