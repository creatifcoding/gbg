/**
 * Slice C3 — focused tests for the host-neutral render-core.ts module.
 *
 * These tests require render-core.ts to exist (written by CoreExtraction as
 * part of the C3 slice).  They will fail with "module not found" until that
 * file lands.  Run layout-decision.test.ts for the subset that can be
 * verified today.
 *
 * Gates covered:
 *   G1  render-core.ts has no @mariozechner/* or @oh-my-pi/* imports.
 *   G2  fitColumns — proportional width clamping with min-3 enforced.
 *   G3  cellStr — cell value serialisation contract.
 *   G4  tryParseJSON — structured/plain detection; returns null for bad JSON.
 *   G5  typeLabel — human-readable labels for array/object/primitive types.
 *   G6  colorValue — status-aware colour mapping via RendererTheme.
 *
 * Run with:
 *   bunx vitest run __tests__/render-core.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import type { RendererTheme } from '../src/primitives/render-host.ts'

import {
  tryParseJSON,
  typeLabel,
  fitColumns,
  cellStr,
  colorValue,
} from '../src/render-core.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', 'src')

// ─── G1. Import boundary ─────────────────────────────────────────────────────

describe('render-core.ts — import boundary (G1)', () => {
  let src: string
  beforeAll(() => {
    src = readFileSync(join(ROOT, 'render-core.ts'), 'utf8')
  })

  it('contains no host package import/export declarations', () => {
    expect(src).not.toMatch(/^\s*import\s+.*from\s+['"]@(?:mariozechner|oh-my-pi)\//m)
    expect(src).not.toMatch(/^\s*export\s+.*from\s+['"]@(?:mariozechner|oh-my-pi)\//m)
  })
})

// ─── G2. fitColumns — proportional width clamping ────────────────────────────

describe('fitColumns — width clamping (G2)', () => {
  it('returns natural widths unchanged when they all fit within budget', () => {
    expect(fitColumns([10, 20, 30], 100)).toEqual([10, 20, 30])
  })

  it('returns empty array for empty input', () => {
    expect(fitColumns([], 100)).toEqual([])
  })

  it('returns single-element array unchanged when it fits', () => {
    expect(fitColumns([50], 100)).toEqual([50])
  })

  it('shrinks proportionally when total exceeds budget', () => {
    const result = fitColumns([100, 100], 100)
    const total = result.reduce((s, w) => s + w, 0)
    expect(total).toBeLessThanOrEqual(100)
    // Both columns receive proportional share (equal weights → equal widths)
    expect(result[0]).toBe(result[1])
  })

  it('enforces minimum column width of 3 per column even under extreme shrink', () => {
    const result = fitColumns([100, 100, 100, 100, 100], 5)
    for (const w of result) {
      expect(w).toBeGreaterThanOrEqual(3)
    }
  })

  it('distributes remainder so total is as close to budget as possible', () => {
    const result = fitColumns([50, 50], 99)
    const total = result.reduce((s, w) => s + w, 0)
    // Floor-based proportional split for equal shares: each gets 49 or 50
    expect(total).toBeGreaterThanOrEqual(98)
    expect(total).toBeLessThanOrEqual(99)
  })

  it('handles unequal columns proportionally', () => {
    // Natural [60, 40] → total 100, budget 50 → proportional [30, 20]
    const result = fitColumns([60, 40], 50)
    expect(result[0]).toBeGreaterThan(result[1]) // wider column still wider
    const total = result.reduce((s, w) => s + w, 0)
    expect(total).toBeLessThanOrEqual(50)
  })
})

// ─── G3. cellStr — cell value serialisation ───────────────────────────────────

describe('cellStr — cell value serialisation (G3)', () => {
  it('formats null as the string "null"', () => {
    expect(cellStr(null)).toBe('null')
  })

  it('formats undefined as empty string', () => {
    expect(cellStr(undefined)).toBe('')
  })

  it('formats plain objects as "{…}"', () => {
    expect(cellStr({ a: 1 })).toBe('{…}')
    expect(cellStr({})).toBe('{…}')
  })

  it('formats arrays as "[N]" with their length', () => {
    expect(cellStr([1, 2, 3])).toBe('[3]')
    expect(cellStr([])).toBe('[0]')
  })

  it('converts string values as-is', () => {
    expect(cellStr('hello')).toBe('hello')
    expect(cellStr('')).toBe('')
  })

  it('converts numbers to their string representation', () => {
    expect(cellStr(42)).toBe('42')
    expect(cellStr(0)).toBe('0')
    expect(cellStr(-1.5)).toBe('-1.5')
  })

  it('converts booleans to their string representation', () => {
    expect(cellStr(true)).toBe('true')
    expect(cellStr(false)).toBe('false')
  })
})

// ─── G4. tryParseJSON — structured/plain detection ────────────────────────────

describe('tryParseJSON — structured detection (G4)', () => {
  it('marks valid JSON object as structured with correct parsed value', () => {
    const { parsed, isStructured } = tryParseJSON('{"a":1,"b":2}')
    expect(isStructured).toBe(true)
    expect(parsed).toEqual({ a: 1, b: 2 })
  })

  it('marks valid JSON array as structured', () => {
    const { parsed, isStructured } = tryParseJSON('[1,2,3]')
    expect(isStructured).toBe(true)
    expect(parsed).toEqual([1, 2, 3])
  })

  it('marks valid JSON string as structured', () => {
    const { isStructured } = tryParseJSON('"hello"')
    expect(isStructured).toBe(true)
  })

  it('marks invalid JSON as unstructured', () => {
    const { isStructured } = tryParseJSON('hello world')
    expect(isStructured).toBe(false)
  })

  it('returns null as parsed for invalid JSON (not the original string)', () => {
    const { parsed } = tryParseJSON('not json')
    expect(parsed).toBeNull()
  })

  it('marks empty string as unstructured', () => {
    const { isStructured } = tryParseJSON('')
    expect(isStructured).toBe(false)
  })

  it('marks partial JSON as unstructured', () => {
    const { isStructured } = tryParseJSON('{incomplete')
    expect(isStructured).toBe(false)
  })
})

// ─── G5. typeLabel — human-readable type labels ───────────────────────────────

describe('typeLabel — type identification (G5)', () => {
  it('labels arrays with element count: array[N]', () => {
    expect(typeLabel([1, 2, 3])).toBe('array[3]')
    expect(typeLabel([])).toBe('array[0]')
  })

  it('labels plain objects as "object"', () => {
    expect(typeLabel({ a: 1 })).toBe('object')
    expect(typeLabel({})).toBe('object')
  })

  it('labels strings as "string"', () => {
    expect(typeLabel('hello')).toBe('string')
  })

  it('labels numbers as "number"', () => {
    expect(typeLabel(42)).toBe('number')
    expect(typeLabel(0)).toBe('number')
  })

  it('labels booleans as "boolean"', () => {
    expect(typeLabel(true)).toBe('boolean')
    expect(typeLabel(false)).toBe('boolean')
  })
})

// ─── G6. colorValue — status-aware colour mapping ────────────────────────────
//
// colorValue(text, raw, theme: RendererTheme) applies semantic colour tokens.
// The fake theme encodes colour as `token(text)` so assertions stay readable.

describe('colorValue — status-aware colour mapping (G6)', () => {
  const theme: RendererTheme = {
    fg(color: string, text: string): string {
      return `${color}(${text})`
    },
  }

  it('colours `true` with the "success" token', () => {
    expect(colorValue('true', true, theme)).toBe('success(true)')
  })

  it('colours `false` with the "error" token', () => {
    expect(colorValue('false', false, theme)).toBe('error(false)')
  })

  it('colours numeric values with the "syntaxNumber" token', () => {
    expect(colorValue('42', 42, theme)).toBe('syntaxNumber(42)')
    expect(colorValue('0', 0, theme)).toBe('syntaxNumber(0)')
  })

  it('colours status strings: "complete" → success', () => {
    expect(colorValue('complete', 'complete', theme)).toBe('success(complete)')
  })

  it('colours status strings: "clean" → success', () => {
    expect(colorValue('clean', 'clean', theme)).toBe('success(clean)')
  })

  it('colours status strings: "passed" → success', () => {
    expect(colorValue('passed', 'passed', theme)).toBe('success(passed)')
  })

  it('colours status strings: "error" → error', () => {
    expect(colorValue('error', 'error', theme)).toBe('error(error)')
  })

  it('colours status strings: "failed" → error', () => {
    expect(colorValue('failed', 'failed', theme)).toBe('error(failed)')
  })

  it('colours status strings: "missing" → error', () => {
    expect(colorValue('missing', 'missing', theme)).toBe('error(missing)')
  })

  it('colours status strings: "exists" → warning', () => {
    expect(colorValue('exists', 'exists', theme)).toBe('warning(exists)')
  })

  it('colours status strings: "governed" → warning', () => {
    expect(colorValue('governed', 'governed', theme)).toBe('warning(governed)')
  })

  it('colours status strings: "warning" → warning', () => {
    expect(colorValue('warning', 'warning', theme)).toBe('warning(warning)')
  })

  it('applies "toolOutput" token to plain non-status strings', () => {
    expect(colorValue('hello', 'hello', theme)).toBe('toolOutput(hello)')
    expect(colorValue('random', 'random', theme)).toBe('toolOutput(random)')
  })

  it('status matching is case-insensitive', () => {
    expect(colorValue('COMPLETE', 'COMPLETE', theme)).toBe('success(COMPLETE)')
    expect(colorValue('Failed', 'Failed', theme)).toBe('error(Failed)')
  })
})
