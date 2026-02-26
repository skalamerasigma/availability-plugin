import { useState, useEffect, useCallback, useRef } from 'react'
import { getQhmApiBaseUrl, isDebugEnabled } from '../config'

const API_BASE_URL = getQhmApiBaseUrl()
const LOG = isDebugEnabled()
const POLL_INTERVAL_MS = 10_000
const UNSEEN_TTL_MS = 10 * 60 * 1000 // expire entries not seen in any poll for 10 minutes

export interface WebhookAwayStatusEntry {
  status: string
  updatedAt: number
}

export interface WebhookAwayStatus {
  byId: Record<string, WebhookAwayStatusEntry>
  byName: Record<string, WebhookAwayStatusEntry>
  fetchedAt?: string
}

interface TrackedEntry extends WebhookAwayStatusEntry {
  lastSeenAt: number
}

function trackedRecordsEqual(
  a: Record<string, TrackedEntry>,
  b: Record<string, TrackedEntry>,
): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const k of keysA) {
    const ea = a[k]
    const eb = b[k]
    if (!eb) return false
    if (ea.status !== eb.status || ea.updatedAt !== eb.updatedAt) return false
  }
  return true
}

function toPublic(tracked: Record<string, TrackedEntry>): Record<string, WebhookAwayStatusEntry> {
  const out: Record<string, WebhookAwayStatusEntry> = {}
  for (const [k, v] of Object.entries(tracked)) {
    out[k] = { status: v.status, updatedAt: v.updatedAt }
  }
  return out
}

/**
 * Merges incoming webhook-derived away statuses with previously known data.
 *
 * - Entries are kept across polls even when a different Cloud Run instance
 *   (that lacks the in-memory webhook store) is hit.
 * - TTL is based on `lastSeenAt` (when an entry was last present in a poll
 *   response), NOT `updatedAt` (when the status originally changed). This
 *   prevents entries for people who changed status hours ago from expiring
 *   prematurely while the serving instance still reports them.
 * - An entry is only replaced if the incoming one has a newer `updatedAt`.
 */
export function useWebhookAwayStatus(enabled = true) {
  const [data, setData] = useState<WebhookAwayStatus>({ byId: {}, byName: {} })
  const storeById = useRef<Record<string, TrackedEntry>>({})
  const storeByName = useRef<Record<string, TrackedEntry>>({})

  const fetchStatuses = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/intercom/away-status`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        if (res.status === 401 && LOG) console.log('[webhook] 401, skipping')
        return
      }
      const json = await res.json()
      const inById: Record<string, WebhookAwayStatusEntry> = json.byId || {}
      const inByName: Record<string, WebhookAwayStatusEntry> = json.byName || {}
      const now = Date.now()
      const incomingIdKeys = new Set(Object.keys(inById))
      const incomingNameKeys = new Set(Object.keys(inByName))

      // --- merge byId ---
      const nextById: Record<string, TrackedEntry> = {}
      // keep previous entries within TTL that aren't in this response
      for (const [k, v] of Object.entries(storeById.current)) {
        if (incomingIdKeys.has(k)) continue
        if (now - v.lastSeenAt < UNSEEN_TTL_MS) nextById[k] = v
      }
      // layer in incoming entries
      for (const [k, v] of Object.entries(inById)) {
        const existing = nextById[k]
        if (!existing || v.updatedAt >= existing.updatedAt) {
          nextById[k] = { ...v, lastSeenAt: now }
        } else {
          nextById[k] = { ...existing, lastSeenAt: now }
        }
      }

      // --- merge byName ---
      const nextByName: Record<string, TrackedEntry> = {}
      for (const [k, v] of Object.entries(storeByName.current)) {
        if (incomingNameKeys.has(k)) continue
        if (now - v.lastSeenAt < UNSEEN_TTL_MS) nextByName[k] = v
      }
      for (const [k, v] of Object.entries(inByName)) {
        const existing = nextByName[k]
        if (!existing || v.updatedAt >= existing.updatedAt) {
          nextByName[k] = { ...v, lastSeenAt: now }
        } else {
          nextByName[k] = { ...existing, lastSeenAt: now }
        }
      }

      const changed =
        !trackedRecordsEqual(storeById.current, nextById) ||
        !trackedRecordsEqual(storeByName.current, nextByName)

      storeById.current = nextById
      storeByName.current = nextByName

      if (changed) {
        setData({ byId: toPublic(nextById), byName: toPublic(nextByName), fetchedAt: json.fetchedAt })
        if (LOG) console.log('[webhook] updated —', Object.keys(nextByName).length, 'entries')
      } else if (LOG) {
        console.log('[webhook] no changes')
      }
    } catch (err) {
      if (LOG) console.warn('[webhook] fetch error:', err)
    }
  }, [enabled])

  useEffect(() => {
    fetchStatuses()
    if (!enabled) return
    const interval = setInterval(fetchStatuses, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchStatuses, enabled])

  return { data, refetch: fetchStatuses }
}
