import { Link } from '@tanstack/react-router'
import {
  organismLabel,
  type CatalogCard,
} from '~/lib/catalog/schema'

export function ContextCard({ card }: { card: CatalogCard }) {
  return (
    <Link
      to="/cards/$cardId"
      params={{ cardId: card.id }}
      className="t-resize block rounded-2xl border border-[color:var(--catalog-line)] bg-[color:var(--catalog-paper)] p-5 shadow-[0_1px_0_rgba(28,27,25,0.04)]"
    >
      <div className="catalog-sans flex flex-wrap items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-[color:var(--catalog-muted)]">
        <span>{card.kind}</span>
        <span aria-hidden="true">·</span>
        <span>{card.status}</span>
        <span aria-hidden="true">·</span>
        <span>{organismLabel(card.organism)}</span>
        {card.example ? (
          <span className="rounded-full bg-[color:var(--catalog-example)] px-2 py-0.5 text-white">
            example
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[18px] leading-snug">{card.claim}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {card.tags.map((tag) => (
          <span key={tag} className="catalog-chip catalog-sans">
            {tag}
          </span>
        ))}
      </div>
      {card.questions.length > 0 ? (
        <p className="mt-4 text-[14px] text-[color:var(--catalog-muted)]">
          {card.questions[0]}
        </p>
      ) : null}
    </Link>
  )
}
