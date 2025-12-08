/**
 * TMNL Hotkeys — KeyParser Service
 *
 * Parses and serializes key strings with platform normalization.
 *
 * Examples:
 *   'ctrl+shift+p'    -> [{ ctrl: true, shift: true, ... key: 'p' }]
 *   'g i'             -> [{ ... key: 'g' }, { ... key: 'i' }]
 *   'cmd+k cmd+s'     -> [{ meta: true, key: 'k' }, { meta: true, key: 's' }]
 */

import { Context, Effect, Layer, Option } from 'effect'
import type { KeyChord, KeySequence, KeyString, Modifiers } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Service Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface KeyParserService {
  /** Parse a key string into a key sequence */
  readonly parse: (keyString: KeyString) => Effect.Effect<KeySequence, KeyParserError>

  /** Serialize a key sequence back to a string */
  readonly serialize: (sequence: KeySequence) => string

  /** Normalize a single key name (e.g., 'esc' -> 'Escape') */
  readonly normalizeKey: (key: string) => string

  /** Create a chord from a keyboard event */
  readonly fromEvent: (event: KeyboardEvent) => KeyChord

  /** Check if two chords are equal */
  readonly chordsEqual: (a: KeyChord, b: KeyChord) => boolean

  /** Check if a sequence starts with a prefix */
  readonly isPrefix: (sequence: KeySequence, prefix: KeySequence) => boolean
}

export class KeyParser extends Context.Tag('tmnl/hotkeys/KeyParser')<
  KeyParser,
  KeyParserService
>() {
  static Default = Layer.succeed(
    this,
    this.of(makeKeyParser())
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Type
// ─────────────────────────────────────────────────────────────────────────────

export class KeyParserError {
  readonly _tag = 'KeyParserError'
  constructor(
    readonly input: string,
    readonly message: string
  ) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Key Normalization Maps
// ─────────────────────────────────────────────────────────────────────────────

/** Map of common key aliases to their normalized form */
const KEY_ALIASES: Record<string, string> = {
  // Escape
  esc: 'Escape',
  escape: 'Escape',

  // Enter
  enter: 'Enter',
  return: 'Enter',
  ret: 'Enter',

  // Modifiers (when used as the main key)
  ctrl: 'Control',
  control: 'Control',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  win: 'Meta',
  windows: 'Meta',
  super: 'Meta',

  // Arrows
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',

  // Space
  space: ' ',
  spc: ' ',

  // Tab
  tab: 'Tab',

  // Backspace/Delete
  backspace: 'Backspace',
  bs: 'Backspace',
  delete: 'Delete',
  del: 'Delete',

  // Home/End/PageUp/PageDown
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pgup: 'PageUp',
  pagedown: 'PageDown',
  pgdn: 'PageDown',

  // Insert
  insert: 'Insert',
  ins: 'Insert',

  // Punctuation/Symbols
  plus: '+',
  minus: '-',
  comma: ',',
  period: '.',
  dot: '.',
  slash: '/',
  backslash: '\\',
  semicolon: ';',
  quote: "'",
  backtick: '`',
  tilde: '~',
  equal: '=',
  equals: '=',
  bracket: '[',
  openbracket: '[',
  closebracket: ']',
}

/** Modifier key identifiers */
const MODIFIER_KEYS = new Set(['ctrl', 'control', 'alt', 'option', 'opt', 'shift', 'meta', 'cmd', 'command', 'win', 'windows', 'super'])

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

function makeKeyParser(): KeyParserService {
  const normalizeKey = (key: string): string => {
    const lower = key.toLowerCase()
    const alias = KEY_ALIASES[lower]
    if (alias) return alias

    // F-keys: f1 -> F1
    if (/^f\d{1,2}$/.test(lower)) {
      return 'F' + lower.slice(1)
    }

    // Single letters stay lowercase
    if (key.length === 1) {
      return key.toLowerCase()
    }

    // CamelCase keys (ArrowUp, etc.) stay as-is
    return key
  }

  const emptyModifiers = (): Modifiers => ({
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
  })

  const parseChord = (chordStr: string): Effect.Effect<KeyChord, KeyParserError> => {
    return Effect.gen(function* () {
      const parts = chordStr.split('+').map((p) => p.trim().toLowerCase())

      if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
        return yield* Effect.fail(new KeyParserError(chordStr, 'Empty chord'))
      }

      const modifiers = emptyModifiers()
      let mainKey: string | null = null

      for (const part of parts) {
        if (MODIFIER_KEYS.has(part)) {
          // It's a modifier
          if (part === 'ctrl' || part === 'control') {
            modifiers.ctrl = true
          } else if (part === 'alt' || part === 'option' || part === 'opt') {
            modifiers.alt = true
          } else if (part === 'shift') {
            modifiers.shift = true
          } else if (part === 'meta' || part === 'cmd' || part === 'command' || part === 'win' || part === 'windows' || part === 'super') {
            modifiers.meta = true
          }
        } else {
          // It's the main key
          if (mainKey !== null) {
            return yield* Effect.fail(
              new KeyParserError(chordStr, `Multiple main keys: '${mainKey}' and '${part}'`)
            )
          }
          mainKey = normalizeKey(part)
        }
      }

      // Handle case where only modifiers are pressed (e.g., 'ctrl' alone)
      if (mainKey === null) {
        // If it's just modifiers, use the last modifier as the key
        // This handles edge cases like 'ctrl' meaning Ctrl key press
        return yield* Effect.fail(
          new KeyParserError(chordStr, 'No main key specified')
        )
      }

      return {
        ...modifiers,
        key: mainKey,
      } as KeyChord
    })
  }

  const parse = (keyString: KeyString): Effect.Effect<KeySequence, KeyParserError> => {
    return Effect.gen(function* () {
      const trimmed = keyString.trim()

      if (trimmed === '') {
        return yield* Effect.fail(new KeyParserError(keyString, 'Empty key string'))
      }

      // Split by spaces (for sequences like 'g i' or 'ctrl+k ctrl+s')
      const chordStrings = trimmed.split(/\s+/)
      const chords: KeyChord[] = []

      for (const chordStr of chordStrings) {
        const chord = yield* parseChord(chordStr)
        chords.push(chord)
      }

      return chords as readonly KeyChord[]
    })
  }

  const serializeChord = (chord: KeyChord): string => {
    const parts: string[] = []

    if (chord.ctrl) parts.push('ctrl')
    if (chord.alt) parts.push('alt')
    if (chord.shift) parts.push('shift')
    if (chord.meta) parts.push('cmd')

    // Pretty-print special keys
    let keyStr = chord.key
    if (chord.key === ' ') keyStr = 'space'
    else if (chord.key === 'Escape') keyStr = 'esc'
    else if (chord.key === 'ArrowUp') keyStr = 'up'
    else if (chord.key === 'ArrowDown') keyStr = 'down'
    else if (chord.key === 'ArrowLeft') keyStr = 'left'
    else if (chord.key === 'ArrowRight') keyStr = 'right'

    parts.push(keyStr)

    return parts.join('+')
  }

  const serialize = (sequence: KeySequence): string => {
    return sequence.map(serializeChord).join(' ')
  }

  const fromEvent = (event: KeyboardEvent): KeyChord => {
    return {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
      key: normalizeKey(event.key),
    }
  }

  const chordsEqual = (a: KeyChord, b: KeyChord): boolean => {
    return (
      a.ctrl === b.ctrl &&
      a.alt === b.alt &&
      a.shift === b.shift &&
      a.meta === b.meta &&
      a.key === b.key
    )
  }

  const isPrefix = (sequence: KeySequence, prefix: KeySequence): boolean => {
    if (prefix.length >= sequence.length) {
      return false
    }

    for (let i = 0; i < prefix.length; i++) {
      if (!chordsEqual(sequence[i], prefix[i])) {
        return false
      }
    }

    return true
  }

  return {
    parse,
    serialize,
    normalizeKey,
    fromEvent,
    chordsEqual,
    isPrefix,
  }
}
