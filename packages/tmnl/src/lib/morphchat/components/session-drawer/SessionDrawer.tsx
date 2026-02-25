import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import {
  VANTA_ANIMATION,
  VANTA_SPACING,
  VANTA_TYPOGRAPHY,
} from '@/components/portal/tokens'
import { SessionCard, type SessionCardSession } from './SessionCard'

export interface SessionDrawerProps {
  isOpen: boolean
  onClose: () => void
  onResumeSession: (sessionId: string) => void
  onNewSession: () => void
  currentSessionId: string | null
  instanceId: string
  width?: number
}

type SessionFilter = 'all' | 'starred' | 'archived'

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'

function storageKey(instanceId: string): string {
  return `tmnl:morphchat:sessions:${instanceId}`
}

function normalizeSession(input: unknown): SessionCardSession | null {
  if (!input || typeof input !== 'object') return null

  const value = input as Partial<SessionCardSession>
  if (!value.sessionId || typeof value.sessionId !== 'string') return null

  const now = Date.now()

  return {
    sessionId: value.sessionId,
    name: typeof value.name === 'string' ? value.name : '',
    autoTitle: typeof value.autoTitle === 'string' ? value.autoTitle : 'Untitled session',
    previewSnippet: typeof value.previewSnippet === 'string' ? value.previewSnippet : '',
    messageCount: typeof value.messageCount === 'number' ? value.messageCount : 0,
    modelId: typeof value.modelId === 'string' ? value.modelId : 'unknown',
    provider: typeof value.provider === 'string' ? value.provider : 'pi',
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    status: value.status === 'archived' || value.status === 'starred' ? value.status : 'active',
    starred: typeof value.starred === 'boolean' ? value.starred : false,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
  }
}

function readSessionIndex(indexKey: string): SessionCardSession[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(indexKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry) => normalizeSession(entry))
      .filter((entry): entry is SessionCardSession => entry !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

function persistSessionIndex(indexKey: string, sessions: ReadonlyArray<SessionCardSession>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(indexKey, JSON.stringify(sessions))
}

function makeSessionStub(sessionId: string, timestamp = Date.now()): SessionCardSession {
  return {
    sessionId,
    name: '',
    autoTitle: `Session ${sessionId.slice(0, 8)}`,
    previewSnippet: 'New session ready.',
    messageCount: 0,
    modelId: 'unknown',
    provider: 'pi',
    tags: [],
    status: 'active',
    starred: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function updateSession(
  sessions: ReadonlyArray<SessionCardSession>,
  sessionId: string,
  updater: (session: SessionCardSession) => SessionCardSession,
): SessionCardSession[] {
  return sessions.map((session) => (
    session.sessionId === sessionId ? updater(session) : session
  ))
}

function sortByUpdatedAt(sessions: ReadonlyArray<SessionCardSession>): SessionCardSession[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function SessionDrawer({
  isOpen,
  onClose,
  onResumeSession,
  onNewSession,
  currentSessionId,
  instanceId,
  width = 380,
}: SessionDrawerProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SessionFilter>('all')
  const [sessions, setSessions] = useState<SessionCardSession[]>([])

  const indexKey = useMemo(() => storageKey(instanceId), [instanceId])

  useEffect(() => {
    setSessions(readSessionIndex(indexKey))
  }, [indexKey])

  useEffect(() => {
    persistSessionIndex(indexKey, sessions)
  }, [indexKey, sessions])

  useEffect(() => {
    if (!currentSessionId) return

    const now = Date.now()
    setSessions((previous) => {
      const existing = previous.find((session) => session.sessionId === currentSessionId)
      if (!existing) {
        return sortByUpdatedAt([
          makeSessionStub(currentSessionId, now),
          ...previous,
        ])
      }

      return sortByUpdatedAt(
        updateSession(previous, currentSessionId, (session) => ({
          ...session,
          updatedAt: now,
          status: session.starred ? 'starred' : 'active',
        })),
      )
    })
  }, [currentSessionId])

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return sortByUpdatedAt(sessions).filter((session) => {
      const statusMatch =
        filter === 'all'
          ? true
          : filter === 'starred'
            ? session.starred || session.status === 'starred'
            : session.status === 'archived'

      if (!statusMatch) return false
      if (!normalizedQuery) return true

      const haystack = [
        session.name,
        session.autoTitle,
        session.previewSnippet,
        session.modelId,
        session.provider,
        ...session.tags,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [filter, query, sessions])

  const selectSession = (sessionId: string) => {
    setSessions((previous) => sortByUpdatedAt(updateSession(previous, sessionId, (session) => ({
      ...session,
      updatedAt: Date.now(),
      status: session.starred ? 'starred' : session.status === 'archived' ? 'archived' : 'active',
    }))))

    onResumeSession(sessionId)
  }

  const renameSession = (sessionId: string, name: string) => {
    setSessions((previous) => sortByUpdatedAt(updateSession(previous, sessionId, (session) => ({
      ...session,
      name,
      updatedAt: Date.now(),
    }))))
  }

  const toggleStar = (sessionId: string) => {
    setSessions((previous) => sortByUpdatedAt(updateSession(previous, sessionId, (session) => {
      const starred = !session.starred
      return {
        ...session,
        starred,
        status: session.status === 'archived'
          ? 'archived'
          : starred
            ? 'starred'
            : 'active',
        updatedAt: Date.now(),
      }
    })))
  }

  const toggleArchive = (sessionId: string) => {
    setSessions((previous) => sortByUpdatedAt(updateSession(previous, sessionId, (session) => {
      const archived = session.status !== 'archived'
      return {
        ...session,
        status: archived ? 'archived' : session.starred ? 'starred' : 'active',
        updatedAt: Date.now(),
      }
    })))
  }

  const deleteSession = (sessionId: string) => {
    setSessions((previous) => previous.filter((session) => session.sessionId !== sessionId))
  }

  const exportSession = (sessionId: string) => {
    const target = sessions.find((session) => session.sessionId === sessionId)
    if (!target || typeof window === 'undefined') return

    const payload = JSON.stringify(target, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${target.name || target.autoTitle || 'session'}.json`
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  const filters: ReadonlyArray<{ key: SessionFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'starred', label: 'Starred' },
    { key: 'archived', label: 'Archived' },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 40,
          }}
          className="h-full flex flex-col overflow-hidden flex-shrink-0"
          style={{
            background: 'oklch(0.04 0 0)',
            borderLeft: '1px solid oklch(0.12 0 0)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '12px 16px',
              borderBottom: '1px solid oklch(0.1 0 0)',
              background: 'oklch(0.05 0 0)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={16} style={{ color: 'oklch(0.5 0 0)' }} />
              <span
                style={{
                  color: 'oklch(0.72 0 0)',
                  fontFamily: MONO,
                  fontSize: 'var(--tmnl-text-sm, 14px)',
                  lineHeight: 1.2,
                }}
              >
                Sessions
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={onNewSession}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 6,
                  border: '1px solid oklch(0.14 0 0)',
                  background: 'oklch(0.08 0 0)',
                  color: 'oklch(0.72 0.14 195)',
                  fontFamily: MONO,
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  padding: '5px 8px',
                  cursor: 'pointer',
                  transition: VANTA_ANIMATION.transition.colors,
                }}
              >
                <Plus size={13} />
                New Session
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close sessions drawer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'oklch(0.52 0 0)',
                  cursor: 'pointer',
                  transition: VANTA_ANIMATION.transition.colors,
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
              borderBottom: '1px solid oklch(0.1 0 0)',
              background: 'oklch(0.045 0 0)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flex: 1,
                minWidth: 0,
                borderRadius: 6,
                border: '1px solid oklch(0.12 0 0)',
                background: 'oklch(0.07 0 0)',
                padding: '0 8px',
                height: 32,
              }}
            >
              <Search size={14} style={{ color: 'oklch(0.52 0 0)' }} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'oklch(0.88 0 0)',
                  fontFamily: VANTA_TYPOGRAPHY.family.sans,
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                }}
              />
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                borderRadius: 6,
                border: '1px solid oklch(0.12 0 0)',
                background: 'oklch(0.07 0 0)',
                padding: 3,
              }}
            >
              {filters.map((item) => {
                const active = filter === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key)}
                    style={{
                      border: 'none',
                      borderRadius: 4,
                      background: active ? 'oklch(0.12 0 0)' : 'transparent',
                      color: active ? 'oklch(0.86 0 0)' : 'oklch(0.56 0 0)',
                      fontFamily: MONO,
                      fontSize: 'var(--tmnl-text-xs, 12px)',
                      padding: '4px 8px',
                      lineHeight: 1.1,
                      cursor: 'pointer',
                      transition: VANTA_ANIMATION.transition.colors,
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
            {filteredSessions.length === 0 ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: 'oklch(0.42 0 0)',
                  textAlign: 'center',
                  padding: 16,
                }}
              >
                <Sparkles size={18} style={{ color: 'oklch(0.5 0 0)' }} />
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 'var(--tmnl-text-sm, 14px)',
                    color: 'oklch(0.62 0 0)',
                  }}
                >
                  No sessions yet
                </span>
                <span
                  style={{
                    fontFamily: VANTA_TYPOGRAPHY.family.sans,
                    fontSize: 'var(--tmnl-text-xs, 12px)',
                    color: 'oklch(0.5 0 0)',
                  }}
                >
                  Start a new run to populate this panel.
                </span>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredSessions.map((session) => (
                  <motion.div
                    key={session.sessionId}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    style={{ marginBottom: 8 }}
                  >
                    <SessionCard
                      session={session}
                      isActive={currentSessionId === session.sessionId}
                      onResume={() => selectSession(session.sessionId)}
                      onRename={(name) => renameSession(session.sessionId, name)}
                      onStar={() => toggleStar(session.sessionId)}
                      onArchive={() => toggleArchive(session.sessionId)}
                      onDelete={() => deleteSession(session.sessionId)}
                      onExport={() => exportSession(session.sessionId)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

SessionDrawer.displayName = 'MorphChat.SessionDrawer'
