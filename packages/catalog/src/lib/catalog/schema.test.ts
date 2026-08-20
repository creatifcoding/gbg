import { describe, expect, it } from 'vitest'
import { decodeIntake, fileCard, IntakeError } from './intake'
import {
  decodeCard,
  guessFromInput,
  organismLabel,
  parseTags,
} from './schema'

describe('intake invariant', () => {
  it('files a raw card from type, claim, and 3 tags without an organism', () => {
    const filed = fileCard(
      {
        kind: 'picture',
        claim: 'Gecko toe pad dumped before the analog is designed.',
        tags: ['adhesion', 'setae', 'dump'],
        questions: ['What surface was the toe on?'],
      },
      1_700_000_000_000,
    )

    expect(filed.card.status).toBe('raw')
    expect(filed.card.body).toBe('')
    expect(filed.card.example).toBe(false)
    expect(filed.card.organismGuess).toBeNull()
    expect(filed.tags).toHaveLength(3)
    expect(filed.card.createdAt).toBe(1_700_000_000_000)
    expect(filed.events[0]?.type).toBe('CardCreated')
  })

  it('marks a provided organism as a guess, not a reference node', () => {
    const filed = fileCard({
      kind: 'note',
      claim: 'Lotus leaf wetting still a hypothesis.',
      tags: ['wetting', 'lotus', 'leaf'],
      organismGuess: { label: 'Nelumbo nucifera', guess: true },
      questions: [],
    })

    expect(filed.card.organismGuess).toEqual({
      label: 'Nelumbo nucifera',
      guess: true,
    })
  })

  it('rejects fewer than 3 tags', () => {
    expect(() =>
      decodeIntake({
        kind: 'note',
        claim: 'Too thin',
        tags: ['one', 'two'],
        questions: [],
      }),
    ).toThrow()

    expect(() =>
      fileCard({
        kind: 'note',
        claim: 'Too thin',
        tags: ['one', 'two'],
        questions: [],
      }),
    ).toThrow(IntakeError)
  })

  it('rejects an empty claim', () => {
    expect(() =>
      fileCard({
        kind: 'note',
        claim: '',
        tags: ['a', 'b', 'c'],
        questions: [],
      }),
    ).toThrow(IntakeError)
  })

  it('treats blank organism input as no guess', () => {
    expect(guessFromInput('')).toBeNull()
    expect(guessFromInput('unknown')).toBeNull()
    expect(organismLabel(guessFromInput('Tokay gecko'))).toBe('Tokay gecko')
    expect(organismLabel(null)).toBe('unlinked')
  })

  it('splits tags on commas', () => {
    expect(parseTags('adhesion, setae, example')).toEqual([
      'adhesion',
      'setae',
      'example',
    ])
  })

  it('hydrates a card view from intake records', () => {
    const filed = fileCard({
      kind: 'dossier',
      claim: 'Folder of lotus notes, not a paper.',
      tags: ['notes', 'lotus', 'wetting'],
      organismGuess: { label: 'Nelumbo nucifera', guess: true },
      questions: [],
    })
    const view = decodeCard({
      id: filed.card.id,
      kind: filed.card.kind,
      status: filed.card.status,
      claim: filed.card.claim,
      body: filed.card.body,
      organismGuess: filed.card.organismGuess,
      structureGuess: filed.card.structureGuess,
      functionGuess: filed.card.functionGuess,
      tags: filed.tags.map((tag) => tag.slug),
      questions: filed.questions.map((question) => question.text),
      attachments: [],
      example: filed.card.example,
      createdAt: filed.card.createdAt,
      updatedAt: filed.card.updatedAt,
    })
    expect(view.id).toBe(filed.card.id)
    expect(view.tags).toHaveLength(3)
  })
})
