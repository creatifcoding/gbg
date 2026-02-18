import { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { AssembledLogEntry } from '../../services/CodecService'
import { useLogEntryDetailEntry } from './log-entry-detail-context'
import {
  DEFAULT_HIDDEN_LOG_FIELDS,
  LOG_ENTRY_FIELD_DESCRIPTORS,
  formatLogFieldValue,
  getLogEntryFieldValue,
} from './log-entry-schema-fields'

export interface LogEntryDetailFieldsProps {
  readonly entry?: AssembledLogEntry
}

function CopyFieldButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }, [value])

  return (
    <button
      type="button"
      className="rvn-chat__inline-task-detail-field-copy at-log-detail__field-copy"
      data-copied={copied || undefined}
      onClick={onCopy}
      aria-label={copied ? 'Copied' : 'Copy value'}
      title={copied ? 'Copied' : 'Copy value'}
    >
      {copied ? <Check size={10} strokeWidth={2} /> : <Copy size={10} strokeWidth={2} />}
    </button>
  )
}

export function LogEntryDetailFields({ entry }: LogEntryDetailFieldsProps) {
  const resolvedEntry = useLogEntryDetailEntry(entry)
  const visible = LOG_ENTRY_FIELD_DESCRIPTORS.filter(
    (d) => !DEFAULT_HIDDEN_LOG_FIELDS.has(d.key),
  )

  return (
    <dl className="rvn-chat__inline-task-detail-grid at-log-detail__field-grid">
      {visible.map((desc) => {
        const value = formatLogFieldValue(getLogEntryFieldValue(resolvedEntry, desc))
        return (
          <div key={desc.key} className="rvn-chat__inline-task-detail-field at-log-detail__field">
            <dt>{desc.label}</dt>
            <dd>
              <span className="rvn-chat__inline-task-detail-field-value at-log-detail__field-value">
                {value}
              </span>
              {value !== '—' ? <CopyFieldButton value={value} /> : null}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
