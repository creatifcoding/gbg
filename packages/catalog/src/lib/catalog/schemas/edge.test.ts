import { describe, expect, it } from 'vitest'
import { assertEdge, EdgeEndpointError, edgeEndpointsAllowed } from './edge'
import { createEdge } from '../entity/edge-entity'

describe('biomimetic edges', () => {
  it('allows observation-of from observation to specimen', () => {
    expect(
      edgeEndpointsAllowed(
        'observation-of',
        { _tag: 'observation', id: 'obs_1' as never },
        { _tag: 'specimen', id: 'sp_1' as never },
      ),
    ).toBe(true)
  })

  it('allows exhibits from specimen or organism to structure', () => {
    expect(
      edgeEndpointsAllowed(
        'exhibits',
        { _tag: 'specimen', id: 'sp_1' as never },
        { _tag: 'structure', id: 'str_1' as never },
      ),
    ).toBe(true)
    expect(
      edgeEndpointsAllowed(
        'exhibits',
        { _tag: 'organism', id: 'org_1' as never },
        { _tag: 'structure', id: 'str_1' as never },
      ),
    ).toBe(true)
  })

  it('allows identified-as specimen → organism', () => {
    expect(
      edgeEndpointsAllowed(
        'identified-as',
        { _tag: 'specimen', id: 'sp_1' as never },
        { _tag: 'organism', id: 'org_1' as never },
      ),
    ).toBe(true)
  })

  it('allows inspires from specimen or mechanism to analog', () => {
    expect(
      edgeEndpointsAllowed(
        'inspires',
        { _tag: 'specimen', id: 'sp_1' as never },
        { _tag: 'analog', id: 'an_1' as never },
      ),
    ).toBe(true)
  })

  it('rejects a specimen contained in itself', () => {
    expect(
      edgeEndpointsAllowed(
        'contained-in',
        { _tag: 'specimen', id: 'sp_1' as never },
        { _tag: 'specimen', id: 'sp_1' as never },
      ),
    ).toBe(false)
  })

  it('rejects observation-of unless observation → specimen', () => {
    expect(() =>
      assertEdge(
        createEdge({
          id: 'edge_bad',
          kind: 'observation-of',
          from: { _tag: 'specimen', id: 'sp_1' as never },
          to: { _tag: 'specimen', id: 'sp_2' as never },
        }),
      ),
    ).toThrow(EdgeEndpointError)
  })
})
