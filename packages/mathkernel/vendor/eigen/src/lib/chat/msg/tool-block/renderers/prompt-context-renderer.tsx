/**
 * prompt_context Tool Renderer — displays system prompt registry operations.
 *
 * Shows the agent's code input with syntax highlighting and the structured
 * result (budget, entries, errors) in a meaningful card layout.
 *
 * @module chat/msg/tool-block/renderers/prompt-context-renderer
 */

import { memo, useMemo, type FC } from 'react'
import { cn } from '@/lib/utils'
import {
  Brain,
  Key,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  Loader2,
} from 'lucide-react'
import type { ToolRendererProps } from './registry'

// ── Helpers ─────────────────────────────────────────────────

function parseInput(input: unknown): Record<string, unknown> {
  if (input == null) return {}
  if (typeof input === 'string') {
    try { return parseInput(JSON.parse(input)) } catch { return { raw: input } }
  }
  const obj = input as Record<string, unknown>
  if (obj.arguments && typeof obj.arguments === 'object' && !Array.isArray(obj.arguments)) {
    return obj.arguments as Record<string, unknown>
  }
  return obj
}

function extractText(output: unknown): string {
  if (output == null) return ''
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    return output.filter((c: any) => c?.type === 'text').map((c: any) => c.text ?? '').join('\n')
  }
  const obj = output as Record<string, unknown>
  if (Array.isArray(obj.result)) {
    return obj.result.filter((c: any) => c?.type === 'text').map((c: any) => c.text ?? '').join('\n')
  }
  return typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output)
}

function tryParseJson(text: string): unknown | null {
  try { return JSON.parse(text) } catch { return null }
}

// ── Badge ───────────────────────────────────────────────────

function Badge({ children, variant = 'neutral' }: {
  children: React.ReactNode
  variant?: 'success' | 'error' | 'warning' | 'neutral' | 'info'
}) {
  const styles = {
    success: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400/80',
    error: 'border-red-500/20 bg-red-500/[0.06] text-red-400/80',
    warning: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-400/80',
    neutral: 'border-neutral-700/30 bg-neutral-800/20 text-neutral-400/60',
    info: 'border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-400/80',
  }[variant]

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono',
      styles,
    )} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
      {children}
    </span>
  )
}

// ── Budget Bar ──────────────────────────────────────────────

function BudgetBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const color = pct > 80 ? 'bg-amber-500/60' : pct > 95 ? 'bg-red-500/60' : 'bg-cyan-500/40'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-neutral-800/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-neutral-500/60 whitespace-nowrap" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        {formatBytes(used)} / {formatBytes(limit)}
      </span>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  return `${(bytes / 1024).toFixed(1)}KB`
}

// ── Result Display ──────────────────────────────────────────

function ResultDisplay({ text }: { text: string }) {
  const parsed = useMemo(() => tryParseJson(text), [text])

  // Budget result
  if (parsed && typeof parsed === 'object' && 'usedBytes' in (parsed as any)) {
    const budget = parsed as { usedBytes: number; limitBytes: number; remainingBytes: number; entryCount: number }
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-cyan-500/50" />
          <span className="text-neutral-400/80" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Budget: {budget.entryCount} entries
          </span>
        </div>
        <BudgetBar used={budget.usedBytes} limit={budget.limitBytes} />
      </div>
    )
  }

  // Array result (list() output)
  if (parsed && Array.isArray(parsed)) {
    return (
      <div className="space-y-1">
        {parsed.map((item: any, i: number) => (
          <div key={i} className="flex items-center gap-2 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            <Key className="w-3 h-3 text-neutral-500/40 flex-shrink-0" />
            <span className="text-cyan-400/70">{item.key}</span>
            <span className="text-neutral-600">p:{item.priority}</span>
            <span className="text-neutral-600">{formatBytes(item.sizeBytes)}</span>
          </div>
        ))}
      </div>
    )
  }

  // Error result
  if (parsed && typeof parsed === 'object' && (parsed as any).error) {
    return (
      <div className="flex items-start gap-2 text-red-400/80" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span className="font-mono">{(parsed as any).message ?? text}</span>
      </div>
    )
  }

  // Simple "OK" result
  if (text === 'OK') {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/60" />
        <span className="text-emerald-400/60" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Done</span>
      </div>
    )
  }

  // Object/complex result
  if (parsed && typeof parsed === 'object') {
    return (
      <pre className="font-mono text-neutral-400/70 whitespace-pre-wrap overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        {JSON.stringify(parsed, null, 2)}
      </pre>
    )
  }

  // Plain text fallback
  return (
    <pre className="font-mono text-neutral-400/70 whitespace-pre-wrap" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
      {text}
    </pre>
  )
}

// ── Main Renderer ───────────────────────────────────────────

export const PromptContextRenderer: FC<ToolRendererProps> = memo(({ input, output, errorText, state }) => {
  const params = parseInput(input)
  const code = (params.code as string) ?? ''
  const outputText = errorText ?? extractText(output)
  const isRunning = state === 'running' || state === 'pending'
  const isError = !!errorText

  // Detect operation type from code
  const opType = useMemo(() => {
    if (code.includes('.set(')) return 'write'
    if (code.includes('.delete(')) return 'delete'
    if (code.includes('.budget()')) return 'budget'
    if (code.includes('.list()')) return 'list'
    if (code.includes('.get(')) return 'read'
    if (code.includes('.keys()')) return 'keys'
    if (code.includes('.has(')) return 'check'
    return 'eval'
  }, [code])

  const opLabel = {
    write: 'Write',
    delete: 'Delete',
    budget: 'Budget',
    list: 'List',
    read: 'Read',
    keys: 'Keys',
    check: 'Check',
    eval: 'Eval',
  }[opType]

  const opColor = {
    write: 'info' as const,
    delete: 'warning' as const,
    budget: 'neutral' as const,
    list: 'neutral' as const,
    read: 'neutral' as const,
    keys: 'neutral' as const,
    check: 'neutral' as const,
    eval: 'info' as const,
  }[opType]

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-violet-400/60" />
        <span className="text-neutral-300/80 font-medium" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          System Prompt Registry
        </span>
        <Badge variant={opColor}>{opLabel}</Badge>
        {isRunning && <Loader2 className="w-3.5 h-3.5 text-cyan-500/50 animate-spin" />}
      </div>

      {/* Code input */}
      {code && (
        <pre
          className="font-mono text-neutral-400/70 bg-neutral-900/40 border border-neutral-800/30 rounded px-3 py-2 overflow-x-auto"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {code.trim()}
        </pre>
      )}

      {/* Result */}
      {!isRunning && outputText && (
        <div className={cn(
          'border rounded px-3 py-2',
          isError
            ? 'border-red-500/15 bg-red-500/[0.03]'
            : 'border-neutral-800/30 bg-neutral-900/20',
        )}>
          <ResultDisplay text={outputText} />
        </div>
      )}
    </div>
  )
})
PromptContextRenderer.displayName = 'PromptContextRenderer'

// ── Header Meta (collapsed view) ────────────────────────────

export const PromptContextHeaderMeta: FC<ToolRendererProps> = memo(({ input, output, state }) => {
  const params = parseInput(input)
  const code = (params.code as string) ?? ''
  const isRunning = state === 'running' || state === 'pending'

  // Extract operation + key from code
  const summary = useMemo(() => {
    const setMatch = code.match(/\.set\(\s*['"]([^'"]+)['"]/)
    if (setMatch) return `set ${setMatch[1]}`

    const deleteMatch = code.match(/\.delete\(\s*['"]([^'"]+)['"]/)
    if (deleteMatch) return `delete ${deleteMatch[1]}`

    const getMatch = code.match(/\.get\(\s*['"]([^'"]+)['"]/)
    if (getMatch) return `get ${getMatch[1]}`

    if (code.includes('.budget()')) return 'budget'
    if (code.includes('.list()')) return 'list'
    if (code.includes('.keys()')) return 'keys'

    // Multi-op: count distinct operations
    const ops = ['.set(', '.delete(', '.get(', '.list()', '.budget()', '.keys()'].filter(op => code.includes(op))
    if (ops.length > 1) return `${ops.length} ops`

    return 'eval'
  }, [code])

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-neutral-500/60" style={{ fontSize: '10px' }}>
      <Brain className="w-3 h-3 text-violet-400/40" />
      <span className="text-violet-400/50">{summary}</span>
      {isRunning && <Loader2 className="w-2.5 h-2.5 text-cyan-500/40 animate-spin" />}
    </span>
  )
})
PromptContextHeaderMeta.displayName = 'PromptContextHeaderMeta'
