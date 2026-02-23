/**
 * Key Encoding Tests — encodeKeyToken, decodeHexBytes, translateInput
 *
 * Pure function tests, zero dependencies.
 * Validates named keys, ctrl/alt/shift combos, hex decode, bracketed paste,
 * tmux syntax, modifier encoding, unknown passthrough.
 */

import { describe, it, expect } from 'vitest'
import {
  encodeKeyToken,
  decodeHexBytes,
  translateInput,
} from '../key-encoding'

// ─────────────────────────────────────────────────────────────────────────────
// encodeKeyToken
// ─────────────────────────────────────────────────────────────────────────────

describe('encodeKeyToken', () => {
  describe('named keys', () => {
    it.each([
      ['enter', '\r'],
      ['return', '\r'],
      ['escape', '\x1b'],
      ['esc', '\x1b'],
      ['tab', '\t'],
      ['space', ' '],
      ['backspace', '\x7f'],
      ['delete', '\x1b[3~'],
    ])('encodes %s → correct escape sequence', (key, expected) => {
      expect(encodeKeyToken(key)).toBe(expected)
    })

    it.each([
      ['up', '\x1b[A'],
      ['down', '\x1b[B'],
      ['left', '\x1b[D'],
      ['right', '\x1b[C'],
    ])('encodes arrow key %s', (key, expected) => {
      expect(encodeKeyToken(key)).toBe(expected)
    })

    it.each([
      ['home', '\x1b[H'],
      ['end', '\x1b[F'],
      ['pageup', '\x1b[5~'],
      ['pagedown', '\x1b[6~'],
      ['insert', '\x1b[2~'],
    ])('encodes navigation key %s', (key, expected) => {
      expect(encodeKeyToken(key)).toBe(expected)
    })

    it.each([
      ['f1', '\x1bOP'],
      ['f2', '\x1bOQ'],
      ['f3', '\x1bOR'],
      ['f4', '\x1bOS'],
      ['f5', '\x1b[15~'],
      ['f6', '\x1b[17~'],
      ['f12', '\x1b[24~'],
    ])('encodes function key %s', (key, expected) => {
      expect(encodeKeyToken(key)).toBe(expected)
    })
  })

  describe('tmux aliases', () => {
    it.each([
      ['bspace', '\x7f'],
      ['dc', '\x1b[3~'],
      ['ic', '\x1b[2~'],
      ['pgup', '\x1b[5~'],
      ['pgdn', '\x1b[6~'],
      ['ppage', '\x1b[5~'],
      ['npage', '\x1b[6~'],
      ['btab', '\x1b[Z'],
    ])('encodes tmux alias %s', (key, expected) => {
      expect(encodeKeyToken(key)).toBe(expected)
    })
  })

  describe('ctrl combos', () => {
    it('encodes ctrl+c as 0x03', () => {
      expect(encodeKeyToken('ctrl+c')).toBe('\x03')
    })

    it('encodes ctrl+z as 0x1a', () => {
      expect(encodeKeyToken('ctrl+z')).toBe('\x1a')
    })

    it('encodes ctrl+d as 0x04', () => {
      expect(encodeKeyToken('ctrl+d')).toBe('\x04')
    })

    it('encodes ctrl+a as 0x01', () => {
      expect(encodeKeyToken('ctrl+a')).toBe('\x01')
    })

    it('encodes ctrl+[ as ESC', () => {
      expect(encodeKeyToken('ctrl+[')).toBe('\x1b')
    })

    it('encodes ctrl+? as DEL', () => {
      expect(encodeKeyToken('ctrl+?')).toBe('\x7f')
    })
  })

  describe('tmux c- syntax', () => {
    it('encodes c-c as ctrl+c', () => {
      expect(encodeKeyToken('c-c')).toBe('\x03')
    })

    it('encodes c-z as ctrl+z', () => {
      expect(encodeKeyToken('c-z')).toBe('\x1a')
    })
  })

  describe('alt combos', () => {
    it('encodes alt+x as ESC+x', () => {
      expect(encodeKeyToken('alt+x')).toBe('\x1bx')
    })

    it('encodes m-x as ESC+x (tmux syntax)', () => {
      expect(encodeKeyToken('m-x')).toBe('\x1bx')
    })
  })

  describe('shift combos', () => {
    it('encodes shift+tab as backtab', () => {
      expect(encodeKeyToken('shift+tab')).toBe('\x1b[Z')
    })

    it('encodes shift+up with xterm modifier', () => {
      // shift = modifier 2 → ESC[1;2A
      expect(encodeKeyToken('shift+up')).toBe('\x1b[1;2A')
    })

    it('encodes shift+home with xterm modifier', () => {
      expect(encodeKeyToken('shift+home')).toBe('\x1b[1;2H')
    })
  })

  describe('compound modifiers', () => {
    it('encodes ctrl+shift+up (modifier 6)', () => {
      // ctrl+shift = 1 + 1(shift) + 4(ctrl) = 6
      expect(encodeKeyToken('ctrl+shift+up')).toBe('\x1b[1;6A')
    })

    it('encodes ctrl+alt+delete', () => {
      // ctrl+alt = 1 + 2(alt) + 4(ctrl) = 7
      expect(encodeKeyToken('ctrl+alt+delete')).toBe('\x1b[3;7~')
    })
  })

  describe('case insensitivity', () => {
    it('handles uppercase input', () => {
      expect(encodeKeyToken('ENTER')).toBe('\r')
      expect(encodeKeyToken('Ctrl+C')).toBe('\x03')
    })

    it('handles mixed case', () => {
      expect(encodeKeyToken('Shift+Tab')).toBe('\x1b[Z')
    })
  })

  describe('whitespace handling', () => {
    it('trims leading/trailing whitespace', () => {
      expect(encodeKeyToken('  enter  ')).toBe('\r')
    })

    it('returns empty string for empty input', () => {
      expect(encodeKeyToken('')).toBe('')
      expect(encodeKeyToken('   ')).toBe('')
    })
  })

  describe('unknown passthrough', () => {
    it('passes through unknown multi-char tokens as-is', () => {
      expect(encodeKeyToken('FancyKey')).toBe('FancyKey')
    })

    it('passes through single characters (lowercased)', () => {
      expect(encodeKeyToken('a')).toBe('a')
      // encodeKeyToken normalizes to lowercase
      expect(encodeKeyToken('Z')).toBe('z')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// decodeHexBytes
// ─────────────────────────────────────────────────────────────────────────────

describe('decodeHexBytes', () => {
  it('decodes 0x-prefixed hex bytes', () => {
    expect(decodeHexBytes(['0x1b', '0x5b', '0x41'])).toBe('\x1b[A') // ESC[A = up arrow
  })

  it('decodes bare hex (no 0x prefix)', () => {
    expect(decodeHexBytes(['1b', '5b', '41'])).toBe('\x1b[A')
  })

  it('handles mixed prefixed and bare', () => {
    expect(decodeHexBytes(['0x1b', '5b'])).toBe('\x1b[')
  })

  it('returns empty string for empty array', () => {
    expect(decodeHexBytes([])).toBe('')
  })

  it('handles single byte', () => {
    expect(decodeHexBytes(['0x03'])).toBe('\x03')
  })

  it('ignores invalid hex', () => {
    // Non-hex chars should be skipped
    expect(decodeHexBytes(['0xGG', '0x41'])).toBe('A')
  })

  it('handles uppercase hex', () => {
    expect(decodeHexBytes(['0x1B', '0x5B', '0x41'])).toBe('\x1b[A')
  })

  it('trims whitespace around bytes', () => {
    expect(decodeHexBytes([' 0x41 ', '  0x42  '])).toBe('AB')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// translateInput
// ─────────────────────────────────────────────────────────────────────────────

describe('translateInput', () => {
  it('passes through raw string unchanged', () => {
    expect(translateInput('hello\n')).toBe('hello\n')
  })

  it('translates named keys array', () => {
    const result = translateInput({ keys: ['ctrl+c'] })
    expect(result).toBe('\x03')
  })

  it('translates hex bytes', () => {
    const result = translateInput({ hex: ['0x1b', '0x5b', '0x41'] })
    expect(result).toBe('\x1b[A')
  })

  it('translates bracketed paste', () => {
    const result = translateInput({ paste: 'multi\nline' })
    expect(result).toBe('\x1b[200~multi\nline\x1b[201~')
  })

  it('concatenates all parts in order: hex → text → keys → paste', () => {
    const result = translateInput({
      hex: ['0x41'],     // 'A'
      text: 'BC',
      keys: ['enter'],   // '\r'
      paste: 'D',        // bracketed
    })
    expect(result).toBe('A' + 'BC' + '\r' + '\x1b[200~D\x1b[201~')
  })

  it('handles multiple named keys', () => {
    const result = translateInput({ keys: ['up', 'up', 'enter'] })
    expect(result).toBe('\x1b[A\x1b[A\r')
  })

  it('handles text-only structured input', () => {
    const result = translateInput({ text: 'ls -la\n' })
    expect(result).toBe('ls -la\n')
  })

  it('handles empty structured input', () => {
    expect(translateInput({})).toBe('')
  })
})
