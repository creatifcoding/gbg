import { describe, expect, it, beforeEach } from 'vitest'
import { BreakdownRequest, TemplateBundle } from '../schema.ts'
import * as Facade from '../state/facade.ts'
import { resetState } from '../state/atoms.ts'

describe('state facade lifecycle', () => {
  beforeEach(() => {
    resetState()
  })

  it('transitions running -> done and increments runs', () => {
    const request = new BreakdownRequest({ componentName: 'LayerPanel' })

    Facade.beginRun(request)
    expect(Facade.snapshot().status).toBe('running')

    const bundle = new TemplateBundle({
      componentName: 'LayerPanel',
      context: 'ctx',
      compactStateDiagram: 'compact',
      expandedStateDiagram: 'expanded',
      petNameLexicon: 'lexicon',
      interactionPrecedenceMatrix: 'matrix',
      perPhaseSmokeTests: 'smoke',
      generatedAt: new Date().toISOString(),
    })

    Facade.completeRun(request, bundle)

    const state = Facade.snapshot()
    expect(state.status).toBe('done')
    expect(state.runs).toBe(1)
    expect(state.lastRequest?.componentName).toBe('LayerPanel')
    expect(state.lastBundle?.componentName).toBe('LayerPanel')
  })

  it('captures error state', () => {
    const request = new BreakdownRequest({ componentName: 'FailPanel' })

    Facade.beginRun(request)
    Facade.failRun(request, 'boom')

    const state = Facade.snapshot()
    expect(state.status).toBe('error')
    expect(state.lastError).toBe('boom')
  })
})
