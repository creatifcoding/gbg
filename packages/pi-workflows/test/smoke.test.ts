import { describe, expect, it } from 'vitest'

import { piWorkflowsExtension } from '../src/index'

describe('@tmnl/pi-workflows skeleton', () => {
  it('exports a Pi extension factory', () => {
    expect(typeof piWorkflowsExtension).toBe('function')
  })
})
