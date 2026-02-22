/**
 * MermaidBlock — Renders mermaid diagram text as beautiful SVG.
 *
 * Uses beautiful-mermaid (pure TS, no DOM, dagre layout, CSS custom properties).
 * Replaces the old heavy mermaid.js renderer with a clean, themeable alternative.
 *
 * Features:
 *   - Async rendering via renderMermaid()
 *   - TMNL theme mapping (7 CSS custom properties)
 *   - Transparent background (container provides bg)
 *   - Error fallback to raw code block
 *   - Copy source button
 *   - Expand/collapse for source view
 *
 * @module chat/msg/mermaid-block
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import { TMNL_DIAGRAM_THEME } from './tmnl-mermaid-theme'

// =============================================================================
// Types
// =============================================================================

export interface MermaidBlockProps {
  /** Raw mermaid diagram source text */
  source: string
  /** Whether the source is still streaming in */
  isStreaming?: boolean
  /** Override theme colors */
  theme?: import('beautiful-mermaid').DiagramColors
  /** Additional className on outer container */
  className?: string
}

// =============================================================================
// MermaidCanvas — zoom/pan interactive SVG viewer
// =============================================================================

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const ZOOM_SENSITIVITY = 0.0015

const MermaidCanvas = memo(function MermaidCanvas({ svgHtml }: { svgHtml: string }) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  // ── Wheel zoom (toward cursor) ─────────────────────────
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left - rect.width / 2
      const my = e.clientY - rect.top - rect.height / 2

      setScale(prev => {
        const delta = -e.deltaY * ZOOM_SENSITIVITY
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev * (1 + delta)))
        const factor = next / prev
        setTranslate(t => ({
          x: mx - (mx - t.x) * factor,
          y: my - (my - t.y) * factor,
        }))
        return next
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Drag pan ────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [translate])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return
    setTranslate({
      x: dragStart.current.tx + (e.clientX - dragStart.current.x),
      y: dragStart.current.ty + (e.clientY - dragStart.current.y),
    })
  }, [isDragging])

  const onPointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // ── Reset ───────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [])

  const isTransformed = scale !== 1 || translate.x !== 0 || translate.y !== 0

  return (
    <div className="relative">
      {/* Canvas area */}
      <div
        ref={canvasRef}
        className="overflow-hidden"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={innerRef}
          className={cn(
            'flex items-center justify-center select-none',
            '[&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[500px]',
            '[&>svg]:p-4',
          )}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 150ms ease-out',
          }}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>

      {/* Zoom controls — bottom-right, appear on hover */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover/mermaid:opacity-100 transition-opacity duration-150">
        {/* Zoom percentage / reset */}
        <button
          type="button"
          onClick={handleReset}
          title="Reset zoom"
          className={cn(
            'px-1.5 py-0.5 rounded font-mono tabular-nums',
            'transition-colors duration-150 ease-out',
            'bg-neutral-900/80 border border-neutral-800',
            isTransformed
              ? 'text-cyan-400 hover:text-cyan-300'
              : 'text-neutral-600',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {Math.round(scale * 100)}%
        </button>
      </div>

      {/* Hint — bottom-left, faint */}
      <div
        className="absolute bottom-2 left-2 flex items-center gap-1.5 opacity-0 group-hover/mermaid:opacity-100 transition-opacity duration-150 pointer-events-none text-neutral-700"
        style={{ fontSize: '10px' }}
      >
        <span>scroll to zoom</span>
        <span>·</span>
        <span>drag to pan</span>
      </div>
    </div>
  )
})

MermaidCanvas.displayName = 'MermaidCanvas'

// =============================================================================
// Lazy import — beautiful-mermaid is async (layout engine)
// =============================================================================

let renderMermaidFn: typeof import('beautiful-mermaid').renderMermaid | null = null

async function getRenderMermaid() {
  if (renderMermaidFn) return renderMermaidFn
  const mod = await import('beautiful-mermaid')
  renderMermaidFn = mod.renderMermaid
  return renderMermaidFn
}

// =============================================================================
// Component
// =============================================================================

export const MermaidBlockRoot = memo(function MermaidBlockRoot({
  source,
  isStreaming = false,
  theme = TMNL_DIAGRAM_THEME,
  className,
}: MermaidBlockProps) {
  const [svgHtml, setSvgHtml] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [showSource, setShowSource] = useState(false)
  const [copied, setCopied] = useState(false)
  const renderIdRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Render mermaid → SVG ──────────────────────────────────
  useEffect(() => {
    // Don't render while still streaming — wait for complete source
    if (isStreaming) return
    if (!source.trim()) return

    const id = ++renderIdRef.current

    ;(async () => {
      try {
        const render = await getRenderMermaid()
        const svg = await render(source, {
          ...theme,
          transparent: true, // container provides bg
          font: "'SF Mono', 'JetBrains Mono', ui-monospace, monospace",
        })

        // Stale check
        if (id !== renderIdRef.current) return

        setSvgHtml(svg)
        setError(null)
      } catch (err) {
        if (id !== renderIdRef.current) return
        console.warn('[mermaid-block] render failed:', err)
        setError(err instanceof Error ? err.message : 'Failed to render diagram')
        setSvgHtml('')
      }
    })()
  }, [source, isStreaming, theme])

  // ── Copy source ───────────────────────────────────────────
  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(source).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [source])

  // ── Export ────────────────────────────────────────────────
  const diagramSlug = useMemo(() => {
    // Extract a slug from the first meaningful line (e.g. "graph TD" → "graph-td")
    const firstLine = source.trim().split(/[\n;]/)[0]?.trim() ?? 'diagram'
    return firstLine.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'diagram'
  }, [source])

  const handleExportSvg = useCallback(() => {
    if (!svgHtml) return
    const blob = new Blob([svgHtml], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${diagramSlug}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }, [svgHtml, diagramSlug])

  const handleExportDiagram = useCallback(() => {
    const blob = new Blob([source], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${diagramSlug}.diagram`
    a.click()
    URL.revokeObjectURL(url)
  }, [source, diagramSlug])

  // ── Streaming placeholder ─────────────────────────────────
  if (isStreaming) {
    return (
      <div
        className={cn(
          'rounded border border-cyan-500/30 bg-neutral-950 overflow-hidden my-1.5',
          className,
        )}
      >
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-cyan-500/20">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-cyan-400" />
          </span>
          <span className="font-mono text-cyan-400/70" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            mermaid
          </span>
          <span className="font-mono text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            streaming…
          </span>
        </div>
        <pre
          className="p-3 font-mono text-neutral-500 overflow-auto max-h-32"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {source}
        </pre>
      </div>
    )
  }

  // ── Error fallback — show raw source ──────────────────────
  if (error) {
    return (
      <div
        className={cn(
          'rounded border border-red-500/30 bg-neutral-950 overflow-hidden my-1.5',
          className,
        )}
      >
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-red-500/20">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span className="font-mono text-red-400/70" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            mermaid parse error
          </span>
        </div>
        <pre
          className="p-3 font-mono text-neutral-400 overflow-auto max-h-48"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {source}
        </pre>
      </div>
    )
  }

  // ── Rendered SVG ──────────────────────────────────────────
  return (
    <div
      className={cn(
        'group/mermaid rounded border border-neutral-800 bg-neutral-950 overflow-hidden my-1.5',
        className,
      )}
    >
      {/* ── Header chrome ──────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          {/* Diagram icon */}
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            className="text-neutral-500"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 17h7M17.5 14v7" />
          </svg>
          <span className="font-mono text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            mermaid
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Export .diagram (mermaid source) */}
          <button
            type="button"
            onClick={handleExportDiagram}
            aria-label="Export .diagram"
            title="Export .diagram"
            className="inline-flex items-center justify-center rounded w-5 h-5 text-neutral-600 hover:text-neutral-400 transition-colors duration-150 ease-out"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </button>
          {/* Export .svg */}
          {svgHtml && (
            <button
              type="button"
              onClick={handleExportSvg}
              aria-label="Export SVG"
              title="Export SVG"
              className="inline-flex items-center justify-center rounded w-5 h-5 text-neutral-600 hover:text-neutral-400 transition-colors duration-150 ease-out"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
          {/* Divider */}
          <span className="w-px h-3 bg-neutral-800 mx-0.5" />
          {/* Source toggle */}
          <button
            type="button"
            onClick={() => setShowSource(!showSource)}
            className={cn(
              'px-1.5 py-0.5 rounded font-mono transition-colors duration-150',
              showSource
                ? 'text-cyan-400 bg-cyan-500/10'
                : 'text-neutral-600 hover:text-neutral-400',
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {'</>'}
          </button>
          {/* Copy source */}
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? 'Copied!' : 'Copy source'}
            className={cn(
              'inline-flex items-center justify-center rounded w-5 h-5',
              'transition-colors duration-150 ease-out',
              copied ? 'text-emerald-400' : 'text-neutral-600 hover:text-neutral-400',
            )}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {copied ? (
                <polyline
                  points="20 6 9 17 4 12"
                  style={{
                    strokeDasharray: 28,
                    strokeDashoffset: 0,
                    transition: 'stroke-dashoffset 250ms ease-out',
                  }}
                />
              ) : (
                <>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* ── SVG diagram with zoom/pan ─────────────────── */}
      {svgHtml && (
        <MermaidCanvas svgHtml={svgHtml} />
      )}

      {/* ── Loading state (between streaming end and render complete) ── */}
      {!svgHtml && !error && (
        <div className="flex items-center justify-center py-8">
          <span className="font-mono text-neutral-600 animate-pulse" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            rendering…
          </span>
        </div>
      )}

      {/* ── Source panel (collapsible) ──────────────────── */}
      {showSource && (
        <div className="border-t border-neutral-800">
          <pre
            className="p-3 font-mono text-neutral-500 overflow-auto max-h-48 bg-neutral-950"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {source}
          </pre>
        </div>
      )}
    </div>
  )
})

MermaidBlockRoot.displayName = 'MermaidBlock.Root'
