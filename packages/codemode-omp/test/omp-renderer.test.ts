import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(import.meta.dirname, '..', 'src', 'render-omp.ts'), 'utf8')

describe('OMP renderer host boundary', () => {
  it('uses OMP-native rendering primitives instead of Pi TUI primitives', () => {
    expect(source).toContain("from '@oh-my-pi/pi-coding-agent/tui'")
    expect(source).toContain('framedBlock')
    expect(source).toContain('renderCodeCell')
    expect(source).toContain('outputBlockContentWidth')
    expect(source).not.toContain("from '@mariozechner/pi-tui'")
    expect(source).not.toContain("from '@mariozechner/pi-coding-agent'")
  })

  it('keeps host-neutral primitive rendering behind RenderContext', () => {
    expect(source).toContain('createOmpRenderContext')
    expect(source).toContain('tryRenderPrimitive')
    expect(source).toContain('gridLines')
    expect(source).toContain('visibleWidth')
    expect(source).toContain('truncateToWidth')
  })

  it('renders eval lifecycle states through OMP status surfaces', () => {
    expect(source).toContain('statusForResult')
    expect(source).toContain('renderStatusLine')
    expect(source).toContain("state: 'error'")
    expect(source).toContain("status: 'running'")
    expect(source).toContain("status: 'complete'")
  })
})
