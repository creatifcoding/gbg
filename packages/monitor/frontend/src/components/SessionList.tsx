/**
 * SessionList — left panel.
 *
 * Lists all RCA sessions from the SQLite DB, sorted newest-first.
 * Selection drives the rest of the UI via selectedSessionIdAtom.
 */
import { useMemo } from 'react'
import { useAtom, selectedSessionIdAtom, selectedNodeIdAtom } from '../lib/atoms.ts'
import { useSessionsQuery } from '../lib/query.ts'
import type { Session } from '../lib/schema.ts'

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ts
  }
}

function StatusBadge({ status }: { status: string }) {
  const cls = `gbm-status-badge gbm-status-badge--${status}`
  return <span className={cls}>{status}</span>
}

interface SessionRowProps {
  session: Session
  isActive: boolean
  onSelect: () => void
}

function SessionRow({ session, isActive, onSelect }: SessionRowProps) {
  return (
    <button
      className={`gbm-session-row ${isActive ? 'gbm-session-row--active' : ''}`}
      onClick={onSelect}
      title={session.id}
    >
      <span className="gbm-session-row__name">{session.name}</span>
      <span className="gbm-session-row__meta">
        <StatusBadge status={session.status} />
        <span>{formatTs(session.created_at)}</span>
      </span>
    </button>
  )
}

export function SessionList() {
  const { data: sessions, isLoading, error } = useSessionsQuery()
  const [selectedId, setSelectedId] = useAtom(selectedSessionIdAtom)
  const [, setSelectedNodeId] = useAtom(selectedNodeIdAtom)

  function select(id: string) {
    setSelectedId((prev) => (prev === id ? null : id))
    setSelectedNodeId(null)
  }

  const sorted = useMemo(
    () =>
      sessions
        ? [...sessions].sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
        : [],
    [sessions],
  )

  return (
    <aside className="gbm-sessions">
      <div className="gbm-panel-header">sessions</div>

      {isLoading && <div className="gbm-loading" style={{ padding: '10px' }}>fetching…</div>}

      {error && (
        <div className="gbm-error" style={{ padding: '10px' }}>
          {error instanceof Error ? error.message : 'error loading sessions'}
        </div>
      )}

      {!isLoading && sorted.length === 0 && !error && (
        <div className="gbm-empty" style={{ padding: '10px' }}>no sessions</div>
      )}

      {sorted.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          isActive={selectedId === session.id}
          onSelect={() => select(session.id)}
        />
      ))}
    </aside>
  )
}
