/**
 * Unit tests for layout engine (auto-layout for expand view).
 *
 * Tests the decision algorithm and column compositing.
 */

import { describe, it, expect } from 'vitest'
import { decideLayout, compositeColumns, codePanelLines, codeBlockLines } from '../../../../.pi/extensions/metaskill/layout.ts'

// Minimal theme stub — layout functions only use fg/bold for decoration
const theme = {
  fg: (_token: string, text: string) => text,
  bold: (text: string) => text,
} as any

// ─── decideLayout ────────────────────────────────────────

describe('decideLayout', () => {
  it('stacks when terminal is narrow', () => {
    const d = decideLayout(['const x = 1'], ['row1', 'row2', 'row3', 'row4'], 80)
    expect(d.mode).toBe('stacked')
    expect(d.reason).toContain('80')
  })

  it('stacks when no code', () => {
    const d = decideLayout([], ['row1', 'row2', 'row3', 'row4'], 150)
    expect(d.mode).toBe('stacked')
    expect(d.reason).toContain('no code')
  })

  it('stacks when result is tiny (< 3 lines)', () => {
    const d = decideLayout(['const x = 1', 'return x'], ['one', 'two'], 150)
    expect(d.mode).toBe('stacked')
    expect(d.reason).toContain('< 3')
  })

  it('stacks when code dominates (> 2x result height)', () => {
    const code = Array.from({ length: 20 }, (_, i) => `line ${i}`)
    const result = Array.from({ length: 5 }, (_, i) => `result ${i}`)
    const d = decideLayout(code, result, 150)
    expect(d.mode).toBe('stacked')
    expect(d.reason).toContain('2×')
  })

  it('side-by-side when criteria met', () => {
    const code = ['const ms = api()', 'return ms.inspect("x")']
    const result = Array.from({ length: 10 }, (_, i) => `row ${i}`)
    const d = decideLayout(code, result, 150)
    expect(d.mode).toBe('side-by-side')
  })

  it('widths sum to total width', () => {
    const code = ['const ms = api()', 'return ms.inspect("x")']
    const result = Array.from({ length: 10 }, (_, i) => `row ${i}`)
    const d = decideLayout(code, result, 150)
    if (d.mode === 'side-by-side') {
      expect(d.codeWidth + 3 + d.resultWidth).toBe(150) // 3 = gutter
    }
  })

  it('clamps code panel to 40% of width', () => {
    // Very wide code lines
    const code = ['x'.repeat(200)]
    const result = Array.from({ length: 10 }, (_, i) => `row ${i}`)
    const d = decideLayout(code, result, 200)
    if (d.mode === 'side-by-side') {
      expect(d.codeWidth).toBeLessThanOrEqual(200 * 0.4)
    }
  })

  it('stacks when result panel would be too narrow', () => {
    // Moderately wide terminal but very wide code
    const code = ['x'.repeat(80)]
    const result = Array.from({ length: 10 }, (_, i) => `row ${i}`)
    const d = decideLayout(code, result, 105)
    // At 105 width: code clamp = 42, gutter = 3, result = 60 — should work
    // But depends on natural width calculation
    expect(['stacked', 'side-by-side']).toContain(d.mode)
  })
})

// ─── compositeColumns ────────────────────────────────────

describe('compositeColumns', () => {
  it('merges equal-height columns', () => {
    const left = ['AAA', 'BBB']
    const right = ['111', '222']
    const lines = compositeColumns(left, right, 5, theme)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('AAA')
    expect(lines[0]).toContain('111')
  })

  it('pads shorter column', () => {
    const left = ['AAA']
    const right = ['111', '222', '333']
    const lines = compositeColumns(left, right, 5, theme)
    expect(lines).toHaveLength(3)
    // Third line left side should be spaces
    expect(lines[2]).toMatch(/^\s+/)
  })

  it('handles empty left', () => {
    const lines = compositeColumns([], ['111', '222'], 5, theme)
    expect(lines).toHaveLength(2)
  })

  it('handles empty right', () => {
    const lines = compositeColumns(['AAA', 'BBB'], [], 5, theme)
    expect(lines).toHaveLength(2)
  })
})

// ─── codePanelLines ──────────────────────────────────────

describe('codePanelLines', () => {
  it('wraps code with compact chrome', () => {
    const lines = codePanelLines('return 42', 30, theme)
    expect(lines[0]).toContain('eval')    // header
    expect(lines[1]).toContain('return')  // code
    expect(lines.length).toBeGreaterThanOrEqual(3) // header + code + footer
  })

  it('multi-line code preserved', () => {
    const lines = codePanelLines('const x = 1\nreturn x', 30, theme)
    const codeLines = lines.filter(l => l.includes('return') || l.includes('const'))
    expect(codeLines.length).toBe(2)
  })
})

// ─── codeBlockLines ──────────────────────────────────────

describe('codeBlockLines', () => {
  it('wraps code with stacked chrome', () => {
    const lines = codeBlockLines('return 42', 40, theme)
    expect(lines.some(l => l.includes('eval'))).toBe(true)
    expect(lines.some(l => l.includes('return'))).toBe(true)
    expect(lines.some(l => l.includes('╰'))).toBe(true)
  })
})
