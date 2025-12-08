/**
 * Keybinding Testbed
 *
 * UI for viewing and reconfiguring keyboard shortcuts.
 * Uses the command system's override mechanism.
 *
 * Architecture:
 * - Reads from effectiveBindingsAtom (defaults + overrides)
 * - Writes via CommandService.overrideBinding()
 * - Groups commands by category
 * - KeyCaptureModal for rebinding
 *
 * Design: TMNL Design System — monospace, brutalist, terminal-native
 */

import { useState, useEffect, useCallback, useContext, useRef } from 'react'
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import { TMNL_TOKENS } from '@/components/tldraw/shapes/data-grid-theme'

// Import command system
import '@/lib/commands/defaults'
import {
  getRegisteredCommands,
  getDefaultBindings,
  effectiveBindingsAtom,
  bindingOverridesAtom,
  CommandService,
  useKeybindingPersistence,
} from '@/lib/commands'
import type { Command, KeyBinding, CommandCategory } from '@/lib/commands/types'

// ─────────────────────────────────────────────────────────────────────────────
// Design Tokens
// ─────────────────────────────────────────────────────────────────────────────

const KB_TOKENS = {
  colors: {
    ...TMNL_TOKENS.colors,
    keyBg: TMNL_TOKENS.colors.backgroundTertiary,
    keyBorder: TMNL_TOKENS.colors.borderDefault,
    keyText: TMNL_TOKENS.colors.accentCyan,
    keyModifier: TMNL_TOKENS.colors.accentViolet,
    categoryHeader: TMNL_TOKENS.colors.textMuted,
    rowHover: TMNL_TOKENS.colors.backgroundHover,
    conflictBg: '#7f1d1d20',
    conflictBorder: '#dc2626',
    overrideBadge: TMNL_TOKENS.colors.accentOrange,
    resetButton: TMNL_TOKENS.colors.textDisabled,
    captureOverlay: 'rgba(0, 0, 0, 0.85)',
    captureBox: TMNL_TOKENS.colors.backgroundSecondary,
    captureBorder: TMNL_TOKENS.colors.accentCyan,
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: TMNL_TOKENS.colors.black,
    color: TMNL_TOKENS.colors.textPrimary,
    fontFamily: TMNL_TOKENS.typography.fontFamily.join(', '),
    fontSize: TMNL_TOKENS.typography.fontSizeMd,
    padding: 32,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: KB_TOKENS.colors.accentCyan,
    marginBottom: 8,
    letterSpacing: '0.05em',
  },
  subtitle: {
    fontSize: TMNL_TOKENS.typography.fontSizeSm,
    color: TMNL_TOKENS.colors.textMuted,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
    padding: 12,
    backgroundColor: TMNL_TOKENS.colors.backgroundSecondary,
    border: `1px solid ${TMNL_TOKENS.colors.borderDefault}`,
  },
  searchInput: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: TMNL_TOKENS.colors.black,
    border: `1px solid ${TMNL_TOKENS.colors.borderDefault}`,
    color: TMNL_TOKENS.colors.textPrimary,
    fontFamily: TMNL_TOKENS.typography.fontFamily.join(', '),
    fontSize: TMNL_TOKENS.typography.fontSizeSm,
    outline: 'none',
  },
  resetAllButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: `1px solid ${TMNL_TOKENS.colors.borderDefault}`,
    color: TMNL_TOKENS.colors.textSecondary,
    fontFamily: TMNL_TOKENS.typography.fontFamily.join(', '),
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  statsBar: {
    display: 'flex',
    gap: 24,
    marginBottom: 24,
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    color: TMNL_TOKENS.colors.textMuted,
  },
  statItem: {
    display: 'flex',
    gap: 8,
  },
  statValue: {
    color: KB_TOKENS.colors.accentCyan,
  },
  categorySection: {
    marginBottom: 32,
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: `1px solid ${TMNL_TOKENS.colors.borderMuted}`,
  },
  categoryName: {
    fontSize: TMNL_TOKENS.typography.fontSizeSm,
    fontWeight: 600,
    color: KB_TOKENS.colors.categoryHeader,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  categoryCount: {
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    color: TMNL_TOKENS.colors.textDisabled,
  },
  commandRow: (isHovered: boolean, hasConflict: boolean, isModified: boolean) => ({
    display: 'grid',
    gridTemplateColumns: '1fr 200px 80px',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: hasConflict
      ? KB_TOKENS.colors.conflictBg
      : isHovered
        ? KB_TOKENS.colors.rowHover
        : 'transparent',
    borderLeft: hasConflict
      ? `3px solid ${KB_TOKENS.colors.conflictBorder}`
      : isModified
        ? `3px solid ${KB_TOKENS.colors.overrideBadge}`
        : '3px solid transparent',
    transition: 'background-color 0.1s ease',
  }),
  commandInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  commandName: {
    fontSize: TMNL_TOKENS.typography.fontSizeSm,
    color: TMNL_TOKENS.colors.textPrimary,
    fontWeight: 500,
  },
  commandId: {
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    color: TMNL_TOKENS.colors.textDisabled,
  },
  commandDescription: {
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    color: TMNL_TOKENS.colors.textMuted,
  },
  keybindingCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  keybindingButton: (isModified: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    backgroundColor: KB_TOKENS.colors.keyBg,
    border: `1px solid ${isModified ? KB_TOKENS.colors.overrideBadge : KB_TOKENS.colors.keyBorder}`,
    color: KB_TOKENS.colors.keyText,
    fontFamily: TMNL_TOKENS.typography.fontFamily.join(', '),
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    cursor: 'pointer',
    minWidth: 60,
    justifyContent: 'center',
  }),
  modifierKey: {
    color: KB_TOKENS.colors.keyModifier,
  },
  actionCell: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  resetButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: KB_TOKENS.colors.resetButton,
    fontFamily: TMNL_TOKENS.typography.fontFamily.join(', '),
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    cursor: 'pointer',
    opacity: 0.6,
  },
  // Modal styles
  captureOverlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: KB_TOKENS.colors.captureOverlay,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  captureBox: {
    padding: 32,
    backgroundColor: KB_TOKENS.colors.captureBox,
    border: `2px solid ${KB_TOKENS.colors.captureBorder}`,
    textAlign: 'center' as const,
    minWidth: 400,
  },
  captureTitle: {
    fontSize: TMNL_TOKENS.typography.fontSizeMd,
    color: TMNL_TOKENS.colors.textPrimary,
    marginBottom: 8,
  },
  captureCommand: {
    fontSize: TMNL_TOKENS.typography.fontSizeSm,
    color: KB_TOKENS.colors.accentCyan,
    marginBottom: 24,
  },
  captureInstruction: {
    fontSize: TMNL_TOKENS.typography.fontSizeSm,
    color: TMNL_TOKENS.colors.textMuted,
    marginBottom: 16,
  },
  capturePreview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    padding: 16,
    backgroundColor: TMNL_TOKENS.colors.black,
    border: `1px solid ${TMNL_TOKENS.colors.borderDefault}`,
    marginBottom: 24,
  },
  captureKey: {
    padding: '6px 12px',
    backgroundColor: KB_TOKENS.colors.keyBg,
    border: `1px solid ${KB_TOKENS.colors.keyBorder}`,
    color: KB_TOKENS.colors.keyText,
    fontSize: TMNL_TOKENS.typography.fontSizeMd,
  },
  captureButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
  },
  captureButton: (primary: boolean) => ({
    padding: '8px 24px',
    backgroundColor: primary ? KB_TOKENS.colors.accentCyan : 'transparent',
    border: `1px solid ${primary ? KB_TOKENS.colors.accentCyan : TMNL_TOKENS.colors.borderDefault}`,
    color: primary ? TMNL_TOKENS.colors.black : TMNL_TOKENS.colors.textSecondary,
    fontFamily: TMNL_TOKENS.typography.fontFamily.join(', '),
    fontSize: TMNL_TOKENS.typography.fontSizeSm,
    cursor: 'pointer',
  }),
  conflictWarning: {
    marginTop: 16,
    padding: 12,
    backgroundColor: KB_TOKENS.colors.conflictBg,
    border: `1px solid ${KB_TOKENS.colors.conflictBorder}`,
    color: KB_TOKENS.colors.conflictBorder,
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
  },
  emptyState: {
    padding: 48,
    textAlign: 'center' as const,
    color: TMNL_TOKENS.colors.textDisabled,
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CommandWithBinding {
  command: Command
  binding: KeyBinding | undefined
  defaultBinding: KeyBinding | undefined
  isModified: boolean
}

interface KeyCapture {
  commandId: string
  commandName: string
  keys: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_ORDER: CommandCategory[] = [
  'file',
  'edit',
  'view',
  'navigation',
  'selection',
  'grid',
  'canvas',
  'system',
]

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  file: 'File',
  edit: 'Edit',
  view: 'View',
  navigation: 'Navigation',
  selection: 'Selection',
  grid: 'Grid',
  canvas: 'Canvas',
  system: 'System',
}

function formatKeys(keys: string): string {
  return keys
    .split(/\s+/)
    .map((chord) =>
      chord
        .split('+')
        .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
        .join('+')
    )
    .join(' → ')
}

function parseKeyEvent(e: KeyboardEvent): string[] {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  if (e.metaKey) parts.push('meta')

  // Normalize key name
  let key = e.key.toLowerCase()
  if (key === ' ') key = 'space'
  else if (key === 'escape') key = 'esc'
  else if (key === 'arrowup') key = 'up'
  else if (key === 'arrowdown') key = 'down'
  else if (key === 'arrowleft') key = 'left'
  else if (key === 'arrowright') key = 'right'

  // Skip modifier-only presses
  if (['control', 'alt', 'shift', 'meta'].includes(key)) {
    return parts
  }

  parts.push(key)
  return parts
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function KeyDisplay({ keys }: { keys: string }) {
  const parts = keys.split(/\s+/)

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {parts.map((chord, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {chord.split('+').map((k, j) => {
            const isModifier = ['ctrl', 'alt', 'shift', 'meta', 'cmd'].includes(k.toLowerCase())
            return (
              <kbd
                key={j}
                style={{
                  padding: '2px 6px',
                  backgroundColor: KB_TOKENS.colors.keyBg,
                  border: `1px solid ${KB_TOKENS.colors.keyBorder}`,
                  color: isModifier ? KB_TOKENS.colors.keyModifier : KB_TOKENS.colors.keyText,
                  fontSize: TMNL_TOKENS.typography.fontSizeXs,
                }}
              >
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </kbd>
            )
          })}
          {i < parts.length - 1 && (
            <span style={{ color: TMNL_TOKENS.colors.textDisabled, margin: '0 4px' }}>→</span>
          )}
        </span>
      ))}
    </span>
  )
}

function KeyCaptureModal({
  capture,
  conflict,
  onConfirm,
  onCancel,
  onClear,
}: {
  capture: KeyCapture
  conflict: Command | null
  onConfirm: () => void
  onCancel: () => void
  onClear: () => void
}) {
  const keysStr = capture.keys.join('+')

  return (
    <div style={styles.captureOverlay} onClick={onCancel}>
      <div style={styles.captureBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.captureTitle}>Set Keybinding</div>
        <div style={styles.captureCommand}>{capture.commandName}</div>
        <div style={styles.captureInstruction}>Press desired key combination...</div>

        <div style={styles.capturePreview}>
          {capture.keys.length === 0 ? (
            <span style={{ color: TMNL_TOKENS.colors.textDisabled }}>Waiting for input...</span>
          ) : (
            <KeyDisplay keys={keysStr} />
          )}
        </div>

        {conflict && (
          <div style={styles.conflictWarning}>
            ⚠ Conflicts with: <strong>{conflict.name}</strong> ({conflict.id})
          </div>
        )}

        <div style={styles.captureButtons}>
          <button style={styles.captureButton(false)} onClick={onCancel}>
            Cancel
          </button>
          <button style={styles.captureButton(false)} onClick={onClear}>
            Unbind
          </button>
          <button
            style={styles.captureButton(true)}
            onClick={onConfirm}
            disabled={capture.keys.length === 0}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function CommandRow({
  item,
  onRebind,
  onReset,
}: {
  item: CommandWithBinding
  onRebind: () => void
  onReset: () => void
}) {
  const [hover, setHover] = useState(false)
  const { command, binding, isModified } = item
  const keysStr = binding?.keys ?? '—'

  return (
    <div
      style={styles.commandRow(hover, false, isModified)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={styles.commandInfo}>
        <div style={styles.commandName}>{command.name}</div>
        <div style={styles.commandId}>{command.id}</div>
        {command.description && <div style={styles.commandDescription}>{command.description}</div>}
      </div>

      <div style={styles.keybindingCell}>
        <button style={styles.keybindingButton(isModified)} onClick={onRebind}>
          {keysStr === '—' ? <span style={{ opacity: 0.5 }}>—</span> : <KeyDisplay keys={keysStr} />}
        </button>
      </div>

      <div style={styles.actionCell}>
        {isModified && (
          <button
            style={styles.resetButton}
            onClick={onReset}
            title="Reset to default"
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.6'
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function KeybindingTestbed() {
  const registry = useContext(RegistryContext)
  const effectiveBindings = useAtomValue(effectiveBindingsAtom)
  const overrides = useAtomValue(bindingOverridesAtom)

  // Persistence: load from localStorage on mount, save on change
  const { isLoaded } = useKeybindingPersistence({ debug: true })

  const [search, setSearch] = useState('')
  const [capture, setCapture] = useState<KeyCapture | null>(null)
  const [conflict, setConflict] = useState<Command | null>(null)

  // Build command list with bindings
  const commands = getRegisteredCommands()
  const defaultBindings = getDefaultBindings()

  const commandList: CommandWithBinding[] = Array.from(commands.values()).map((command) => {
    const binding = effectiveBindings.find((b) => b.commandId === command.id)
    const defaultBinding = defaultBindings.find((b) => b.commandId === command.id)
    const override = overrides.find((o) => o.commandId === command.id)
    const isModified = override !== undefined

    return { command, binding, defaultBinding, isModified }
  })

  // Filter by search
  const filteredList = commandList.filter((item) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      item.command.name.toLowerCase().includes(q) ||
      item.command.id.toLowerCase().includes(q) ||
      (item.command.description?.toLowerCase().includes(q) ?? false) ||
      (item.binding?.keys.toLowerCase().includes(q) ?? false)
    )
  })

  // Group by category
  const groupedCommands = CATEGORY_ORDER.reduce(
    (acc, category) => {
      const items = filteredList.filter((item) => item.command.category === category)
      if (items.length > 0) {
        acc[category] = items
      }
      return acc
    },
    {} as Record<CommandCategory, CommandWithBinding[]>
  )

  // Stats
  const totalCommands = commands.size
  const totalOverrides = overrides.length
  const unboundCommands = commandList.filter((c) => !c.binding).length

  // Key capture handler
  useEffect(() => {
    if (!capture) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const parts = parseKeyEvent(e)
      if (parts.length === 0) return // Modifier-only press

      // Build key string
      const keysStr = parts.join('+')

      // Check for conflicts
      const conflicting = effectiveBindings.find(
        (b) => b.keys === keysStr && b.commandId !== capture.commandId
      )
      if (conflicting) {
        const conflictCmd = commands.get(conflicting.commandId)
        setConflict(conflictCmd ?? null)
      } else {
        setConflict(null)
      }

      setCapture((prev) => (prev ? { ...prev, keys: parts } : null))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [capture, effectiveBindings, commands])

  // Actions
  const handleRebind = useCallback((command: Command) => {
    setCapture({
      commandId: command.id,
      commandName: command.name,
      keys: [],
    })
    setConflict(null)
  }, [])

  const handleConfirmRebind = useCallback(() => {
    if (!capture || capture.keys.length === 0) return

    const keysStr = capture.keys.join('+')

    Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* CommandService
        yield* service.overrideBinding(registry, capture.commandId, keysStr)
      }).pipe(Effect.provide(CommandService.Default))
    )

    setCapture(null)
    setConflict(null)
  }, [capture, registry])

  const handleCancelRebind = useCallback(() => {
    setCapture(null)
    setConflict(null)
  }, [])

  const handleClearBinding = useCallback(() => {
    if (!capture) return

    Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* CommandService
        yield* service.overrideBinding(registry, capture.commandId, null)
      }).pipe(Effect.provide(CommandService.Default))
    )

    setCapture(null)
    setConflict(null)
  }, [capture, registry])

  const handleResetBinding = useCallback(
    (commandId: string) => {
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* CommandService
          yield* service.resetBinding(registry, commandId)
        }).pipe(Effect.provide(CommandService.Default))
      )
    },
    [registry]
  )

  const handleResetAll = useCallback(() => {
    if (!confirm('Reset all keybindings to defaults?')) return

    Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* CommandService
        yield* service.resetAllBindings(registry)
      }).pipe(Effect.provide(CommandService.Default))
    )
  }, [registry])

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>KEYBINDING TESTBED</h1>
        <p style={styles.subtitle}>View and reconfigure keyboard shortcuts</p>
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          type="text"
          placeholder="Search commands..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <button
          style={styles.resetAllButton}
          onClick={handleResetAll}
          disabled={totalOverrides === 0}
        >
          Reset All
        </button>
      </div>

      {/* Stats */}
      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <span>Commands:</span>
          <span style={styles.statValue}>{totalCommands}</span>
        </div>
        <div style={styles.statItem}>
          <span>Modified:</span>
          <span style={styles.statValue}>{totalOverrides}</span>
        </div>
        <div style={styles.statItem}>
          <span>Unbound:</span>
          <span style={styles.statValue}>{unboundCommands}</span>
        </div>
      </div>

      {/* Command List */}
      {Object.entries(groupedCommands).length === 0 ? (
        <div style={styles.emptyState}>No commands found matching "{search}"</div>
      ) : (
        Object.entries(groupedCommands).map(([category, items]) => (
          <div key={category} style={styles.categorySection}>
            <div style={styles.categoryHeader}>
              <span style={styles.categoryName}>
                {CATEGORY_LABELS[category as CommandCategory] ?? category}
              </span>
              <span style={styles.categoryCount}>{items.length} commands</span>
            </div>
            {items.map((item) => (
              <CommandRow
                key={item.command.id}
                item={item}
                onRebind={() => handleRebind(item.command)}
                onReset={() => handleResetBinding(item.command.id)}
              />
            ))}
          </div>
        ))
      )}

      {/* Key Capture Modal */}
      {capture && (
        <KeyCaptureModal
          capture={capture}
          conflict={conflict}
          onConfirm={handleConfirmRebind}
          onCancel={handleCancelRebind}
          onClear={handleClearBinding}
        />
      )}
    </div>
  )
}
