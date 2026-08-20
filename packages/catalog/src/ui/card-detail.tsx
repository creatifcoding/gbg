import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import * as Label from '@radix-ui/react-label'
import * as Separator from '@radix-ui/react-separator'
import { updateCard } from '~/lib/catalog/functions'
import {
  CARD_STATUSES,
  organismLabel,
  type CatalogCard,
  type CardStatus,
} from '~/lib/catalog/schema'
import { SlidingTabs } from './sliding-tabs'

export function CardDetail({ card }: { card: CatalogCard }) {
  const router = useRouter()
  const [notes, setNotes] = useState(card.notes)
  const [status, setStatus] = useState<CardStatus>(card.status)
  const [pending, setPending] = useState(false)

  return (
    <article className="t-panel-slide space-y-6" data-open="true">
      {card.example ? (
        <p className="catalog-sans rounded-xl bg-[color:var(--catalog-example)] px-4 py-3 text-[14px] text-white">
          EXAMPLE CARD. Synthetic UI fixture. Not a paper, not a citation, not a result.
        </p>
      ) : null}

      <header className="space-y-3">
        <p className="catalog-sans text-[12px] uppercase tracking-[0.16em] text-[color:var(--catalog-muted)]">
          {card.kind} · {organismLabel(card.organism)}
        </p>
        <h2 className="text-3xl leading-tight">{card.claim}</h2>
        <div className="flex flex-wrap gap-2">
          {card.tags.map((tag) => (
            <span key={tag} className="catalog-chip catalog-sans">
              {tag}
            </span>
          ))}
        </div>
      </header>

      <section className="space-y-3">
        <h3 className="catalog-sans text-[12px] uppercase tracking-[0.14em] text-[color:var(--catalog-muted)]">
          Status
        </h3>
        <SlidingTabs
          ariaLabel="Card status"
          value={status}
          options={CARD_STATUSES.map((value) => ({ value, label: value }))}
          onChange={async (next) => {
            setStatus(next)
            await updateCard({ data: { id: card.id, status: next } })
            await router.invalidate()
          }}
        />
      </section>

      <section className="space-y-3">
        <h3 className="catalog-sans text-[12px] uppercase tracking-[0.14em] text-[color:var(--catalog-muted)]">
          Open questions
        </h3>
        {card.questions.length === 0 ? (
          <p className="text-[16px] text-[color:var(--catalog-muted)]">None written at intake.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-[16px]">
            {card.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="catalog-sans text-[12px] uppercase tracking-[0.14em] text-[color:var(--catalog-muted)]">
          Attachments
        </h3>
        {card.attachments.length === 0 ? (
          <p className="text-[16px] text-[color:var(--catalog-muted)]">No file on this card.</p>
        ) : (
          <ul className="space-y-4">
            {card.attachments.map((attachment) => (
              <li key={attachment.id}>
                {attachment.kind === 'image' ? (
                  <img
                    src={`/api/blobs/${card.id}/${attachment.id}`}
                    alt={attachment.filename}
                    className="max-h-80 rounded-xl border border-[color:var(--catalog-line)]"
                  />
                ) : null}
                <a
                  className="catalog-sans text-[14px] underline"
                  href={`/api/blobs/${card.id}/${attachment.id}`}
                >
                  {attachment.filename}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator.Root className="h-px bg-[color:var(--catalog-line)]" />

      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault()
          setPending(true)
          try {
            await updateCard({ data: { id: card.id, notes } })
            await router.invalidate()
          } finally {
            setPending(false)
          }
        }}
      >
        <Label.Root
          htmlFor="notes"
          className="catalog-sans text-[12px] uppercase tracking-[0.14em] text-[color:var(--catalog-muted)]"
        >
          Deeper notes
        </Label.Root>
        <p className="text-[14px] text-[color:var(--catalog-muted)]">
          This field stays empty until the card exists. Write after filing.
        </p>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          rows={8}
          className="w-full rounded-xl border border-[color:var(--catalog-line)] bg-white px-3 py-2 text-[16px]"
        />
        <button
          type="submit"
          disabled={pending}
          className="catalog-sans rounded-full bg-[color:var(--catalog-ink)] px-4 py-2 text-[14px] text-[color:var(--catalog-paper)] disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save notes'}
        </button>
      </form>
    </article>
  )
}
