import { describe, expect, it } from 'vitest'
import * as Schema from 'effect/Schema'
import {
  IDENTIFY_SYSTEM_STATUS,
  INTAKE_REQUIRED_COMPONENTS,
  SPECIMENDB_COMPONENTS,
  SPECIMENDB_ENTITIES,
  SPECIMENDB_SYSTEMS,
} from './ecs'
import { spawnSpecimen } from './entity/specimen'
import { fileSpecimen, type IntakeInput } from './intake'
import { SpecimenId } from './schemas/identifiers'
import type { Specimen } from './schemas/specimen'

type RequiredKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]

type RequiredIntakeKeys = RequiredKeys<IntakeInput>
type RequiredSpecimenKeys = RequiredKeys<Specimen>

const intakeRequiresOnlyKind: RequiredIntakeKeys extends 'kind'
  ? 'kind' extends RequiredIntakeKeys
    ? true
    : false
  : false = true

const specimenRequiresEntityFields: Exclude<
  RequiredSpecimenKeys,
  '_tag' | 'id' | 'kind' | 'status' | 'example' | 'createdAt' | 'updatedAt'
> extends never
  ? true
  : false = true

describe('specimendb ECS', () => {
  it('names entities, optional components, and systems', () => {
    expect(SPECIMENDB_ENTITIES).toContain('specimen')
    expect(SPECIMENDB_COMPONENTS).toEqual(
      expect.arrayContaining([
        'status',
        'claim',
        'media',
        'exif',
        'locality',
        'taxon',
        'structure',
        'mechanism',
        'function',
        'analogLink',
        'tag',
        'question',
        'observation',
      ]),
    )
    expect(SPECIMENDB_SYSTEMS).toEqual([
      'intake',
      'capture',
      'file',
      'identify',
      'relate',
    ])
    expect(INTAKE_REQUIRED_COMPONENTS).toEqual(['status'])
    expect(IDENTIFY_SYSTEM_STATUS).toBe('later')
  })

  it('does not require taxon, locality, or claim on the entity or intake', () => {
    expect(intakeRequiresOnlyKind).toBe(true)
    expect(specimenRequiresEntityFields).toBe(true)
  })

  it('spawns a specimen without stuffing a Card row', () => {
    const { specimen } = spawnSpecimen({
      id: Schema.decodeUnknownSync(SpecimenId)('20260820-001'),
      kind: 'picture',
    })
    expect(specimen.status).toBe('raw')
    expect(Object.keys(specimen).sort()).toEqual(
      ['_tag', 'createdAt', 'example', 'id', 'kind', 'status', 'updatedAt'].sort(),
    )
  })

  it('lets intake attach only what is in hand', () => {
    const filed = fileSpecimen({ kind: 'artifact' })
    expect(filed.specimen.status).toBe('raw')
    expect(filed.specimen.claim).toBeUndefined()
    expect(filed.specimen.locality).toBeUndefined()
    expect(filed.observation.kind).toBe('artifact')
  })
})
