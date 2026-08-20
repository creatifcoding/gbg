import type { ReactNode } from 'react'
import {
  EVIDENCE_KINDS,
  SPECIMEN_STATUSES,
  type EvidenceKind,
  type SpecimenStatus,
} from '~/lib/catalog/schema'

export function FilterChips({
  kind,
  status,
  tag,
  tags,
  onKind,
  onStatus,
  onTag,
}: {
  kind: EvidenceKind | 'all'
  status: SpecimenStatus | 'all'
  tag: string
  tags: ReadonlyArray<string>
  onKind: (value: EvidenceKind | 'all') => void
  onStatus: (value: SpecimenStatus | 'all') => void
  onTag: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <ChipRow label="Type">
        <Chip active={kind === 'all'} onClick={() => onKind('all')}>
          all
        </Chip>
        {EVIDENCE_KINDS.map((value) => (
          <Chip key={value} active={kind === value} onClick={() => onKind(value)}>
            {value}
          </Chip>
        ))}
      </ChipRow>
      <ChipRow label="Status">
        <Chip active={status === 'all'} onClick={() => onStatus('all')}>
          all
        </Chip>
        {SPECIMEN_STATUSES.map((value) => (
          <Chip key={value} active={status === value} onClick={() => onStatus(value)}>
            {value}
          </Chip>
        ))}
      </ChipRow>
      {tags.length > 0 ? (
        <ChipRow label="Tags">
          <Chip active={tag === ''} onClick={() => onTag('')}>
            all
          </Chip>
          {tags.map((value) => (
            <Chip key={value} active={tag === value} onClick={() => onTag(value)}>
              {value}
            </Chip>
          ))}
        </ChipRow>
      ) : null}
    </div>
  )
}

function ChipRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="vanta-label w-14">{label}</span>
      {children}
    </div>
  )
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="vanta-chip"
      data-active={active ? 'true' : 'false'}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
