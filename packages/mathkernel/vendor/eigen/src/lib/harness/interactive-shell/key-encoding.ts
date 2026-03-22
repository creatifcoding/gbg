/**
 * Terminal Key Encoding — translates named keys + modifiers into escape sequences.
 *
 * Ported from pi extension interactive-shell/key-encoding.ts.
 * Pure string manipulation, zero dependencies.
 *
 * Supports:
 *   - Named keys: up, down, enter, escape, f1-f12, home, end, etc.
 *   - Ctrl combos: ctrl+c, ctrl+z, ctrl+d, c-c (tmux syntax)
 *   - Alt combos: alt+x, m-x
 *   - Shift combos: shift+tab, shift+up
 *   - Compound: ctrl+alt+delete, c-m-a
 *   - Hex bytes: 0x1b, 0x5b, 0x41 (raw escape sequences)
 *   - Bracketed paste: wraps text in ESC[200~ / ESC[201~
 *
 * @module harness/interactive-shell/key-encoding
 */

// ─────────────────────────────────────────────────────────────────────────────
// Named key → escape sequence map
// ─────────────────────────────────────────────────────────────────────────────

const NAMED_KEYS: Record<string, string> = {
  // Arrow keys
  up: '\x1b[A',
  down: '\x1b[B',
  left: '\x1b[D',
  right: '\x1b[C',

  // Common keys
  enter: '\r',
  return: '\r',
  escape: '\x1b',
  esc: '\x1b',
  tab: '\t',
  space: ' ',
  backspace: '\x7f',
  bspace: '\x7f', // tmux alias

  // Editing
  delete: '\x1b[3~',
  del: '\x1b[3~',
  dc: '\x1b[3~', // tmux alias
  insert: '\x1b[2~',
  ic: '\x1b[2~', // tmux alias

  // Navigation
  home: '\x1b[H',
  end: '\x1b[F',
  pageup: '\x1b[5~',
  pgup: '\x1b[5~',
  ppage: '\x1b[5~', // tmux alias
  pagedown: '\x1b[6~',
  pgdn: '\x1b[6~',
  npage: '\x1b[6~', // tmux alias

  // Shift+Tab (backtab)
  btab: '\x1b[Z',

  // Function keys
  f1: '\x1bOP',
  f2: '\x1bOQ',
  f3: '\x1bOR',
  f4: '\x1bOS',
  f5: '\x1b[15~',
  f6: '\x1b[17~',
  f7: '\x1b[18~',
  f8: '\x1b[19~',
  f9: '\x1b[20~',
  f10: '\x1b[21~',
  f11: '\x1b[23~',
  f12: '\x1b[24~',

  // Keypad (application mode)
  kp0: '\x1bOp',
  kp1: '\x1bOq',
  kp2: '\x1bOr',
  kp3: '\x1bOs',
  kp4: '\x1bOt',
  kp5: '\x1bOu',
  kp6: '\x1bOv',
  kp7: '\x1bOw',
  kp8: '\x1bOx',
  kp9: '\x1bOy',
  'kp/': '\x1bOo',
  'kp*': '\x1bOj',
  'kp-': '\x1bOm',
  'kp+': '\x1bOk',
  'kp.': '\x1bOn',
  kpenter: '\x1bOM',
}

// ─────────────────────────────────────────────────────────────────────────────
// Ctrl+key map (ctrl+a = 0x01 through ctrl+z = 0x1a)
// ─────────────────────────────────────────────────────────────────────────────

const CTRL_KEYS: Record<string, string> = {}
for (let i = 0; i < 26; i++) {
  CTRL_KEYS[`ctrl+${String.fromCharCode(97 + i)}`] = String.fromCharCode(
    i + 1,
  )
}
// Special ctrl combos
CTRL_KEYS['ctrl+['] = '\x1b' // Escape
CTRL_KEYS['ctrl+\\'] = '\x1c'
CTRL_KEYS['ctrl+]'] = '\x1d'
CTRL_KEYS['ctrl+^'] = '\x1e'
CTRL_KEYS['ctrl+_'] = '\x1f'
CTRL_KEYS['ctrl+?'] = '\x7f' // Backspace

// ─────────────────────────────────────────────────────────────────────────────
// Modifier encoding (xterm CSI sequences)
// ─────────────────────────────────────────────────────────────────────────────

/** Keys that support xterm modifier encoding */
const MODIFIABLE_KEYS = new Set([
  'up',
  'down',
  'left',
  'right',
  'home',
  'end',
  'pageup',
  'pgup',
  'ppage',
  'pagedown',
  'pgdn',
  'npage',
  'insert',
  'ic',
  'delete',
  'del',
  'dc',
])

/** xterm modifier code: 1 + (shift?1:0) + (alt?2:0) + (ctrl?4:0) */
function xtermModifier(
  shift: boolean,
  alt: boolean,
  ctrl: boolean,
): number {
  let mod = 1
  if (shift) mod += 1
  if (alt) mod += 2
  if (ctrl) mod += 4
  return mod
}

/** Apply xterm modifier to CSI sequence: ESC[A → ESC[1;modA */
function applyXtermModifier(
  sequence: string,
  modifier: number,
): string | null {
  // Arrow keys: ESC[A → ESC[1;modA
  const arrow = sequence.match(/^\x1b\[([A-D])$/)
  if (arrow) return `\x1b[1;${modifier}${arrow[1]}`

  // Numbered: ESC[5~ → ESC[5;mod~
  const num = sequence.match(/^\x1b\[(\d+)~$/)
  if (num) return `\x1b[${num[1]};${modifier}~`

  // Home/End: ESC[H → ESC[1;modH
  const hf = sequence.match(/^\x1b\[([HF])$/)
  if (hf) return `\x1b[1;${modifier}${hf[1]}`

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Bracketed paste
// ─────────────────────────────────────────────────────────────────────────────

const BRACKETED_PASTE_START = '\x1b[200~'
const BRACKETED_PASTE_END = '\x1b[201~'

function encodePaste(text: string): string {
  return `${BRACKETED_PASTE_START}${text}${BRACKETED_PASTE_END}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Single key token encoder
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a key token (e.g. "ctrl+c", "up", "shift+tab") → escape sequence */
export function encodeKeyToken(token: string): string {
  const normalized = token.trim().toLowerCase()
  if (!normalized) return ''

  // Direct named key match
  if (NAMED_KEYS[normalized]) return NAMED_KEYS[normalized]

  // Direct ctrl+key match
  if (CTRL_KEYS[normalized]) return CTRL_KEYS[normalized]

  // Parse modifier prefixes: ctrl+alt+shift+key, c-m-s-key, etc.
  let rest = normalized
  let ctrl = false
  let alt = false
  let shift = false

  // Support both "ctrl+alt+x" and "c-m-x" syntax
  while (rest.length > 2) {
    if (rest.startsWith('ctrl+') || rest.startsWith('ctrl-')) {
      ctrl = true
      rest = rest.slice(5)
    } else if (rest.startsWith('alt+') || rest.startsWith('alt-')) {
      alt = true
      rest = rest.slice(4)
    } else if (rest.startsWith('shift+') || rest.startsWith('shift-')) {
      shift = true
      rest = rest.slice(6)
    } else if (rest.startsWith('c-')) {
      ctrl = true
      rest = rest.slice(2)
    } else if (rest.startsWith('m-')) {
      alt = true
      rest = rest.slice(2)
    } else if (rest.startsWith('s-')) {
      shift = true
      rest = rest.slice(2)
    } else {
      break
    }
  }

  // Shift+Tab special case
  if (shift && rest === 'tab') return '\x1b[Z'

  // Modifiable named key (arrow, nav, etc.)
  const baseSeq = NAMED_KEYS[rest]
  if (baseSeq && MODIFIABLE_KEYS.has(rest) && (ctrl || alt || shift)) {
    const mod = xtermModifier(shift, alt, ctrl)
    if (mod > 1) {
      const modified = applyXtermModifier(baseSeq, mod)
      if (modified) return modified
    }
  }

  // Single character with modifiers
  if (rest.length === 1) {
    let char = rest
    if (shift && /[a-z]/.test(char)) char = char.toUpperCase()
    if (ctrl) {
      const ctrlChar = CTRL_KEYS[`ctrl+${char.toLowerCase()}`]
      if (ctrlChar) char = ctrlChar
    }
    if (alt) return `\x1b${char}`
    return char
  }

  // Named key with alt
  if (baseSeq && alt) return `\x1b${baseSeq}`

  // Bare named key
  if (baseSeq) return baseSeq

  // Unknown — pass through as literal
  return token
}

// ─────────────────────────────────────────────────────────────────────────────
// Hex byte decoder
// ─────────────────────────────────────────────────────────────────────────────

/** Decode hex bytes (e.g. "0x1b", "5b", "41") → raw string */
export function decodeHexBytes(hexArray: ReadonlyArray<string>): string {
  let result = ''
  for (const raw of hexArray) {
    const trimmed = raw.trim().toLowerCase()
    const normalized = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed
    if (/^[0-9a-f]{1,2}$/.test(normalized)) {
      const value = Number.parseInt(normalized, 16)
      if (!Number.isNaN(value) && value >= 0 && value <= 0xff) {
        result += String.fromCharCode(value)
      }
    }
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified translator
// ─────────────────────────────────────────────────────────────────────────────

export interface StructuredInput {
  /** Raw text input */
  readonly text?: string
  /** Named keys with modifier support */
  readonly keys?: ReadonlyArray<string>
  /** Raw hex escape sequences */
  readonly hex?: ReadonlyArray<string>
  /** Text to paste with bracketed paste mode */
  readonly paste?: string
}

/**
 * Translate input specification to terminal escape sequences.
 *
 * Priority order: hex → text → keys → paste
 * All parts are concatenated into a single output string.
 */
export function translateInput(
  input: string | StructuredInput,
): string {
  if (typeof input === 'string') return input

  let result = ''

  // Hex bytes first (raw escape sequences)
  if (input.hex?.length) {
    result += decodeHexBytes(input.hex)
  }

  // Literal text
  if (input.text) {
    result += input.text
  }

  // Named keys
  if (input.keys) {
    for (const key of input.keys) {
      result += encodeKeyToken(key)
    }
  }

  // Bracketed paste
  if (input.paste) {
    result += encodePaste(input.paste)
  }

  return result
}
