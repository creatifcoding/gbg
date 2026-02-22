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
// MermaidCanvas — native SVG viewBox zoom/pan
//
// WHY viewBox, not CSS transform:
//   CSS `scale()` + `will-change: transform` rasterizes the SVG at its original
//   resolution, then stretches the bitmap. Text becomes blurry at high zoom.
//   SVG viewBox manipulation re-renders all primitives (text, paths, lines) at
//   native resolution for every frame. Diagram-scale SVGs (~100-500 elements)
//   render in <1ms — no perceptible jank.
//
// Interaction design:
//   - Ref-driven viewBox state (zero React re-renders during gesture)
//   - Direct SVG attribute writes (no React reconciliation)
//   - Exponential zoom (multiply scale, not add) — natural feel
//   - Zoom-to-cursor: viewport-to-SVG coordinate mapping
//   - Pointer capture for reliable drag across elements
//   - Double-click to fit-to-view (animated via rAF interpolation)
//   - Touch-none to prevent browser pinch conflict
//   - SVG text/paths always pixel-perfect at any zoom level
// =============================================================================

const MIN_ZOOM = 0.15
const MAX_ZOOM = 10
const ZOOM_FACTOR = 0.003
const FIT_ANIM_MS = 250

/** The SVG-space rectangle we're looking at */
interface ViewRect {
  x: number
  y: number
  w: number
  h: number
}

function clampZoom(z: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))
}

const MermaidCanvas = memo(function MermaidCanvas({ svgHtml }: { svgHtml: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Original intrinsic SVG dimensions (parsed once)
  const intrinsic = useRef({ w: 0, h: 0 })
  // Current view rect in SVG coordinate space
  const view = useRef<ViewRect>({ x: 0, y: 0, w: 0, h: 0 })
  // Gesture tracking
  const dragging = useRef(false)
  const dragStart = useRef({ px: 0, py: 0, vx: 0, vy: 0 })
  // Animation
  const animFrame = useRef(0)

  // Display state — only updated on gesture end
  const [displayZoom, setDisplayZoom] = useState(1)
  const [isTransformed, setIsTransformed] = useState(false)

  // ── Parse SVG element + intrinsic viewBox on mount ─────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const svg = el.querySelector('svg')
    if (!svg) return
    svgRef.current = svg

    // Parse the original viewBox from beautiful-mermaid output
    const vb = svg.getAttribute('viewBox')
    if (vb) {
      const parts = vb.split(/\s+/).map(Number)
      intrinsic.current = { w: parts[2] ?? 0, h: parts[3] ?? 0 }
    } else {
      // Fallback to width/height attributes
      intrinsic.current = {
        w: parseFloat(svg.getAttribute('width') ?? '800'),
        h: parseFloat(svg.getAttribute('height') ?? '600'),
      }
    }

    // Make SVG fill container (responsive), remove fixed dimensions
    svg.removeAttribute('width')
    svg.removeAttribute('height')
    svg.style.width = '100%'
    svg.style.height = '100%'
    svg.style.display = 'block'

    // Initialize view to show entire diagram
    view.current = { x: 0, y: 0, w: intrinsic.current.w, h: intrinsic.current.h }
    applyViewBox(view.current)
  }, [svgHtml])

  // ── Apply viewBox to SVG element (no React) ────────────
  const applyViewBox = useCallback((v: ViewRect) => {
    const svg = svgRef.current
    if (!svg) return
    svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`)
  }, [])

  // ── Current zoom level (ratio of intrinsic to view) ────
  const currentZoom = useCallback(() => {
    if (view.current.w === 0) return 1
    return intrinsic.current.w / view.current.w
  }, [])

  // ── Sync display state ─────────────────────────────────
  const syncDisplay = useCallback(() => {
    const zoom = currentZoom()
    setDisplayZoom(zoom)
    const i = intrinsic.current
    const v = view.current
    setIsTransformed(
      Math.abs(zoom - 1) > 0.01 ||
      Math.abs(v.x) > 1 ||
      Math.abs(v.y) > 1 ||
      Math.abs(v.w - i.w) > 1 ||
      Math.abs(v.h - i.h) > 1
    )
  }, [currentZoom])

  // ── Wheel zoom — toward cursor ─────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const svg = svgRef.current
      if (!svg) return

      const rect = el.getBoundingClientRect()
      // Cursor position as fraction of viewport (0→1)
      const fx = (e.clientX - rect.left) / rect.width
      const fy = (e.clientY - rect.top) / rect.height

      // Cursor position in SVG coordinates
      const v = view.current
      const svgX = v.x + fx * v.w
      const svgY = v.y + fy * v.h

      // Exponential zoom
      const delta = -e.deltaY * ZOOM_FACTOR
      const factor = Math.exp(delta) // >1 = zoom in, <1 = zoom out

      // New view dimensions
      const newW = v.w / factor
      const newH = v.h / factor

      // Clamp zoom
      const newZoom = intrinsic.current.w / newW
      if (newZoom < MIN_ZOOM || newZoom > MAX_ZOOM) return

      // Adjust origin so cursor stays on the same SVG point
      const newX = svgX - fx * newW
      const newY = svgY - fy * newH

      view.current = { x: newX, y: newY, w: newW, h: newH }
      applyViewBox(view.current)

      // Debounce display sync
      clearTimeout((onWheel as any)._t)
      ;(onWheel as any)._t = setTimeout(syncDisplay, 120)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyViewBox, syncDisplay])

  // ── Drag pan ────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    dragging.current = true
    dragStart.current = {
      px: e.clientX,
      py: e.clientY,
      vx: view.current.x,
      vy: view.current.y,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    ;(e.currentTarget as HTMLElement).style.cursor = 'grabbing'
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return

    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()

    // Convert pixel drag distance to SVG coordinate delta
    const v = view.current
    const dxSvg = ((e.clientX - dragStart.current.px) / rect.width) * v.w
    const dySvg = ((e.clientY - dragStart.current.py) / rect.height) * v.h

    // Pan = move viewBox origin in opposite direction of drag
    view.current = {
      ...v,
      x: dragStart.current.vx - dxSvg,
      y: dragStart.current.vy - dySvg,
    }
    applyViewBox(view.current)
  }, [applyViewBox])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    }
    ;(e.currentTarget as HTMLElement).style.cursor = 'grab'
    dragging.current = false
    syncDisplay()
  }, [syncDisplay])

  // ── Animated fit-to-view (double-click / reset) ────────
  const animateToView = useCallback((target: ViewRect) => {
    cancelAnimationFrame(animFrame.current)
    const start = { ...view.current }
    const t0 = performance.now()

    const tick = (now: number) => {
      const elapsed = now - t0
      // Ease-out cubic
      const t = Math.min(elapsed / FIT_ANIM_MS, 1)
      const ease = 1 - Math.pow(1 - t, 3)

      view.current = {
        x: start.x + (target.x - start.x) * ease,
        y: start.y + (target.y - start.y) * ease,
        w: start.w + (target.w - start.w) * ease,
        h: start.h + (target.h - start.h) * ease,
      }
      applyViewBox(view.current)

      if (t < 1) {
        animFrame.current = requestAnimationFrame(tick)
      } else {
        syncDisplay()
      }
    }
    animFrame.current = requestAnimationFrame(tick)
  }, [applyViewBox, syncDisplay])

  const handleReset = useCallback(() => {
    const i = intrinsic.current
    animateToView({ x: 0, y: 0, w: i.w, h: i.h })
  }, [animateToView])

  // Cleanup animation on unmount
  useEffect(() => () => cancelAnimationFrame(animFrame.current), [])

  return (
    <div className="relative">
      {/* Viewport — clips content, captures all events */}
      <div
        ref={containerRef}
        className="overflow-hidden touch-none select-none"
        style={{ cursor: 'grab', maxHeight: 500 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={handleReset}
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />

      {/* Zoom badge — bottom-right */}
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
          {Math.round(displayZoom * 100)}%
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
        <span>double-click fit</span>
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
