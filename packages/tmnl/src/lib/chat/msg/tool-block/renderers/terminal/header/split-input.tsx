/**
 * SplitInput — Human input field below the terminal when in human-controlled
 * or supervised mode. Sends text to the PTY as structured input.
 *
 * Visibility gated by control mode atoms.
 *
 * @module terminal/header/split-input
 */

import { useState, useCallback, useRef, type KeyboardEvent } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import type { ShellSessionAtoms } from '@/lib/harness/interactive-shell/shell-session-atoms'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface SplitInputProps {
  sessionId: string
  atoms: ShellSessionAtoms
  /** Send text input to PTY */
  onSend?: (sessionId: string, text: string) => void
  /** Placeholder text */
  placeholder?: string
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SplitInput({
  sessionId,
  atoms,
  onSend,
  placeholder = 'Type a command…',
  className,
}: SplitInputProps) {
  const controlMode = useAtomValue(atoms.controlMode$)
  const controller = useAtomValue(atoms.controller$)
  const status = useAtomValue(atoms.status$)

  // UI-only input state — acceptable useState (ephemeral form state)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isAlive = status === 'starting' || status === 'running'

  // Gate: only show when human can type
  const humanCanType =
    controlMode === 'human-controlled' ||
    (controlMode === 'supervised' && controller === 'human')
  if (!humanCanType || !isAlive) return null

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend?.(sessionId, trimmed + '\n')
    setValue('')
    inputRef.current?.focus()
  }, [sessionId, value, onSend])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 border-t border-neutral-800 bg-neutral-900/30',
        className,
      )}
    >
      <span
        className="text-amber-500/60 font-mono shrink-0"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        $
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'flex-1 bg-transparent border-none outline-none font-mono text-neutral-300',
          'placeholder:text-neutral-700',
        )}
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim()}
        className={cn(
          'px-2 py-0.5 rounded border font-mono transition-colors',
          value.trim()
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            : 'bg-neutral-800/50 text-neutral-600 border-neutral-700 cursor-not-allowed',
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Send
      </button>
    </div>
  )
}
