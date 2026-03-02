import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import {
  VANTA_ANIMATION,
  VANTA_SPACING,
  VANTA_TYPOGRAPHY,
} from '@/components/portal/tokens'
import { useSessionManager } from '@/lib/morphchat/hooks/useSessionManager'
import { SessionCard } from './SessionCard'

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

const FILTERS: ReadonlyArray<{ key: SessionFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'starred', label: 'Starred' },
  { key: 'archived', label: 'Archived' },
]

const OPERATION_LABELS: Record<string, string> = {
  fetch: '[session.fetch]',
  rename: '[session.rename]',
  star: '[session.star]',
  archive: '[session.archive]',
  delete: '[session.delete]',
  fork: '[session.fork]',
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
  const {
    sessions,
    totalSessions,
    visibleSessions,
    loading,
    error,
    operation,
    diagnostics,
    v2Diagnostics,
    query,
    setSearch,
    setFilter,
    rename,
    star,
    archive,
    deleteSession,
    fork,
    refresh,
  } = useSessionManager(instanceId)

  useEffect(() => {
    if (!isOpen) return
    refresh()
  }, [isOpen, refresh])

  // Keep session index in sync when session identity changes (new/resume/fork)
  useEffect(() => {
    if (!isOpen) return
    refresh()
  }, [currentSessionId, isOpen, refresh])

  const hasSearch = query.search.trim().length > 0
  const hasFilter = query.filter !== 'all'
  const hasActiveQuery = hasSearch || hasFilter

  const showInitialLoading = loading && totalSessions === 0
  const showErrorState = !showInitialLoading && !!error && sessions.length === 0
  const showFilteredEmpty = !loading && !error && sessions.length === 0 && totalSessions > 0 && hasActiveQuery
  const showNoSessions = !loading && !error && sessions.length === 0 && totalSessions === 0

  const operationLabel = operation.inFlight && operation.op !== 'idle'
    ? OPERATION_LABELS[operation.op] ?? `[session.${operation.op}]`
    : null

  const diagnosticLabel = diagnostics.lastFetchAt
    ? new Date(diagnostics.lastFetchAt).toLocaleTimeString()
    : 'never'

  const resetFilters = () => {
    setSearch('')
    setFilter('all')
  }

  const selectSession = (sessionId: string) => {
    onResumeSession(sessionId)
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

  const dumpSessionDebug = () => {
    if (typeof console === 'undefined') return
    console.info('[session-drawer:debug]', {
      instanceId,
      currentSessionId,
      query,
      operation,
      diagnostics,
      v2Diagnostics,
      totalSessions,
      visibleSessions,
      visibleSessionIds: sessions.map((session) => session.sessionId),
      diagnosticSampleSessionIds: diagnostics.sampleSessionIds,
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{
            type: 'tween',
            duration: 0.14,
            ease: [0.22, 0.0, 0.0, 1],
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
                  fontSize: 'var(--tmnl-text-sm, 12px)',
                  lineHeight: 1.2,
                }}
              >
                Sessions
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={refresh}
                aria-label="Refresh sessions"
                title="Refresh sessions"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: '1px solid oklch(0.14 0 0)',
                  background: 'oklch(0.08 0 0)',
                  color: 'oklch(0.62 0 0)',
                  cursor: 'pointer',
                  transition: VANTA_ANIMATION.transition.colors,
                }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
              </button>

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
                  fontSize: 'var(--tmnl-text-xs, 10px)',
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
                value={query.search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'oklch(0.88 0 0)',
                  fontFamily: VANTA_TYPOGRAPHY.family.sans,
                  fontSize: 'var(--tmnl-text-xs, 10px)',
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
              {FILTERS.map((item) => {
                const active = query.filter === item.key
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
                      fontSize: 'var(--tmnl-text-xs, 10px)',
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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '6px 12px',
              borderBottom: '1px solid oklch(0.1 0 0)',
              background: 'oklch(0.05 0 0)',
              color: 'oklch(0.54 0 0)',
              fontFamily: MONO,
              fontSize: 'var(--tmnl-text-xs, 10px)',
              lineHeight: 1.2,
            }}
          >
            <span>
              server:{diagnostics.serverCount} · local:{v2Diagnostics.localSessionCount} · visible:{visibleSessions} · fetched:{diagnosticLabel}
            </span>
            <button
              type="button"
              onClick={dumpSessionDebug}
              style={{
                border: '1px solid oklch(0.14 0 0)',
                borderRadius: 6,
                background: 'oklch(0.07 0 0)',
                color: 'oklch(0.68 0 0)',
                cursor: 'pointer',
                fontFamily: MONO,
                fontSize: 'var(--tmnl-text-xs, 10px)',
                padding: '2px 8px',
              }}
            >
              dump
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
            {(operationLabel || error) && sessions.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  marginBottom: 10,
                  borderRadius: 8,
                  border: '1px solid oklch(0.14 0 0)',
                  background: 'oklch(0.065 0 0)',
                  padding: 8,
                }}
              >
                {operationLabel && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      color: 'oklch(0.66 0 0)',
                      fontFamily: MONO,
                      fontSize: 'var(--tmnl-text-xs, 10px)',
                    }}
                  >
                    <Loader2 size={12} className="animate-spin" />
                    {operationLabel} syncing session state…
                  </div>
                )}
                {error && (
                  <div
                    style={{
                      color: 'oklch(0.72 0.14 20)',
                      fontFamily: VANTA_TYPOGRAPHY.family.sans,
                      fontSize: 'var(--tmnl-text-xs, 10px)',
                      lineHeight: 1.35,
                    }}
                  >
                    Operator guidance: sync failed — verify harness connectivity, then refresh.
                  </div>
                )}
              </div>
            )}

            {showInitialLoading ? (
              <StateBlock
                icon={<Loader2 size={18} className="animate-spin" />}
                title="Loading sessions"
                body="Operator guidance: waiting for authoritative session index from runtime."
                action={{ label: 'Retry Fetch', onClick: refresh }}
              />
            ) : showErrorState ? (
              <StateBlock
                icon={<AlertTriangle size={18} />}
                title="Session index unavailable"
                body={`Operator guidance: verify harness connection and retry fetch.${error ? `\n\nLast error: ${error}` : ''}`}
                tone="error"
                action={{ label: 'Retry Fetch', onClick: refresh }}
              />
            ) : showFilteredEmpty ? (
              <StateBlock
                icon={<Sparkles size={18} />}
                title="No sessions match current filters"
                body="Operator guidance: clear search/filter constraints to reveal indexed sessions."
                action={{ label: 'Reset Filters', onClick: resetFilters }}
              />
            ) : showNoSessions ? (
              <StateBlock
                icon={<Sparkles size={18} />}
                title="No sessions yet"
                body="Operator guidance: start a new run to seed the session index, then return here to resume or fork."
                action={{ label: 'New Session', onClick: onNewSession }}
              />
            ) : (
              sessions.map((session) => (
                <div key={session.sessionId} style={{ marginBottom: 8 }}>
                  <SessionCard
                    session={session}
                    isActive={currentSessionId === session.sessionId}
                    onResume={() => selectSession(session.sessionId)}
                    onRename={(name) => rename(session.sessionId, name)}
                    onStar={() => star(session.sessionId)}
                    onArchive={() => archive(session.sessionId)}
                    onDelete={() => deleteSession(session.sessionId)}
                    onExport={() => exportSession(session.sessionId)}
                    onFork={() => fork(session.sessionId)}
                  />
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface StateBlockProps {
  readonly icon: ReactNode
  readonly title: string
  readonly body: string
  readonly tone?: 'default' | 'error'
  readonly action?: {
    readonly label: string
    readonly onClick: () => void
  }
}

function StateBlock({
  icon,
  title,
  body,
  tone = 'default',
  action,
}: StateBlockProps) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        textAlign: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          color: tone === 'error' ? 'oklch(0.72 0.14 20)' : 'oklch(0.5 0 0)',
        }}
      >
        {icon}
      </div>

      <span
        style={{
          fontFamily: MONO,
          fontSize: 'var(--tmnl-text-sm, 12px)',
          color: tone === 'error' ? 'oklch(0.8 0.1 20)' : 'oklch(0.62 0 0)',
          lineHeight: 1.3,
        }}
      >
        {title}
      </span>

      <span
        style={{
          fontFamily: VANTA_TYPOGRAPHY.family.sans,
          fontSize: 'var(--tmnl-text-xs, 10px)',
          color: tone === 'error' ? 'oklch(0.66 0.08 20)' : 'oklch(0.5 0 0)',
          lineHeight: 1.45,
          whiteSpace: 'pre-line',
        }}
      >
        {body}
      </span>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            border: '1px solid oklch(0.16 0 0)',
            background: 'oklch(0.08 0 0)',
            color: tone === 'error' ? 'oklch(0.76 0.08 20)' : 'oklch(0.72 0.14 195)',
            fontFamily: MONO,
            fontSize: 'var(--tmnl-text-xs, 10px)',
            padding: '6px 10px',
            cursor: 'pointer',
            transition: VANTA_ANIMATION.transition.colors,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

SessionDrawer.displayName = 'MorphChat.SessionDrawer'
