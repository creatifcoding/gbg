import { describe, expect, it } from 'vitest'
import { decodeIntake, fileSpecimen, IntakeError } from './intake'
import {
  decodeSpecimen,
  guessFromInput,
  organismLabel,
  parseTags,
} from './schema'

describe('intake invariant', () => {
  it('files a complete raw specimen without taxon, GPS, mechanism, or analog', () => {
    const filed = fileSpecimen(
      {
        kind: 'picture',
        claim: 'This gecko toe pad, dumped before the analog is designed.',
        tags: ['adhesion', 'setae', 'dump'],
        questions: ['What surface was the toe on?'],
      },
      1_700_000_000_000,
    )

    expect(filed.specimen.status).toBe('raw')
    expect(filed.specimen.body).toBe('')
    expect(filed.specimen.example).toBe(false)
    expect(filed.specimen.organismGuess).toBeNull()
    expect(filed.specimen.structureGuess).toBeNull()
    expect(filed.specimen.locality).toEqual({ _tag: 'unknown' })
    expect(filed.specimen.cameraMake).toBeNull()
    expect(filed.questions.map((question) => question.text)).toEqual([
      'What surface was the toe on?',
    ])
    expect(filed.specimen).not.toHaveProperty('mechanism')
    expect(filed.specimen).not.toHaveProperty('analog')
    expect(filed.specimen.id).toMatch(/^\d{8}-\d{3}$/)
    expect(filed.tags).toHaveLength(3)
    expect(filed.specimen.createdAt).toBe(1_700_000_000_000)
    expect(filed.events[0]?.type).toBe('SpecimenCreated')
    expect(filed.observation.specimenId).toBe(filed.specimen.id)
    expect(filed.observationEdge.kind).toBe('observation-of')
  })

  it('still files when open questions are empty', () => {
    const filed = fileSpecimen({
      kind: 'note',
      claim: 'A cup dump with nothing identified yet.',
      tags: ['cup', 'dump', 'unknown'],
      questions: [],
    })
    expect(filed.specimen.status).toBe('raw')
    expect(filed.questions).toEqual([])
    expect(filed.specimen.organismGuess).toBeNull()
    expect(filed.specimen.locality).toEqual({ _tag: 'unknown' })
  })

  it('marks a provided taxon as a guess, not a required Organism record', () => {
    const filed = fileSpecimen({
      kind: 'note',
      claim: 'This lotus leaf, wetting still a hypothesis.',
      tags: ['wetting', 'lotus', 'leaf'],
      organismGuess: { label: 'Nelumbo nucifera', guess: true },
      structureGuess: { label: 'leaf surface', guess: true },
      locality: { _tag: 'named', label: 'pond margin' },
      observedAt: 'June dump',
      questions: [],
    })

    expect(filed.specimen.organismGuess).toEqual({
      label: 'Nelumbo nucifera',
      guess: true,
    })
    expect(filed.specimen.structureGuess).toEqual({
      label: 'leaf surface',
      guess: true,
    })
    expect(filed.specimen.locality).toEqual({
      _tag: 'named',
      label: 'pond margin',
    })
    expect(filed.specimen.observedAt).toBe('June dump')
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
      fileSpecimen({
        kind: 'note',
        claim: 'Too thin',
        tags: ['one', 'two'],
        questions: [],
      }),
    ).toThrow(IntakeError)
  })

  it('rejects an empty claim', () => {
    expect(() =>
      fileSpecimen({
        kind: 'note',
        claim: '',
        tags: ['a', 'b', 'c'],
        questions: [],
      }),
    ).toThrow(IntakeError)
  })

  it('treats blank taxon input as no guess', () => {
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

  it('hydrates a specimen view from intake records', () => {
    const filed = fileSpecimen({
      kind: 'dossier',
      claim: 'Folder of lotus notes, not a paper.',
      tags: ['notes', 'lotus', 'wetting'],
      organismGuess: { label: 'Nelumbo nucifera', guess: true },
      questions: [],
    })
    const view = decodeSpecimen({
      id: filed.specimen.id,
      kind: filed.specimen.kind,
      status: filed.specimen.status,
      claim: filed.specimen.claim,
      body: filed.specimen.body,
      organismGuess: filed.specimen.organismGuess,
      structureGuess: filed.specimen.structureGuess,
      locality: filed.specimen.locality,
      observedAt: filed.specimen.observedAt,
      cameraMake: filed.specimen.cameraMake,
      cameraModel: filed.specimen.cameraModel,
      tags: filed.tags.map((tag) => tag.slug),
      questions: filed.questions.map((question) => question.text),
      observations: [filed.observation],
      attachments: [],
      example: filed.specimen.example,
      createdAt: filed.specimen.createdAt,
      updatedAt: filed.specimen.updatedAt,
    })
    expect(view.id).toBe(filed.specimen.id)
    expect(view.tags).toHaveLength(3)
  })
})
