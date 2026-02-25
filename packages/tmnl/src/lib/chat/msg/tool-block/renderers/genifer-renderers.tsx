/**
 * Genifer Tool Renderers — native artifact cards for the harness chat system.
 *
 * Renders genifer tool results inline in the chat thread:
 *   genifer_generate  → Full artifact card with interactive UITree
 *   genifer_refine    → Side-by-side before/after with diff badges
 *   genifer_query     → Collapsible JSON data display
 *   genifer_code      → Code + result split view
 *   genifer_define_*  → Compact registration confirmation cards
 *   genifer_export    → Bundle manifest summary card
 *
 * Conforms to ToolRendererProps contract from chat/msg/tool-block/renderers/registry.
 *
 * @module chat/msg/tool-block/renderers/genifer-renderers
 */

import { memo, useMemo, useState, type FC } from 'react'
import { HashMap } from 'effect'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  RefreshCw,
  Database,
  Code2,
  Zap,
  Radio,
  Wrench,
  Package,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import type { ToolRendererProps } from './registry'
import { Renderer, DefaultFallback } from '@/lib/genifer/react/renderer'
import { UITree, UIElement } from '@/lib/genifer/core/schemas'

// =============================================================================
// Helpers
// =============================================================================

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

/** Extract details from output — handles both shapes:
 *  - { result: [...], details: {...} }  (merged by event processor)
 *  - [{ type: 'text', text: '...' }]   (legacy, no details)
 */
function extractDetails(output: unknown): Record<string, unknown> | null {
  if (!output || typeof output !== 'object') return null
  const obj = output as Record<string, unknown>
  if (obj.details && typeof obj.details === 'object') {
    return obj.details as Record<string, unknown>
  }
  return null
}

/** Extract text content from output */
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
  return ''
}

/** Parse a UITree from treeSnapshot (string or object) */
function parseTree(snapshot: unknown): UITree | null {
  if (!snapshot) return null
  let snap: Record<string, unknown>
  if (typeof snapshot === 'string') {
    try { snap = JSON.parse(snapshot) } catch { return null }
  } else if (typeof snapshot === 'object' && snapshot !== null) {
    snap = snapshot as Record<string, unknown>
  } else {
    return null
  }
  try {
    const root = snap.root as string
    const elements = snap.elements
    if (!root || !elements) return null

    if (Array.isArray(elements)) {
      const entries = elements.map(([k, v]: [string, unknown]) => [k, new UIElement(v as any)] as const)
      return new UITree({ root, elements: HashMap.fromIterable(entries) })
    }
    if (typeof elements === 'object' && !Array.isArray(elements)) {
      const entries = Object.entries(elements as Record<string, unknown>).map(
        ([k, v]) => [k, new UIElement(v as any)] as const,
      )
      return new UITree({ root, elements: HashMap.fromIterable(entries) })
    }
    return null
  } catch {
    return null
  }
}

// =============================================================================
// Tokens — Q-Branch palette
// =============================================================================

const T = {
  bg: 'rgba(28, 25, 23, 0.85)',
  bgInner: 'rgba(23, 20, 18, 0.6)',
  border: 'rgba(120, 113, 108, 0.2)',
  borderActive: 'rgba(34, 211, 238, 0.3)',
  header: 'rgba(41, 37, 36, 0.9)',
  footer: 'rgba(41, 37, 36, 0.6)',
  glow: '0 0 16px rgba(34, 211, 238, 0.06)',
  cyan: 'rgb(34, 211, 238)',
  cyanMuted: 'rgba(34, 211, 238, 0.7)',
} as const

// =============================================================================
// genifer_generate — Full Artifact Card with Interactive UITree
// =============================================================================

export const GeniferGenerateRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
  toolCallId,
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const parsed = useMemo(() => parseInput(input), [input])
  const details = useMemo(() => extractDetails(output), [output])
  const tree = useMemo(() => parseTree(details?.treeSnapshot), [details])
  const prompt = (parsed.prompt as string) ?? ''
  const isRunning = state === 'running'
  const isError = state === 'error' || errorText != null
  const elementCount = (details?.elementCount as number) ?? (tree ? HashMap.size(tree.elements) : 0)
  const qualityPct = details?.qualityScore != null ? Math.round((details.qualityScore as number) * 100) : null
  const repairCount = details?.repairCount as number | undefined
  const durationMs = details?.durationMs as number | undefined
  const model = details?.model as string | undefined
  const surfaceId = details?.surfaceId as string | undefined
  const treeId = details?.treeId as string | undefined
  const threadId = details?.threadId as string | undefined

  return (
    <div
      className="rounded-lg overflow-hidden mx-3 mb-2"
      style={{
        background: T.bg,
        border: `1px solid ${isRunning ? T.borderActive : T.border}`,
        boxShadow: T.glow,
      }}
      data-slot="tmnl-tool-renderer-genifer-generate"
      data-surface-id={surfaceId}
    >
      {/* Scan line while streaming */}
      {isRunning && (
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, ${T.cyan}99, transparent)`,
            animation: 'genifer-chat-scan 1.8s ease-in-out infinite',
          }}
        />
      )}

      {/* Header — prompt excerpt + quality + collapse toggle */}
      <div
        style={{ background: T.header, borderBottom: `1px solid ${T.border}` }}
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isRunning ? (
            <Loader2 size={13} className="text-cyan-400 animate-spin flex-shrink-0" />
          ) : isError ? (
            <XCircle size={13} className="text-red-400 flex-shrink-0" />
          ) : (
            <Sparkles size={13} className="text-cyan-400 flex-shrink-0" />
          )}
          <span
            className="font-mono text-stone-200 truncate"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {prompt.length > 72 ? prompt.slice(0, 69) + '…' : (prompt || 'Generate UI')}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {elementCount > 0 && (
            <span className="font-mono text-stone-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {elementCount} el
            </span>
          )}
          {qualityPct != null && !isRunning && (
            <span
              className="font-mono px-1.5 py-0.5 rounded"
              style={{
                fontSize: 'var(--tmnl-text-xs, 12px)',
                background: qualityPct >= 80 ? 'rgba(34,211,238,0.12)' : 'rgba(239,68,68,0.12)',
                color: qualityPct >= 80 ? 'rgb(103,232,249)' : 'rgb(252,165,165)',
              }}
            >
              {qualityPct}%
            </span>
          )}
          <ChevronDown
            size={12}
            className="text-stone-500 transition-transform"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          />
        </div>
      </div>

      {/* Body — interactive UITree */}
      {!collapsed && (
        <div className="p-3" style={{ minHeight: isRunning ? 64 : undefined }}>
          {tree ? (
            <Renderer
              tree={tree}
              loading={isRunning}
              fallback={DefaultFallback}
              disableAnimations={isRunning}
            />
          ) : isRunning ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="animate-pulse rounded"
                  style={{ height: 20 + i * 8, background: 'rgba(120,113,108,0.12)' }}
                />
              ))}
            </div>
          ) : isError ? (
            <div className="text-red-300/80 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {errorText ?? (extractText(output) || 'Generation failed')}
            </div>
          ) : (
            <pre
              className="text-stone-400 font-mono overflow-x-auto"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)', maxHeight: 200, overflowY: 'auto' }}
            >
              {extractText(output) || 'No content'}
            </pre>
          )}
        </div>
      )}

      {/* Footer — trace metadata */}
      {!collapsed && !isRunning && surfaceId && (
        <div
          className="flex items-center justify-between px-3 py-1 font-mono text-stone-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)', background: T.footer, borderTop: `1px solid ${T.border}` }}
        >
          <span>
            {model ?? '—'} · {durationMs ?? 0}ms
            {repairCount ? ` · ${repairCount} repairs` : ''}
            {threadId ? ` · thread ${threadId.slice(0, 6)}` : ''}
          </span>
          <span>
            {surfaceId.slice(0, 8)}
            {treeId ? ` → ${(treeId as string).slice(0, 8)}` : ''}
          </span>
        </div>
      )}

      <style>{`@keyframes genifer-chat-scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
    </div>
  )
})

GeniferGenerateRenderer.displayName = 'GeniferGenerateRenderer'

// =============================================================================
// genifer_refine — Side-by-side before/after with diff badges
// =============================================================================

export const GeniferRefineRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
  toolCallId,
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const parsed = useMemo(() => parseInput(input), [input])
  const details = useMemo(() => extractDetails(output), [output])
  const tree = useMemo(() => parseTree(details?.treeSnapshot), [details])
  const instruction = (parsed.instruction as string) ?? ''
  const sourceSurfaceId = (parsed.surfaceId as string) ?? ''
  const isRunning = state === 'running'
  const isError = state === 'error' || errorText != null
  const added = (details?.addedElements as number) ?? 0
  const removed = (details?.removedElements as number) ?? 0
  const modified = (details?.modifiedElements as number) ?? 0
  const elementCount = (details?.elementCount as number) ?? 0
  const qualityPct = details?.qualityScore != null ? Math.round((details.qualityScore as number) * 100) : null
  const surfaceId = details?.surfaceId as string | undefined

  return (
    <div
      className="rounded-lg overflow-hidden mx-3 mb-2"
      style={{
        background: T.bg,
        border: `1px solid ${isRunning ? T.borderActive : T.border}`,
        boxShadow: T.glow,
      }}
      data-slot="tmnl-tool-renderer-genifer-refine"
    >
      {isRunning && (
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, transparent, ${T.cyan}99, transparent)`,
            animation: 'genifer-chat-scan 1.8s ease-in-out infinite',
          }}
        />
      )}

      {/* Header */}
      <div
        style={{ background: T.header, borderBottom: `1px solid ${T.border}` }}
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isRunning ? (
            <Loader2 size={13} className="text-cyan-400 animate-spin flex-shrink-0" />
          ) : isError ? (
            <XCircle size={13} className="text-red-400 flex-shrink-0" />
          ) : (
            <RefreshCw size={13} className="text-cyan-400 flex-shrink-0" />
          )}
          <span className="font-mono text-stone-500 flex-shrink-0" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {sourceSurfaceId.slice(0, 8)} →
          </span>
          <span
            className="font-mono text-stone-200 truncate"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {instruction.length > 60 ? instruction.slice(0, 57) + '…' : (instruction || 'Refine UI')}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {/* Diff badges */}
          {!isRunning && (added > 0 || removed > 0 || modified > 0) && (
            <div className="flex items-center gap-1.5 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {added > 0 && <span className="text-green-400">+{added}</span>}
              {removed > 0 && <span className="text-red-400">−{removed}</span>}
              {modified > 0 && <span className="text-amber-400">~{modified}</span>}
            </div>
          )}
          {elementCount > 0 && (
            <span className="font-mono text-stone-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {elementCount} el
            </span>
          )}
          <ChevronDown
            size={12}
            className="text-stone-500 transition-transform"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          />
        </div>
      </div>

      {/* Body — refined tree */}
      {!collapsed && (
        <div className="p-3" style={{ minHeight: isRunning ? 64 : undefined }}>
          {tree ? (
            <Renderer
              tree={tree}
              loading={isRunning}
              fallback={DefaultFallback}
              disableAnimations={isRunning}
            />
          ) : isRunning ? (
            <div className="flex flex-col gap-2">
              {[0, 1].map(i => (
                <div key={i} className="animate-pulse rounded" style={{ height: 18 + i * 6, background: 'rgba(120,113,108,0.12)' }} />
              ))}
            </div>
          ) : isError ? (
            <div className="text-red-300/80 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {errorText ?? 'Refinement failed'}
            </div>
          ) : (
            <pre
              className="text-stone-400 font-mono overflow-x-auto"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)', maxHeight: 200, overflowY: 'auto' }}
            >
              {extractText(output) || 'No content'}
            </pre>
          )}
        </div>
      )}

      {/* Footer */}
      {!collapsed && !isRunning && surfaceId && (
        <div
          className="flex items-center justify-between px-3 py-1 font-mono text-stone-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)', background: T.footer, borderTop: `1px solid ${T.border}` }}
        >
          <span>{sourceSurfaceId.slice(0, 8)} → {surfaceId.slice(0, 8)}</span>
          {qualityPct != null && <span>{qualityPct}%</span>}
        </div>
      )}
    </div>
  )
})

GeniferRefineRenderer.displayName = 'GeniferRefineRenderer'

// =============================================================================
// genifer_query — Collapsible JSON data display
// =============================================================================

export const GeniferQueryRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const parsed = useMemo(() => parseInput(input), [input])
  const operation = (parsed.operation as string) ?? 'query'
  const isRunning = state === 'running'
  const isError = state === 'error' || errorText != null
  const text = extractText(output)

  return (
    <div
      className="rounded-lg overflow-hidden mx-3 mb-2"
      style={{ background: T.bg, border: `1px solid ${T.border}` }}
      data-slot="tmnl-tool-renderer-genifer-query"
    >
      <div
        style={{ background: T.header, borderBottom: `1px solid ${T.border}` }}
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 size={13} className="text-blue-400 animate-spin" />
          ) : isError ? (
            <XCircle size={13} className="text-red-400" />
          ) : (
            <Database size={13} className="text-stone-400" />
          )}
          <span className="font-mono text-stone-300" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            {operation}
          </span>
        </div>
        <ChevronDown
          size={12}
          className="text-stone-500 transition-transform"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
        />
      </div>

      {!collapsed && !isRunning && text && (
        <pre
          className="px-3 py-2 font-mono text-stone-400 overflow-x-auto"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)', maxHeight: 240, overflowY: 'auto' }}
        >
          {text.length > 3000 ? text.slice(0, 3000) + '\n…' : text}
        </pre>
      )}

      {isError && errorText && (
        <div className="px-3 py-2 text-red-300/80 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {errorText}
        </div>
      )}
    </div>
  )
})

GeniferQueryRenderer.displayName = 'GeniferQueryRenderer'

// =============================================================================
// genifer_code — Code + Result split view
// =============================================================================

export const GeniferCodeRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const [showCode, setShowCode] = useState(false)
  const parsed = useMemo(() => parseInput(input), [input])
  const details = useMemo(() => extractDetails(output), [output])
  const code = (parsed.code as string) ?? ''
  const mode = (parsed.mode as string) ?? (details?.mode as string) ?? 'execute'
  const isRunning = state === 'running'
  const isError = state === 'error' || errorText != null
  const success = details?.success as boolean | undefined
  const durationMs = details?.durationMs as number | undefined
  const resultText = details?.result != null
    ? (typeof details.result === 'string' ? details.result : JSON.stringify(details.result, null, 2))
    : extractText(output)

  return (
    <div
      className="rounded-lg overflow-hidden mx-3 mb-2"
      style={{ background: T.bg, border: `1px solid ${T.border}` }}
      data-slot="tmnl-tool-renderer-genifer-code"
    >
      {/* Header */}
      <div
        style={{ background: T.header, borderBottom: `1px solid ${T.border}` }}
        className="flex items-center justify-between px-3 py-1.5"
      >
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 size={13} className="text-cyan-400 animate-spin" />
          ) : isError ? (
            <XCircle size={13} className="text-red-400" />
          ) : (
            <Code2 size={13} className="text-cyan-400" />
          )}
          <span className="font-mono text-stone-300" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            {mode}
          </span>
          {durationMs != null && (
            <span className="font-mono text-stone-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {durationMs}ms
            </span>
          )}
        </div>
        {success != null && (
          <span className={cn('font-mono', success ? 'text-green-400' : 'text-red-400')} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {success ? '✓ OK' : '✗ FAIL'}
          </span>
        )}
      </div>

      {/* Code block — collapsible */}
      {code && (
        <div style={{ borderBottom: `1px solid ${T.border}` }}>
          <div
            className="flex items-center gap-1.5 px-3 py-1 cursor-pointer select-none"
            onClick={() => setShowCode(c => !c)}
            style={{ background: T.bgInner }}
          >
            <ChevronRight
              size={12}
              className="text-stone-600 transition-transform"
              style={{ transform: showCode ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
            <span className="font-mono text-stone-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              Code
            </span>
          </div>
          {showCode && (
            <pre
              className="px-3 py-2 font-mono text-stone-400 overflow-x-auto"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)', maxHeight: 300, overflowY: 'auto', background: T.bgInner }}
            >
              {code}
            </pre>
          )}
        </div>
      )}

      {/* Result */}
      <div className="px-3 py-2">
        {isError ? (
          <pre className="text-red-300/80 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {errorText ?? (details?.error as string) ?? 'Execution failed'}
          </pre>
        ) : resultText ? (
          <pre
            className="text-stone-400 font-mono overflow-x-auto"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)', maxHeight: 200, overflowY: 'auto' }}
          >
            {resultText.length > 2000 ? resultText.slice(0, 2000) + '\n…' : resultText}
          </pre>
        ) : isRunning ? (
          <div className="animate-pulse rounded" style={{ height: 20, background: 'rgba(120,113,108,0.12)' }} />
        ) : null}
      </div>
    </div>
  )
})

GeniferCodeRenderer.displayName = 'GeniferCodeRenderer'

// =============================================================================
// Meta-tools — Compact registration confirmation cards
// =============================================================================

const MetaToolRenderer: FC<ToolRendererProps & { icon: typeof Zap; label: string }> = memo(({
  input,
  output,
  errorText,
  state,
  icon: Icon,
  label,
}) => {
  const [expanded, setExpanded] = useState(false)
  const parsed = useMemo(() => parseInput(input), [input])
  const details = useMemo(() => extractDetails(output), [output])
  const tag = (parsed.tag as string) ?? (parsed.name as string) ?? ''
  const description = (parsed.description as string) ?? ''
  const registered = (details?.registered as boolean) ?? state === 'completed'
  const isError = state === 'error' || errorText != null

  return (
    <div
      className="rounded border mx-3 mb-2 overflow-hidden"
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
      }}
      data-slot="tmnl-tool-renderer-genifer-meta"
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
        style={{ background: T.header }}
      >
        {isError ? (
          <XCircle size={13} className="text-red-400 flex-shrink-0" />
        ) : registered ? (
          <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
        ) : (
          <Icon size={13} className="text-stone-400 flex-shrink-0" />
        )}
        <span className="font-mono text-stone-300" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          {label}
        </span>
        <code
          className="font-mono text-cyan-300/80 truncate"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {tag}
        </code>
        {registered && (
          <span className="font-mono text-green-400/60 ml-auto flex-shrink-0" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            ✓ registered
          </span>
        )}
      </div>

      {expanded && (description || errorText) && (
        <div className="px-3 py-2 font-mono text-stone-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)', borderTop: `1px solid ${T.border}` }}>
          {errorText ?? description}
        </div>
      )}
    </div>
  )
})

MetaToolRenderer.displayName = 'MetaToolRenderer'

// Typed wrappers
export const GeniferDefineRpcRenderer: FC<ToolRendererProps> = (props) =>
  <MetaToolRenderer {...props} icon={Zap} label="RPC" />
export const GeniferDefineEventRenderer: FC<ToolRendererProps> = (props) =>
  <MetaToolRenderer {...props} icon={Radio} label="Event" />
export const GeniferDefineToolRenderer: FC<ToolRendererProps> = (props) =>
  <MetaToolRenderer {...props} icon={Wrench} label="Tool" />

GeniferDefineRpcRenderer.displayName = 'GeniferDefineRpcRenderer'
GeniferDefineEventRenderer.displayName = 'GeniferDefineEventRenderer'
GeniferDefineToolRenderer.displayName = 'GeniferDefineToolRenderer'

// =============================================================================
// genifer_export_extension — Bundle manifest summary
// =============================================================================

export const GeniferExportRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const parsed = useMemo(() => parseInput(input), [input])
  const details = useMemo(() => extractDetails(output), [output])
  const name = (parsed.name as string) ?? ''
  const isError = state === 'error' || errorText != null
  const bundled = details?.bundled as Record<string, number> | undefined

  return (
    <div
      className="rounded border mx-3 mb-2 overflow-hidden"
      style={{ background: T.bg, border: `1px solid ${T.border}` }}
      data-slot="tmnl-tool-renderer-genifer-export"
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{ background: T.header }}
      >
        {isError ? (
          <XCircle size={13} className="text-red-400" />
        ) : (
          <Package size={13} className="text-cyan-400" />
        )}
        <span className="font-mono text-stone-300" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          Export
        </span>
        <code className="font-mono text-cyan-300/80" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {name}
        </code>
      </div>

      {bundled && (
        <div
          className="flex items-center gap-3 px-3 py-1.5 font-mono text-stone-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)', borderTop: `1px solid ${T.border}` }}
        >
          <span>{bundled.elements ?? 0} elements</span>
          <span>{bundled.rpcs ?? 0} RPCs</span>
          <span>{bundled.events ?? 0} events</span>
          <span>{bundled.tools ?? 0} tools</span>
        </div>
      )}

      {isError && errorText && (
        <div className="px-3 py-2 text-red-300/80 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {errorText}
        </div>
      )}
    </div>
  )
})

GeniferExportRenderer.displayName = 'GeniferExportRenderer'
