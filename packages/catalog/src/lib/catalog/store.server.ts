import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { nanoid } from 'nanoid'
import {
  attachToCard,
  setCardBody,
  transitionCard,
} from './entity/card-entity'
import { createEdge } from './entity/edge-entity'
import {
  hydrateCard,
  matchesFilter,
  type CardView,
  type CatalogFilter,
} from './models/card-view'
import type { CatalogSnapshot, ExampleFragment } from './models/catalog-snapshot'
import { findAttachment, insertAttachment } from './repos/attachment-repo'
import { appendEvents, findCard, upsertCard } from './repos/card-repo'
import { insertEdge } from './repos/edge-repo'
import { insertEvents } from './repos/event-repo'
import { catalogDataDir, fileExists, JsonCatalog } from './repos/json-catalog'
import { upsertAnalog as putAnalog } from './repos/analog-repo'
import {
  findTagBySlug,
  insertQuestion,
  upsertBioFunction,
  upsertMechanism,
  upsertOrganism,
  upsertStructure,
  upsertTag,
} from './repos/reference-repo'
import { attachmentKindFromMime, decodeAttachment } from './schemas/attachment'
import type { CardStatus } from './schemas/card'
import type { CatalogEvent } from './schemas/events'
import type { IntakeResult } from './intake'

export type CardPatch = {
  body?: string
  status?: CardStatus
}

export type StoredAttachment = {
  readonly bytes: Uint8Array
  readonly filename: string
  readonly mimeType: string
}

export class CatalogStore {
  readonly json: JsonCatalog

  constructor(dataDir: string) {
    this.json = new JsonCatalog(dataDir)
  }

  get dataDir(): string {
    return this.json.dataDir
  }

  get blobsDir(): string {
    return this.json.blobsDir
  }

  get catalogPath(): string {
    return this.json.catalogPath
  }

  snapshot(): CatalogSnapshot {
    return this.json.read()
  }

  list(filter: CatalogFilter = {}): CardView[] {
    const snapshot = this.json.read()
    return snapshot.cards
      .map((card) => hydrateCard(snapshot, card))
      .filter((view) => matchesFilter(view, filter))
  }

  get(id: string): CardView | undefined {
    const snapshot = this.json.read()
    const card = findCard(snapshot, id)
    return card ? hydrateCard(snapshot, card) : undefined
  }

  insertIntake(result: IntakeResult): CardView {
    const snapshot = this.json.mutate((current) => {
      let next = current
      const tagIds = result.card.tagIds.map((id) => {
        const draft = result.tags.find((tag) => tag.id === id)
        if (!draft) return id
        const existing = findTagBySlug(next, draft.slug)
        if (existing) return existing.id
        next = upsertTag(next, draft)
        return draft.id
      })
      for (const question of result.questions) {
        next = insertQuestion(next, question)
      }
      next = upsertCard(next, {
        ...result.card,
        tagIds,
      })
      next = appendEvents(next, result.events)
      return next
    })
    const card = findCard(snapshot, result.card.id)
    if (!card) {
      throw new Error(`Card ${result.card.id} missing after intake`)
    }
    return hydrateCard(snapshot, card)
  }

  update(id: string, patch: CardPatch): CardView | undefined {
    let found = false
    const snapshot = this.json.mutate((current) => {
      const card = findCard(current, id)
      if (!card) return current
      found = true
      let nextCard = card
      let next = current
      const events: CatalogEvent[] = []
      if (typeof patch.body === 'string') {
        const updated = setCardBody(nextCard, patch.body)
        nextCard = updated.card
        events.push(updated.event)
      }
      if (patch.status) {
        const updated = transitionCard(nextCard, patch.status)
        nextCard = updated.card
        events.push(updated.event)
      }
      next = upsertCard(next, nextCard)
      next = appendEvents(next, events)
      return next
    })
    if (!found) return undefined
    const card = findCard(snapshot, id)
    return card ? hydrateCard(snapshot, card) : undefined
  }

  attach(input: {
    cardId: string
    filename: string
    mimeType: string
    bytes: Uint8Array
  }): CardView | undefined {
    const current = this.json.read()
    const card = findCard(current, input.cardId)
    if (!card) return undefined

    const attachment = decodeAttachment({
      id: nanoid(),
      cardId: card.id,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      kind: attachmentKindFromMime(input.mimeType),
    })

    const dest = this.json.blobPath(card.id, attachment.id)
    mkdirSync(path.dirname(dest), { recursive: true })
    writeFileSync(dest, input.bytes)

    const snapshot = this.json.mutate((snap) => {
      const live = findCard(snap, card.id)
      if (!live) return snap
      let next = insertAttachment(snap, attachment)
      next = upsertCard(next, attachToCard(live, attachment.id))
      return next
    })
    const nextCard = findCard(snapshot, card.id)
    return nextCard ? hydrateCard(snapshot, nextCard) : undefined
  }

  readBlob(cardId: string, attachmentId: string): StoredAttachment | undefined {
    const snapshot = this.json.read()
    const card = findCard(snapshot, cardId)
    const attachment = findAttachment(snapshot, attachmentId)
    if (!card || !attachment || attachment.cardId !== card.id) return undefined
    const dest = this.json.blobPath(card.id, attachment.id)
    if (!fileExists(dest)) return undefined
    return {
      bytes: new Uint8Array(readFileSync(dest)),
      filename: attachment.filename,
      mimeType: attachment.mimeType,
    }
  }

  mergeExample(fragment: ExampleFragment): void {
    this.json.mutate((current) => {
      let next = current
      const have = {
        cards: new Set(current.cards.map((item) => item.id)),
        analogs: new Set(current.analogs.map((item) => item.id)),
        organisms: new Set(current.organisms.map((item) => item.id)),
        structures: new Set(current.structures.map((item) => item.id)),
        mechanisms: new Set(current.mechanisms.map((item) => item.id)),
        functions: new Set(current.functions.map((item) => item.id)),
        tags: new Set(current.tags.map((item) => item.id)),
        questions: new Set(current.questions.map((item) => item.id)),
        edges: new Set(current.edges.map((item) => item.id)),
        events: new Set(current.events.map((item) => item.id)),
      }
      for (const tag of fragment.tags ?? []) {
        if (!have.tags.has(tag.id) && !findTagBySlug(next, tag.slug)) {
          next = upsertTag(next, tag)
        }
      }
      for (const question of fragment.questions ?? []) {
        if (!have.questions.has(question.id)) {
          next = insertQuestion(next, question)
        }
      }
      for (const organism of fragment.organisms ?? []) {
        if (!have.organisms.has(organism.id)) {
          next = upsertOrganism(next, organism)
        }
      }
      for (const structure of fragment.structures ?? []) {
        if (!have.structures.has(structure.id)) {
          next = upsertStructure(next, structure)
        }
      }
      for (const mechanism of fragment.mechanisms ?? []) {
        if (!have.mechanisms.has(mechanism.id)) {
          next = upsertMechanism(next, mechanism)
        }
      }
      for (const bioFunction of fragment.functions ?? []) {
        if (!have.functions.has(bioFunction.id)) {
          next = upsertBioFunction(next, bioFunction)
        }
      }
      for (const analog of fragment.analogs ?? []) {
        if (!have.analogs.has(analog.id)) {
          next = putAnalog(next, analog)
        }
      }
      for (const card of fragment.cards ?? []) {
        if (!have.cards.has(card.id)) {
          next = upsertCard(next, {
            ...card,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        }
      }
      for (const edge of fragment.edges ?? []) {
        if (!have.edges.has(edge.id)) {
          next = insertEdge(next, createEdge(edge))
        }
      }
      next = insertEvents(
        next,
        (fragment.events ?? []).filter((event) => !have.events.has(event.id)),
      )
      return next
    })
  }

  reset(): void {
    this.json.reset()
  }
}

let defaultStore: CatalogStore | undefined

export { catalogDataDir }

export function getCatalogStore(): CatalogStore {
  defaultStore ??= new CatalogStore(catalogDataDir())
  return defaultStore
}
