import { useRouter } from '@tanstack/react-router'
import { useId, useState } from 'react'
import * as Label from '@radix-ui/react-label'
import * as Select from '@radix-ui/react-select'
import { createSpecimen } from '~/lib/catalog/functions'
import {
  EVIDENCE_KINDS,
  isEvidenceKind,
  type EvidenceKind,
} from '~/lib/catalog/schema'
import { IntakeError } from '~/lib/catalog/intake'
import { SlidingTabs } from './sliding-tabs'

export function IntakeDrop() {
  const router = useRouter()
  const claimId = useId()
  const tagsId = useId()
  const organismId = useId()
  const partId = useId()
  const localityId = useId()
  const observedId = useId()
  const questionsId = useId()
  const [kind, setKind] = useState<EvidenceKind>('picture')
  const [file, setFile] = useState<File | null>(null)
  const [hover, setHover] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  function onFiles(list: FileList | null) {
    const next = list?.[0]
    if (!next) return
    setFile(next)
    if (next.type.startsWith('image/')) setKind('picture')
    else if (kind === 'note') setKind('artifact')
  }

  return (
    <form
      className={error ? 't-input-wrap is-error space-y-5' : 't-input-wrap space-y-5'}
      onSubmit={async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        data.set('kind', kind)
        if (file) data.set('file', file)
        else data.delete('file')
        setPending(true)
        setError('')
        try {
          const specimen = await createSpecimen({ data })
          await router.navigate({
            to: '/specimens/$specimenId',
            params: { specimenId: specimen.id },
          })
        } catch (caught) {
          const message =
            caught instanceof IntakeError
              ? caught.issues[0]
              : caught instanceof Error
                ? caught.message
                : 'Intake failed.'
          setError(message)
        } finally {
          setPending(false)
        }
      }}
    >
      <div
        className={hover ? 'vanta-drop is-active' : 'vanta-drop'}
        onDragOver={(event) => {
          event.preventDefault()
          setHover(true)
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(event) => {
          event.preventDefault()
          setHover(false)
          onFiles(event.dataTransfer.files)
        }}
      >
        <p className="vanta-heading text-base">Drop a picture, dossier, or artifact</p>
        <p className="vanta-muted mt-2 text-[14px]">
          Intake creates a Specimen entity and attaches what is in hand. Pictures attach Media plus EXIF. GPS tags become Locality. Missing GPS, taxon, mechanism, and analog stay off the entity. Notes file without a file.
        </p>
        <label className="vanta-chip mt-3 cursor-pointer">
          Choose file
          <input
            className="sr-only"
            type="file"
            name="ignored-file"
            onChange={(event) => onFiles(event.currentTarget.files)}
          />
        </label>
        {file ? <p className="vanta-file mt-3">{file.name}</p> : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="vanta-label">How it arrived</legend>
        <SlidingTabs
          ariaLabel="First evidence type"
          value={kind}
          onChange={setKind}
          options={EVIDENCE_KINDS.map((value) => ({ value, label: value }))}
        />
        <KindSelect value={kind} onChange={setKind} />
      </fieldset>

      <Field
        id={claimId}
        name="claim"
        label="Claim (if you have one)"
        placeholder="What is this specimen, in one sentence?"
        error={error}
      />
      <Field
        id={tagsId}
        name="tags"
        label="Tags (optional, comma-separated)"
        placeholder="adhesion, setae, dump"
      />
      <Field
        id={organismId}
        name="organism"
        label="Taxon guess (optional)"
        placeholder="leave blank"
      />
      <Field
        id={partId}
        name="part"
        label="Part / structure (optional)"
        placeholder="setae, leaf surface"
      />
      {kind === 'picture' ? (
        <p className="vanta-muted text-[14px]">
          Locality and collected time come from EXIF GPS tags written at capture (browser geolocation into the JPEG). GPSLatitude, GPSLongitude, GPSAltitude, GPSDateTime when present. Missing GPS still files. Locality unknown is not a blocker.
        </p>
      ) : (
        <>
          <Field
            id={localityId}
            name="locality"
            label="Locality (optional)"
            placeholder="where it came from"
          />
          <Field
            id={observedId}
            name="observedAt"
            label="Collected / observed (optional)"
            placeholder="when, if you know"
          />
        </>
      )}
      <div className="space-y-2">
        <Label.Root htmlFor={questionsId} className="vanta-label">
          Open questions
        </Label.Root>
        <textarea
          id={questionsId}
          name="questions"
          rows={3}
          placeholder="What still needs to be understood? One per line. Enough for later."
          className="t-input vanta-textarea"
        />
      </div>

      <p className="t-error-msg vanta-error">{error}</p>

      <button type="submit" disabled={pending} className="vanta-btn-primary">
        {pending ? 'Filing…' : 'File specimen'}
      </button>
    </form>
  )
}

function Field({
  id,
  name,
  label,
  placeholder,
  required,
  error,
}: {
  id: string
  name: string
  label: string
  placeholder: string
  required?: boolean
  error?: string
}) {
  return (
    <div className="space-y-2">
      <Label.Root htmlFor={id} className="vanta-label">
        {label}
      </Label.Root>
      <input
        id={id}
        name={name}
        required={required}
        placeholder={placeholder}
        className={
          error
            ? 't-input is-error is-shaking vanta-input'
            : 't-input vanta-input'
        }
      />
    </div>
  )
}

function KindSelect({
  value,
  onChange,
}: {
  value: EvidenceKind
  onChange: (value: EvidenceKind) => void
}) {
  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        if (isEvidenceKind(next)) onChange(next)
      }}
    >
      <Select.Trigger aria-label="First evidence type" className="sr-only">
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="rounded-[4px] border border-[color:var(--vanta-border)] bg-[color:var(--vanta-elevated)] p-1">
          <Select.Viewport>
            {EVIDENCE_KINDS.map((kind) => (
              <Select.Item
                key={kind}
                value={kind}
                className="vanta-label cursor-pointer rounded-[2px] px-3 py-2 outline-none data-[highlighted]:bg-[color:var(--vanta-hover)] data-[highlighted]:text-[color:var(--vanta-cyan)]"
              >
                <Select.ItemText>{kind}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
