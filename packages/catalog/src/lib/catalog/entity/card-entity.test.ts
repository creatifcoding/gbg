import { describe, expect, it } from 'vitest'
import {
  CardTransitionError,
  createCard,
  transitionCard,
} from './card-entity'
import {
  AnalogTransitionError,
  createAnalog,
  transitionAnalog,
} from './analog-entity'
import type { AnalogId, CardId } from '../schemas/identifiers'

describe('CardEntity status machine', () => {
  it('creates a card in raw', () => {
    const { card, event } = createCard({
      id: 'card_1' as CardId,
      kind: 'note',
      claim: 'Dump first.',
      organismGuess: null,
      tagIds: [],
      questionIds: [],
    })
    expect(card.status).toBe('raw')
    expect(event.type).toBe('CardCreated')
  })

  it('allows raw → filed and rejects raw → working', () => {
    const { card } = createCard({
      id: 'card_2' as CardId,
      kind: 'picture',
      claim: 'Raw picture.',
      organismGuess: null,
      tagIds: [],
      questionIds: [],
    })
    const filed = transitionCard(card, 'filed')
    expect(filed.card.status).toBe('filed')
    expect(() => transitionCard(card, 'working')).toThrow(CardTransitionError)
  })
})

describe('AnalogEntity status machine', () => {
  it('allows raw → working → tested and rejects raw → tested', () => {
    const { analog } = createAnalog({
      id: 'an_1' as AnalogId,
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
