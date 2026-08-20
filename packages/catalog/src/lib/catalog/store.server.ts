import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { nanoid } from 'nanoid'
import {
  setSpecimenBody,
  transitionSpecimen,
} from './entity/specimen-entity'
import { attachToObservation } from './entity/observation-entity'
import { createEdge } from './entity/edge-entity'
import {
  hydrateSpecimen,
  matchesFilter,
  type SpecimenView,
  type CatalogFilter,
} from './models/specimen-view'
import type { CatalogSnapshot, ExampleFragment } from './models/catalog-snapshot'
import { findAttachment, insertAttachment } from './repos/attachment-repo'
import { appendEvents, findSpecimen, upsertSpecimen } from './repos/specimen-repo'
import {
  findObservation,
  observationsForSpecimen,
  upsertObservation,
} from './repos/observation-repo'
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
import type { SpecimenStatus } from './schemas/specimen'
import type { CatalogEvent } from './schemas/events'
import type { IntakeResult } from './intake'

export type SpecimenPatch = {
  body?: string
  status?: SpecimenStatus
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

  list(filter: CatalogFilter = {}): SpecimenView[] {
    const snapshot = this.json.read()
    return snapshot.specimens
      .map((specimen) => hydrateSpecimen(snapshot, specimen))
      .filter((view) => matchesFilter(view, filter))
  }

  get(id: string): SpecimenView | undefined {
    const snapshot = this.json.read()
    const specimen = findSpecimen(snapshot, id)
    return specimen ? hydrateSpecimen(snapshot, specimen) : undefined
  }

  insertIntake(result: IntakeResult): SpecimenView {
    const snapshot = this.json.mutate((current) => {
      let next = current
      const tagIds = result.specimen.tagIds.map((id) => {
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
      next = upsertSpecimen(next, {
        ...result.specimen,
        tagIds,
      })
      next = upsertObservation(next, result.observation)
      next = insertEdge(next, result.observationEdge)
      next = appendEvents(next, result.events)
      return next
    })
    const specimen = findSpecimen(snapshot, result.specimen.id)
    if (!specimen) {
      throw new Error(`Specimen ${result.specimen.id} missing after intake`)
    }
    return hydrateSpecimen(snapshot, specimen)
  }

  update(id: string, patch: SpecimenPatch): SpecimenView | undefined {
    let found = false
    const snapshot = this.json.mutate((current) => {
      const specimen = findSpecimen(current, id)
      if (!specimen) return current
      found = true
      let nextSpecimen = specimen
      let next = current
      const events: CatalogEvent[] = []
      if (typeof patch.body === 'string') {
        const updated = setSpecimenBody(nextSpecimen, patch.body)
        nextSpecimen = updated.specimen
        events.push(updated.event)
      }
      if (patch.status) {
        const updated = transitionSpecimen(nextSpecimen, patch.status)
        nextSpecimen = updated.specimen
        events.push(updated.event)
      }
      next = upsertSpecimen(next, nextSpecimen)
      next = appendEvents(next, events)
      return next
    })
    if (!found) return undefined
    const specimen = findSpecimen(snapshot, id)
    return specimen ? hydrateSpecimen(snapshot, specimen) : undefined
  }

  attach(input: {
    specimenId: string
    filename: string
    mimeType: string
    bytes: Uint8Array
  }): SpecimenView | undefined {
    const current = this.json.read()
    const specimen = findSpecimen(current, input.specimenId)
    if (!specimen) return undefined

    const dump =
      observationsForSpecimen(current, specimen.id)[0] ??
      findObservation(current, specimen.observationIds[0] ?? '')

    const attachment = decodeAttachment({
      id: nanoid(),
      specimenId: specimen.id,
      host: dump
        ? { _tag: 'observation', id: dump.id }
        : { _tag: 'specimen' },
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      kind: attachmentKindFromMime(input.mimeType),
    })

    const dest = this.json.blobPath(specimen.id, attachment.id)
    mkdirSync(path.dirname(dest), { recursive: true })
    writeFileSync(dest, input.bytes)

    const snapshot = this.json.mutate((snap) => {
      const live = findSpecimen(snap, specimen.id)
      if (!live) return snap
      let next = insertAttachment(snap, attachment)
      if (dump) {
        const liveObs = findObservation(next, dump.id)
        if (liveObs) {
          next = upsertObservation(next, attachToObservation(liveObs, attachment.id))
        }
      }
      return next
    })
    const nextSpecimen = findSpecimen(snapshot, specimen.id)
    return nextSpecimen ? hydrateSpecimen(snapshot, nextSpecimen) : undefined
  }

  readBlob(specimenId: string, attachmentId: string): StoredAttachment | undefined {
    const snapshot = this.json.read()
    const specimen = findSpecimen(snapshot, specimenId)
    const attachment = findAttachment(snapshot, attachmentId)
    if (!specimen || !attachment || attachment.specimenId !== specimen.id) {
      return undefined
    }
    const dest = this.json.blobPath(specimen.id, attachment.id)
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
        specimens: new Set(current.specimens.map((item) => item.id)),
        observations: new Set(current.observations.map((item) => item.id)),
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
      for (const observation of fragment.observations ?? []) {
        if (!have.observations.has(observation.id)) {
          next = upsertObservation(next, observation)
        }
      }
      for (const specimen of fragment.specimens ?? []) {
        if (!have.specimens.has(specimen.id)) {
          next = upsertSpecimen(next, {
            ...specimen,
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
