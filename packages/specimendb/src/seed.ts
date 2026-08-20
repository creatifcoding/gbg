import * as Schema from 'effect/Schema'
import { fileSpecimen } from './intake'
import { SpecimenId } from './schemas/identifiers'
import type { Specimen } from './schemas/specimen'

export const FIRST_SPECIMEN_ID = Schema.decodeUnknownSync(SpecimenId)(
  '20260819-001',
)

export const SECOND_SPECIMEN_ID = Schema.decodeUnknownSync(SpecimenId)(
  '20260819-002',
)

const firstFiledAt = Date.UTC(2026, 7, 19)

/** 20260819-001 field catch JPEG. EXIF stripped. Original not in this clone. */
export const FIRST_SPECIMEN: Specimen = fileSpecimen(
  {
    id: FIRST_SPECIMEN_ID,
    kind: 'picture',
    claim: 'Elongate arthropod in a Taco Bell cup.',
    tags: ['arthropod', 'cup', 'dump'],
    organismGuess: { label: 'elongate arthropod', guess: true },
    questions: [],
  },
  firstFiledAt,
).specimen

/** 20260819-002 Apple TextKit emoji HEIC. No GPS tags. Original not in this clone. */
export const SECOND_SPECIMEN: Specimen = fileSpecimen(
  {
    id: SECOND_SPECIMEN_ID,
    kind: 'picture',
    claim: 'Apple TextKit emoji HEIC.',
    tags: ['emoji', 'heic', 'dump'],
    questions: [],
  },
  firstFiledAt + 1,
).specimen

export const SEED_SPECIMENS: ReadonlyArray<Specimen> = [
  FIRST_SPECIMEN,
  SECOND_SPECIMEN,
]
