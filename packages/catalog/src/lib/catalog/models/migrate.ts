import { Schema } from 'effect'
import { decodeAttachment } from '../schemas/attachment'
import { decodeObservation } from '../schemas/observation'
import { decodeQuestion } from '../schemas/question'
import { decodeStoredSpecimen } from '../schemas/specimen'
import { decodeTag } from '../schemas/tag'
import { decodeEdge } from '../schemas/edge'
import { decodeCatalogEvent } from '../schemas/events'
import { UNKNOWN_LOCALITY } from '../schemas/locality'
import { Guess } from '../schemas/guess'
import {
  decodeCatalogSnapshot,
  emptySnapshot,
  type CatalogSnapshot,
} from './catalog-snapshot'

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

const V2Guess = Schema.Struct({
  label: Schema.NonEmptyString,
  guess: Schema.Literal(true),
})

const V2Card = Schema.Struct({
  _tag: Schema.Literal('Card'),
  id: Schema.String,
  kind: Schema.Literals(['picture', 'dossier', 'artifact', 'note'] as const),
  status: Schema.Literals(['raw', 'filed', 'working', 'dead'] as const),
  claim: Schema.NonEmptyString,
  body: Schema.String,
  organismGuess: Schema.NullOr(V2Guess),
  structureGuess: Schema.NullOr(V2Guess),
  functionGuess: Schema.NullOr(V2Guess),
  tagIds: Schema.Array(Schema.String),
  questionIds: Schema.Array(Schema.String),
  attachmentIds: Schema.Array(Schema.String),
  example: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})

const V2Attachment = Schema.Struct({
  id: Schema.String,
  cardId: Schema.String,
  filename: Schema.NonEmptyString,
  mimeType: Schema.NonEmptyString,
  sizeBytes: Schema.Number,
  kind: Schema.Literals(['image', 'file'] as const),
})

const V2Question = Schema.Struct({
  id: Schema.String,
  cardId: Schema.String,
  text: Schema.NonEmptyString,
})

const V2Node = Schema.Struct({
  _tag: Schema.String,
  id: Schema.String,
})

const V2Edge = Schema.Struct({
  id: Schema.String,
  kind: Schema.String,
  from: V2Node,
  to: V2Node,
  createdAt: Schema.Number,
})

const V2Event = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  entityId: Schema.String,
  occurredAt: Schema.Number,
  payload: Schema.Unknown,
})

export const V2CatalogFile = Schema.Struct({
  version: Schema.Literal(2),
  cards: Schema.Array(V2Card),
  analogs: Schema.Array(Schema.Unknown),
  organisms: Schema.Array(Schema.Unknown),
  structures: Schema.Array(Schema.Unknown),
  mechanisms: Schema.Array(Schema.Unknown),
  functions: Schema.Array(Schema.Unknown),
  attachments: Schema.Array(V2Attachment),
  tags: Schema.Array(Schema.Unknown),
  questions: Schema.Array(V2Question),
  edges: Schema.Array(V2Edge),
  events: Schema.Array(V2Event),
})
export type V2CatalogFile = typeof V2CatalogFile.Type

export const decodeV2CatalogFile = Schema.decodeUnknownSync(V2CatalogFile)

function snapshotVersion(raw: unknown): number | undefined {
  if (typeof raw !== 'object' || raw === null || !('version' in raw)) {
    return undefined
  }
  const version = (raw as { version: unknown }).version
  return typeof version === 'number' ? version : undefined
}

export function snapshotLooksLikeV1(raw: unknown): boolean {
  return snapshotVersion(raw) === 1
}

export function snapshotLooksLikeV2(raw: unknown): boolean {
  return snapshotVersion(raw) === 2
}

export function snapshotLooksLikeV3(raw: unknown): boolean {
  return snapshotVersion(raw) === 3
}

function cardToSpecimenBundle(input: {
  id: string
  kind: 'picture' | 'dossier' | 'artifact' | 'note'
  status: 'raw' | 'filed' | 'working' | 'dead'
  claim: string
  body: string
  organismGuess: { label: string; guess: true } | null
  structureGuess: { label: string; guess: true } | null
  tagIds: ReadonlyArray<string>
  questionIds: ReadonlyArray<string>
  attachmentIds: ReadonlyArray<string>
  example: boolean
  createdAt: number
  updatedAt: number
}) {
  const observationId = `obs_${input.id}_intake`
  const specimen = decodeStoredSpecimen({
    _tag: 'Specimen',
    id: input.id,
    kind: input.kind,
    status: input.status,
    claim: input.claim,
    body: input.body,
    organismGuess: input.organismGuess,
    structureGuess: input.structureGuess,
    locality: UNKNOWN_LOCALITY,
    observedAt: null,
    cameraMake: null,
    cameraModel: null,
    tagIds: input.tagIds,
    questionIds: input.questionIds,
    observationIds: [observationId],
    attachmentIds: [],
    example: input.example,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  })
  const observation = decodeObservation({
    id: observationId,
    specimenId: input.id,
    kind: input.kind,
    note: '',
    attachmentIds: [...input.attachmentIds],
    createdAt: input.createdAt,
  })
  const edge = decodeEdge({
    id: `edge_obs_${input.id}`,
    kind: 'observation-of',
    from: { _tag: 'observation', id: observationId },
    to: { _tag: 'specimen', id: input.id },
    createdAt: input.createdAt,
  })
  return { specimen, observation, edge }
}

export function migrateV1(file: V1CatalogFile): CatalogSnapshot {
  const tagsBySlug = new Map<string, { id: string; slug: string }>()
  const tags: unknown[] = []
  const questions: unknown[] = []
  const attachments: unknown[] = []
  const specimens: unknown[] = []
  const observations: unknown[] = []
  const edges: unknown[] = []

  for (const v1 of file.cards) {
    const tagIds: string[] = []
    for (const slug of v1.tags) {
      let tag = tagsBySlug.get(slug)
      if (!tag) {
        tag = decodeTag({ id: `tag_${slug}`, slug })
        tagsBySlug.set(slug, tag)
        tags.push(tag)
      }
      tagIds.push(tag.id)
    }

    const questionIds: string[] = []
    v1.questions.forEach((text, index) => {
      const question = decodeQuestion({
        id: `q_${v1.id}_${index}`,
        specimenId: v1.id,
        text,
      })
      questions.push(question)
      questionIds.push(question.id)
    })

    const attachmentIds: string[] = []
    const observationId = `obs_${v1.id}_intake`
    for (const item of v1.attachments) {
      const attachment = decodeAttachment({
        id: item.id,
        specimenId: v1.id,
        host: { _tag: 'observation', id: observationId },
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

    const bundle = cardToSpecimenBundle({
      id: v1.id,
      kind: v1.kind,
      status: v1.status,
      claim: v1.claim,
      body: v1.notes,
      organismGuess,
      structureGuess: null,
      tagIds,
      questionIds,
      attachmentIds,
      example: v1.example,
      createdAt: v1.createdAt,
      updatedAt: v1.updatedAt,
    })
    specimens.push(bundle.specimen)
    observations.push(bundle.observation)
    edges.push(bundle.edge)
  }

  return decodeCatalogSnapshot({
    ...emptySnapshot(),
    specimens,
    observations,
    attachments,
    tags,
    questions,
    edges,
  })
}

function rewriteNode(node: { _tag: string; id: string }) {
  if (node._tag === 'card') {
    return { _tag: 'specimen', id: node.id }
  }
  return node
}

function rewriteEventType(type: string): string {
  if (type === 'CardCreated') return 'SpecimenCreated'
  if (type === 'CardTransitioned') return 'SpecimenTransitioned'
  if (type === 'CardBodySet') return 'SpecimenBodySet'
  return type
}

export function migrateV2(file: V2CatalogFile): CatalogSnapshot {
  const specimens: unknown[] = []
  const observations: unknown[] = []
  const extraEdges: unknown[] = []

  for (const card of file.cards) {
    const bundle = cardToSpecimenBundle({
      id: card.id,
      kind: card.kind,
      status: card.status,
      claim: card.claim,
      body: card.body,
      organismGuess: card.organismGuess,
      structureGuess: card.structureGuess,
      tagIds: card.tagIds,
      questionIds: card.questionIds,
      attachmentIds: card.attachmentIds,
      example: card.example,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    })
    specimens.push(bundle.specimen)
    observations.push(bundle.observation)
    extraEdges.push(bundle.edge)
  }

  const questions = file.questions.map((question) =>
    decodeQuestion({
      id: question.id,
      specimenId: question.cardId,
      text: question.text,
    }),
  )

  const attachments = file.attachments.map((item) =>
    decodeAttachment({
      id: item.id,
      specimenId: item.cardId,
      host: { _tag: 'observation', id: `obs_${item.cardId}_intake` },
      filename: item.filename,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      kind: item.kind,
    }),
  )

  const edges = [
    ...file.edges.map((edge) =>
      decodeEdge({
        id: edge.id,
        kind: edge.kind === 'contained-in' ? 'contained-in' : edge.kind,
        from: rewriteNode(edge.from),
        to: rewriteNode(edge.to),
        createdAt: edge.createdAt,
      }),
    ),
    ...extraEdges,
  ]

  const events = file.events.flatMap((event) => {
    try {
      return [
        decodeCatalogEvent({
          ...event,
          type: rewriteEventType(event.type),
        }),
      ]
    } catch {
      return []
    }
  })

  return decodeCatalogSnapshot({
    version: 4,
    specimens,
    observations,
    analogs: file.analogs,
    organisms: file.organisms,
    structures: file.structures,
    mechanisms: file.mechanisms,
    functions: file.functions,
    attachments,
    tags: file.tags,
    questions,
    edges,
    events,
  })
}

const V3Specimen = Schema.Struct({
  _tag: Schema.Literal('Specimen'),
  id: Schema.String,
  kind: Schema.Literals(['picture', 'dossier', 'artifact', 'note'] as const),
  status: Schema.Literals(['raw', 'filed', 'working', 'dead'] as const),
  claim: Schema.NonEmptyString,
  body: Schema.String,
  organismGuess: Schema.NullOr(Guess),
  structureGuess: Schema.NullOr(Guess),
  locality: Schema.NullOr(Schema.NonEmptyString),
  observedAt: Schema.NullOr(Schema.NonEmptyString),
  tagIds: Schema.Array(Schema.String),
  questionIds: Schema.Array(Schema.String),
  observationIds: Schema.Array(Schema.String),
  attachmentIds: Schema.Array(Schema.String),
  example: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})

export const V3CatalogFile = Schema.Struct({
  version: Schema.Literal(3),
  specimens: Schema.Array(V3Specimen),
  observations: Schema.Array(Schema.Unknown),
  analogs: Schema.Array(Schema.Unknown),
  organisms: Schema.Array(Schema.Unknown),
  structures: Schema.Array(Schema.Unknown),
  mechanisms: Schema.Array(Schema.Unknown),
  functions: Schema.Array(Schema.Unknown),
  attachments: Schema.Array(Schema.Unknown),
  tags: Schema.Array(Schema.Unknown),
  questions: Schema.Array(Schema.Unknown),
  edges: Schema.Array(Schema.Unknown),
  events: Schema.Array(Schema.Unknown),
})
export type V3CatalogFile = typeof V3CatalogFile.Type

export const decodeV3CatalogFile = Schema.decodeUnknownSync(V3CatalogFile)

function localityFromV3(raw: string | null) {
  if (raw == null || raw.trim().length === 0 || raw.trim().toLowerCase() === 'unknown') {
    return UNKNOWN_LOCALITY
  }
  return { _tag: 'named' as const, label: raw.trim() }
}

export function migrateV3(file: V3CatalogFile): CatalogSnapshot {
  return decodeCatalogSnapshot({
    version: 4,
    specimens: file.specimens.map((specimen) =>
      decodeStoredSpecimen({
        ...specimen,
        locality: localityFromV3(specimen.locality),
        cameraMake: null,
        cameraModel: null,
      }),
    ),
    observations: file.observations,
    analogs: file.analogs,
    organisms: file.organisms,
    structures: file.structures,
    mechanisms: file.mechanisms,
    functions: file.functions,
    attachments: file.attachments,
    tags: file.tags,
    questions: file.questions,
    edges: file.edges,
    events: file.events,
  })
}
