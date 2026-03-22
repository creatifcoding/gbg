import { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { AssembledLogEntry } from '../../services/CodecService'
import { useMaybeLogEntryDetailEntry } from './log-entry-detail-context'

export interface LogEntryJsonBlockProps {
  readonly title: string
  readonly value?: unknown
  readonly source?: 'payload' | 'metadata'
  readonly entry?: AssembledLogEntry
}

export function LogEntryJsonBlock({
  title,
  value,
  source,
  entry,
}: LogEntryJsonBlockProps) {
  const [copied, setCopied] = useState(false)

  const resolvedEntry = useMaybeLogEntryDetailEntry(entry)
  const resolvedValue =
    value !== undefined
      ? value
      : source === 'payload'
        ? resolvedEntry?.entry.payload
        : source === 'metadata'
          ? resolvedEntry?.entry.metadata
          : undefined

  if (resolvedValue === undefined || resolvedValue === null) return null

  const json = JSON.stringify(resolvedValue, null, 2)

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(json).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }, [json])

  return (
    <section className="at-log-detail__json-block">
      <div className="at-log-detail__json-head">
        <h5 className="at-log-detail__json-title">{title}</h5>
        <button
          type="button"
          className="rvn-chat__inline-task-detail-field-copy at-log-detail__field-copy"
          data-copied={copied || undefined}
          onClick={onCopy}
          aria-label={copied ? 'Copied' : `Copy ${title}`}
          title={copied ? 'Copied' : `Copy ${title}`}
        >
          {copied ? <Check size={10} strokeWidth={2} /> : <Copy size={10} strokeWidth={2} />}
        </button>
      </div>
      <pre className="at-log-detail__json-body">{json}</pre>
    </section>
  )
}

export interface LogEntryJsonVariantProps {
  readonly entry?: AssembledLogEntry
}

export const LogEntryPayloadJsonBlock = ({ entry }: LogEntryJsonVariantProps) => (
  <LogEntryJsonBlock title="Payload JSON" source="payload" entry={entry} />
)

export const LogEntryMetadataJsonBlock = ({ entry }: LogEntryJsonVariantProps) => (
  <LogEntryJsonBlock title="Metadata JSON" source="metadata" entry={entry} />
)
