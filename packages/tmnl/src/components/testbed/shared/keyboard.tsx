/**
 * Keyboard UI Primitives
 *
 * Basic keyboard visualization components for testbeds.
 * More complex keyboard UI (modal, scope panels) stays in their testbeds
 * due to tight coupling with testbed-specific types.
 *
 * @provenance
 * ────────────────────────────────────────────────────────────────────────────
 * COMPONENT              │ EXTRACTED FROM                     │ DATE
 * ────────────────────────────────────────────────────────────────────────────
 * KeyBadge               │ KeybindingTestbed.tsx              │ 2025-12-02
 *                        │ HotkeyTestbed.tsx                  │
 *                        │ Pattern used across keybind UIs    │
 * ────────────────────────────────────────────────────────────────────────────
 * KeyChordDisplay        │ KeybindingTestbed.tsx              │ 2025-12-02
 *                        │ HotkeyTestbed.tsx                  │
 * ────────────────────────────────────────────────────────────────────────────
 * KeySequenceDisplay     │ KeybindingTestbed.tsx              │ 2025-12-02
 *                        │ (For vim-style multi-chord seqs)   │
 * ────────────────────────────────────────────────────────────────────────────
 * ShortcutHint           │ Multiple testbeds                  │ 2025-12-02
 * ────────────────────────────────────────────────────────────────────────────
 *
 * RATIONALE:
 * Keyboard visualization is a common pattern across hotkey and keybinding
 * testbeds. These primitives handle the basic rendering:
 *
 * 1. KeyBadge - Single key with modifier/base styling
 * 2. KeyChordDisplay - Multiple keys like "Ctrl+Shift+K"
 * 3. KeySequenceDisplay - Vim-style sequences like "g g" → "G G"
 * 4. ShortcutHint - Label + keys inline display
 *
 * WHAT STAYS IN TESTBEDS:
 * - KeyboardModal (full scope panel with state machine)
 * - Conflict detection UI
 * - Binding override panels
 *
 * These are too tightly coupled to specific testbed state/types to extract.
 * The primitives here are purely presentational.
 *
 * TYPOGRAPHY:
 * Uses CSS variable pattern for ScaleProvider compatibility.
 */

import type { ReactNode } from 'react'

// =============================================================================
// KEY BADGE
// =============================================================================

export interface KeyBadgeProps {
  children: ReactNode
  variant?: 'base' | 'modifier'
  className?: string
}

/**
 * Single keyboard key badge.
 */
export function KeyBadge({ children, variant = 'base', className = '' }: KeyBadgeProps) {
  const variantStyles = {
    base: 'bg-neutral-800 border-neutral-700 text-neutral-200',
    modifier: 'bg-neutral-900 border-neutral-600 text-cyan-400',
  }

  return (
    <kbd
      className={`inline-flex items-center justify-center px-2 py-0.5 border rounded font-mono ${variantStyles[variant]} ${className}`}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {children}
    </kbd>
  )
}

// =============================================================================
// KEY CHORD DISPLAY
// =============================================================================

export interface KeyChordDisplayProps {
  /** String like "ctrl+shift+k" or "cmd+p" */
  chord: string
  className?: string
}

/**
 * Display a key chord (e.g., "ctrl+shift+k") with proper styling.
 */
export function KeyChordDisplay({ chord, className = '' }: KeyChordDisplayProps) {
  const modifiers = ['ctrl', 'alt', 'shift', 'meta', 'cmd', 'super']
  const parts = chord.split('+').map((k) => k.trim().toLowerCase())

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {parts.map((key, i) => {
        const isModifier = modifiers.includes(key)
        const displayKey = key.charAt(0).toUpperCase() + key.slice(1)
        return (
          <KeyBadge key={i} variant={isModifier ? 'modifier' : 'base'}>
            {displayKey}
          </KeyBadge>
        )
      })}
    </span>
  )
}

// =============================================================================
// KEY SEQUENCE DISPLAY
// =============================================================================

export interface KeySequenceDisplayProps {
  /** Array of chords like ["ctrl+k", "ctrl+c"] or space-separated string */
  sequence: string | string[]
  className?: string
}

/**
 * Display a key sequence (multiple chords with arrows between).
 */
export function KeySequenceDisplay({ sequence, className = '' }: KeySequenceDisplayProps) {
  const chords = typeof sequence === 'string' ? sequence.split(/\s+/) : sequence

  if (chords.length === 0 || (chords.length === 1 && chords[0] === '')) {
    return (
      <span className={`text-neutral-500 font-mono ${className}`} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        —
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {chords.map((chord, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          <KeyChordDisplay chord={chord} />
          {i < chords.length - 1 && (
            <span className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              →
            </span>
          )}
        </span>
      ))}
    </span>
  )
}

// =============================================================================
// SHORTCUT HINT
// =============================================================================

export interface ShortcutHintProps {
  label: string
  keys: string
  className?: string
}

/**
 * Inline label + keyboard shortcut hint.
 */
export function ShortcutHint({ label, keys, className = '' }: ShortcutHintProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="text-neutral-400" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        {label}
      </span>
      <KeyChordDisplay chord={keys} />
    </div>
  )
}
