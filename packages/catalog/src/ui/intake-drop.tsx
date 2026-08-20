import { useRouter } from '@tanstack/react-router'
import { useId, useState } from 'react'
import * as Label from '@radix-ui/react-label'
import * as Select from '@radix-ui/react-select'
import { createCard } from '~/lib/catalog/functions'
import { CARD_KINDS, type CardKind } from '~/lib/catalog/schema'
import { IntakeError } from '~/lib/catalog/intake'
import { SlidingTabs } from './sliding-tabs'

export function IntakeDrop() {
  const router = useRouter()
  const claimId = useId()
  const tagsId = useId()
  const organismId = useId()
  const questionsId = useId()
  const [kind, setKind] = useState<CardKind>('note')
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
          const card = await createCard({ data })
          await router.navigate({
            to: '/cards/$cardId',
            params: { cardId: card.id },
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
        className="catalog-drop catalog-sans flex flex-col items-center justify-center gap-3 px-6 py-8 text-center"
        data-active={hover ? 'true' : 'false'}
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
        <p className="text-[16px]">Drop a picture, dossier, or artifact</p>
        <p className="text-[14px] text-[color:var(--catalog-muted)]">
          One file is enough. Notes-only dumps work too.
        </p>
        <label className="catalog-chip cursor-pointer">
          Choose file
          <input
            className="sr-only"
            type="file"
            name="ignored-file"
            onChange={(event) => onFiles(event.currentTarget.files)}
          />
        </label>
        {file ? (
          <p className="text-[12px] text-[color:var(--catalog-accent)]">{file.name}</p>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="catalog-sans text-[12px] uppercase tracking-[0.14em] text-[color:var(--catalog-muted)]">
          Type
        </legend>
        <SlidingTabs
          ariaLabel="Card type"
          value={kind}
          onChange={setKind}
          options={CARD_KINDS.map((value) => ({ value, label: value }))}
        />
        <KindSelect value={kind} onChange={setKind} />
      </fieldset>

      <Field
        id={claimId}
        name="claim"
        label="One-line claim"
        placeholder="What is this, in one sentence?"
        required
        error={error}
      />
      <Field
        id={tagsId}
        name="tags"
        label="Tags (at least 3, comma-separated)"
        placeholder="gel, western, blot"
        required
      />
      <Field
        id={organismId}
        name="organism"
        label="Organism / system"
        placeholder="unknown"
      />
      <div className="space-y-2">
        <Label.Root
          htmlFor={questionsId}
          className="catalog-sans text-[12px] uppercase tracking-[0.14em] text-[color:var(--catalog-muted)]"
        >
          Open questions
        </Label.Root>
        <textarea
          id={questionsId}
          name="questions"
          rows={3}
          placeholder="One question per line"
          className="t-input w-full rounded-xl border border-[color:var(--catalog-line)] bg-white px-3 py-2 text-[16px]"
        />
      </div>

      <p className="t-error-msg catalog-sans text-[14px] text-[color:var(--catalog-danger)]">
        {error}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="catalog-sans rounded-full bg-[color:var(--catalog-ink)] px-5 py-2 text-[14px] text-[color:var(--catalog-paper)] disabled:opacity-60"
      >
        {pending ? 'Filing…' : 'File card'}
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
      <Label.Root
        htmlFor={id}
        className="catalog-sans text-[12px] uppercase tracking-[0.14em] text-[color:var(--catalog-muted)]"
      >
        {label}
      </Label.Root>
      <input
        id={id}
        name={name}
        required={required}
        placeholder={placeholder}
        className={error ? 't-input is-error is-shaking w-full rounded-xl border border-[color:var(--catalog-danger)] bg-white px-3 py-2 text-[16px]' : 't-input w-full rounded-xl border border-[color:var(--catalog-line)] bg-white px-3 py-2 text-[16px]'}
      />
    </div>
  )
}

function KindSelect({
  value,
  onChange,
}: {
  value: CardKind
  onChange: (value: CardKind) => void
}) {
  return (
    <Select.Root value={value} onValueChange={(next) => onChange(next as CardKind)}>
      <Select.Trigger
        aria-label="Card type"
        className="catalog-sans sr-only"
      >
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="catalog-sans rounded-xl border border-[color:var(--catalog-line)] bg-white p-1 shadow-md">
          <Select.Viewport>
            {CARD_KINDS.map((kind) => (
              <Select.Item
                key={kind}
                value={kind}
                className="cursor-pointer rounded-lg px-3 py-2 text-[14px] outline-none data-[highlighted]:bg-[color:var(--catalog-bg)]"
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
