import { Link } from '@tanstack/react-router'
import { VantaCard } from '~/components/portal'
import { statusVisual } from '~/lib/catalog/registry'
import { organismLabel, type CatalogCard } from '~/lib/catalog/schema'

export function ContextCard({ card }: { card: CatalogCard }) {
  const visual = statusVisual(card.status)

  return (
    <Link to="/cards/$cardId" params={{ cardId: card.id }} className="t-resize block">
      <VantaCard variant="elevated" glow glowColor={visual.accent}>
        <VantaCard.Header>
          <VantaCard.Title>{card.kind}</VantaCard.Title>
          <VantaCard.Indicator
            status={visual.indicator}
            label={card.example ? `${card.status} example` : card.status}
          />
        </VantaCard.Header>
        <VantaCard.Subtitle>{organismLabel(card.organismGuess)}</VantaCard.Subtitle>
        <VantaCard.Body>{card.claim}</VantaCard.Body>
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
      </VantaCard>
    </Link>
  )
}
