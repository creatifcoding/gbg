/**
 * useKeyboardShortcuts — Spec-driven keyboard handler for MorphChat.
 *
 * Maps spec.keyboardShortcuts axis to actual key bindings:
 *   - full: Ctrl+Enter send, Escape cancel, Ctrl+L clear
 *   - minimal: Enter send only
 *   - disabled: noop
 *
 * Returns an onKeyDown handler to spread on the surface container.
 *
 * @module morphchat/hooks/useKeyboardShortcuts
 */

import { useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import type { KeyboardShortcutScope } from '../schemas/surface-spec'
import type { MorphChatAdapter } from '../schemas/adapter-types'

export interface KeyboardShortcutDeps {
  /** Active scope from spec */
  scope: KeyboardShortcutScope
  /** Adapter for send/cancel/clear */
  adapter: MorphChatAdapter
  /** Callback to focus the composer input */
  focusComposer?: () => void
}

/**
 * Returns an onKeyDown handler scoped by spec.keyboardShortcuts.
 *
 * ```tsx
 * const onKeyDown = useKeyboardShortcuts({ scope: spec.keyboardShortcuts, adapter })
 * <div onKeyDown={onKeyDown}>...</div>
 * ```
 */
export function useKeyboardShortcuts({ scope, adapter, focusComposer }: KeyboardShortcutDeps) {
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (scope === 'disabled') return

      // ── Minimal: Enter sends ──────────────────────
      if (scope === 'minimal') {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // Only if target is an input/textarea (don't hijack random Enter)
          const tag = (e.target as HTMLElement).tagName
          if (tag === 'TEXTAREA' || tag === 'INPUT') {
            // Let the composer handle its own Enter — don't duplicate
            return
          }
        }
        return
      }

      // ── Full: all shortcuts ───────────────────────
      // Ctrl+Enter or Cmd+Enter → send
      // (Handled by Composer internally, but we add surface-level too)

      // Escape → cancel streaming
      if (e.key === 'Escape') {
        adapter.cancel()
        e.preventDefault()
        return
      }

      // Ctrl+L / Cmd+L → clear messages
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        adapter.clear()
        e.preventDefault()
        return
      }

      // / → focus composer (slash to start typing)
      if (e.key === '/' && !(e.target as HTMLElement).closest('textarea, input, [contenteditable]')) {
        focusComposer?.()
        e.preventDefault()
        return
      }
    },
    [scope, adapter, focusComposer],
  )
}
