import { describe, expect, it } from 'vitest'
import {
  IntakeFile,
  SpecimenGet,
  SpecimenList,
  SpecimenPromote,
  SpecimendbRpcs,
} from './rpc/rpcs'
import {
  IntakeFileTag,
  SpecimenGetTag,
  SpecimenListTag,
  SpecimenPromoteTag,
} from './rpc/tags'

describe('specimendb RPC contract', () => {
  it('names Intake.File, Specimen.Get, Specimen.List, Specimen.Promote', () => {
    expect(IntakeFile._tag).toBe(IntakeFileTag)
    expect(SpecimenGet._tag).toBe(SpecimenGetTag)
    expect(SpecimenList._tag).toBe(SpecimenListTag)
    expect(SpecimenPromote._tag).toBe(SpecimenPromoteTag)
    expect([...SpecimendbRpcs.requests.keys()]).toEqual([
      'Intake.File',
      'Specimen.Get',
      'Specimen.List',
      'Specimen.Promote',
    ])
  })
})
