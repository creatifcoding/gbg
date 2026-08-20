import { describe, expect, it } from 'vitest'
import {
  decodeCard,
  decodeIntake,
  organismFromInput,
  organismLabel,
  parseTags,
} from './schema'
import { fileCard, IntakeError } from './intake'

describe('intake invariant', () => {
  it('files a raw card when type, claim, 3 tags, and organism are present', () => {
    const card = fileCard(
      {
        kind: 'picture',
        claim: 'Gel photo before lane assignment.',
        tags: ['gel', 'western', 'blot'],
        organism: { _tag: 'OrganismUnknown' },
        questions: ['Which lane is the ladder?'],
      },
      1_700_000_000_000,
    )

    expect(card.status).toBe('raw')
    expect(card.notes).toBe('')
    expect(card.example).toBe(false)
    expect(card.tags).toHaveLength(3)
    expect(card.createdAt).toBe(1_700_000_000_000)
  })

  it('rejects fewer than 3 tags', () => {
    expect(() =>
      decodeIntake({
        kind: 'note',
        claim: 'Too thin',
        tags: ['one', 'two'],
        organism: { _tag: 'OrganismUnknown' },
        questions: [],
      }),
    ).toThrow()

    expect(() =>
      fileCard({
        kind: 'note',
        claim: 'Too thin',
        tags: ['one', 'two'],
        organism: { _tag: 'OrganismUnknown' },
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
        organism: { _tag: 'OrganismUnknown' },
        questions: [],
      }),
    ).toThrow(IntakeError)
  })

  it('treats blank organism as unknown', () => {
    expect(organismFromInput('')).toEqual({ _tag: 'OrganismUnknown' })
    expect(organismFromInput('unknown')).toEqual({ _tag: 'OrganismUnknown' })
    expect(organismLabel(organismFromInput('Mus musculus'))).toBe('Mus musculus')
  })

  it('splits tags on commas', () => {
    expect(parseTags('gel, western, example')).toEqual([
      'gel',
      'western',
      'example',
    ])
  })

  it('round-trips a card through the schema', () => {
    const card = fileCard({
      kind: 'dossier',
      claim: 'Folder of lab notes, not a paper.',
      tags: ['notes', 'folder', 'bench'],
      organism: { _tag: 'OrganismKnown', label: 'HeLa' },
      questions: [],
    })
    expect(decodeCard(card).id).toBe(card.id)
  })
})
