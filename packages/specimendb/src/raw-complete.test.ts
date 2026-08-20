import { describe, expect, it } from 'vitest'
import { fileSpecimen, type IntakeInput } from './intake'
import type { Specimen } from './schemas/specimen'

type BannedIntakeKeys = Extract<
  keyof IntakeInput,
  | 'mechanism'
  | 'analog'
  | 'mechanismId'
  | 'analogId'
  | 'organismId'
  | 'gps'
  | 'incomplete'
>
type BannedSpecimenKeys = Extract<
  keyof Specimen,
  'mechanism' | 'analog' | 'incomplete' | 'draft'
>

const intakeOmitsIdGates: [BannedIntakeKeys] extends [never] ? true : false =
  true
const specimenOmitsIdGates: [BannedSpecimenKeys] extends [never]
  ? true
  : false = true

describe('raw specimens are complete', () => {
  it('does not put mechanism, analog, or identification gates on intake', () => {
    expect(intakeOmitsIdGates).toBe(true)
    expect(specimenOmitsIdGates).toBe(true)
  })

  it('treats open questions as enough', () => {
    const filed = fileSpecimen({
      kind: 'artifact',
      claim: 'Elongate arthropod in a cup. Not identified.',
      tags: ['arthropod', 'cup', 'dump'],
      questions: ['What is this?', 'Where did the cup sit?'],
    })
    expect(filed.specimen.status).toBe('raw')
    expect(filed.specimen.organismGuess).toBeUndefined()
    expect(filed.specimen.locality).toBeUndefined()
    expect(filed.questions).toHaveLength(2)
  })
})
