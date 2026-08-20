import { Schema } from 'effect'
import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { fileSpecimen, IntakeError, namedLocality, optionalText } from './intake'
import { EXAMPLE_FRAGMENT } from './seed'
import {
  CatalogFilter,
  guessFromInput,
  isEvidenceKind,
  isSpecimenStatus,
  parseQuestions,
  parseTags,
} from './schema'
import { getCatalogStore } from './store.server'
import { AssetExistsError } from './assets'
import { SpecimenTransitionError } from './entity/specimen-entity'

export const listSpecimens = createServerFn({ method: 'GET' })
  .validator((data: { kind?: string; status?: string; tag?: string } = {}) =>
    Schema.decodeUnknownSync(CatalogFilter)(data),
  )
  .handler(async ({ data }) => {
    return getCatalogStore().list(data)
  })

export const getSpecimen = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const specimen = getCatalogStore().get(data.id)
    if (!specimen) throw notFound()
    return specimen
  })

export const createSpecimen = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error('Expected FormData')
    }
    return data
  })
  .handler(async ({ data }) => {
    const kindRaw = String(data.get('kind') ?? '')
    if (!isEvidenceKind(kindRaw)) {
      throw new IntakeError(['Pick a type: picture, dossier, artifact, or note.'])
    }

    try {
      if (kindRaw === 'picture') {
        const file = data.get('file')
        if (!(file instanceof File) || file.size === 0) {
          throw new IntakeError(['Picture intake needs a dropped file.'])
        }
        const bytes = new Uint8Array(await file.arrayBuffer())
        return await getCatalogStore().ingestPicture({
          filename: file.name || 'upload',
          mimeType: file.type || 'application/octet-stream',
          bytes,
          claim: String(data.get('claim') ?? '').trim(),
          tags: parseTags(String(data.get('tags') ?? '')),
          organismGuess: guessFromInput(String(data.get('organism') ?? '')),
          structureGuess: guessFromInput(String(data.get('part') ?? '')),
          questions: parseQuestions(String(data.get('questions') ?? '')),
        })
      }

      const filed = fileSpecimen({
        kind: kindRaw,
        claim: String(data.get('claim') ?? '').trim(),
        tags: parseTags(String(data.get('tags') ?? '')),
        organismGuess: guessFromInput(String(data.get('organism') ?? '')),
        structureGuess: guessFromInput(String(data.get('part') ?? '')),
        locality: namedLocality(optionalText(String(data.get('locality') ?? ''))),
        observedAt: optionalText(String(data.get('observedAt') ?? '')),
        questions: parseQuestions(String(data.get('questions') ?? '')),
        takenIds: getCatalogStore().takenSpecimenIds(),
      })

      const stored = getCatalogStore().insertIntake(filed)
      const file = data.get('file')
      if (file instanceof File && file.size > 0) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const withFile = getCatalogStore().attach({
          specimenId: stored.id,
          filename: file.name || 'upload',
          mimeType: file.type || 'application/octet-stream',
          bytes,
        })
        return withFile ?? stored
      }
      return stored
    } catch (error) {
      if (error instanceof IntakeError) throw error
      if (error instanceof AssetExistsError) {
        throw new IntakeError([error.message])
      }
      throw new IntakeError(['Need a type, a one-line claim, and 3+ tags.'])
    }
  })

export const updateSpecimen = createServerFn({ method: 'POST' })
  .validator((data: { id: string; body?: string; status?: string }) => data)
  .handler(async ({ data }) => {
    const patch: {
      body?: string
      status?: 'raw' | 'filed' | 'working' | 'dead'
    } = {}
    if (typeof data.body === 'string') patch.body = data.body
    if (data.status) {
      if (!isSpecimenStatus(data.status)) {
        throw new Error(`Unknown status: ${data.status}`)
      }
      patch.status = data.status
    }
    try {
      const next = getCatalogStore().update(data.id, patch)
      if (!next) throw notFound()
      return next
    } catch (error) {
      if (error instanceof SpecimenTransitionError) throw error
      throw error
    }
  })

export const loadExampleSpecimens = createServerFn({ method: 'POST' }).handler(
  async () => {
    const store = getCatalogStore()
    store.mergeExample(EXAMPLE_FRAGMENT)
    return store.list()
  },
)
