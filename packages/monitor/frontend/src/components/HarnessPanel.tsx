/**
 * HarnessPanel — bottom-bar workflow runner.
 *
 * Submits prompts to the backend AG-UI/Mastra workflow harness and
 * streams lifecycle events into a compact scrolling log.  The graph
 * is untouched; this panel occupies the third grid row of .gbm-shell.
 *
 * AG-UI/CopilotKit packages (@ag-ui/client, @copilotkit/runtime-client-gql)
 * are NOT installed in this package.  Local structural types in
 * lib/schema.ts mirror the wire format; a future package install is a
 * near-drop-in substitution.
 */
import { useRef, useState, useCallback, useEffect, type KeyboardEvent } from 'react'
import {
  useAtom,
  useAtomValue,
  selectedSessionIdAtom,
  harnessExpandedAtom,
} from '../lib/atoms.ts'
import { submitWorkflowRun, streamWorkflowEvents } from '../lib/api.ts'
import type { WorkflowEvent, WorkflowRun } from '../lib/schema.ts'

// ── Display maps ─────────────────────────────────────────────────────────────

/** Human-readable badge text for each run status. */
const STATUS_LABEL: Record<string, string> = {
  idle:      'IDLE',
  running:   'RUN…',
  success:   'OK',
  completed: 'OK',   // Mastra native terminal status
  error:     'ERR',
  cancelled: 'STOP',
  disabled:  'OFF',
}

/**
 * Maps run status → existing .gbm-status-badge modifier.
 * Falls back to 'unknown' for unrecognised values.
 */
const STATUS_MOD: Record<string, string> = {
  idle:      'unknown',
  running:   'running',
  success:   'open',
  completed: 'open',
  error:     'error',
  cancelled: 'closed',
  disabled:  'closed',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HarnessPanel(): React.ReactNode {
  const sessionId = useAtomValue(selectedSessionIdAtom)
  const [expanded, setExpanded] = useAtom(harnessExpandedAtom)

  const [prompt, setPrompt] = useState('')
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [events, setEvents] = useState<WorkflowEvent[]>([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const eventsEndRef = useRef<HTMLDivElement>(null)
  /** AbortController for the active SSE stream; null when idle. */
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll to newest event
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  const cancelStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  // Teardown on unmount
  useEffect(() => {
    return cancelStream
  }, [cancelStream])

  const handleSubmit = useCallback(async () => {
    if (!sessionId || !prompt.trim() || submitting) return

    cancelStream()
    setSubmitting(true)
    setError(null)
    setEvents([])
    setStatus('running')
    setExpanded(true)

    try {
      const newRun = await submitWorkflowRun(sessionId, prompt.trim())
      setRun(newRun)

      const ctrl = new AbortController()
      abortRef.current = ctrl

      void streamWorkflowEvents(
        newRun.id,
        (evt) => {
          setEvents((prev) => [...prev, evt])
          if (evt.type === 'RUN_FINISHED') {
            setStatus('success')
            ctrl.abort()
          } else if (evt.type === 'RUN_DISABLED') {
            setStatus('disabled')
            ctrl.abort()
          } else if (evt.type === 'RUN_ERROR') {
            // Extract message from payload; fall back to a generic string
            const p = typeof evt.payload === 'object' && evt.payload !== null
              ? evt.payload as Record<string, unknown>
              : null
            setStatus('error')
            setError(
              typeof p?.message === 'string' && p.message.length > 0
                ? p.message
                : typeof p?.error === 'string' && p.error.length > 0
                  ? p.error
                  : 'Workflow error',
            )
            ctrl.abort()
          }
        },
        ctrl.signal,
      )
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, prompt, submitting, cancelStream, setExpanded])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        void handleSubmit()
      }
    },
    [handleSubmit],
  )

  const canSubmit = sessionId !== null && prompt.trim().length > 0 && !submitting
  const statusMod = STATUS_MOD[status] ?? 'unknown'
  const statusLabel = STATUS_LABEL[status] ?? status.toUpperCase()

  return (
    <div className={`gbm-harness${expanded ? ' gbm-harness--expanded' : ''}`}>

      {/* ── Bar — always visible ─────────────────────────────── */}
      <div className="gbm-harness__bar">
        <button
          className="gbm-harness__toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse harness panel' : 'Expand harness panel'}
        >
          {expanded ? '▼' : '▲'} HARNESS
        </button>

        <span className={`gbm-status-badge gbm-status-badge--${statusMod}`}>
          {statusLabel}
        </span>

        {run !== null && (
          <span className="gbm-harness__run-id" title={run.id}>
            {run.id.slice(0, 8)} · {run.workflow}
          </span>
        )}

        {error !== null && !expanded && (
          <span className="gbm-harness__inline-error" title={error}>
            {error.length > 64 ? `${error.slice(0, 61)}…` : error}
          </span>
        )}

        {sessionId === null && error === null && (
          <span className="gbm-harness__hint">select a session to run</span>
        )}
      </div>

      {/* ── Expanded body ────────────────────────────────────── */}
      {expanded && (
        <div className="gbm-harness__body">

          <div className="gbm-harness__prompt-row">
            <textarea
              className="gbm-harness__prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                sessionId !== null
                  ? 'Workflow prompt — ⌘↵ to run'
                  : 'Select a session first'
              }
              disabled={sessionId === null || submitting}
              rows={2}
            />
            <button
              className={`gbm-harness__submit${canSubmit ? '' : ' gbm-harness__submit--disabled'}`}
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
            >
              {submitting ? '…' : 'RUN'}
            </button>
          </div>

          {error !== null && (
            <div className="gbm-harness__error">⚠ {error}</div>
          )}

          <div className="gbm-harness__events">
            {events.length === 0 && error === null && (
              <div className="gbm-harness__empty">
                {status === 'idle'
                  ? 'no runs yet — enter a prompt above'
                  : status === 'running'
                    ? 'waiting for events…'
                    : 'run complete'}
              </div>
            )}
            {events.map((evt, i) => {
              const evtMod = evt.type.replace(/_/g, '-')
              // For text_delta, surface the text field; otherwise compact JSON
              const payloadRecord = typeof evt.payload === 'object' && evt.payload !== null
                ? evt.payload as Record<string, unknown>
                : null
              const textContent = typeof payloadRecord?.text === 'string'
                ? payloadRecord.text
                : null
              return (
                <div
                  key={`${evt.id}-${i}`}
                  className={`gbm-harness__event gbm-harness__event--${evtMod}`}
                >
                  <span className="gbm-harness__event-type">{evt.type}</span>
                  {textContent !== null
                    ? <span className="gbm-harness__event-text">{textContent}</span>
                    : evt.payload !== null
                      ? <span className="gbm-harness__event-payload">
                          {JSON.stringify(evt.payload)}
                        </span>
                      : null
                  }
                  <span className="gbm-harness__event-ts">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )
            })}
            <div ref={eventsEndRef} />
          </div>

        </div>
      )}
    </div>
  )
}
