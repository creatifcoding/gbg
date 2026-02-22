import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { BreakdownRequest } from '../schema.ts'

describe('BreakdownRequest schema', () => {
  it('applies defaults', () => {
    const decoded = Schema.decodeUnknownSync(BreakdownRequest)({ componentName: 'Panel' })

    expect(decoded.componentName).toBe('Panel')
    expect(decoded.diagramMode).toBe('both')
    expect(decoded.phaseLabels.length).toBeGreaterThan(0)
    expect(decoded.interactionModes.length).toBeGreaterThan(0)
  })

  it('rejects empty component name', () => {
    expect(() => Schema.decodeUnknownSync(BreakdownRequest)({ componentName: '' })).toThrow()
  })
})
