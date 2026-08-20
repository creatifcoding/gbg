import { useMemo, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { loadExampleCards } from '~/lib/catalog/functions'
import type { CardKind, CardStatus, CatalogCard } from '~/lib/catalog/schema'
import { ContextCard } from './context-card'
import { FilterChips } from './filter-chips'

export function CatalogIndex({ cards }: { cards: ReadonlyArray<CatalogCard> }) {
  const router = useRouter()
  const [kind, setKind] = useState<CardKind | 'all'>('all')
  const [status, setStatus] = useState<CardStatus | 'all'>('all')
  const [tag, setTag] = useState('')

  const tags = useMemo(() => {
    const values = new Set<string>()
    for (const card of cards) {
      for (const item of card.tags) values.add(item)
    }
    return [...values].sort()
  }, [cards])

  const visible = cards.filter((card) => {
    if (kind !== 'all' && card.kind !== kind) return false
    if (status !== 'all' && card.status !== status) return false
    if (tag && !card.tags.includes(tag)) return false
    return true
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="catalog-sans text-[12px] uppercase tracking-[0.16em] text-[color:var(--catalog-muted)]">
            Index
          </p>
          <h2 className="text-3xl">Cards</h2>
        </div>
        <Link
          to="/intake"
          className="catalog-sans rounded-full bg-[color:var(--catalog-ink)] px-4 py-2 text-[14px] text-[color:var(--catalog-paper)]"
        >
          Dump something
        </Link>
      </header>

      <FilterChips
        kind={kind}
        status={status}
        tag={tag}
        tags={tags}
        onKind={setKind}
        onStatus={setStatus}
        onTag={setTag}
      />

      {cards.length === 0 ? (
        <EmptyCatalog
          onLoadExamples={async () => {
            await loadExampleCards()
            await router.invalidate()
          }}
        />
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--catalog-line)] bg-white p-8 text-[16px] text-[color:var(--catalog-muted)]">
          No cards match those filters.
        </p>
      ) : (
        <ul className="grid gap-4">
          {visible.map((card) => (
            <li key={card.id}>
              <ContextCard card={card} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyCatalog({ onLoadExamples }: { onLoadExamples: () => Promise<void> }) {
  const [pending, setPending] = useState(false)
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--catalog-line)] bg-white p-8">
      <p className="text-[20px]">Empty catalog. That is valid.</p>
      <p className="mt-2 max-w-xl text-[16px] text-[color:var(--catalog-muted)]">
        Intake is one screen. A dump becomes a card with type, claim, tags, organism, and open questions. Deeper notes wait until after the card exists.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/intake"
          className="catalog-sans rounded-full bg-[color:var(--catalog-ink)] px-4 py-2 text-[14px] text-[color:var(--catalog-paper)]"
        >
          Open intake
        </Link>
        <button
          type="button"
          className="catalog-sans catalog-chip"
          disabled={pending}
          onClick={async () => {
            setPending(true)
            try {
              await onLoadExamples()
            } finally {
              setPending(false)
            }
          }}
        >
          {pending ? 'Loading examples…' : 'Load marked example cards'}
        </button>
      </div>
    </div>
  )
}
