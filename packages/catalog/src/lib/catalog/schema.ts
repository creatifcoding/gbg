import { Schema } from 'effect'

export const CardKind = Schema.Literals([
  'picture',
  'dossier',
  'artifact',
  'note',
] as const)
export type CardKind = typeof CardKind.Type

export const CardStatus = Schema.Literals([
  'raw',
  'filed',
  'working',
  'dead',
] as const)
export type CardStatus = typeof CardStatus.Type

export const CardId = Schema.String.pipe(Schema.brand('CardId'))
export type CardId = typeof CardId.Type

export const AttachmentId = Schema.String.pipe(Schema.brand('AttachmentId'))
export type AttachmentId = typeof AttachmentId.Type

export const AttachmentKind = Schema.Literals(['image', 'file'] as const)
export type AttachmentKind = typeof AttachmentKind.Type

export const Attachment = Schema.Struct({
  id: AttachmentId,
  filename: Schema.NonEmptyString,
  mimeType: Schema.NonEmptyString,
  sizeBytes: Schema.Number,
  kind: AttachmentKind,
})
export type Attachment = typeof Attachment.Type

export const OrganismKnown = Schema.TaggedStruct('OrganismKnown', {
  label: Schema.NonEmptyString,
})
export type OrganismKnown = typeof OrganismKnown.Type

export const OrganismUnknown = Schema.TaggedStruct('OrganismUnknown', {})
export type OrganismUnknown = typeof OrganismUnknown.Type

export const OrganismSystem = Schema.Union([OrganismKnown, OrganismUnknown])
export type OrganismSystem = typeof OrganismSystem.Type

export const Tags = Schema.Array(Schema.NonEmptyString).check(Schema.isMinLength(3))
export type Tags = typeof Tags.Type

export const CatalogCard = Schema.Struct({
  id: CardId,
  kind: CardKind,
  status: CardStatus,
  claim: Schema.NonEmptyString,
  tags: Tags,
  organism: OrganismSystem,
  questions: Schema.Array(Schema.NonEmptyString),
  notes: Schema.String,
  attachments: Schema.Array(Attachment),
  example: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})
export type CatalogCard = typeof CatalogCard.Type

export const CatalogFilter = Schema.Struct({
  kind: Schema.optional(CardKind),
  status: Schema.optional(CardStatus),
  tag: Schema.optional(Schema.NonEmptyString),
})
export type CatalogFilter = typeof CatalogFilter.Type

export const IntakeInput = Schema.Struct({
  kind: CardKind,
  claim: Schema.NonEmptyString,
  tags: Tags,
  organism: OrganismSystem,
  questions: Schema.Array(Schema.NonEmptyString),
})
export type IntakeInput = typeof IntakeInput.Type

export const decodeCard = Schema.decodeUnknownSync(CatalogCard)
export const decodeIntake = Schema.decodeUnknownSync(IntakeInput)
export const encodeCard = Schema.encodeUnknownSync(CatalogCard)

export const CARD_KINDS = [
  'picture',
  'dossier',
  'artifact',
  'note',
] as const satisfies ReadonlyArray<CardKind>

export const CARD_STATUSES = [
  'raw',
  'filed',
  'working',
  'dead',
] as const satisfies ReadonlyArray<CardStatus>

export function isCardKind(value: string): value is CardKind {
  return (CARD_KINDS as readonly string[]).includes(value)
}

export function isCardStatus(value: string): value is CardStatus {
  return (CARD_STATUSES as readonly string[]).includes(value)
}

export function parseTags(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

export function parseQuestions(raw: string): string[] {
  return raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function organismFromInput(raw: string): OrganismSystem {
  const label = raw.trim()
  if (label.length === 0 || label.toLowerCase() === 'unknown') {
    return { _tag: 'OrganismUnknown' }
  }
  return { _tag: 'OrganismKnown', label }
}

export function organismLabel(organism: OrganismSystem): string {
  switch (organism._tag) {
    case 'OrganismKnown':
      return organism.label
    case 'OrganismUnknown':
      return 'unknown'
    default: {
      const _exhaustive: never = organism
      return _exhaustive
    }
  }
}

export function attachmentKindFromMime(mimeType: string): AttachmentKind {
  return mimeType.startsWith('image/') ? 'image' : 'file'
}
