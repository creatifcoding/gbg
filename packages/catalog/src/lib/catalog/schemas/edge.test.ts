import { describe, expect, it } from 'vitest'
import { assertEdge, EdgeEndpointError, edgeEndpointsAllowed } from './edge'
import { createEdge } from '../entity/edge-entity'

describe('biomimetic edges', () => {
  it('allows exhibits organism → structure', () => {
    expect(
      edgeEndpointsAllowed(
        'exhibits',
        { _tag: 'organism', id: 'org_1' as never },
        { _tag: 'structure', id: 'str_1' as never },
      ),
    ).toBe(true)
  })

  it('allows via from function or structure to mechanism', () => {
    expect(
      edgeEndpointsAllowed(
        'via',
        { _tag: 'function', id: 'fn_1' as never },
        { _tag: 'mechanism', id: 'mech_1' as never },
      ),
    ).toBe(true)
    expect(
      edgeEndpointsAllowed(
        'via',
        { _tag: 'structure', id: 'str_1' as never },
        { _tag: 'mechanism', id: 'mech_1' as never },
      ),
    ).toBe(true)
  })

  it('allows depicts from a card onto analog or organism', () => {
    expect(
      edgeEndpointsAllowed(
        'depicts',
        { _tag: 'card', id: 'card_1' as never },
        { _tag: 'analog', id: 'an_1' as never },
      ),
    ).toBe(true)
  })

  it('rejects inspires unless mechanism → analog', () => {
    expect(() =>
      assertEdge(
        createEdge({
          id: 'edge_bad' as never,
          kind: 'inspires',
          from: { _tag: 'card', id: 'card_1' as never },
          to: { _tag: 'analog', id: 'an_1' as never },
        }),
      ),
    ).toThrow(EdgeEndpointError)
  })

  it('rejects a card contained in itself', () => {
    expect(
      edgeEndpointsAllowed(
        'contained-in',
        { _tag: 'card', id: 'card_1' as never },
        { _tag: 'card', id: 'card_1' as never },
      ),
    ).toBe(false)
  })
})
