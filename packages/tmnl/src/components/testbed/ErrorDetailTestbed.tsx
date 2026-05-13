/**
 * Error Detail Testbed — renders every category variant for visual verification.
 *
 * Route: /testbed/error-detail
 */

import { useState, useCallback, useMemo } from 'react'
import { matchCategory, ErrorDetailProvider, type ErrorDetailState, type ErrorDetailActions, type ErrorDetailMeta } from '@/lib/harness/error-detail'
import { categoryOf } from '@/lib/harness/error-detail/category-registry'
import type { HarnessErrorCode } from '@/lib/harness/error-codes'

/** One representative code per category */
const TEST_CODES: ReadonlyArray<{ code: HarnessErrorCode; message: string; details?: unknown }> = [
  { code: 'stream-error', message: "Stream failed after 30000ms timeout in round 3" },
  { code: 'network-unavailable', message: "Network is unavailable" },
  { code: 'session-missing', message: "Session not found on server" },
  { code: 'session-create-failed', message: "Failed to create session" },
  { code: 'tool-execution-failed', message: "Tool 'execute_code' failed in round 2" },
  { code: 'model-catalog-failed', message: "Model 'claude-opus-4' catalog lookup failed" },
  { code: 'stream-timeout', message: "Stream timed out after 30000ms" },
  { code: 'compaction-failed', message: "Compaction pass failed silently" },
  { code: 'stream-defect', message: "Unexpected defect in stream handler", details: { cause: { message: "Cannot read property 'foo' of undefined", stack: "TypeError: Cannot read property 'foo' of undefined\n    at StreamHandler.process (stream.ts:42)\n    at Runtime.run (runtime.ts:88)" } } },
  { code: 'adapter-state-defect', message: "Adapter state inconsistency detected" },
  { code: 'store-index-corrupt', message: "Session store index corrupted" },
  { code: 'aborted', message: "Request cancelled by user" },
]

function ErrorCard({ code, message, details }: { code: HarnessErrorCode; message: string; details?: unknown }) {
  const [expanded, setExpanded] = useState(false)
  const match = useMemo(() => matchCategory(code), [code])

  const state = useMemo<ErrorDetailState>(() => ({
    code,
    message,
    at: Date.now(),
    details: details ?? null,
  }), [code, message, details])

  const actions = useMemo<ErrorDetailActions>(() => ({
    onDismiss: () => setExpanded(false),
    onReconnect: () => alert(`Reconnect for ${code}`),
    onNewSession: () => alert(`New session for ${code}`),
    onCopyDiagnostic: () => navigator.clipboard.writeText(JSON.stringify(state, null, 2)),
  }), [code, state])

  const meta = useMemo<ErrorDetailMeta>(() => ({
    config: match.config,
    sessionId: 'test-session-abc123def',
  }), [match.config])

  const DetailComponent = match.DetailComponent

  return (
    <div
      className="rounded overflow-hidden font-mono"
      style={{
        width: 360,
        border: `1px solid ${match.config.borderTint}`,
        background: match.config.bgTint,
        borderLeft: `2px solid ${match.config.accent}`,
      }}
    >
      {/* Collapsed row */}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 px-2 py-0.5 w-full text-left hover:brightness-110 transition-colors"
          style={{ height: 22, fontSize: 'var(--tmnl-text-xs, 12px)', color: match.config.accent }}
        >
          <match.config.Icon size={11} strokeWidth={1.5} />
          <span className="truncate flex-1">{message}</span>
          <span style={{ fontSize: '9px', opacity: 0.5 }}>click to expand</span>
        </button>
      )}

      {/* Expanded detail */}
      {expanded && (
        <ErrorDetailProvider state={state} actions={actions} meta={meta}>
          <DetailComponent />
        </ErrorDetailProvider>
      )}
    </div>
  )
}

export function ErrorDetailTestbed() {
  const [allExpanded, setAllExpanded] = useState(false)

  return (
    <div className="min-h-screen bg-neutral-950 p-8">
      <div className="max-w-[800px] mx-auto">
        <h1 className="font-mono text-xl text-cyan-400 mb-2">Error Detail Testbed</h1>
        <p className="font-mono text-sm text-neutral-500 mb-6">
          12 categories × 1 representative code each. Click to expand/collapse.
        </p>

        <button
          type="button"
          onClick={() => setAllExpanded(v => !v)}
          className="font-mono text-xs px-3 py-1 rounded border border-cyan-800 text-cyan-400 hover:bg-cyan-900/20 transition-colors mb-6"
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>

        <div className="flex flex-col gap-3">
          {TEST_CODES.map(({ code, message, details }) => (
            <ErrorCard key={code} code={code} message={message} details={details} />
          ))}
        </div>
      </div>
    </div>
  )
}
