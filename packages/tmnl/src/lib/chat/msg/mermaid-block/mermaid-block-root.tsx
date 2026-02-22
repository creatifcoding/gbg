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
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
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
// MermaidCanvas — d3-zoom powered SVG viewer
//
// WHY d3-zoom:
//   d3-zoom is the gold standard for pan/zoom. It applies an SVG `transform`
//   attribute to a <g> wrapper — this is a vector-space transform, not CSS.
//   The SVG renderer re-renders text/paths at the correct resolution every
//   frame. Text is pixel-perfect at any zoom level.
//
// React integration pattern:
//   - useRef for SVG element — d3 needs direct DOM access
//   - useEffect to apply zoom on mount, clean up .zoom listeners on unmount
//   - d3 owns the <g> transform attribute — React doesn't touch it
//   - Only the zoom badge triggers React re-renders (debounced)
//   - Programmatic reset via zoom.transform(selection, zoomIdentity)
//
// SVG DOM surgery:
//   beautiful-mermaid outputs a flat SVG (shapes + text at root level).
//   On mount we wrap all non-<style>/<defs> children in a <g> so d3-zoom
//   can transform them as a group while leaving CSS and marker defs intact.
// =============================================================================

const MIN_SCALE = 0.15
const MAX_SCALE = 10

const MermaidCanvas = memo(function MermaidCanvas({ svgHtml }: { svgHtml: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const syncTimer = useRef<ReturnType<typeof setTimeout>>()

  // Badge display state — debounced, only for the percentage label
  const [displayScale, setDisplayScale] = useState(1)
  const [isTransformed, setIsTransformed] = useState(false)

  // ── Mount: inject SVG, wrap in <g>, apply d3-zoom ──────
  useEffect(() => {
    const wrapper = containerRef.current
    if (!wrapper) return

    // 1. Inject beautiful-mermaid SVG into DOM
    wrapper.innerHTML = svgHtml
    const svgEl = wrapper.querySelector('svg') as SVGSVGElement | null
    if (!svgEl) return

    // 2. Parse intrinsic dimensions from viewBox
    const vbAttr = svgEl.getAttribute('viewBox')
    const vbParts = vbAttr?.split(/\s+/).map(Number)
    const svgW = vbParts?.[2] ?? parseFloat(svgEl.getAttribute('width') ?? '800')
    const svgH = vbParts?.[3] ?? parseFloat(svgEl.getAttribute('height') ?? '600')

    // 3. Make SVG responsive — fill container width, compute height from aspect
    svgEl.removeAttribute('width')
    svgEl.removeAttribute('height')
    svgEl.style.width = '100%'
    svgEl.style.display = 'block'
    // Set a reasonable height that respects aspect ratio, capped at 500px
    const containerW = wrapper.clientWidth || 600
    const computedH = Math.min(500, Math.round((svgH / svgW) * containerW))
    svgEl.style.height = `${computedH}px`

    // 4. Wrap all renderable children in a <g> for d3-zoom to transform.
    //    Keep <style> and <defs> at SVG root (markers, CSS vars).
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.setAttribute('class', 'diagram-content')
    const children = Array.from(svgEl.childNodes)
    for (const child of children) {
      const tag = (child as Element).tagName?.toLowerCase()
      if (tag === 'style' || tag === 'defs') continue
      g.appendChild(child)
    }
    svgEl.appendChild(g)

    // 5. d3 selections
    const svgSel = select(svgEl)
    const gSel = select(g)

    // 6. Create zoom behavior
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .on('zoom', ({ transform }) => {
        // Apply SVG transform attribute — vector-space, always crisp
        gSel.attr('transform', transform.toString())

        // Debounced badge update (avoids React re-render per frame)
        clearTimeout(syncTimer.current)
        syncTimer.current = setTimeout(() => {
          setDisplayScale(transform.k)
          setIsTransformed(
            Math.abs(transform.k - 1) > 0.01 ||
            Math.abs(transform.x) > 1 ||
            Math.abs(transform.y) > 1
          )
        }, 80)
      })

    // 7. Apply zoom to SVG — d3 handles wheel, drag, touch, dblclick
    svgSel.call(z)

    // 8. Override filter to prevent scroll passthrough
    //    Default d3 filter allows wheel zoom — we preventDefault to stop page scroll
    z.filter((event: Event) => {
      ;(event as Event).preventDefault()
      const e = event as MouseEvent
      return (!e.ctrlKey || event.type === 'wheel') && !e.button
    })
    // Re-apply after filter change
    svgSel.call(z)

    // 9. Set cursor
    svgEl.style.cursor = 'grab'
    svgSel
      .on('mousedown.cursor', () => { svgEl.style.cursor = 'grabbing' })
      .on('mouseup.cursor', () => { svgEl.style.cursor = 'grab' })
      .on('mouseleave.cursor', () => { svgEl.style.cursor = 'grab' })

    zoomRef.current = z

    // Cleanup: remove all d3 zoom event listeners
    return () => {
      clearTimeout(syncTimer.current)
      svgSel.on('.zoom', null)
      svgSel.on('.cursor', null)
      zoomRef.current = null
    }
  }, [svgHtml])

  // ── Programmatic reset — smooth d3 transition ──────────
  const handleReset = useCallback(() => {
    const wrapper = containerRef.current
    const z = zoomRef.current
    if (!wrapper || !z) return

    const svgEl = wrapper.querySelector('svg') as SVGSVGElement | null
    if (!svgEl) return

    select(svgEl)
      .transition()
      .duration(300)
      .call(z.transform, zoomIdentity)
  }, [])

  return (
    <div className="relative">
      {/* SVG container — d3-zoom owns all interaction */}
      <div
        ref={containerRef}
        className="overflow-hidden touch-none select-none"
      />

      {/* Zoom badge — bottom-right, hover reveal */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover/mermaid:opacity-100 transition-opacity duration-150">
        <button
          type="button"
          onClick={handleReset}
          title="Reset zoom (or double-click)"
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
          {Math.round(displayScale * 100)}%
        </button>
      </div>

      {/* Hint — bottom-left */}
      <div
        className="absolute bottom-2 left-2 flex items-center gap-1.5 opacity-0 group-hover/mermaid:opacity-100 transition-opacity duration-150 pointer-events-none text-neutral-700"
        style={{ fontSize: '10px' }}
      >
        <span>scroll to zoom</span>
        <span>·</span>
        <span>drag to pan</span>
        <span>·</span>
        <span>double-click reset</span>
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
