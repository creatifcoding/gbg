import { useMemo, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { loadExampleSpecimens } from '~/lib/catalog/functions'
import type { EvidenceKind, SpecimenStatus, SpecimenView } from '~/lib/catalog/schema'
import { ContextCard } from './context-card'
import { FilterChips } from './filter-chips'

export function CatalogIndex({
  specimens,
}: {
  specimens: ReadonlyArray<SpecimenView>
}) {
  const router = useRouter()
  const [kind, setKind] = useState<EvidenceKind | 'all'>('all')
  const [status, setStatus] = useState<SpecimenStatus | 'all'>('all')
  const [tag, setTag] = useState('')

  const tags = useMemo(() => {
    const values = new Set<string>()
    for (const specimen of specimens) {
      for (const item of specimen.tags) values.add(item)
    }
    return [...values].sort()
  }, [specimens])

  const visible = specimens.filter((specimen) => {
    if (kind !== 'all' && specimen.kind !== kind) return false
    if (status !== 'all' && specimen.status !== status) return false
    if (tag && !specimen.tags.includes(tag)) return false
    return true
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="vanta-label">Index</p>
          <h2 className="vanta-heading text-3xl">Specimens</h2>
        </div>
        <Link to="/intake" className="vanta-btn-primary">
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

      {specimens.length === 0 ? (
        <EmptyCatalog
          onLoadExamples={async () => {
            await loadExampleSpecimens()
            await router.invalidate()
          }}
        />
      ) : visible.length === 0 ? (
        <p className="vanta-empty">No specimens match those filters.</p>
      ) : (
        <ul className="grid gap-4">
          {visible.map((specimen) => (
            <li key={specimen.id}>
              <ContextCard specimen={specimen} />
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
    <div className="vanta-empty">
      <p className="vanta-heading text-xl">Empty catalog. That is valid.</p>
      <p className="vanta-muted mt-2 max-w-xl text-[16px]">
        Intake spawns a Specimen entity and attaches what is in hand. Raw is complete. Taxon, GPS, mechanism, and analog can stay absent. Open questions are enough. Body waits until after the specimen exists.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/intake" className="vanta-btn-primary">
          Open intake
        </Link>
        <button
          type="button"
          className="vanta-btn"
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
          {pending ? 'Loading examples…' : 'Load marked example specimens'}
        </button>
      </div>
    </div>
  )
}
