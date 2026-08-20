import {
  decodeCard,
  decodeIntake,
  type CatalogCard as CatalogCardType,
  type IntakeInput,
} from './schema'

export class IntakeError extends Error {
  readonly _tag = 'IntakeError'
  constructor(readonly issues: ReadonlyArray<string>) {
    super(issues.join('; '))
    this.name = 'IntakeError'
  }
}

export function fileCard(input: unknown, now = Date.now()): CatalogCardType {
  let intake: IntakeInput
  try {
    intake = decodeIntake(input)
  } catch (error) {
    throw new IntakeError(issuesFromUnknown(error))
  }

  return decodeCard({
    id: crypto.randomUUID(),
    kind: intake.kind,
    status: 'raw',
    claim: intake.claim,
    tags: intake.tags,
    organism: intake.organism,
    questions: intake.questions,
    notes: '',
    attachments: [],
    example: false,
    createdAt: now,
    updatedAt: now,
  })
}

function issuesFromUnknown(error: unknown): string[] {
  if (error instanceof Error && error.message.length > 0) {
    return [
      'Need a type, a one-line claim, 3+ tags, and organism/system (or unknown).',
      error.message,
    ]
  }
  return ['Need a type, a one-line claim, 3+ tags, and organism/system (or unknown).']
}
