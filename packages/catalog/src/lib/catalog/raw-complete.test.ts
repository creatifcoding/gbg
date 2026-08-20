import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fileSpecimen, type IntakeInput } from './intake'
import type { Specimen } from './schemas/specimen'

const catalogRoot = path.resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
)

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

  it('treats open questions as enough for later understanding', () => {
    const filed = fileSpecimen({
      kind: 'artifact',
      claim: 'Elongate arthropod in a cup. Not identified.',
      tags: ['arthropod', 'cup', 'dump'],
      questions: ['What is this?', 'Where did the cup sit?'],
    })
    expect(filed.specimen.status).toBe('raw')
    expect(filed.specimen.organismGuess).toBeNull()
    expect(filed.specimen.locality._tag).toBe('unknown')
    expect(filed.questions).toHaveLength(2)
  })

  it('has no identification wizard routes or intake steps', () => {
    const routeDir = path.join(catalogRoot, 'src/routes')
    const routeNames = readdirSync(routeDir)
    expect(routeNames.some((name) => /identif|wizard/i.test(name))).toBe(false)

    const intakeUi = readFileSync(
      path.join(catalogRoot, 'src/ui/intake-drop.tsx'),
      'utf8',
    )
    expect(intakeUi).not.toMatch(/name="mechanism"/)
    expect(intakeUi).not.toMatch(/name="analog"/)
    const organismField = intakeUi.slice(
      intakeUi.indexOf('name="organism"'),
      intakeUi.indexOf('name="part"'),
    )
    expect(organismField).toContain('Taxon guess (optional)')
    expect(organismField).not.toMatch(/\brequired\b/)

    const functions = readFileSync(
      path.join(catalogRoot, 'src/lib/catalog/functions.ts'),
      'utf8',
    )
    expect(functions).not.toMatch(/data\.get\('mechanism'\)/)
    expect(functions).not.toMatch(/data\.get\('analog'\)/)
  })
})
