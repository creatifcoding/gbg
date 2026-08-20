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
      className="t-resize vanta-card block"
    >
      <div className="vanta-label flex flex-wrap items-center gap-2">
        <span>{card.kind}</span>
        <span aria-hidden="true">·</span>
        <span className={`status-${card.status}`}>{card.status}</span>
        <span aria-hidden="true">·</span>
        <span>{organismLabel(card.organism)}</span>
        {card.example ? <span className="vanta-mark">example</span> : null}
      </div>
      <p className="vanta-heading mt-3 text-lg leading-snug">{card.claim}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {card.tags.map((tag) => (
          <span key={tag} className="vanta-chip cursor-default">
            {tag}
          </span>
        ))}
      </div>
      {card.questions.length > 0 ? (
        <p className="vanta-muted mt-4 text-[14px]">{card.questions[0]}</p>
      ) : null}
    </Link>
  )
}
