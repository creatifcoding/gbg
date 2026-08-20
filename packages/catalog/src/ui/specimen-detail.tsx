import { useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import * as Label from '@radix-ui/react-label'
import * as Separator from '@radix-ui/react-separator'
import { updateSpecimen } from '~/lib/catalog/functions'
import {
  formatLocality,
  getValidNextSpecimenStates,
  organismLabel,
  type SpecimenStatus,
  type SpecimenView,
} from '~/lib/catalog/schema'
import { SlidingTabs } from './sliding-tabs'

export function SpecimenDetail({ specimen }: { specimen: SpecimenView }) {
  const router = useRouter()
  const [body, setBody] = useState(specimen.body)
  const [status, setStatus] = useState<SpecimenStatus>(specimen.status)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const statusOptions = useMemo(() => {
    const next = getValidNextSpecimenStates(status)
    const values = [status, ...next]
    return values.map((value) => ({ value, label: value }))
  }, [status])

  const meta = [
    organismLabel(specimen.organismGuess),
    specimen.structureGuess?.label,
    formatLocality(specimen.locality),
    specimen.observedAt,
    specimen.cameraMake && specimen.cameraModel
      ? `${specimen.cameraMake} ${specimen.cameraModel}`
      : specimen.cameraMake ?? specimen.cameraModel,
  ].filter((item): item is string => Boolean(item) && item !== 'unlinked')

  return (
    <article className="t-panel-slide space-y-6" data-open="true">
      {specimen.example ? (
        <p className="vanta-banner">
          EXAMPLE SPECIMEN. Synthetic UI fixture. Not a paper, not a citation, not a result.
        </p>
      ) : null}

      <header className="space-y-3">
        <p className="vanta-label">
          {specimen.id} · {specimen.kind} ·{' '}
          <span className={`status-${specimen.status}`}>{status}</span>
          {meta.length > 0 ? ` · ${meta.join(' · ')}` : ''}
        </p>
        <h2 className="vanta-heading text-3xl leading-tight">{specimen.claim || specimen.id}</h2>
        <div className="flex flex-wrap gap-2">
          {specimen.tags.map((tag) => (
            <span key={tag} className="vanta-chip cursor-default">
              {tag}
            </span>
          ))}
        </div>
        {specimen.organismGuess || specimen.structureGuess ? (
          <p className="vanta-muted text-[14px]">
            {specimen.organismGuess
              ? `taxon guess: ${specimen.organismGuess.label}`
              : 'taxon unlinked'}
            {specimen.structureGuess
              ? ` · part guess: ${specimen.structureGuess.label}`
              : ''}
          </p>
        ) : (
          <p className="vanta-muted text-[14px]">
            No taxon or part guess. Raw is complete. Open questions are enough.
          </p>
        )}
      </header>

      <section className="space-y-3">
        <h3 className="vanta-label">Status</h3>
        <SlidingTabs
          ariaLabel="Specimen status"
          value={status}
          options={statusOptions}
          onChange={async (next) => {
            if (next === status) return
            const previous = status
            setStatus(next)
            setError('')
            try {
              await updateSpecimen({ data: { id: specimen.id, status: next } })
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
        <h3 className="vanta-label">Observations</h3>
        {specimen.observations.length === 0 ? (
          <p className="vanta-muted text-[16px]">None yet. Intake creates the first one.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-[16px]">
            {specimen.observations.map((observation) => (
              <li key={observation.id}>
                {observation.kind}
                {observation.note ? ` · ${observation.note}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="vanta-label">Open questions</h3>
        {specimen.questions.length === 0 ? (
          <p className="vanta-muted text-[16px]">None written at intake.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-[16px]">
            {specimen.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="vanta-label">Attachments</h3>
        {specimen.attachments.length === 0 ? (
          <p className="vanta-muted text-[16px]">No file on this specimen.</p>
        ) : (
          <ul className="space-y-4">
            {specimen.attachments.map((attachment) => (
              <li key={attachment.id}>
                {attachment.kind === 'image' ? (
                  <img
                    src={`/api/blobs/${specimen.id}/${attachment.id}`}
                    alt={attachment.filename}
                    className="max-h-80 rounded-[4px] border border-[color:var(--vanta-border)]"
                  />
                ) : null}
                <a
                  className="vanta-file underline"
                  href={`/api/blobs/${specimen.id}/${attachment.id}`}
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
            await updateSpecimen({ data: { id: specimen.id, body } })
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
          Markdown later. This field stays empty until the specimen exists.
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
