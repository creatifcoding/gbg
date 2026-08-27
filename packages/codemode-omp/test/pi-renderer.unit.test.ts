import { describe, expect, it } from 'vitest'
import { renderCall, renderResult, type Theme } from '../src/render.ts'

const theme = {
  fg(color: string, text: string): string {
    return `${color}(${text})`
  },
  bold(text: string): string {
    return `bold(${text})`
  },
} as unknown as Theme

describe('Pi renderer host wrapper', () => {
  it('renderCall returns a Text-compatible component for empty code', () => {
    const component = renderCall({}, theme)
    expect(typeof component.render).toBe('function')
    expect(component.render(80).join('\n')).toContain('(empty)')
  })

  it('renderCall shows inline code for a short one-liner', () => {
    const component = renderCall({ code: 'return 1' }, theme)
    expect(component.render(80).join('\n')).toContain('return')
  })

  it('renderCall truncates multiline preview with remaining-line count', () => {
    const component = renderCall({ code: ['a()', 'b()', 'c()', 'd()'].join('\n') }, theme)
    const output = component.render(120).join('\n')
    expect(output).toContain('1 more line')
    expect(output).toContain('4 total')
  })

  it('renderResult renders collapsed structured JSON with success header and content', () => {
    const component = renderResult(
      { content: [{ type: 'text', text: JSON.stringify([{ name: 'metatool', level: 3 }]) }], details: { code: 'return data' } },
      { expanded: false, isPartial: false },
      theme,
    )
    const output = component.render(120).join('\n')
    expect(output).toContain('success(✓)')
    expect(output).toContain('metatool')
    expect(output).toContain('level')
  })

  it('renderResult expanded output includes eval block and output separator', () => {
    const component = renderResult(
      { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }], details: { code: 'return { ok: true }' } },
      { expanded: true, isPartial: false },
      theme,
    )
    const output = component.render(140).join('\n')
    expect(output).toContain('eval')
    expect(output).toContain('output')
    expect(output).toContain('ok')
  })

  it('renderResult renders primitive payloads through the Pi registry', () => {
    const component = renderResult(
      {
        content: [{ type: 'text', text: 'ignored fallback' }],
        details: { code: 'return ms.txt("hello")', primitive: { _v: 'txt', d: 'hello' } },
      },
      { expanded: false, isPartial: false },
      theme,
    )
    const output = component.render(80).join('\n')
    expect(output).toContain('hello')
    expect(output).not.toContain('ignored fallback')
  })
})
