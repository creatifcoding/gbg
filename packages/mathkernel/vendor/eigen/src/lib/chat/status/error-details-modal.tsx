import { useEffect, useMemo } from 'react'
import * as Accordion from '@radix-ui/react-accordion'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ChatErrorModalSeverity = 'info' | 'warn' | 'error'
export type ChatErrorModalViewVariant = 'surface' | 'compact'
export type ChatErrorModalAdapterVariant = 'harness' | 'mock' | 'generic'

export interface ChatErrorDetailsModalProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title?: string
  readonly summary: string
  readonly details: unknown
  readonly severity?: ChatErrorModalSeverity
  readonly viewVariant?: ChatErrorModalViewVariant
  readonly adapterVariant?: ChatErrorModalAdapterVariant
  readonly onReconnect?: () => void
  readonly onCancel?: () => void
  readonly onClear?: () => void
}

const SEVERITY_TONE: Record<ChatErrorModalSeverity, string> = {
  info: 'border-neutral-700 text-neutral-300',
  warn: 'border-amber-500/30 text-amber-200',
  error: 'border-red-500/30 text-red-200',
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function extractCodeAndMessage(text: string): { code?: string; message: string } {
  const trimmed = text.trim()
  if (!trimmed) return { message: '' }

  const match = trimmed.match(/\[([^\]]+)\]/)
  if (!match) return { message: trimmed }

  const code = match[1]?.trim() || undefined
  const message = trimmed.replace(match[0], '').replace(/^HARNESS\s*/i, '').trim()
  return { code, message }
}

function normalizeDetails(details: unknown): {
  rawPretty: string
  code?: string
  message?: string
} {
  if (details == null) return { rawPretty: '' }

  if (typeof details === 'string') {
    // JSON string payload
    try {
      const parsed = JSON.parse(details) as Record<string, unknown>
      const code = typeof parsed.code === 'string' ? parsed.code : undefined
      const message = typeof parsed.message === 'string' ? parsed.message : undefined
      return {
        rawPretty: safeStringify(parsed),
        code,
        message,
      }
    } catch {
      const parsedLine = extractCodeAndMessage(details)
      return {
        rawPretty: details,
        code: parsedLine.code,
        message: parsedLine.message,
      }
    }
  }

  if (typeof details === 'object') {
    const parsed = details as Record<string, unknown>
    const code = typeof parsed.code === 'string' ? parsed.code : undefined
    const message = typeof parsed.message === 'string'
      ? parsed.message
      : typeof parsed.error === 'string'
        ? parsed.error
        : undefined
    return {
      rawPretty: safeStringify(parsed),
      code,
      message,
    }
  }

  return { rawPretty: String(details) }
}

export function ChatErrorDetailsModal({
  open,
  onOpenChange,
  title = 'Harness Error',
  summary,
  details,
  severity = 'error',
  viewVariant = 'surface',
  adapterVariant = 'harness',
  onReconnect,
  onCancel,
  onClear,
}: ChatErrorDetailsModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const parsed = useMemo(() => normalizeDetails(details), [details])
  const summaryParsed = useMemo(() => extractCodeAndMessage(summary), [summary])
  const code = parsed.code ?? summaryParsed.code
  const summaryText = parsed.message ?? summaryParsed.message ?? summary

  if (!open) return null

  return (
    <div
      data-slot="tmnl-chat-error-modal"
      data-view-variant={viewVariant}
      data-adapter-variant={adapterVariant}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close error details"
        className="absolute inset-0 bg-black/70 backdrop-blur-[1px]"
        onClick={() => onOpenChange(false)}
      />

      <div
        className={cn(
          'relative w-full rounded-lg border bg-black shadow-2xl',
          viewVariant === 'compact' ? 'max-w-2xl' : 'max-w-4xl',
          SEVERITY_TONE[severity],
        )}
      >
        <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
          <div className="font-mono text-neutral-200" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            {title}
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center rounded border border-neutral-800 px-2 py-1 text-neutral-400 hover:text-neutral-200"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-neutral-900 space-y-1.5">
          {code && (
            <div className="inline-flex items-center rounded border border-neutral-800 px-1.5 py-0.5 font-mono text-neutral-300" style={{ fontSize: '11px' }}>
              {code}
            </div>
          )}
          <div className="font-mono text-red-300 whitespace-pre-wrap break-words" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {summaryText}
          </div>
        </div>

        <div className="px-3 py-2 border-b border-neutral-900">
          <Accordion.Root type="single" collapsible>
            <Accordion.Item value="raw-payload" className="border border-neutral-900 rounded">
              <Accordion.Header>
                <Accordion.Trigger
                  className={cn(
                    'group w-full inline-flex items-center justify-between px-2.5 py-2',
                    'font-mono text-neutral-300 hover:text-neutral-100 transition-colors',
                  )}
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  <span>Raw payload</span>
                  <ChevronDown
                    size={12}
                    strokeWidth={1.5}
                    className="transition-transform duration-150 group-data-[state=open]:rotate-180"
                  />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <pre
                  className="m-2 mt-0 max-h-[45vh] overflow-auto rounded border border-neutral-900 bg-neutral-950/60 p-3 font-mono text-neutral-300"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {parsed.rawPretty}
                </pre>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
        </div>

        <div className="flex items-center gap-2 border-t border-neutral-900 px-3 py-2">
          {onReconnect && (
            <button
              type="button"
              onClick={onReconnect}
              className="rounded border border-neutral-800 px-2.5 py-1 font-mono text-neutral-300 hover:text-neutral-100"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Reconnect
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-neutral-800 px-2.5 py-1 font-mono text-neutral-300 hover:text-neutral-100"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Cancel
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="rounded border border-neutral-800 px-2.5 py-1 font-mono text-neutral-300 hover:text-neutral-100"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Clear
            </button>
          )}
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded border border-neutral-700 px-2.5 py-1 font-mono text-neutral-200 hover:text-white"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

ChatErrorDetailsModal.displayName = 'ChatErrorDetailsModal'
