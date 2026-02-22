/**
 * InteractiveShellRenderer — Tool renderer for interactive_shell tool calls.
 *
 * For spawn results: shows InteractiveTerminal with live PTY connection.
 * For input/kill/status results: shows text output like GenericToolRenderer.
 *
 * The renderer connects to the harness WS transport for bidirectional PTY data:
 *   - Receives `shell:data` events → writes to terminal
 *   - Sends `remote:shell_input` commands on user keystrokes
 *   - Sends `remote:shell_resize` on FitAddon resize
 *   - Sends `remote:shell_kill` on kill button click
 *
 * @module chat/msg/tool-block/renderers/interactive-shell-renderer
 */

import { memo, useRef, useEffect, useState, useCallback, type FC } from 'react'
import type { ToolRendererProps } from './registry'
import { InteractiveTerminal } from './terminal/interactive-terminal'

// ─────────────────────────────────────────────────────────────────────────────
// Session ID extraction from tool output
// ─────────────────────────────────────────────────────────────────────────────

function extractSessionId(output: unknown): string | null {
  if (typeof output === 'string') {
    // Look for "sessionId: shell-XXXX" pattern
    const match = output.match(/sessionId:\s*(shell-[a-zA-Z0-9_-]+)/)
    return match?.[1] ?? null
  }
  if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item === 'object' && item && 'text' in item) {
        const found = extractSessionId((item as { text: string }).text)
        if (found) return found
      }
    }
  }
  return null
}

function extractSessionStatus(output: unknown): string {
  if (typeof output === 'string') {
    const match = output.match(/status:(\w+)/)
    return match?.[1] ?? 'running'
  }
  return 'running'
}

function isSpawnResult(input: unknown): boolean {
  if (typeof input !== 'object' || !input) return false
  const args = input as Record<string, unknown>
  // Spawn: has command, no sessionId
  return typeof args.command === 'string' && !args.sessionId
}

function getOutputText(output: unknown): string {
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    return output
      .filter((item): item is { type: string; text: string } =>
        typeof item === 'object' && item && 'text' in item,
      )
      .map((item) => item.text)
      .join('\n')
  }
  return JSON.stringify(output, null, 2)
}

// ─────────────────────────────────────────────────────────────────────────────
// WS event plumbing hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook that connects to the harness WS transport for shell events.
 *
 * Uses the adapter's existing WS connection (via window.__harnessWs or
 * custom event bus). For now, uses a postMessage-based bridge.
 *
 * TODO: Wire to actual adapter WS transport when available.
 */
function useShellConnection(sessionId: string | null) {
  const termRef = useRef<{ write: (data: string) => void } | null>(null)
  const [status, setStatus] = useState<'starting' | 'running' | 'exited' | 'killed' | 'error'>('starting')
  const [exitCode, setExitCode] = useState<number | undefined>()

  // Listen for shell events from WS
  useEffect(() => {
    if (!sessionId) return

    const handler = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data._tag === 'shell:data' && data.sessionId === sessionId) {
        termRef.current?.write(data.data)
      } else if (data._tag === 'shell:started' && data.sessionId === sessionId) {
        setStatus('running')
      } else if (data._tag === 'shell:exited' && data.sessionId === sessionId) {
        setStatus('exited')
        setExitCode(data.exitCode)
      } else if (data._tag === 'shell:error' && data.sessionId === sessionId) {
        setStatus('error')
      }
    }

    // Use window message bus for cross-component shell events
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [sessionId])

  const sendInput = useCallback(
    (_sessionId: string, data: string) => {
      // Dispatch to WS transport via adapter
      window.postMessage(
        { _tag: 'remote:shell_input', sessionId: _sessionId, data },
        '*',
      )
    },
    [],
  )

  const sendResize = useCallback(
    (_sessionId: string, cols: number, rows: number) => {
      window.postMessage(
        { _tag: 'remote:shell_resize', sessionId: _sessionId, cols, rows },
        '*',
      )
    },
    [],
  )

  const sendKill = useCallback(
    (_sessionId: string) => {
      window.postMessage(
        { _tag: 'remote:shell_kill', sessionId: _sessionId },
        '*',
      )
    },
    [],
  )

  return {
    termRef,
    status,
    exitCode,
    sendInput,
    sendResize,
    sendKill,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderer Component
// ─────────────────────────────────────────────────────────────────────────────

export const InteractiveShellRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  state,
  toolCallId,
}) => {
  const sessionId = extractSessionId(output)
  const isSpawn = isSpawnResult(input)

  // Only show interactive terminal for spawn results with a valid sessionId
  if (isSpawn && sessionId) {
    return (
      <InteractiveShellTerminalView
        sessionId={sessionId}
        name={(input as Record<string, unknown>)?.name as string | undefined}
        toolCallId={toolCallId}
      />
    )
  }

  // For input/kill/status operations, show text output
  const text = getOutputText(output)
  return (
    <pre
      className="bg-neutral-950 border border-neutral-800 rounded p-3 text-neutral-300 font-mono overflow-x-auto"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)', maxHeight: '300px' }}
    >
      {text || '(no output)'}
    </pre>
  )
})

InteractiveShellRenderer.displayName = 'InteractiveShellRenderer'

/**
 * Internal: InteractiveTerminal with WS connection plumbing
 */
const InteractiveShellTerminalView: FC<{
  sessionId: string
  name?: string
  toolCallId: string
}> = memo(({ sessionId, name, toolCallId }) => {
  const { termRef, status, exitCode, sendInput, sendResize, sendKill } =
    useShellConnection(sessionId)

  return (
    <InteractiveTerminal
      sessionId={sessionId}
      name={name}
      status={status}
      exitCode={exitCode}
      onInput={sendInput}
      onResizeRequest={sendResize}
      onKill={sendKill}
      maxHeight={500}
      ref={(ref) => {
        // Bridge terminal ref for WS data writes
        if (ref) {
          termRef.current = ref as any
        }
      }}
    />
  )
})

InteractiveShellTerminalView.displayName = 'InteractiveShellTerminalView'

// ─────────────────────────────────────────────────────────────────────────────
// Header Meta
// ─────────────────────────────────────────────────────────────────────────────

export const InteractiveShellHeaderMeta: FC<{ input?: unknown; output?: unknown }> = ({ input, output }) => {
  const args = input as Record<string, unknown> | undefined

  if (args?.sessionId && args?.kill) {
    return (
      <span className="text-red-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        kill {String(args.sessionId).slice(0, 16)}
      </span>
    )
  }

  if (args?.sessionId && args?.input) {
    const inputPreview = String(args.input).slice(0, 40).replace(/\n/g, '↵')
    return (
      <span className="text-neutral-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        → {inputPreview}
      </span>
    )
  }

  if (args?.command) {
    return (
      <span className="text-cyan-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        {String(args.command)}
      </span>
    )
  }

  if (args?.sessionId) {
    return (
      <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        status {String(args.sessionId).slice(0, 16)}
      </span>
    )
  }

  return null
}
