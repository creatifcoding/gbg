/**
 * InteractiveShellRenderer — Tool renderer for interactive_shell tool calls.
 *
 * For spawn results: shows InteractiveTerminal with live PTY connection.
 * For input/kill/status results: shows text output.
 *
 * Shell IO bridged through shell-client-atoms:
 *   - subscribeShellEvents(sessionId, callback) for data/started/exited/error
 *   - sendShellInput/sendShellResize/sendShellKill for commands
 *
 * These are wired by useHarnessAdapter's connect fn-atom, which:
 *   - Forks a daemon fiber tapping transport.events for shell envelopes
 *   - Registers the command sender with the transport.request() function
 *
 * @module chat/msg/tool-block/renderers/interactive-shell-renderer
 */

import { memo, useRef, useEffect, useState, useCallback, type FC } from 'react'
import type { ToolRendererProps } from './registry'
import { InteractiveTerminal } from './terminal/interactive-terminal'
import type { TerminalCoreRef } from './terminal/terminal-core'
import {
  subscribeShellEvents,
  sendShellInput,
  sendShellResize,
  sendShellKill,
} from '@/lib/harness/interactive-shell/shell-client-atoms'
import type { ShellEvent } from '@/lib/harness/interactive-shell/schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Session ID extraction from tool output
// ─────────────────────────────────────────────────────────────────────────────

function extractSessionId(output: unknown): string | null {
  if (typeof output === 'string') {
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

function isSpawnResult(input: unknown): boolean {
  if (typeof input !== 'object' || !input) return false
  const args = input as Record<string, unknown>
  return typeof args.command === 'string' && !args.sessionId
}

function getOutputText(output: unknown): string {
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    return output
      .filter(
        (item): item is { type: string; text: string } =>
          typeof item === 'object' && item && 'text' in item,
      )
      .map((item) => item.text)
      .join('\n')
  }
  return JSON.stringify(output, null, 2)
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderer
// ─────────────────────────────────────────────────────────────────────────────

export const InteractiveShellRenderer: FC<ToolRendererProps> = memo(
  ({ input, output }) => {
    const sessionId = extractSessionId(output)
    const isSpawn = isSpawnResult(input)

    if (isSpawn && sessionId) {
      return (
        <InteractiveShellTerminalView
          sessionId={sessionId}
          name={
            (input as Record<string, unknown>)?.name as string | undefined
          }
        />
      )
    }

    const text = getOutputText(output)
    return (
      <pre
        className="bg-neutral-950 border border-neutral-800 rounded p-3 text-neutral-300 font-mono overflow-x-auto"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)', maxHeight: '300px' }}
      >
        {text || '(no output)'}
      </pre>
    )
  },
)

InteractiveShellRenderer.displayName = 'InteractiveShellRenderer'

// ─────────────────────────────────────────────────────────────────────────────
// Terminal Bridge (subscribeShellEvents → ghostty-web terminal)
// ─────────────────────────────────────────────────────────────────────────────

const InteractiveShellTerminalView: FC<{
  sessionId: string
  name?: string
}> = memo(({ sessionId, name }) => {
  const termRef = useRef<TerminalCoreRef>(null)
  const [status, setStatus] = useState<
    'starting' | 'running' | 'exited' | 'killed' | 'error'
  >('starting')
  const [exitCode, setExitCode] = useState<number | undefined>()

  // Subscribe to shell events for this session
  useEffect(() => {
    const unsub = subscribeShellEvents(sessionId, (event: ShellEvent) => {
      switch (event._tag) {
        case 'shell:data':
          termRef.current?.write(event.data)
          break
        case 'shell:started':
          setStatus('running')
          break
        case 'shell:exited':
          setStatus('exited')
          setExitCode(event.exitCode)
          break
        case 'shell:error':
          setStatus('error')
          break
      }
    })
    return unsub
  }, [sessionId])

  // Callbacks → shell-client-atoms (fire-and-forget via transport.request)
  const handleInput = useCallback(
    (_sid: string, data: string) => sendShellInput(sessionId, data),
    [sessionId],
  )

  const handleResize = useCallback(
    (_sid: string, cols: number, rows: number) =>
      sendShellResize(sessionId, cols, rows),
    [sessionId],
  )

  const handleKill = useCallback(
    (_sid: string) => sendShellKill(sessionId),
    [sessionId],
  )

  return (
    <InteractiveTerminal
      sessionId={sessionId}
      name={name}
      status={status}
      exitCode={exitCode}
      onInput={handleInput}
      onResizeRequest={handleResize}
      onKill={handleKill}
      maxHeight={500}
      ref={termRef}
    />
  )
})

InteractiveShellTerminalView.displayName = 'InteractiveShellTerminalView'

// ─────────────────────────────────────────────────────────────────────────────
// Header Meta
// ─────────────────────────────────────────────────────────────────────────────

export const InteractiveShellHeaderMeta: FC<{
  input?: unknown
  output?: unknown
}> = ({ input }) => {
  const args = input as Record<string, unknown> | undefined

  if (args?.sessionId && args?.kill) {
    return (
      <span
        className="text-red-400"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        kill {String(args.sessionId).slice(0, 16)}
      </span>
    )
  }

  if (args?.sessionId && args?.input) {
    const inputPreview = String(args.input).slice(0, 40).replace(/\n/g, '↵')
    return (
      <span
        className="text-neutral-400 font-mono"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        → {inputPreview}
      </span>
    )
  }

  if (args?.command) {
    return (
      <span
        className="text-cyan-400 font-mono"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {String(args.command)}
      </span>
    )
  }

  if (args?.sessionId) {
    return (
      <span
        className="text-neutral-500 font-mono"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        status {String(args.sessionId).slice(0, 16)}
      </span>
    )
  }

  return null
}
