import { describe, expect, it } from 'vitest'
import {
  SpecimenTransitionError,
  createSpecimen,
  transitionSpecimen,
} from './specimen-entity'
import {
  AnalogTransitionError,
  createAnalog,
  transitionAnalog,
} from './analog-entity'
import { Schema } from 'effect'
import { AnalogId, SpecimenId } from '../schemas/identifiers'

describe('SpecimenEntity status machine', () => {
  it('creates a specimen in raw', () => {
    const { specimen, event } = createSpecimen({
      id: Schema.decodeUnknownSync(SpecimenId)('sp_1'),
      kind: 'note',
    })
    expect(specimen.status).toBe('raw')
    expect(specimen.claim).toBeUndefined()
    expect(specimen.organismGuess).toBeUndefined()
    expect(specimen.locality).toBeUndefined()
    expect(event.type).toBe('SpecimenCreated')
  })

  it('allows raw → filed and rejects raw → working', () => {
    const { specimen } = createSpecimen({
      id: Schema.decodeUnknownSync(SpecimenId)('sp_2'),
      kind: 'picture',
    })
    const filed = transitionSpecimen(specimen, 'filed')
    expect(filed.specimen.status).toBe('filed')
    expect(() => transitionSpecimen(specimen, 'working')).toThrow(
      SpecimenTransitionError,
    )
  })
})

describe('AnalogEntity status machine', () => {
  it('allows raw → working → tested and rejects raw → tested', () => {
    const { analog } = createAnalog({
      id: Schema.decodeUnknownSync(AnalogId)('an_1'),
      claim: 'Tape analog of setae.',
    })
    expect(analog.status).toBe('raw')
    const working = transitionAnalog(analog, 'working')
    const tested = transitionAnalog(working.analog, 'tested')
    expect(tested.analog.status).toBe('tested')
    expect(() => transitionAnalog(analog, 'tested')).toThrow(
      AnalogTransitionError,
    )
  })
})
