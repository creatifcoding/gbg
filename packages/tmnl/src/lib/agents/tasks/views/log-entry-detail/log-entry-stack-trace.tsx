import { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { AssembledLogEntry } from '../../services/CodecService'
import { useLogEntryDetailEntry } from './log-entry-detail-context'

const resolveStackTrace = (entry: AssembledLogEntry): string | undefined => {
  const payload = entry.entry.payload as Record<string, unknown> | undefined
  const metadata = entry.entry.metadata as Record<string, unknown> | undefined

  const directPayloadStack = payload?.stackTrace ?? payload?.stack
  if (typeof directPayloadStack === 'string' && directPayloadStack.trim().length > 0) {
    return directPayloadStack
  }

  const payloadError = payload?.error as Record<string, unknown> | undefined
  const payloadErrorStack = payloadError?.stackTrace ?? payloadError?.stack
  if (typeof payloadErrorStack === 'string' && payloadErrorStack.trim().length > 0) {
    return payloadErrorStack
  }

  const metadataStack = metadata?.stackTrace ?? metadata?.stack
  if (typeof metadataStack === 'string' && metadataStack.trim().length > 0) {
    return metadataStack
  }

  return undefined
}

export interface LogEntryStackTraceProps {
  readonly entry?: AssembledLogEntry
}

export function LogEntryStackTrace({ entry }: LogEntryStackTraceProps) {
  const resolvedEntry = useLogEntryDetailEntry(entry)
  const [copied, setCopied] = useState(false)
  const stack = resolveStackTrace(resolvedEntry)
  if (!stack) return null

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(stack).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }, [stack])

  return (
    <details className="at-log-detail__stack" open>
      <summary className="at-log-detail__stack-summary">Stack Trace</summary>
      <div className="at-log-detail__stack-actions">
        <button
          type="button"
          className="rvn-chat__inline-task-detail-field-copy at-log-detail__field-copy"
          data-copied={copied || undefined}
          onClick={onCopy}
          aria-label={copied ? 'Copied' : 'Copy stack trace'}
          title={copied ? 'Copied' : 'Copy stack trace'}
        >
          {copied ? <Check size={10} strokeWidth={2} /> : <Copy size={10} strokeWidth={2} />}
        </button>
      </div>
      <pre className="at-log-detail__stack-body">{stack}</pre>
    </details>
  )
}
