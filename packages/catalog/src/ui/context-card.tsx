import { Link } from '@tanstack/react-router'
import { VantaCard } from '~/components/portal'
import { statusVisual } from '~/lib/catalog/registry'
import { formatLocality, type SpecimenView } from '~/lib/catalog/schema'

export function ContextCard({ specimen }: { specimen: SpecimenView }) {
  const visual = statusVisual(specimen.status)

  return (
    <Link
      to="/specimens/$specimenId"
      params={{ specimenId: specimen.id }}
      className="t-resize block"
    >
      <VantaCard variant="elevated" glow glowColor={visual.accent}>
        <VantaCard.Header>
          <VantaCard.Title>{specimen.kind}</VantaCard.Title>
          <VantaCard.Indicator
            status={visual.indicator}
            label={specimen.example ? `${specimen.status} example` : specimen.status}
          />
        </VantaCard.Header>
        <VantaCard.Subtitle>
          {[
            specimen.id,
            specimen.organismGuess?.label,
            specimen.structureGuess?.label,
            specimen.locality._tag === 'unknown'
              ? null
              : formatLocality(specimen.locality),
          ]
            .filter((item): item is string => Boolean(item))
            .join(' · ')}
        </VantaCard.Subtitle>
        <VantaCard.Body>{specimen.claim}</VantaCard.Body>
        <div className="mt-4 flex flex-wrap gap-2">
          {specimen.tags.map((tag) => (
            <span key={tag} className="vanta-chip cursor-default">
              {tag}
            </span>
          ))}
        </div>
        {specimen.questions.length > 0 ? (
          <p className="vanta-muted mt-4 text-[14px]">{specimen.questions[0]}</p>
        ) : null}
      </VantaCard>
    </Link>
  )
}
