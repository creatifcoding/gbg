import { Schema } from 'effect'
import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { fileCard, IntakeError } from './intake'
import { EXAMPLE_FRAGMENT } from './seed'
import {
  CatalogFilter,
  guessFromInput,
  isCardKind,
  isCardStatus,
  parseQuestions,
  parseTags,
} from './schema'
import { getCatalogStore } from './store.server'
import { CardTransitionError } from './entity/card-entity'

export const listCards = createServerFn({ method: 'GET' })
  .validator((data: { kind?: string; status?: string; tag?: string } = {}) =>
    Schema.decodeUnknownSync(CatalogFilter)(data),
  )
  .handler(async ({ data }) => {
    return getCatalogStore().list(data)
  })

export const getCard = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const card = getCatalogStore().get(data.id)
    if (!card) throw notFound()
    return card
  })

export const createCard = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error('Expected FormData')
    }
    return data
  })
  .handler(async ({ data }) => {
    const kindRaw = String(data.get('kind') ?? '')
    if (!isCardKind(kindRaw)) {
      throw new IntakeError(['Pick a type: picture, dossier, artifact, or note.'])
    }

    try {
      const filed = fileCard({
        kind: kindRaw,
        claim: String(data.get('claim') ?? '').trim(),
        tags: parseTags(String(data.get('tags') ?? '')),
        organismGuess: guessFromInput(String(data.get('organism') ?? '')),
        questions: parseQuestions(String(data.get('questions') ?? '')),
      })

      const stored = getCatalogStore().insertIntake(filed)
      const file = data.get('file')
      if (file instanceof File && file.size > 0) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const withFile = getCatalogStore().attach({
          cardId: stored.id,
          filename: file.name || 'upload',
          mimeType: file.type || 'application/octet-stream',
          bytes,
        })
        return withFile ?? stored
      }
      return stored
    } catch (error) {
      if (error instanceof IntakeError) throw error
      throw new IntakeError(['Need a type, a one-line claim, and 3+ tags.'])
    }
  })

export const updateCard = createServerFn({ method: 'POST' })
  .validator((data: { id: string; body?: string; status?: string }) => data)
  .handler(async ({ data }) => {
    const patch: { body?: string; status?: 'raw' | 'filed' | 'working' | 'dead' } =
      {}
    if (typeof data.body === 'string') patch.body = data.body
    if (data.status) {
      if (!isCardStatus(data.status)) {
        throw new Error(`Unknown status: ${data.status}`)
      }
      patch.status = data.status
    }
    try {
      const next = getCatalogStore().update(data.id, patch)
      if (!next) throw notFound()
      return next
    } catch (error) {
      if (error instanceof CardTransitionError) throw error
      throw error
    }
  })

export const loadExampleCards = createServerFn({ method: 'POST' }).handler(
  async () => {
    const store = getCatalogStore()
    store.mergeExample(EXAMPLE_FRAGMENT)
    return store.list()
  },
)
