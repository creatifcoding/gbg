import { Schema } from 'effect'
import { decodeAttachment, type Attachment } from '../schemas/attachment'
import { decodeStoredCard, type Card } from '../schemas/card'
import { decodeQuestion, type Question } from '../schemas/question'
import { decodeTag, type Tag } from '../schemas/tag'
import type { AttachmentId, CardId, QuestionId, TagId } from '../schemas/identifiers'
import { decodeCatalogSnapshot, type CatalogSnapshot } from './catalog-snapshot'

const V1OrganismKnown = Schema.TaggedStruct('OrganismKnown', {
  label: Schema.NonEmptyString,
})
const V1OrganismUnknown = Schema.TaggedStruct('OrganismUnknown', {})
const V1Organism = Schema.Union([V1OrganismKnown, V1OrganismUnknown])

const V1Attachment = Schema.Struct({
  id: Schema.String,
  filename: Schema.NonEmptyString,
  mimeType: Schema.NonEmptyString,
  sizeBytes: Schema.Number,
  kind: Schema.Literals(['image', 'file'] as const),
})

const V1Card = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(['picture', 'dossier', 'artifact', 'note'] as const),
  status: Schema.Literals(['raw', 'filed', 'working', 'dead'] as const),
  claim: Schema.NonEmptyString,
  tags: Schema.Array(Schema.NonEmptyString),
  organism: V1Organism,
  questions: Schema.Array(Schema.NonEmptyString),
  notes: Schema.String,
  attachments: Schema.Array(V1Attachment),
  example: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})

export const V1CatalogFile = Schema.Struct({
  version: Schema.Literal(1),
  cards: Schema.Array(V1Card),
})
export type V1CatalogFile = typeof V1CatalogFile.Type

export const decodeV1CatalogFile = Schema.decodeUnknownSync(V1CatalogFile)

function tagIdForSlug(slug: string): TagId {
  return `tag_${slug}` as TagId
}

export function migrateV1(file: V1CatalogFile): CatalogSnapshot {
  const tags: Tag[] = []
  const questions: Question[] = []
  const attachments: Attachment[] = []
  const cards: Card[] = []
  const tagsBySlug = new Map<string, Tag>()

  for (const v1 of file.cards) {
    const tagIds: TagId[] = []
    for (const slug of v1.tags) {
      let tag = tagsBySlug.get(slug)
      if (!tag) {
        tag = decodeTag({ id: tagIdForSlug(slug), slug })
        tagsBySlug.set(slug, tag)
        tags.push(tag)
      }
      tagIds.push(tag.id)
    }

    const questionIds: QuestionId[] = []
    v1.questions.forEach((text, index) => {
      const question = decodeQuestion({
        id: `q_${v1.id}_${index}` as QuestionId,
        cardId: v1.id as CardId,
        text,
      })
      questions.push(question)
      questionIds.push(question.id)
    })

    const attachmentIds: AttachmentId[] = []
    for (const item of v1.attachments) {
      const attachment = decodeAttachment({
        id: item.id as AttachmentId,
        cardId: v1.id as CardId,
        filename: item.filename,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        kind: item.kind,
      })
      attachments.push(attachment)
      attachmentIds.push(attachment.id)
    }

    const organismGuess =
      v1.organism._tag === 'OrganismKnown'
        ? { label: v1.organism.label, guess: true as const }
        : null

    cards.push(
      decodeStoredCard({
        _tag: 'Card',
        id: v1.id as CardId,
        kind: v1.kind,
        status: v1.status,
        claim: v1.claim,
        body: v1.notes,
        organismGuess,
        structureGuess: null,
        functionGuess: null,
        tagIds,
        questionIds,
        attachmentIds,
        example: v1.example,
        createdAt: v1.createdAt,
        updatedAt: v1.updatedAt,
      }),
    )
  }

  return decodeCatalogSnapshot({
    version: 2,
    cards,
    analogs: [],
    organisms: [],
    structures: [],
    mechanisms: [],
    functions: [],
    attachments,
    tags,
    questions,
    edges: [],
    events: [],
  })
}

export function snapshotLooksLikeV1(raw: unknown): boolean {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'version' in raw &&
    (raw as { version: unknown }).version === 1
  )
}
