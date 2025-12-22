/**
 * DiagramViewer
 *
 * Renders Mermaid diagrams with heavy TMNL styling.
 * Full interactivity: wheel zoom, drag pan, keyboard controls.
 *
 * @module docs/diagrams
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import mermaid from "mermaid"
import type { DiagramEntry } from "./registry"

// =============================================================================
// TMNL Mermaid Theme — Heavy Stylization
// =============================================================================

/**
 * TMNL Color Palette for diagrams
 */
const TMNL_DIAGRAM_COLORS = {
  // Backgrounds
  bg: {
    primary: "#030303",
    secondary: "#0a0a0a",
    tertiary: "#111111",
    elevated: "#171717",
  },
  // Accents
  accent: {
    cyan: "#14b8a6",
    cyanGlow: "#2dd4bf",
    cyanMuted: "#0d9488",
    emerald: "#10b981",
    amber: "#f59e0b",
    rose: "#f43f5e",
  },
  // Text
  text: {
    primary: "#f5f5f5",
    secondary: "#a3a3a3",
    muted: "#525252",
    inverse: "#030303",
  },
  // Lines
  line: {
    primary: "#404040",
    secondary: "#262626",
    accent: "#14b8a6",
  },
} as const

/**
 * TMNL themeCSS — Raw CSS injected into Mermaid SVG
 * This is the proper way to apply custom styles per Mermaid docs
 */
const TMNL_THEME_CSS = `
  /* ══════════════════════════════════════════════════════════════════════════
   * TMNL Mermaid Theme — Q-Branch Brutalist Aesthetic
   * ══════════════════════════════════════════════════════════════════════════ */

  /* === Typography === */
  * {
    font-family: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace !important;
  }

  text {
    text-rendering: optimizeLegibility !important;
    -webkit-font-smoothing: antialiased !important;
  }

  /* === Flowchart Nodes === */
  .node rect,
  .node circle,
  .node ellipse,
  .node polygon,
  .node path {
    fill: ${TMNL_DIAGRAM_COLORS.bg.elevated} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke-width: 2px !important;
    filter: drop-shadow(0 0 8px ${TMNL_DIAGRAM_COLORS.accent.cyan}40) !important;
  }

  .node .label {
    color: ${TMNL_DIAGRAM_COLORS.text.primary} !important;
    fill: ${TMNL_DIAGRAM_COLORS.text.primary} !important;
  }

  /* Primary nodes (decision, etc) */
  .node.default > rect,
  .node.default > polygon {
    fill: ${TMNL_DIAGRAM_COLORS.bg.elevated} !important;
  }

  /* === Flowchart Edges === */
  .edgePath .path {
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke-width: 2px !important;
    fill: none !important;
  }

  .edgePath marker path {
    fill: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
  }

  /* Arrowheads */
  .arrowheadPath {
    fill: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
  }

  marker path {
    fill: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke: none !important;
  }

  .edgeLabel {
    background-color: ${TMNL_DIAGRAM_COLORS.bg.primary} !important;
    color: ${TMNL_DIAGRAM_COLORS.text.secondary} !important;
  }

  .edgeLabel rect {
    fill: ${TMNL_DIAGRAM_COLORS.bg.primary} !important;
    opacity: 0.9 !important;
  }

  .edgeLabel span {
    color: ${TMNL_DIAGRAM_COLORS.text.secondary} !important;
    background: ${TMNL_DIAGRAM_COLORS.bg.primary} !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
  }

  /* === Subgraphs / Clusters === */
  .cluster rect {
    fill: ${TMNL_DIAGRAM_COLORS.bg.tertiary} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.line.primary} !important;
    stroke-width: 1px !important;
    rx: 8 !important;
    ry: 8 !important;
  }

  .cluster span {
    color: ${TMNL_DIAGRAM_COLORS.text.secondary} !important;
  }

  .cluster-label .nodeLabel {
    color: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    fill: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    font-weight: 600 !important;
  }

  /* === Sequence Diagram === */
  .actor {
    fill: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyanGlow} !important;
    stroke-width: 2px !important;
    filter: drop-shadow(0 0 12px ${TMNL_DIAGRAM_COLORS.accent.cyan}50) !important;
  }

  .actor-man circle,
  .actor-man line {
    fill: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyanGlow} !important;
  }

  text.actor > tspan {
    fill: ${TMNL_DIAGRAM_COLORS.text.inverse} !important;
    font-weight: 600 !important;
  }

  .actor-line {
    stroke: ${TMNL_DIAGRAM_COLORS.line.secondary} !important;
    stroke-dasharray: 4, 4 !important;
    stroke-width: 1px !important;
  }

  .messageLine0,
  .messageLine1 {
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke-width: 1.5px !important;
  }

  .messageText {
    fill: ${TMNL_DIAGRAM_COLORS.text.primary} !important;
    font-size: 12px !important;
  }

  .sequenceNumber {
    fill: ${TMNL_DIAGRAM_COLORS.text.inverse} !important;
    font-weight: 700 !important;
  }

  .labelBox {
    fill: ${TMNL_DIAGRAM_COLORS.bg.tertiary} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.line.primary} !important;
    rx: 6 !important;
    ry: 6 !important;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4)) !important;
  }

  .labelText,
  .labelText > tspan {
    fill: ${TMNL_DIAGRAM_COLORS.text.secondary} !important;
  }

  .loopLine {
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyanMuted} !important;
    stroke-dasharray: 6, 3 !important;
    stroke-width: 1px !important;
  }

  .loopText,
  .loopText > tspan {
    fill: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    font-weight: 500 !important;
  }

  .activation0,
  .activation1,
  .activation2 {
    fill: ${TMNL_DIAGRAM_COLORS.accent.cyan}18 !important;
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyanGlow} !important;
    stroke-width: 1px !important;
  }

  /* Notes */
  .note {
    fill: ${TMNL_DIAGRAM_COLORS.bg.elevated} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyanMuted} !important;
    stroke-width: 1px !important;
    rx: 4 !important;
    ry: 4 !important;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5)) !important;
  }

  .noteText,
  .noteText > tspan {
    fill: ${TMNL_DIAGRAM_COLORS.text.secondary} !important;
    font-size: 12px !important;
  }

  /* === State Diagram === */
  .statediagram-state rect {
    fill: ${TMNL_DIAGRAM_COLORS.bg.elevated} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke-width: 2px !important;
    rx: 8 !important;
    ry: 8 !important;
    filter: drop-shadow(0 0 8px ${TMNL_DIAGRAM_COLORS.accent.cyan}30) !important;
  }

  .stateGroup .state-title {
    fill: ${TMNL_DIAGRAM_COLORS.text.primary} !important;
    font-weight: 600 !important;
    letter-spacing: 0.5px !important;
  }

  .statediagram-state .nodeLabel {
    color: ${TMNL_DIAGRAM_COLORS.text.primary} !important;
  }

  .statediagram-cluster rect {
    fill: ${TMNL_DIAGRAM_COLORS.bg.tertiary} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.line.primary} !important;
  }

  .transition {
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke-width: 1.5px !important;
  }

  /* Start/End nodes */
  .start-state,
  .end-state-outer,
  .end-state-inner {
    fill: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyanGlow} !important;
  }

  /* === ER Diagram === */
  .entityBox {
    fill: ${TMNL_DIAGRAM_COLORS.bg.elevated} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke-width: 2px !important;
    rx: 6 !important;
    ry: 6 !important;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4)) !important;
  }

  .entityLabel {
    fill: ${TMNL_DIAGRAM_COLORS.text.primary} !important;
    font-weight: 600 !important;
  }

  .attributeBoxOdd,
  .attributeBoxEven {
    fill: ${TMNL_DIAGRAM_COLORS.bg.tertiary} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.line.secondary} !important;
  }

  .relationshipLine {
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke-width: 1.5px !important;
  }

  .relationshipLabel {
    fill: ${TMNL_DIAGRAM_COLORS.text.secondary} !important;
    font-size: 11px !important;
  }

  /* === Class Diagram === */
  .classGroup rect {
    fill: ${TMNL_DIAGRAM_COLORS.bg.elevated} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke-width: 2px !important;
  }

  .classGroup .title {
    fill: ${TMNL_DIAGRAM_COLORS.text.primary} !important;
    font-weight: 600 !important;
  }

  .classGroup line {
    stroke: ${TMNL_DIAGRAM_COLORS.line.primary} !important;
  }

  .relation {
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
    stroke-width: 1.5px !important;
  }

  /* === Pie Chart === */
  .pieCircle {
    stroke: ${TMNL_DIAGRAM_COLORS.bg.primary} !important;
    stroke-width: 2px !important;
  }

  .pieTitleText {
    fill: ${TMNL_DIAGRAM_COLORS.text.primary} !important;
    font-weight: 600 !important;
  }

  .slice {
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)) !important;
  }

  /* === Gantt Chart === */
  .grid .tick line {
    stroke: ${TMNL_DIAGRAM_COLORS.line.secondary} !important;
  }

  .grid path {
    stroke: ${TMNL_DIAGRAM_COLORS.line.secondary} !important;
  }

  .taskText {
    fill: ${TMNL_DIAGRAM_COLORS.text.primary} !important;
  }

  .taskTextOutsideRight,
  .taskTextOutsideLeft {
    fill: ${TMNL_DIAGRAM_COLORS.text.secondary} !important;
  }

  .sectionTitle {
    fill: ${TMNL_DIAGRAM_COLORS.text.primary} !important;
    font-weight: 600 !important;
  }

  /* === Git Graph === */
  .commit-id,
  .commit-msg {
    fill: ${TMNL_DIAGRAM_COLORS.text.secondary} !important;
  }

  .branch-label {
    fill: ${TMNL_DIAGRAM_COLORS.text.primary} !important;
    font-weight: 600 !important;
  }

  /* === Journey Diagram === */
  .journey-section {
    fill: ${TMNL_DIAGRAM_COLORS.bg.tertiary} !important;
  }

  .journey-task {
    fill: ${TMNL_DIAGRAM_COLORS.bg.elevated} !important;
    stroke: ${TMNL_DIAGRAM_COLORS.accent.cyan} !important;
  }

  /* === General Shape Rendering === */
  rect, path, line, circle, ellipse, polygon {
    shape-rendering: geometricPrecision !important;
  }

  /* === Link Hover States === */
  .edgePath:hover .path {
    stroke-width: 3px !important;
    filter: drop-shadow(0 0 4px ${TMNL_DIAGRAM_COLORS.accent.cyanGlow}) !important;
  }

  /* === Title === */
  .titleText {
    fill: ${TMNL_DIAGRAM_COLORS.text.primary} !important;
    font-size: 16px !important;
    font-weight: 600 !important;
  }
`

/**
 * Heavy TMNL theme configuration for Mermaid
 * Using theme: 'base' as recommended - the only theme that supports full themeVariables customization
 */
const TMNL_MERMAID_CONFIG = {
  theme: "base" as const,
  themeVariables: {
    // === Dark Mode Foundation ===
    darkMode: true,
    background: TMNL_DIAGRAM_COLORS.bg.primary,
    mainBkg: TMNL_DIAGRAM_COLORS.bg.elevated,
    secondBkg: TMNL_DIAGRAM_COLORS.bg.tertiary,

    // === Typography ===
    fontFamily: "'SF Mono', 'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace",
    fontSize: "14px",
    textColor: TMNL_DIAGRAM_COLORS.text.primary,
    primaryTextColor: TMNL_DIAGRAM_COLORS.text.primary,
    secondaryTextColor: TMNL_DIAGRAM_COLORS.text.secondary,
    tertiaryTextColor: TMNL_DIAGRAM_COLORS.text.muted,

    // === Primary Colors (Cyan) ===
    primaryColor: TMNL_DIAGRAM_COLORS.bg.elevated,
    primaryBorderColor: TMNL_DIAGRAM_COLORS.accent.cyan,

    // === Secondary Colors (Emerald) ===
    secondaryColor: TMNL_DIAGRAM_COLORS.bg.tertiary,
    secondaryBorderColor: TMNL_DIAGRAM_COLORS.accent.emerald,

    // === Tertiary Colors (Amber) ===
    tertiaryColor: TMNL_DIAGRAM_COLORS.bg.secondary,
    tertiaryBorderColor: TMNL_DIAGRAM_COLORS.accent.amber,

    // === Lines ===
    lineColor: TMNL_DIAGRAM_COLORS.accent.cyan,

    // === Notes ===
    noteBkgColor: TMNL_DIAGRAM_COLORS.bg.elevated,
    noteTextColor: TMNL_DIAGRAM_COLORS.text.secondary,
    noteBorderColor: TMNL_DIAGRAM_COLORS.accent.cyanMuted,

    // === Sequence Diagram ===
    actorBkg: TMNL_DIAGRAM_COLORS.accent.cyan,
    actorTextColor: TMNL_DIAGRAM_COLORS.text.inverse,
    actorBorder: TMNL_DIAGRAM_COLORS.accent.cyanGlow,
    actorLineColor: TMNL_DIAGRAM_COLORS.line.secondary,
    signalColor: TMNL_DIAGRAM_COLORS.accent.cyan,
    signalTextColor: TMNL_DIAGRAM_COLORS.text.primary,
    labelBoxBkgColor: TMNL_DIAGRAM_COLORS.bg.tertiary,
    labelBoxBorderColor: TMNL_DIAGRAM_COLORS.line.primary,
    labelTextColor: TMNL_DIAGRAM_COLORS.text.secondary,
    loopTextColor: TMNL_DIAGRAM_COLORS.accent.cyan,
    activationBorderColor: TMNL_DIAGRAM_COLORS.accent.cyanGlow,
    activationBkgColor: `${TMNL_DIAGRAM_COLORS.accent.cyan}18`,
    sequenceNumberColor: TMNL_DIAGRAM_COLORS.text.inverse,

    // === State Diagram ===
    labelColor: TMNL_DIAGRAM_COLORS.text.primary,
    altBackground: TMNL_DIAGRAM_COLORS.bg.tertiary,

    // === Flowchart ===
    nodeBorder: TMNL_DIAGRAM_COLORS.accent.cyan,
    nodeTextColor: TMNL_DIAGRAM_COLORS.text.primary,
    clusterBkg: TMNL_DIAGRAM_COLORS.bg.tertiary,
    clusterBorder: TMNL_DIAGRAM_COLORS.line.primary,
    defaultLinkColor: TMNL_DIAGRAM_COLORS.accent.cyan,
    titleColor: TMNL_DIAGRAM_COLORS.text.primary,
    edgeLabelBackground: TMNL_DIAGRAM_COLORS.bg.primary,

    // === Error States ===
    errorBkgColor: TMNL_DIAGRAM_COLORS.accent.rose,
    errorTextColor: TMNL_DIAGRAM_COLORS.text.primary,

    // === Pie Chart ===
    pie1: TMNL_DIAGRAM_COLORS.accent.cyan,
    pie2: TMNL_DIAGRAM_COLORS.accent.emerald,
    pie3: TMNL_DIAGRAM_COLORS.accent.amber,
    pie4: TMNL_DIAGRAM_COLORS.accent.rose,
    pie5: "#8b5cf6", // violet
    pie6: "#ec4899", // pink
    pie7: "#06b6d4", // cyan-500
    pie8: "#84cc16", // lime
  },
  // === themeCSS — Raw CSS injection (proper Mermaid API) ===
  themeCSS: TMNL_THEME_CSS,
  // === Diagram-specific configurations ===
  sequence: {
    diagramMarginX: 80,
    diagramMarginY: 40,
    actorMargin: 100,
    width: 200,
    height: 65,
    boxMargin: 15,
    boxTextMargin: 8,
    noteMargin: 15,
    messageMargin: 50,
    mirrorActors: false,
    bottomMarginAdj: 5,
    useMaxWidth: false,
    rightAngles: false,
    showSequenceNumbers: true,
    wrap: true,
    wrapPadding: 15,
  },
  state: {
    dividerMargin: 15,
    sizeUnit: 8,
    padding: 12,
    textHeight: 12,
    titleShift: -20,
    noteMargin: 15,
    forkWidth: 80,
    forkHeight: 10,
    miniPadding: 4,
    fontSizeFactor: 5.5,
    fontSize: 14,
    labelHeight: 20,
    radius: 8,
  },
  er: {
    diagramPadding: 30,
    layoutDirection: "TB",
    minEntityWidth: 120,
    minEntityHeight: 80,
    entityPadding: 20,
    stroke: TMNL_DIAGRAM_COLORS.line.primary,
    fill: TMNL_DIAGRAM_COLORS.bg.elevated,
    fontSize: 13,
    useMaxWidth: false,
  },
  flowchart: {
    diagramPadding: 20,
    htmlLabels: true,
    nodeSpacing: 60,
    rankSpacing: 80,
    curve: "basis",
    padding: 20,
  },
}

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  ...TMNL_MERMAID_CONFIG,
  securityLevel: "loose",
})

// =============================================================================
// Types
// =============================================================================

export interface DiagramViewerProps {
  diagram: DiagramEntry
  className?: string
  showSource?: boolean
}

interface ViewState {
  scale: number
  translateX: number
  translateY: number
}

// =============================================================================
// Constants
// =============================================================================

const MIN_SCALE = 0.1
const MAX_SCALE = 5
const ZOOM_SENSITIVITY = 0.002
const ZOOM_STEP = 0.25

// =============================================================================
// Component
// =============================================================================

export function DiagramViewer({
  diagram,
  className = "",
  showSource = false,
}: DiagramViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [svgContent, setSvgContent] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [isSourceVisible, setIsSourceVisible] = useState(showSource)

  // View state for pan/zoom
  const [view, setView] = useState<ViewState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  })

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, translateX: 0, translateY: 0 })

  // Render mermaid diagram
  const renderDiagram = useCallback(async () => {
    if (!containerRef.current) return

    try {
      setError(null)
      const id = `mermaid-${diagram.id}-${Date.now()}`
      const { svg } = await mermaid.render(id, diagram.source)

      // themeCSS is properly configured in TMNL_MERMAID_CONFIG
      // No manual injection needed - Mermaid handles it
      setSvgContent(svg)

      // Reset view on new diagram
      setView({ scale: 1, translateX: 0, translateY: 0 })
    } catch (err) {
      console.error("Mermaid render error:", err)
      setError(err instanceof Error ? err.message : "Failed to render diagram")
    }
  }, [diagram.id, diagram.source])

  useEffect(() => {
    renderDiagram()
  }, [renderDiagram])

  // ─── Wheel Zoom ────────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()

    const rect = svgContainerRef.current?.getBoundingClientRect()
    if (!rect) return

    // Mouse position relative to container center
    const mouseX = e.clientX - rect.left - rect.width / 2
    const mouseY = e.clientY - rect.top - rect.height / 2

    // Calculate new scale
    const delta = -e.deltaY * ZOOM_SENSITIVITY
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * (1 + delta)))
    const scaleFactor = newScale / view.scale

    // Adjust translation to zoom toward mouse
    setView(prev => ({
      scale: newScale,
      translateX: mouseX - (mouseX - prev.translateX) * scaleFactor,
      translateY: mouseY - (mouseY - prev.translateY) * scaleFactor,
    }))
  }, [view.scale])

  // ─── Mouse Drag Pan ────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Left click only

    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      translateX: view.translateX,
      translateY: view.translateY,
    }
  }, [view.translateX, view.translateY])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return

    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y

    setView(prev => ({
      ...prev,
      translateX: dragStartRef.current.translateX + dx,
      translateY: dragStartRef.current.translateY + dy,
    }))
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Attach wheel listener
  useEffect(() => {
    const container = svgContainerRef.current
    if (!container) return

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [handleWheel])

  // ─── Zoom Controls ─────────────────────────────────────────────
  const zoomIn = useCallback(() => {
    setView(prev => ({
      ...prev,
      scale: Math.min(MAX_SCALE, prev.scale + ZOOM_STEP),
    }))
  }, [])

  const zoomOut = useCallback(() => {
    setView(prev => ({
      ...prev,
      scale: Math.max(MIN_SCALE, prev.scale - ZOOM_STEP),
    }))
  }, [])

  const resetView = useCallback(() => {
    setView({ scale: 1, translateX: 0, translateY: 0 })
  }, [])

  const fitToView = useCallback(() => {
    // Reset to default fit
    setView({ scale: 0.8, translateX: 0, translateY: 0 })
  }, [])

  // Transform style
  const transformStyle = useMemo(() => ({
    transform: `translate(${view.translateX}px, ${view.translateY}px) scale(${view.scale})`,
    transformOrigin: "center center",
    transition: isDragging ? "none" : "transform 150ms ease-out",
  }), [view, isDragging])

  return (
    <div className={`flex flex-col gap-4 h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-medium text-neutral-100 truncate">
            {diagram.title}
          </h2>
          <p className="text-sm text-neutral-500 mt-1 line-clamp-2">
            {diagram.description}
          </p>
          {diagram.relatedBeads && diagram.relatedBeads.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {diagram.relatedBeads.map((bead) => (
                <span
                  key={bead}
                  className="px-2 py-0.5 text-xs font-mono bg-teal-500/10 text-teal-400 rounded border border-teal-500/20"
                >
                  {bead}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-4">
          {/* Zoom controls */}
          <div className="flex items-center bg-neutral-900 rounded-lg border border-neutral-800 p-1">
            <button
              onClick={zoomOut}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
              title="Zoom out (scroll down)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
                <circle cx="11" cy="11" r="8" />
              </svg>
            </button>
            <button
              onClick={resetView}
              className="px-2 py-1 min-w-[52px] text-xs font-mono text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors text-center"
              title="Reset view"
            >
              {Math.round(view.scale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
              title="Zoom in (scroll up)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
                <circle cx="11" cy="11" r="8" />
              </svg>
            </button>
          </div>

          {/* Fit button */}
          <button
            onClick={fitToView}
            className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg border border-neutral-800 transition-colors"
            title="Fit to view"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>

          {/* Source toggle */}
          <button
            onClick={() => setIsSourceVisible(!isSourceVisible)}
            className={`p-2 rounded-lg border transition-colors ${
              isSourceVisible
                ? "text-teal-400 bg-teal-500/10 border-teal-500/30"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border-neutral-800"
            }`}
            title={isSourceVisible ? "Hide source" : "Show source"}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Diagram Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden rounded-xl border border-neutral-800 bg-[#030303]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(20, 184, 166, 0.03) 0%, transparent 50%),
            linear-gradient(rgba(20, 20, 20, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20, 20, 20, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 20px 20px, 20px 20px",
        }}
      >
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span className="font-mono text-sm">{error}</span>
            </div>
          </div>
        ) : (
          <div
            ref={svgContainerRef}
            className="absolute inset-0 flex items-center justify-center select-none"
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              style={transformStyle}
              className="pointer-events-none"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>
        )}

        {/* Zoom hint overlay */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 text-xs text-neutral-600 pointer-events-none">
          <kbd className="px-1.5 py-0.5 bg-neutral-900 rounded border border-neutral-800 font-mono">Scroll</kbd>
          <span>to zoom</span>
          <span className="mx-1">•</span>
          <kbd className="px-1.5 py-0.5 bg-neutral-900 rounded border border-neutral-800 font-mono">Drag</kbd>
          <span>to pan</span>
        </div>

        {/* Mini position indicator */}
        <div className="absolute bottom-4 right-4 px-2 py-1 bg-neutral-900/80 rounded border border-neutral-800 text-xs font-mono text-neutral-500">
          {view.translateX > 0 ? "+" : ""}{Math.round(view.translateX)}, {view.translateY > 0 ? "+" : ""}{Math.round(view.translateY)}
        </div>
      </div>

      {/* Source code panel */}
      {isSourceVisible && (
        <div className="shrink-0 max-h-64 bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-800/50 border-b border-neutral-800">
            <span className="text-xs font-mono text-neutral-500">Mermaid Source</span>
            <button
              onClick={() => navigator.clipboard.writeText(diagram.source)}
              className="px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 rounded transition-colors"
            >
              Copy
            </button>
          </div>
          <pre className="p-4 text-sm font-mono text-neutral-400 overflow-auto max-h-48">
            {diagram.source}
          </pre>
        </div>
      )}
    </div>
  )
}

export default DiagramViewer
