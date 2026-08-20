import { useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import * as Label from '@radix-ui/react-label'
import * as Separator from '@radix-ui/react-separator'
import { updateCard } from '~/lib/catalog/functions'
import {
  getValidNextCardStates,
  organismLabel,
  type CatalogCard,
  type CardStatus,
} from '~/lib/catalog/schema'
import { SlidingTabs } from './sliding-tabs'

export function CardDetail({ card }: { card: CatalogCard }) {
  const router = useRouter()
  const [body, setBody] = useState(card.body)
  const [status, setStatus] = useState<CardStatus>(card.status)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const statusOptions = useMemo(() => {
    const next = getValidNextCardStates(status)
    const values = [status, ...next]
    return values.map((value) => ({ value, label: value }))
  }, [status])

  const guesses = [
    card.organismGuess ? `organism guess: ${card.organismGuess.label}` : null,
    card.structureGuess ? `structure guess: ${card.structureGuess.label}` : null,
    card.functionGuess ? `function guess: ${card.functionGuess.label}` : null,
  ].filter((item): item is string => item !== null)

  return (
    <article className="t-panel-slide space-y-6" data-open="true">
      {card.example ? (
        <p className="vanta-banner">
          EXAMPLE CARD. Synthetic UI fixture. Not a paper, not a citation, not a result.
        </p>
      ) : null}

      <header className="space-y-3">
        <p className="vanta-label">
          {card.kind} · <span className={`status-${card.status}`}>{status}</span> ·{' '}
          {organismLabel(card.organismGuess)}
        </p>
        <h2 className="vanta-heading text-3xl leading-tight">{card.claim}</h2>
        <div className="flex flex-wrap gap-2">
          {card.tags.map((tag) => (
            <span key={tag} className="vanta-chip cursor-default">
              {tag}
            </span>
          ))}
        </div>
        {guesses.length > 0 ? (
          <p className="vanta-muted text-[14px]">{guesses.join(' · ')}</p>
        ) : (
          <p className="vanta-muted text-[14px]">
            No organism, structure, or function guess. Taxonomy is optional.
          </p>
        )}
      </header>

      <section className="space-y-3">
        <h3 className="vanta-label">Status</h3>
        <SlidingTabs
          ariaLabel="Card status"
          value={status}
          options={statusOptions}
          onChange={async (next) => {
            if (next === status) return
            const previous = status
            setStatus(next)
            setError('')
            try {
              await updateCard({ data: { id: card.id, status: next } })
              await router.invalidate()
            } catch (caught) {
              setStatus(previous)
              setError(
                caught instanceof Error
                  ? caught.message
                  : 'That status move is not allowed.',
              )
            }
          }}
        />
        {error ? <p className="vanta-error">{error}</p> : null}
      </section>

      <section className="space-y-3">
        <h3 className="vanta-label">Open questions</h3>
        {card.questions.length === 0 ? (
          <p className="vanta-muted text-[16px]">None written at intake.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-[16px]">
            {card.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="vanta-label">Attachments</h3>
        {card.attachments.length === 0 ? (
          <p className="vanta-muted text-[16px]">No file on this card.</p>
        ) : (
          <ul className="space-y-4">
            {card.attachments.map((attachment) => (
              <li key={attachment.id}>
                {attachment.kind === 'image' ? (
                  <img
                    src={`/api/blobs/${card.id}/${attachment.id}`}
                    alt={attachment.filename}
                    className="max-h-80 rounded-[4px] border border-[color:var(--vanta-border)]"
                  />
                ) : null}
                <a
                  className="vanta-file underline"
                  href={`/api/blobs/${card.id}/${attachment.id}`}
                >
                  {attachment.filename}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator.Root className="h-px bg-[color:var(--vanta-border)]" />

      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault()
          setPending(true)
          try {
            await updateCard({ data: { id: card.id, body } })
            await router.invalidate()
          } finally {
            setPending(false)
          }
        }}
      >
        <Label.Root htmlFor="body" className="vanta-label">
          Body
        </Label.Root>
        <p className="vanta-muted text-[14px]">
          Markdown later. This field stays empty until the card exists.
        </p>
        <textarea
          id="body"
          value={body}
          onChange={(event) => setBody(event.currentTarget.value)}
          rows={8}
          className="vanta-textarea"
        />
        <button type="submit" disabled={pending} className="vanta-btn-primary">
          {pending ? 'Saving…' : 'Save body'}
        </button>
      </form>
    </article>
  )
}
