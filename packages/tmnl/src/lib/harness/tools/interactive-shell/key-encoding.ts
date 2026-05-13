/**
 * Terminal key encoding utilities.
 * Pure utility — no framework deps. Translates named keys and modifiers
 * into terminal escape sequences.
 *
 * Ported from pi interactive-shell extension, unchanged logic.
 */

const NAMED_KEYS: Record<string, string> = {
  up: '\x1b[A', down: '\x1b[B', left: '\x1b[D', right: '\x1b[C',
  enter: '\r', return: '\r', escape: '\x1b', esc: '\x1b', tab: '\t',
  space: ' ', backspace: '\x7f', bspace: '\x7f',
  delete: '\x1b[3~', del: '\x1b[3~', dc: '\x1b[3~',
  insert: '\x1b[2~', ic: '\x1b[2~',
  home: '\x1b[H', end: '\x1b[F',
  pageup: '\x1b[5~', pgup: '\x1b[5~', ppage: '\x1b[5~',
  pagedown: '\x1b[6~', pgdn: '\x1b[6~', npage: '\x1b[6~',
  btab: '\x1b[Z',
  f1: '\x1bOP', f2: '\x1bOQ', f3: '\x1bOR', f4: '\x1bOS',
  f5: '\x1b[15~', f6: '\x1b[17~', f7: '\x1b[18~', f8: '\x1b[19~',
  f9: '\x1b[20~', f10: '\x1b[21~', f11: '\x1b[23~', f12: '\x1b[24~',
}

const CTRL_KEYS: Record<string, string> = {}
for (let i = 0; i < 26; i++) {
  CTRL_KEYS[`ctrl+${String.fromCharCode(97 + i)}`] = String.fromCharCode(i + 1)
}
CTRL_KEYS['ctrl+['] = '\x1b'
CTRL_KEYS['ctrl+\\'] = '\x1c'
CTRL_KEYS['ctrl+]'] = '\x1d'
CTRL_KEYS['ctrl+^'] = '\x1e'
CTRL_KEYS['ctrl+_'] = '\x1f'
CTRL_KEYS['ctrl+?'] = '\x7f'

const MODIFIABLE_KEYS = new Set([
  'up', 'down', 'left', 'right', 'home', 'end',
  'pageup', 'pgup', 'ppage', 'pagedown', 'pgdn', 'npage',
  'insert', 'ic', 'delete', 'del', 'dc',
])

function xtermModifier(shift: boolean, alt: boolean, ctrl: boolean): number {
  let mod = 1
  if (shift) mod += 1
  if (alt) mod += 2
  if (ctrl) mod += 4
  return mod
}

function applyXtermModifier(sequence: string, modifier: number): string | null {
  const arrowMatch = sequence.match(/^\x1b\[([A-D])$/)
  if (arrowMatch) return `\x1b[1;${modifier}${arrowMatch[1]}`
  const numMatch = sequence.match(/^\x1b\[(\d+)~$/)
  if (numMatch) return `\x1b[${numMatch[1]};${modifier}~`
  const hfMatch = sequence.match(/^\x1b\[([HF])$/)
  if (hfMatch) return `\x1b[1;${modifier}${hfMatch[1]}`
  return null
}

const BRACKETED_PASTE_START = '\x1b[200~'
const BRACKETED_PASTE_END = '\x1b[201~'

function encodeKeyToken