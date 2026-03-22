/**
 * Hotkey Testbed
 *
 * Development playground for the TMNL command system.
 * Tests: which-key, sequences, scopes.
 *
 * Architecture:
 * - Source atoms hold state (reactive)
 * - Derived atoms compute from sources
 * - hotkeyActions mutate via registry
 * - processKeyboardEvent is pure
 *
 * Design: TMNL Design System — monospace, brutalist, terminal-native
 */

import { useState, useEffect, useCallback, useRef, useContext } from 'react'
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react'
import { Effect, Runtime } from 'effect'
import type { KeyChord, KeySequence, Binding, WhichKeyEntry, HotkeyConfig } from '@/lib/hotkeys'
import {
  // Source atoms
  bindingsSourceAtom,
  sequenceSourceAtom,
  scopeStackSourceAtom,
  commandsSourceAtom,
  configSourceAtom,
  // Derived atoms
  activeScopeAtom,
  scopedBindingsAtom,
  whichKeyEntriesAtom,
  // Operations
  hotkeyOps,
  hotkeyActions,
  processKeyboardEvent,
  // Services
  KeyParser,
  Scopes,
} from '@/lib/hotkeys'
import { TMNL_TOKENS } from '@/components/tldraw/shapes/data-grid-theme'

// Import command system defaults (triggers registration) and wiring hook
import '@/lib/commands/defaults'
import { useCommandWire, getRegisteredCommands, getDefaultBindings } from '@/lib/commands'

// ─────────────────────────────────────────────────────────────────────────────
// TMNL Hotkey Tokens (extends core TMNL_TOKENS)
// ─────────────────────────────────────────────────────────────────────────────

const HOTKEY_TOKENS = {
  colors: {
    ...TMNL_TOKENS.colors,
    keyDefault: '#ffffff',
    keyModifier: TMNL_TOKENS.colors.accentCyan,
    keyPressed: TMNL_TOKENS.colors.accentGreen,
    scopeActive: TMNL_TOKENS.colors.accentCyan,
    scopeInactive: TMNL_TOKENS.colors.textMuted,
    sequenceArrow: TMNL_TOKENS.colors.textDisabled,
    commandExecuted: TMNL_TOKENS.colors.accentGreen,
    logTimestamp: TMNL_TOKENS.colors.textDisabled,
    logEvent: TMNL_TOKENS.colors.accentGreen,
    passthroughWarning: '#f59e0b',
  },
  timing: {
    sequenceTimeout: 1000,
    whichKeyDelay: 500,
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Inline Styles (TMNL Design System)
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
    color: HOTKEY_TOKENS.colors.accentCyan,
    marginBottom: 8,
    letterSpacing: '0.05em',
  },
  subtitle: {
    fontSize: TMNL_TOKENS.typography.fontSizeSm,
    color: TMNL_TOKENS.colors.textMuted,
  },
  liveIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
    padding: '4px 8px',
    backgroundColor: '#10b98120',
    border: '1px solid #10b981',
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    color: '#10b981',
  },
  liveDot: {
    width: 6,
    height: 6,
    backgroundColor: '#10b981',
    borderRadius: '50%',
    animation: 'pulse 2s infinite',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 32,
    padding: 16,
    backgroundColor: TMNL_TOKENS.colors.backgroundSecondary,
    border: `1px solid ${TMNL_TOKENS.colors.borderDefault}`,
    marginBottom: 24,
  },
  statusItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  statusLabel: {
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    color: TMNL_TOKENS.colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  statusValue: {
    fontSize: TMNL_TOKENS.typography.fontSizeMd,
    color: HOTKEY_TOKENS.colors.scopeActive,
    fontWeight: 500,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 24,
    marginBottom: 24,
  },
  scopeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  scopePanel: (isActive: boolean) => ({
    padding: 16,
    backgroundColor: isActive
      ? TMNL_TOKENS.colors.backgroundTertiary
      : TMNL_TOKENS.colors.backgroundSecondary,
    border: `2px solid ${isActive ? HOTKEY_TOKENS.colors.accentCyan : TMNL_TOKENS.colors.borderDefault}`,
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  }),
  scopeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scopeIndicator: (isActive: boolean) => ({
    width: 6,
    height: 6,
    backgroundColor: isActive ? HOTKEY_TOKENS.colors.accentCyan : TMNL_TOKENS.colors.textDisabled,
  }),
  scopeName: {
    fontSize: TMNL_TOKENS.typography.fontSizeMd,
    fontWeight: 600,
    color: TMNL_TOKENS.colors.textPrimary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  scopeActiveTag: {
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    color: HOTKEY_TOKENS.colors.accentCyan,
    marginLeft: 'auto',
  },
  scopeCount: {
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    color: TMNL_TOKENS.colors.textMuted,
    marginBottom: 12,
  },
  scopeBinding: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    padding: '4px 0',
    borderBottom: `1px solid ${TMNL_TOKENS.colors.borderMuted}`,
  },
  scopeBindingName: {
    color: TMNL_TOKENS.colors.textSecondary,
  },
  scopeBindingKeys: {
    color: HOTKEY_TOKENS.colors.accentCyan,
  },
  eventLog: {
    height: 200,
    overflow: 'auto',
    backgroundColor: TMNL_TOKENS.colors.black,
    border: `1px solid ${TMNL_TOKENS.colors.borderDefault}`,
    padding: 12,
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
  },
  eventLogEmpty: {
    color: TMNL_TOKENS.colors.textDisabled,
    fontStyle: 'italic',
  },
  eventLogEntry: {
    color: HOTKEY_TOKENS.colors.logEvent,
    lineHeight: 1.6,
  },
  eventLogIndex: {
    color: TMNL_TOKENS.colors.textDisabled,
    marginRight: 8,
  },
  clearButton: {
    marginTop: 8,
    padding: '6px 12px',
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    backgroundColor: TMNL_TOKENS.colors.backgroundTertiary,
    border: `1px solid ${TMNL_TOKENS.colors.borderDefault}`,
    color: TMNL_TOKENS.colors.textSecondary,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  commandGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  commandCard: {
    padding: 12,
    backgroundColor: TMNL_TOKENS.colors.backgroundSecondary,
    border: `1px solid ${TMNL_TOKENS.colors.borderDefault}`,
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  },
  commandCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  commandName: {
    fontSize: TMNL_TOKENS.typography.fontSizeMd,
    fontWeight: 500,
    color: TMNL_TOKENS.colors.textPrimary,
  },
  commandId: {
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    color: TMNL_TOKENS.colors.textDisabled,
    marginTop: 4,
  },
  commandKeys: {
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    color: HOTKEY_TOKENS.colors.accentCyan,
    textAlign: 'right' as const,
  },
  commandScope: {
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    color: TMNL_TOKENS.colors.textDisabled,
    marginTop: 4,
    textAlign: 'right' as const,
  },
  sectionTitle: {
    fontSize: TMNL_TOKENS.typography.fontSizeSm,
    fontWeight: 600,
    color: TMNL_TOKENS.colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  whichKeyPopup: {
    position: 'fixed' as const,
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: TMNL_TOKENS.colors.backgroundSecondary,
    border: `2px solid ${HOTKEY_TOKENS.colors.accentCyan}`,
    padding: 16,
    minWidth: 300,
    zIndex: 1000,
  },
  whichKeyTitle: {
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
    color: TMNL_TOKENS.colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  whichKeyEntry: {
    display: 'flex',
    gap: 12,
    padding: '4px 0',
    fontSize: TMNL_TOKENS.typography.fontSizeSm,
  },
  whichKeyKey: {
    color: HOTKEY_TOKENS.colors.accentCyan,
    fontWeight: 600,
    minWidth: 60,
  },
  whichKeyLabel: {
    color: TMNL_TOKENS.colors.textSecondary,
  },
  whichKeyPrefix: {
    color: TMNL_TOKENS.colors.textMuted,
  },
  helpBox: {
    marginTop: 32,
    padding: 16,
    backgroundColor: TMNL_TOKENS.colors.backgroundSecondary,
    border: `1px solid ${TMNL_TOKENS.colors.borderMuted}`,
    fontSize: TMNL_TOKENS.typography.fontSizeSm,
    color: TMNL_TOKENS.colors.textMuted,
  },
  helpTitle: {
    fontWeight: 600,
    color: TMNL_TOKENS.colors.textSecondary,
    marginBottom: 8,
  },
  helpList: {
    margin: 0,
    paddingLeft: 20,
    lineHeight: 1.8,
  },
  helpCode: {
    color: HOTKEY_TOKENS.colors.accentCyan,
    backgroundColor: TMNL_TOKENS.colors.backgroundTertiary,
    padding: '2px 6px',
  },
  keyChord: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    backgroundColor: TMNL_TOKENS.colors.backgroundTertiary,
    border: `1px solid ${TMNL_TOKENS.colors.borderDefault}`,
    fontSize: TMNL_TOKENS.typography.fontSizeXs,
  },
  keyModifier: {
    color: HOTKEY_TOKENS.colors.keyModifier,
  },
  keyBase: {
    color: HOTKEY_TOKENS.colors.keyDefault,
  },
  sequenceContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  sequenceArrow: {
    color: HOTKEY_TOKENS.colors.sequenceArrow,
  },
  sequenceEmpty: {
    color: TMNL_TOKENS.colors.textDisabled,
    fontStyle: 'italic',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Test Commands
// ─────────────────────────────────────────────────────────────────────────────

interface TestCommand {
  id: string
  name: string
  keys: string
  scope: string
  description?: string
}

const TEST_COMMANDS: TestCommand[] = [
  { id: 'test.save', name: 'Save', keys: 'ctrl+s', scope: 'global', description: 'Save current file' },
  { id: 'test.open', name: 'Open File', keys: 'ctrl+o', scope: 'global' },
  { id: 'palette.open', name: 'Command Palette', keys: 'ctrl+shift+p', scope: 'global', description: 'Open M-x style command palette' },
  { id: 'test.goInbox', name: 'Go to Inbox', keys: 'g i', scope: 'global', description: 'Gmail-style sequence' },
  { id: 'test.goTop', name: 'Go to Top', keys: 'g g', scope: 'global', description: 'Vim-style go to top' },
  { id: 'editor.format', name: 'Format Document', keys: 'shift+alt+f', scope: 'editor' },
  { id: 'editor.comment', name: 'Toggle Comment', keys: 'ctrl+/', scope: 'editor' },
  { id: 'grid.addRow', name: 'Add Row', keys: 'ctrl+enter', scope: 'grid' },
  { id: 'grid.deleteRow', name: 'Delete Row', keys: 'ctrl+backspace', scope: 'grid' },
]

// ─────────────────────────────────────────────────────────────────────────────
// KeyParser Runtime (for parsing key strings)
// ─────────────────────────────────────────────────────────────────────────────

const keyParserRuntime = Runtime.defaultRuntime.pipe(
  Runtime.provideService(KeyParser, KeyParser.of({
    parse: (keyString) => Effect.gen(function* () {
      const trimmed = keyString.trim()
      if (trimmed === '') {
        return yield* Effect.fail({ _tag: 'KeyParserError' as const, input: keyString, message: 'Empty' })
      }
      const chordStrings = trimmed.split(/\s+/)
      const chords: KeyChord[] = []
      for (const chordStr of chordStrings) {
        const chord = parseChordString(chordStr)
        chords.push(chord)
      }
      return chords as readonly KeyChord[]
    }),
    serialize: (sequence) => sequence.map(serializeChord).join(' '),
    normalizeKey: (key) => key.toLowerCase(),
    fromEvent: (event) => ({
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
      key: normalizeKey(event.key),
    }),
    chordsEqual: (a, b) => a.ctrl === b.ctrl && a.alt === b.alt && a.shift === b.shift && a.meta === b.meta && a.key === b.key,
    isPrefix: (sequence, prefix) => {
      if (prefix.length >= sequence.length) return false
      for (let i = 0; i < prefix.length; i++) {
        if (sequence[i].key !== prefix[i].key) return false
      }
      return true
    },
  }))
)

function parseChordString(chordStr: string): KeyChord {
  const parts = chordStr.split('+').map((p) => p.trim().toLowerCase())
  const modifiers = { ctrl: false, alt: false, shift: false, meta: false }
  let key = ''

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') modifiers.ctrl = true
    else if (part === 'alt' || part === 'option') modifiers.alt = true
    else if (part === 'shift') modifiers.shift = true
    else if (part === 'meta' || part === 'cmd' || part === 'command') modifiers.meta = true
    else key = normalizeKey(part)
  }

  return { ...modifiers, key }
}

function normalizeKey(key: string): string {
  const lower = key.toLowerCase()
  const aliases: Record<string, string> = {
    esc: 'Escape', escape: 'Escape',
    enter: 'Enter', return: 'Enter',
    space: ' ', spc: ' ',
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    backspace: 'Backspace', bs: 'Backspace',
    delete: 'Delete', del: 'Delete',
  }
  return aliases[lower] ?? (key.length === 1 ? key.toLowerCase() : key)
}

function serializeChord(chord: KeyChord): string {
  const parts: string[] = []
  if (chord.ctrl) parts.push('ctrl')
  if (chord.alt) parts.push('alt')
  if (chord.shift) parts.push('shift')
  if (chord.meta) parts.push('cmd')
  let keyStr = chord.key
  if (chord.key === ' ') keyStr = 'space'
  else if (chord.key === 'Escape') keyStr = 'esc'
  parts.push(keyStr)
  return parts.join('+')
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function KeyDisplay({ chord }: { chord: KeyChord }) {
  return (
    <span style={styles.keyChord}>
      {chord.ctrl && <kbd style={styles.keyModifier}>Ctrl</kbd>}
      {chord.alt && <kbd style={styles.keyModifier}>Alt</kbd>}
      {chord.shift && <kbd style={styles.keyModifier}>Shift</kbd>}
      {chord.meta && <kbd style={styles.keyModifier}>Meta</kbd>}
      <kbd style={styles.keyBase}>{chord.key}</kbd>
    </span>
  )
}

function SequenceDisplay({ sequence }: { sequence: KeySequence }) {
  if (sequence.length === 0) {
    return <span style={styles.sequenceEmpty}>No keys pressed</span>
  }
  return (
    <div style={styles.sequenceContainer}>
      {sequence.map((chord, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyDisplay chord={chord} />
          {i < sequence.length - 1 && <span style={styles.sequenceArrow}>→</span>}
        </div>
      ))}
    </div>
  )
}

function WhichKeyPopup({ entries, prefix }: { entries: readonly WhichKeyEntry[]; prefix: KeySequence }) {
  if (entries.length === 0) return null

  return (
    <div style={styles.whichKeyPopup}>
      <div style={styles.whichKeyTitle}>
        which-key • {prefix.length > 0 ? 'Prefix active' : 'Available'}
      </div>
      {entries.map((entry, i) => (
        <div key={i} style={styles.whichKeyEntry}>
          <span style={styles.whichKeyKey}>{entry.key}</span>
          <span style={entry.isPrefix ? styles.whichKeyPrefix : styles.whichKeyLabel}>
            {entry.label}
          </span>
        </div>
      ))}
    </div>
  )
}

function CommandCard({ command, onExecute }: { command: TestCommand; onExecute: () => void }) {
  const [hover, setHover] = useState(false)

  return (
    <div
      style={{
        ...styles.commandCard,
        borderColor: hover ? HOTKEY_TOKENS.colors.accentCyan : TMNL_TOKENS.colors.borderDefault,
      }}
      onClick={onExecute}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={styles.commandCardHeader}>
        <div>
          <div style={styles.commandName}>{command.name}</div>
          <div style={styles.commandId}>{command.id}</div>
        </div>
        <div>
          <div style={styles.commandKeys}>{command.keys}</div>
          <div style={styles.commandScope}>{command.scope}</div>
        </div>
      </div>
    </div>
  )
}

function ScopePanel({
  scope,
  isActive,
  bindings,
  onActivate,
}: {
  scope: string
  isActive: boolean
  bindings: readonly Binding[]
  onActivate: () => void
}) {
  const scopeBindings = bindings.filter((b) => b.scope === scope || b.scope === 'global')

  return (
    <div style={styles.scopePanel(isActive)} onClick={onActivate}>
      <div style={styles.scopeHeader}>
        <div style={styles.scopeIndicator(isActive)} />
        <span style={styles.scopeName}>{scope}</span>
        {isActive && <span style={styles.scopeActiveTag}>active</span>}
      </div>
      <div style={styles.scopeCount}>{scopeBindings.length} bindings</div>
      {scopeBindings.slice(0, 3).map((b, i) => (
        <div key={i} style={styles.scopeBinding}>
          <span style={styles.scopeBindingName}>{b.commandId}</span>
          <span style={styles.scopeBindingKeys}>
            {b.keys.map((c) => c.key).join(' ')}
          </span>
        </div>
      ))}
    </div>
  )
}

function EventLog({ events, onClear }: { events: string[]; onClear: () => void }) {
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events])

  return (
    <div>
      <div ref={logRef} style={styles.eventLog}>
        {events.length === 0 ? (
          <div style={styles.eventLogEmpty}>Press keys to see events...</div>
        ) : (
          events.map((event, i) => (
            <div key={i} style={styles.eventLogEntry}>
              <span style={styles.eventLogIndex}>[{String(i).padStart(3, '0')}]</span>
              {event}
            </div>
          ))
        )}
      </div>
      <button
        style={styles.clearButton}
        onClick={onClear}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = TMNL_TOKENS.colors.backgroundHover
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = TMNL_TOKENS.colors.backgroundTertiary
        }}
      >
        Clear Log
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Testbed
// ─────────────────────────────────────────────────────────────────────────────

export function HotkeyTestbed() {
  // Get registry for mutations
  const registry = useContext(RegistryContext)

  // Wire command system commands and bindings
  const { isWired, result: wireResult } = useCommandWire({
    debug: true,
    onWired: (result) => {
      console.log(`[HotkeyTestbed] Wired ${result.commandsRegistered} system commands, ${result.bindingsRegistered} bindings`)
    },
  })

  // Subscribe to reactive atoms
  const bindings = useAtomValue(bindingsSourceAtom)
  const currentSequence = useAtomValue(sequenceSourceAtom)
  const activeScope = useAtomValue(activeScopeAtom)
  const scopedBindings = useAtomValue(scopedBindingsAtom)
  const whichKeyEntries = useAtomValue(whichKeyEntriesAtom)
  const commands = useAtomValue(commandsSourceAtom)
  const config = useAtomValue(configSourceAtom)

  // Local state for UI
  const [events, setEvents] = useState<string[]>([])
  const [lastCommand, setLastCommand] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Sequence timeout ref
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const logEvent = useCallback((msg: string) => {
    const timestamp = new Date().toISOString().slice(11, 23)
    setEvents((prev) => [...prev.slice(-50), `${timestamp} ${msg}`])
  }, [])

  // Initialize: register TEST commands (in addition to system commands)
  useEffect(() => {
    if (initialized || !isWired) return

    // Register test commands and bindings (for demo purposes)
    for (const cmd of TEST_COMMANDS) {
      // Skip if already registered by system
      if (commands.has(cmd.id)) continue

      // Register command
      hotkeyActions.registerCommand(
        registry,
        { id: cmd.id, name: cmd.name, description: cmd.description, category: cmd.scope },
        Effect.sync(() => {
          setLastCommand(cmd.id)
          logEvent(`EXECUTE: ${cmd.id}`)
        })
      )

      // Parse and add binding
      const sequence = cmd.keys.split(/\s+/).map(parseChordString)
      const binding: Binding = {
        keys: sequence as KeySequence,
        commandId: cmd.id,
        scope: cmd.scope,
        priority: 0,
        source: 'default',
      }
      hotkeyActions.addBinding(registry, binding)
    }

    setInitialized(true)
    logEvent(`INIT: Hotkey system initialized (${wireResult?.commandsRegistered ?? 0} system + ${TEST_COMMANDS.length} test commands)`)
  }, [initialized, isWired, logEvent, registry, commands, wireResult])

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // Ignore modifier-only presses
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return
      }

      // Clear existing timeout
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current)
        sequenceTimeoutRef.current = null
      }

      // Create chord from event
      const chord: KeyChord = {
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
        key: normalizeKey(e.key),
      }
      const chordStr = serializeChord(chord)

      // Process through pure function
      const { result, newSequence } = processKeyboardEvent(
        chord,
        currentSequence,
        scopedBindings,
        commands
      )

      if (result.type === 'exact') {
        e.preventDefault()
        logEvent(`KEY: ${chordStr} → EXECUTE: ${result.binding.commandId}`)
        setLastCommand(result.binding.commandId)

        // Execute command handler
        const command = commands.get(result.binding.commandId)
        if (command) {
          Effect.runPromise(command.handler).catch((err) =>
            logEvent(`ERROR: ${err}`)
          )
        }

        // Reset sequence
        hotkeyActions.resetSequence(registry)
      } else if (result.type === 'partial') {
        e.preventDefault()
        logEvent(`KEY: ${chordStr} → PARTIAL (${result.entries.length} options)`)

        // Update sequence
        hotkeyActions.appendToSequence(registry, chord)

        // Set timeout to reset sequence
        sequenceTimeoutRef.current = setTimeout(() => {
          logEvent('TIMEOUT: sequence reset')
          hotkeyActions.resetSequence(registry)
        }, HOTKEY_TOKENS.timing.sequenceTimeout)
      } else {
        logEvent(`KEY: ${chordStr}`)
        hotkeyActions.resetSequence(registry)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current)
      }
    }
  }, [currentSequence, scopedBindings, commands, logEvent, registry])

  // Scope change handler
  const handleScopeChange = useCallback(
    (scope: string) => {
      hotkeyActions.setScope(registry, scope)
      logEvent(`SCOPE: ${scope}`)
    },
    [logEvent, registry]
  )

  const executeCommand = useCallback(
    (commandId: string) => {
      setLastCommand(commandId)
      logEvent(`EXECUTE: ${commandId}`)
      const command = commands.get(commandId)
      if (command) {
        Effect.runPromise(command.handler).catch((err) =>
          logEvent(`ERROR: ${err}`)
        )
      }
    },
    [logEvent, commands]
  )

  return (
    <div style={styles.container}>
      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          HOTKEY TESTBED
          {initialized && (
            <span style={styles.liveIndicator}>
              <span style={styles.liveDot} />
              ATOMS
            </span>
          )}
        </h1>
        <p style={styles.subtitle}>
          TMNL Command System — which-key, sequences, scopes (atom-based)
          {config?.suppressNativeHotkeys && (
            <span style={{ color: HOTKEY_TOKENS.colors.passthroughWarning, marginLeft: 8 }}>
              [NATIVE SUPPRESSION ON]
            </span>
          )}
        </p>
      </div>

      {/* Status Bar */}
      <div style={styles.statusBar}>
        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>Active Scope</span>
          <span style={styles.statusValue}>{activeScope.toUpperCase()}</span>
        </div>
        <div style={{ ...styles.statusItem, flex: 1 }}>
          <span style={styles.statusLabel}>Sequence Buffer</span>
          <SequenceDisplay sequence={currentSequence} />
        </div>
        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>Bindings</span>
          <span style={styles.statusValue}>{bindings.length}</span>
        </div>
        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>Last Command</span>
          <span
            style={{
              ...styles.statusValue,
              color: lastCommand
                ? HOTKEY_TOKENS.colors.commandExecuted
                : TMNL_TOKENS.colors.textDisabled,
            }}
          >
            {lastCommand ?? '—'}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div style={styles.grid}>
        {/* Scopes */}
        <div>
          <h2 style={styles.sectionTitle}>Scopes (click to activate)</h2>
          <div style={styles.scopeGrid}>
            {[Scopes.GLOBAL, Scopes.EDITOR, Scopes.GRID, Scopes.TLDRAW].map((scope) => (
              <ScopePanel
                key={scope}
                scope={scope}
                isActive={activeScope === scope}
                bindings={bindings}
                onActivate={() => handleScopeChange(scope)}
              />
            ))}
          </div>
        </div>

        {/* Event Log */}
        <div>
          <h2 style={styles.sectionTitle}>Event Log</h2>
          <EventLog events={events} onClear={() => setEvents([])} />
        </div>
      </div>

      {/* All Commands */}
      <div>
        <h2 style={styles.sectionTitle}>All Commands ({TEST_COMMANDS.length})</h2>
        <div style={styles.commandGrid}>
          {TEST_COMMANDS.map((cmd) => (
            <CommandCard key={cmd.id} command={cmd} onExecute={() => executeCommand(cmd.id)} />
          ))}
        </div>
      </div>

      {/* which-key popup */}
      {whichKeyEntries.length > 0 && (
        <WhichKeyPopup entries={whichKeyEntries} prefix={currentSequence} />
      )}

      {/* Help */}
      <div style={styles.helpBox}>
        <div style={styles.helpTitle}>TIPS</div>
        <ul style={styles.helpList}>
          <li>
            Try <code style={styles.helpCode}>g i</code> (press g, then i) for Gmail-style sequence
          </li>
          <li>
            Try <code style={styles.helpCode}>Ctrl+Shift+P</code> for command palette (todo)
          </li>
          <li>Click a scope to activate it (scoped commands only fire in active scope)</li>
          <li>Sequences timeout after {HOTKEY_TOKENS.timing.sequenceTimeout}ms of inactivity</li>
          <li>
            Native passthrough knock: <code style={styles.helpCode}>{config?.nativePassthroughKnock ?? 'ctrl+alt+n'}</code>
          </li>
        </ul>
      </div>
    </div>
  )
}
