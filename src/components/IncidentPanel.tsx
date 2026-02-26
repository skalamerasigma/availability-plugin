import { useState, useEffect, useCallback } from 'react'
import { getQhmApiBaseUrl } from '../config'
import { TEAM_MEMBERS } from '../data/teamMembers'

const QHM_API_BASE_URL = getQhmApiBaseUrl()
const INCIDENT_IO_LOGO = 'https://res.cloudinary.com/doznvxtja/image/upload/v1769535474/Untitled_design_30_w9bwzy.svg'
const REFRESH_INTERVAL = 5 * 60 * 1000

interface Incident {
  id: string
  name: string
  severity: string
  status: string
  createdAt: string
  permalink?: string
  incidentLead?: string | null
}

interface OnCallPerson {
  name: string
  email?: string
  scheduleName: string
  scheduleType: string
}

const SCHEDULE_BADGES: Record<string, { label: string; color: string }> = {
  'TSE Manager - Escalations': { label: 'ESC', color: '#ef4444' },
  'TSE Manager - Incidents': { label: 'INC', color: '#f59e0b' },
  '3 - Support On-Call Primary 24x7': { label: 'PRI', color: '#3b82f6' },
  '4 - Support On-Call Backup 24x7': { label: 'BAK', color: '#6366f1' },
  'TSE - Tier 3': { label: 'T3', color: '#8b5cf6' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'just now'
  if (hours === 1) return '1h ago'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getAvatar(person: OnCallPerson): string | undefined {
  const firstName = person.name.split(' ')[0].toLowerCase()
  const member = TEAM_MEMBERS.find(m => m.name.toLowerCase() === firstName || m.id === firstName)
  return member?.avatar
}

interface IncidentPanelProps {
  intercomTeamMembers?: Array<{ id: string | number; name: string; avatar?: { image_url?: string } }>
}

export function IncidentPanel({ intercomTeamMembers = [] }: IncidentPanelProps) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [onCallData, setOnCallData] = useState<OnCallPerson[]>([])

  const fetchData = useCallback(async () => {
    if (!QHM_API_BASE_URL) return
    try {
      const [incRes, ocRes] = await Promise.all([
        fetch(`${QHM_API_BASE_URL}/api/incident-io/incidents`, { credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch(`${QHM_API_BASE_URL}/api/incident-io/on-call`, { credentials: 'include', headers: { Accept: 'application/json' } }),
      ])
      if (incRes.ok) {
        const d = await incRes.json()
        setIncidents(d.incidents || [])
      }
      if (ocRes.ok) {
        const d = await ocRes.json()
        setOnCallData(d.onCall || [])
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  const getPersonAvatar = (person: OnCallPerson): string | undefined => {
    const staticAvatar = getAvatar(person)
    if (staticAvatar) return staticAvatar
    if (intercomTeamMembers.length > 0) {
      const firstName = person.name.split(' ')[0].toLowerCase()
      const member = intercomTeamMembers.find(m => m.name.toLowerCase().startsWith(firstName))
      if (member?.avatar?.image_url) return member.avatar.image_url
    }
    return undefined
  }

  return (
    <div style={{
      background: 'var(--bg-card, #ffffff)',
      borderRadius: '12px',
      padding: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid var(--border-color, #e2e8f0)',
      marginTop: '12px',
    }}>
      {/* Logo - centered */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '-4px 0 -2px',
      }}>
        <img src={INCIDENT_IO_LOGO} alt="Incident.io" style={{ width: '84px', height: '84px' }} />
      </div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginBottom: incidents.length > 0 ? '10px' : '4px',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #1e293b)', letterSpacing: '-0.01em' }}>
          Active Incidents
        </span>
        <span style={{
          fontSize: '33px', fontWeight: 700,
          color: incidents.length > 0 ? '#ef4444' : '#22c55e',
          background: incidents.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          padding: '2px 12px', borderRadius: '12px', lineHeight: 1,
        }}>
          {incidents.length}
        </span>
      </div>

      {/* Incidents list */}
      {incidents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4px 0', fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>
          {'\u2705'} No active SEV1 incidents
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
          {incidents.map((inc) => (
            <a
              key={inc.id}
              href={inc.permalink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', padding: '8px 10px', borderRadius: '8px',
                borderLeft: '3px solid #ef4444', background: 'rgba(239,68,68,0.05)',
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '13px', fontWeight: 700, color: '#ffffff', background: '#ef4444',
                  padding: '2px 8px', borderRadius: '5px', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {inc.severity || 'SEV1'}
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: 600, color: '#fff',
                  background: inc.status.toLowerCase().includes('progress') ? '#3b82f6'
                    : inc.status.toLowerCase().includes('review') ? '#8b5cf6'
                    : inc.status.toLowerCase().includes('triage') ? '#f59e0b'
                    : inc.status.toLowerCase().includes('resolved') ? '#22c55e'
                    : '#6366f1',
                  padding: '2px 8px', borderRadius: '5px',
                }}>
                  {inc.status}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary, #94a3b8)', marginLeft: 'auto', fontWeight: 500 }}>
                  {timeAgo(inc.createdAt)}
                </span>
              </div>
              <div style={{
                fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #1e293b)',
                lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {inc.name}
              </div>
              {inc.incidentLead && (
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary, #94a3b8)', marginTop: '2px', fontWeight: 500 }}>
                  Lead: {inc.incidentLead}
                </div>
              )}
            </a>
          ))}
        </div>
      )}

      {/* On-Call Section */}
      {onCallData.length > 0 && (
        <div style={{
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
        }}>
          <div style={{
            fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', textAlign: 'center',
          }}>
            On-Call
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            justifyItems: 'center',
          }}>
            {onCallData.map((person, idx) => {
              const avatar = getPersonAvatar(person)
              const badge = SCHEDULE_BADGES[person.scheduleName] || { label: 'OC', color: '#6366f1' }
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ position: 'relative' }}>
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={person.name}
                        style={{ width: '56px', height: '56px', borderRadius: '50%', border: `2px solid ${badge.color}`, objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: '56px', height: '56px', borderRadius: '50%', border: `2px solid ${badge.color}`,
                        background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '18px', fontWeight: 700, color: '#64748b',
                      }}>
                        {person.name.charAt(0)}
                      </div>
                    )}
                    <span style={{
                      position: 'absolute', bottom: '-2px', left: '50%', transform: 'translateX(-50%)',
                      fontSize: '8px', fontWeight: 700, color: '#fff', background: badge.color,
                      padding: '1px 5px', borderRadius: '4px', whiteSpace: 'nowrap',
                    }}>
                      {badge.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textAlign: 'center', lineHeight: '1.2' }}>
                    {person.name.split(' ')[0]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
