import { useCallback, useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { AssembledLogEntry } from '../../services/CodecService'
import { useLogEntryDetailEntry } from './log-entry-detail-context'

const getFlushContainers = (entry: AssembledLogEntry): ReadonlyArray<string> => {
  const payload = entry.entry.payload as Record<string, unknown> | undefined
  const metadata = entry.entry.metadata as Record<string, unknown> | undefined

  const payloadContainers = payload?.flushContainers
  if (Array.isArray(payloadContainers)) {
    return payloadContainers.map((v) => String(v)).filter((v) => v.length > 0)
  }

  const metadataContainer = metadata?.flushContainer
  if (typeof metadataContainer === 'string' && metadataContainer.length > 0) {
    return [metadataContainer]
  }

  return []
}

export interface LogEntryFlushContainersProps {
  readonly entry?: AssembledLogEntry
}

export function LogEntryFlushContainers({ entry }: LogEntryFlushContainersProps) {
  const resolvedEntry = useLogEntryDetailEntry(entry)
  const [copied, setCopied] = useState(false)
  const containers = getFlushContainers(resolvedEntry)
  const serialized = useMemo(() => containers.join('\n'), [containers])
  if (containers.length === 0) return null

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(serialized).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }, [serialized])

  return (
    <section className="at-log-detail__flush">
      <div className="at-log-detail__json-head">
        <h5 className="at-log-detail__json-title">Flush Containers</h5>
        <button
          type="button"
          className="rvn-chat__inline-task-detail-field-copy at-log-detail__field-copy"
          data-copied={copied || undefined}
          onClick={onCopy}
          aria-label={copied ? 'Copied' : 'Copy flush containers'}
          title={copied ? 'Copied' : 'Copy flush containers'}
        >
          {copied ? <Check size={10} strokeWidth={2} /> : <Copy size={10} strokeWidth={2} />}
        </button>
      </div>
      <div className="at-log-detail__flush-badges">
        {containers.map((container) => (
          <span key={container} className="at-log-detail__flush-badge">
            {container}
          </span>
        ))}
      </div>
    </section>
  )
}
