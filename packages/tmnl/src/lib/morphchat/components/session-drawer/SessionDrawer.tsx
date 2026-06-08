import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
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
  onResumePiSession?: (path: string, sessionId?: string) => void
  onNewSession: () => void
  currentSessionId: string | null
  instanceId: string
  width?: number
}

type SessionFilter = 'all' | 'starred' | 'archived'

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'
const DRAWER_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]
const MICRO_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

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
  onResumePiSession,
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
    piSessionCount,
    query,
    setSearch,
    setFilter,
    rename,
    star,
    enrich,
    archive,
    deleteSession,
    fork,
    refresh,
  } = useSessionManager(instanceId)

  const prefersReducedMotion = useReducedMotion()
  const debugForceSkeleton = typeof window !== 'undefined'
    && import.meta.env.DEV
    && new URLSearchParams(window.location.search).has('tmnl-session-skeleton')

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

  const showInitialLoading = debugForceSkeleton || (loading && totalSessions === 0)
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
    const target = sessions.find((session) => session.sessionId === sessionId)
    if (target?.sourceKind === 'pi-cli' && target.piPath) {
      onResumePiSession?.(target.piPath, target.sourceRef._tag === 'PiCliSessionRef' ? target.sourceRef.id : undefined)
      return
    }

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
      piSessionCount,
      visibleSessionIds: sessions.map((session) => session.sessionId),
      visibleSources: sessions.map((session) => session.sourceKind),
      diagnosticSampleSessionIds: diagnostics.sampleSessionIds,
      diagnosticSamplePiSessionIds: diagnostics.samplePiSessionIds,
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={prefersReducedMotion ? { width, opacity: 0 } : { width: 0, opacity: 0, x: 14 }}
          animate={prefersReducedMotion ? { width, opacity: 1 } : { width, opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? { width, opacity: 0 } : { width: 0, opacity: 0, x: 10 }}
          transition={{
            type: 'tween',
            duration: prefersReducedMotion ? 0.12 : 0.18,
            ease: DRAWER_EASE,
          }}
          className="h-full flex flex-col overflow-hidden flex-shrink-0"
          data-tmnl-session-drawer="root"
          data-tmnl-session-skeleton-forced={debugForceSkeleton ? 'true' : undefined}
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
              fontSize: 'var(--tmnl-text-xs, 12px)',
              lineHeight: 1.2,
            }}
          >
            <span>
              server:{diagnostics.serverCount} · pi:{piSessionCount} · local:{v2Diagnostics.localSessionCount} · visible:{visibleSessions} · fetched:{diagnosticLabel}
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
                fontSize: 'var(--tmnl-text-xs, 12px)',
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
                      fontSize: 'var(--tmnl-text-xs, 12px)',
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
                      fontSize: 'var(--tmnl-text-xs, 12px)',
                      lineHeight: 1.35,
                    }}
                  >
                    Operator guidance: sync failed — verify harness connectivity, then refresh.
                  </div>
                )}
              </div>
            )}

            {showInitialLoading ? (
              <SessionSkeletonList operationLabel={operationLabel} forced={debugForceSkeleton} />
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
              <div data-tmnl-session-list="settled">
                {sessions.map((session, index) => (
                  <div
                    key={`${session.sourceKind}:${session.sessionId}:${session.sourceRef._tag}:${index}`}
                    style={{ marginBottom: 8 }}
                  >
                    <SessionCard
                      session={session}
                      isActive={currentSessionId === session.sessionId || currentSessionId === session.sourceRef.id}
                      onResume={() => selectSession(session.sessionId)}
                      onRename={(name) => rename(session.sessionId, name)}
                      onStar={() => star(session.sessionId)}
                      onArchive={() => archive(session.sessionId)}
                      onDelete={() => deleteSession(session.sessionId)}
                      onExport={() => exportSession(session.sessionId)}
                      onFork={() => fork(session.sessionId)}
                      onEnrich={(patch) => enrich(session.sessionId, patch)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface SessionSkeletonListProps {
  readonly operationLabel: string | null
  readonly forced: boolean
}

function SessionSkeletonList({ operationLabel, forced }: SessionSkeletonListProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      aria-busy="true"
      aria-label="Loading sessions"
      data-tmnl-session-skeleton="true"
      data-tmnl-session-skeleton-mode={forced ? 'forced-smoke' : 'live'}
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: MICRO_EASE }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: MICRO_EASE }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderRadius: 10,
          border: '1px solid oklch(0.14 0 0)',
          background: 'linear-gradient(135deg, oklch(0.065 0 0), oklch(0.045 0 0))',
          padding: '9px 10px',
          boxShadow: 'inset 0 1px 0 oklch(0.12 0 0)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <Loader2
            size={13}
            className={prefersReducedMotion ? undefined : 'animate-spin'}
            style={{ color: 'oklch(0.62 0.08 195)' }}
          />
          <span
            style={{
              color: 'oklch(0.68 0 0)',
              fontFamily: MONO,
              fontSize: 'var(--tmnl-text-xs, 12px)',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {operationLabel ?? '[session.fetch]'} indexing session ledger…
          </span>
        </div>
        <span
          style={{
            color: 'oklch(0.42 0 0)',
            fontFamily: MONO,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            lineHeight: 1,
          }}
        >
          {forced ? 'smoke' : 'live'}
        </span>
      </motion.div>

      {Array.from({ length: 6 }, (_, index) => (
        <motion.div
          key={index}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: prefersReducedMotion ? 0 : index * 0.026, ease: MICRO_EASE }}
        >
          <SessionSkeletonCard index={index} prefersReducedMotion={prefersReducedMotion} />
        </motion.div>
      ))}
    </motion.div>
  )
}

interface SessionSkeletonCardProps {
  readonly index: number
  readonly prefersReducedMotion: boolean | null
}

function SessionSkeletonCard({ index, prefersReducedMotion }: SessionSkeletonCardProps) {
  const titleWidth = 58 + ((index * 17) % 28)
  const metaWidth = 36 + ((index * 13) % 24)
  const previewWidth = 76 - ((index * 9) % 22)

  return (
    <div
      style={{
        borderRadius: 10,
        border: '1px solid oklch(0.105 0 0)',
        background: 'oklch(0.052 0 0)',
        padding: 10,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <motion.div
        aria-hidden="true"
        animate={prefersReducedMotion
          ? { opacity: [0.05, 0.12, 0.05] }
          : { x: ['-120%', '120%'] }}
        transition={prefersReducedMotion
          ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 1.65, repeat: Infinity, repeatDelay: 0.32, ease: 'linear' }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent, oklch(0.12 0.04 195 / 0.16), transparent)',
          pointerEvents: 'none',
          willChange: prefersReducedMotion ? 'opacity' : 'transform',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <SkeletonBar width={24} height={24} radius={6} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <SkeletonBar width={`${titleWidth}%`} height={12} radius={999} />
          <div style={{ height: 6 }} />
          <SkeletonBar width={`${metaWidth}%`} height={10} radius={999} tone="muted" />
        </div>
      </div>
      <SkeletonBar width={`${previewWidth}%`} height={10} radius={999} tone="muted" />
      <div style={{ height: 7 }} />
      <SkeletonBar width="42%" height={10} radius={999} tone="faint" />
    </div>
  )
}

interface SkeletonBarProps {
  readonly width: number | string
  readonly height: number
  readonly radius: number
  readonly tone?: 'default' | 'muted' | 'faint'
}

function SkeletonBar({ width, height, radius, tone = 'default' }: SkeletonBarProps) {
  const background = tone === 'faint'
    ? 'oklch(0.09 0 0)'
    : tone === 'muted'
      ? 'oklch(0.115 0 0)'
      : 'oklch(0.14 0 0)'

  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background,
        boxShadow: tone === 'default' ? 'inset 0 1px 0 oklch(0.18 0 0)' : undefined,
      }}
    />
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
          fontSize: 'var(--tmnl-text-xs, 12px)',
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
            fontSize: 'var(--tmnl-text-xs, 12px)',
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
