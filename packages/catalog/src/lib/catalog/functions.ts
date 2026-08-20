import { Schema } from 'effect'
import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { fileCard, IntakeError } from './intake'
import { EXAMPLE_CARDS } from './seed'
import {
  CatalogFilter,
  decodeCard,
  isCardKind,
  isCardStatus,
  organismFromInput,
  parseQuestions,
  parseTags,
} from './schema'
import { getCatalogStore } from './store.server'

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
      const card = fileCard({
        kind: kindRaw,
        claim: String(data.get('claim') ?? '').trim(),
        tags: parseTags(String(data.get('tags') ?? '')),
        organism: organismFromInput(String(data.get('organism') ?? '')),
        questions: parseQuestions(String(data.get('questions') ?? '')),
      })

      const stored = getCatalogStore().insert(card)
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
      throw new IntakeError([
        'Need a type, a one-line claim, 3+ tags, and organism/system (or unknown).',
      ])
    }
  })

export const updateCard = createServerFn({ method: 'POST' })
  .validator((data: { id: string; notes?: string; status?: string }) => data)
  .handler(async ({ data }) => {
    const patch: { notes?: string; status?: 'raw' | 'filed' | 'working' | 'dead' } = {}
    if (typeof data.notes === 'string') patch.notes = data.notes
    if (data.status) {
      if (!isCardStatus(data.status)) {
        throw new Error(`Unknown status: ${data.status}`)
      }
      patch.status = data.status
    }
    const next = getCatalogStore().update(data.id, patch)
    if (!next) throw notFound()
    return decodeCard(next)
  })

export const loadExampleCards = createServerFn({ method: 'POST' }).handler(
  async () => {
    const store = getCatalogStore()
    const existing = new Set(store.list().map((card) => card.id))
    for (const example of EXAMPLE_CARDS) {
      if (!existing.has(example.id)) {
        store.insert({ ...example, createdAt: Date.now(), updatedAt: Date.now() })
      }
    }
    return store.list()
  },
)
