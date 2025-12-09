/**
 * Layer System v2 Testbed
 *
 * Validates the Atom-as-State layer system:
 * - useLayer hook for registration/unregistration
 * - useLayerStyle for computed CSS
 * - useLayerOps for bound operations
 * - LayerProvider context integration
 *
 * Features interactive VersionBadge with star animation microinteraction
 * and React 19 native View Transitions for version switching.
 *
 * @hypothesis
 * H1: useLayer registers layer on mount, unregisters on unmount
 * H2: useLayerStyle computes correct CSS from layer instance
 * H3: useLayerOps operations update layer state reactively
 * H4: Multiple layers maintain independent z-index ordering
 * H5: bringToFront/sendToBack algorithms produce correct z-index gaps
 */

import { useState, useRef, useCallback, startTransition } from "react"
import { gsap } from "gsap"
import {
  LayerProvider,
  useLayer,
  useExistingLayer,
  useGlobalLayerOps,
  getAllLayers,
  getSortedLayers,
  resetAllLayers,
  type LayerInstance,
} from "@/lib/layers/v2"
import {
  TestbedHeader,
  SectionLabel,
  TestCard,
  Button,
  StatusIndicator,
  ValueDisplay,
  HypothesisSection,
  HypothesisSummary,
  type ValidationStatus,
} from "./shared"

// ─────────────────────────────────────────────────────────────
// Hypothesis Manifest
// ─────────────────────────────────────────────────────────────

interface LayerHypothesis {
  readonly id: string
  readonly title: string
  readonly claim: string
  readonly test: string
  status: ValidationStatus
  evidence?: string
}

const HYPOTHESES: LayerHypothesis[] = [
  {
    id: "LY-H1",
    title: "Layer Registration",
    claim: "useLayer registers layer on mount with generated ID",
    test: "Mount component → verify layer in registry with unique ID",
    status: "pending",
  },
  {
    id: "LY-H2",
    title: "Layer Unregistration",
    claim: "Layer removed from registry on unmount",
    test: "Unmount component → verify layer absent from registry",
    status: "pending",
  },
  {
    id: "LY-H3",
    title: "Style Computation",
    claim: "useLayerStyle produces correct CSS from layer state",
    test: "Create layer with zIndex:50, absolute → verify style object",
    status: "pending",
  },
  {
    id: "LY-H4",
    title: "Operations Bound",
    claim: "useLayerOps returns functions bound to layer ID",
    test: "Call ops.setVisible(false) → verify layer.visible === false",
    status: "pending",
  },
  {
    id: "LY-H5",
    title: "Z-Index Gap Algorithm",
    claim: "bringToFront adds +10 gap, sendToBack adds -10 gap",
    test: "Add layers at 0,10,20 → bringToFront(0) → verify z=30",
    status: "pending",
  },
  {
    id: "LY-H6",
    title: "Visibility Toggle",
    claim: "setVisible updates layer and style.visibility",
    test: "Toggle visibility → verify CSS visibility property",
    status: "pending",
  },
  {
    id: "LY-H7",
    title: "Pointer Events Mapping",
    claim: "pass-through maps to pointerEvents: none",
    test: "Create layer with pass-through → verify style.pointerEvents",
    status: "pending",
  },
  {
    id: "LY-H8",
    title: "Multiple Independent Layers",
    claim: "Each layer maintains independent state",
    test: "Create 3 layers → modify one → verify others unchanged",
    status: "pending",
  },
]

// ─────────────────────────────────────────────────────────────
// Interactive Version Badge with Star Animation
// ─────────────────────────────────────────────────────────────

interface InteractiveVersionBadgeProps {
  currentVersion: "v1" | "v2"
  onVersionChange: (version: "v1" | "v2") => void
}

function InteractiveVersionBadge({
  currentVersion,
  onVersionChange,
}: InteractiveVersionBadgeProps) {
  const containerRef = useRef<HTMLButtonElement>(null)
  const starRef = useRef<HTMLSpanElement>(null)

  const handleClick = useCallback(() => {
    const star = starRef.current
    const container = containerRef.current
    if (!star || !container) return

    // Get container dimensions for the star expansion
    const rect = container.getBoundingClientRect()
    const maxDimension = Math.max(rect.width, rect.height) * 2

    // Star animation: expand to encompass container and spin
    const tl = gsap.timeline({
      onComplete: () => {
        // Trigger version change inside startTransition for View Transitions
        startTransition(() => {
          onVersionChange(currentVersion === "v1" ? "v2" : "v1")
        })
        // Reset star after transition
        gsap.set(star, { scale: 1, rotation: 0, opacity: 1 })
      },
    })

    tl.to(star, {
      scale: maxDimension / 16, // 16px is base star size
      rotation: 360,
      opacity: 0.8,
      duration: 0.2,
      ease: "power2.out",
    }).to(star, {
      opacity: 0,
      duration: 0.1,
      ease: "power2.in",
    })
  }, [currentVersion, onVersionChange])

  const statusColors = {
    v1: "bg-neutral-800 text-neutral-400 border-neutral-600",
    v2: "bg-cyan-900/50 text-cyan-400 border-cyan-700",
  }

  return (
    <button
      ref={containerRef}
      onClick={handleClick}
      className={`relative px-3 py-1 font-mono rounded border overflow-hidden transition-colors hover:brightness-110 ${statusColors[currentVersion]}`}
      style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
    >
      <span className="relative z-10">
        {currentVersion.toUpperCase()}
        <span
          ref={starRef}
          className="inline-block ml-1 origin-center"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          ✦
        </span>
      </span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Demo Layer Component
// ─────────────────────────────────────────────────────────────

interface DemoLayerProps {
  name: string
  initialZIndex: number
  color: string
}

function DemoLayer({ name, initialZIndex, color }: DemoLayerProps) {
  const { id, style, ops, layer } = useLayer({
    name,
    initialZIndex,
    positionMode: "relative",
    pointerEvents: "auto",
  })

  // Layer registration is handled by useLayer hook automatically
  // No callback needed — query registry via getAllLayers() instead

  return (
    <div
      className="p-4 rounded-lg border"
      style={{
        ...style,
        backgroundColor: `${color}20`,
        borderColor: color,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span
            className="font-mono text-neutral-200"
            style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
          >
            {name}
          </span>
        </div>
        <span
          className="font-mono text-neutral-500"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          z:{layer?.zIndex ?? "—"}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant="ghost"
          onClick={ops.bringToFront}
          style={{ fontSize: "var(--tmnl-text-xs, 12px)", padding: "2px 8px" }}
        >
          ↑ Front
        </Button>
        <Button
          variant="ghost"
          onClick={ops.sendToBack}
          style={{ fontSize: "var(--tmnl-text-xs, 12px)", padding: "2px 8px" }}
        >
          ↓ Back
        </Button>
        <Button
          variant="ghost"
          onClick={() => ops.setVisible(!layer?.visible)}
          style={{ fontSize: "var(--tmnl-text-xs, 12px)", padding: "2px 8px" }}
        >
          {layer?.visible ? "👁 Hide" : "👁‍🗨 Show"}
        </Button>
      </div>

      <div
        className="mt-2 font-mono text-neutral-600"
        style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
      >
        ID: {id}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Layer Stack Visualizer
// ─────────────────────────────────────────────────────────────

function LayerStackVisualizer() {
  const [layers, setLayers] = useState<LayerInstance[]>([])
  const globalOps = useGlobalLayerOps()

  const refresh = useCallback(() => {
    setLayers(getSortedLayers())
  }, [])

  // Auto-refresh on mount
  useState(() => {
    refresh()
  })

  const colors = ["#22d3ee", "#fbbf24", "#a78bfa", "#f472b6", "#34d399"]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span
          className="font-mono text-neutral-400"
          style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
        >
          Stack ({layers.length} layers)
        </span>
        <Button
          variant="ghost"
          onClick={refresh}
          style={{ fontSize: "var(--tmnl-text-xs, 12px)", padding: "2px 8px" }}
        >
          Refresh
        </Button>
      </div>

      {layers.length === 0 ? (
        <div
          className="text-neutral-600 font-mono text-center py-4"
          style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
        >
          No layers registered
        </div>
      ) : (
        <div className="space-y-1">
          {layers.map((layer, i) => (
            <div
              key={layer.id}
              className="flex items-center gap-3 p-2 bg-neutral-900/50 rounded border border-neutral-800"
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <span
                className="font-mono text-neutral-300 flex-1"
                style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
              >
                {layer.name}
              </span>
              <span
                className="font-mono text-cyan-400"
                style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
              >
                z:{layer.zIndex}
              </span>
              <StatusIndicator
                status={layer.visible ? "success" : "neutral"}
                label={layer.visible ? "VIS" : "HID"}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Registry Display (queries registry directly)
// ─────────────────────────────────────────────────────────────

function RegistryDisplay() {
  const [layers, setLayers] = useState<LayerInstance[]>([])

  const refresh = useCallback(() => {
    setLayers(getAllLayers())
  }, [])

  // Auto-refresh on mount
  useState(() => {
    refresh()
  })

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span
          className="font-mono text-neutral-500"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          {layers.length} layers in registry
        </span>
        <Button
          variant="ghost"
          onClick={refresh}
          style={{ fontSize: "var(--tmnl-text-xs, 12px)", padding: "2px 8px" }}
        >
          Refresh
        </Button>
      </div>
      <div className="space-y-1">
        {layers.length === 0 ? (
          <div
            className="text-neutral-600 font-mono text-center py-2"
            style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
          >
            No layers registered
          </div>
        ) : (
          layers.map((layer) => (
            <div
              key={layer.id}
              className="font-mono text-cyan-400 p-2 bg-neutral-900/50 rounded flex justify-between"
              style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
            >
              <span className="text-neutral-400 truncate">{layer.id}</span>
              <span className="text-cyan-400">{layer.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// V1 Content (Legacy Placeholder)
// ─────────────────────────────────────────────────────────────

function V1Content() {
  return (
    <div className="space-y-6">
      <TestCard
        title="Layer System v1 (Legacy)"
        description="HOC-based layer wrapping with implicit registration"
      >
        <div className="p-8 text-center">
          <div
            className="font-mono text-neutral-500 mb-4"
            style={{ fontSize: "var(--tmnl-text-lg, 18px)" }}
          >
            v1 Implementation
          </div>
          <p
            className="text-neutral-600"
            style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
          >
            The v1 layer system used withLayering HOC for implicit registration.
            <br />
            Click the version badge to see the v2 Atom-as-State implementation.
          </p>
        </div>
      </TestCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// V2 Content (Atom-as-State)
// ─────────────────────────────────────────────────────────────

interface V2ContentProps {
  hypotheses: LayerHypothesis[]
  setHypotheses: React.Dispatch<React.SetStateAction<LayerHypothesis[]>>
}

function V2Content({ hypotheses, setHypotheses }: V2ContentProps) {
  const [showLayer3, setShowLayer3] = useState(true)

  // Validate H1 on mount — check if layers exist in registry
  useState(() => {
    setTimeout(() => {
      const layers = getAllLayers()
      if (layers.length > 0) {
        setHypotheses((prev) =>
          prev.map((h) =>
            h.id === "LY-H1" && h.status === "pending"
              ? { ...h, status: "validated" as ValidationStatus, evidence: `${layers.length} layers registered in registry` }
              : h
          )
        )
      }
    }, 100)
  })

  const handleToggleLayer3 = useCallback(() => {
    const wasShowing = showLayer3
    setShowLayer3(!showLayer3)

    // Validate H2 when hiding (unmounting)
    if (wasShowing) {
      setTimeout(() => {
        const layers = getAllLayers()
        const layer3Exists = layers.some((l) => l.name === "Layer C")
        if (!layer3Exists) {
          setHypotheses((prev) =>
            prev.map((h) =>
              h.id === "LY-H2" && h.status === "pending"
                ? { ...h, status: "validated" as ValidationStatus, evidence: "Layer C removed from registry on unmount" }
                : h
            )
          )
        }
      }, 100)
    }
  }, [showLayer3, setHypotheses])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="space-y-6">
        <TestCard
          title="Interactive Layers"
          description="Each layer uses useLayer hook for registration and operations"
        >
          <div className="space-y-3">
            <DemoLayer
              name="Layer A"
              initialZIndex={0}
              color="#22d3ee"
            />
            <DemoLayer
              name="Layer B"
              initialZIndex={10}
              color="#fbbf24"
            />
            {showLayer3 && (
              <DemoLayer
                name="Layer C"
                initialZIndex={20}
                color="#a78bfa"
              />
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={handleToggleLayer3}>
              {showLayer3 ? "Unmount Layer C" : "Mount Layer C"}
            </Button>
            <Button
              variant="danger"
              onClick={resetAllLayers}
            >
              Reset All
            </Button>
          </div>
        </TestCard>

        <TestCard
          title="Layer Stack"
          description="Real-time view of registered layers sorted by z-index"
        >
          <LayerStackVisualizer />
        </TestCard>
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        <TestCard
          title="Hypothesis Validation"
          description="Live validation of Layer System v2 claims"
        >
          <HypothesisSummary
            hypotheses={hypotheses.map((h) => ({
              id: h.id,
              title: h.title,
              status: h.status,
            }))}
          />
        </TestCard>

        <TestCard
          title="Registry State"
          description="Layer IDs from getAllLayers() — no setState bridge"
        >
          <RegistryDisplay />
        </TestCard>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Testbed Component (Inner)
// ─────────────────────────────────────────────────────────────

function LayerV2TestbedInner() {
  const [currentVersion, setCurrentVersion] = useState<"v1" | "v2">("v2")
  const [hypotheses, setHypotheses] = useState<LayerHypothesis[]>(HYPOTHESES)

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-6xl mx-auto">
        <TestbedHeader
          title="Layer System"
          subtitle="Atom-as-State layer management with hook-based style injection"
          actions={
            <InteractiveVersionBadge
              currentVersion={currentVersion}
              onVersionChange={setCurrentVersion}
            />
          }
        />

        {/* Version Status */}
        <div className="mb-6 flex items-center gap-4">
          <StatusIndicator
            status={currentVersion === "v2" ? "success" : "neutral"}
            label={currentVersion === "v2" ? "ATOM-AS-STATE" : "LEGACY HOC"}
            pulse={currentVersion === "v2"}
          />
          <span
            className="font-mono text-neutral-500"
            style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
          >
            Click version badge to switch (with View Transition)
          </span>
        </div>

        {/* Content (View Transitions disabled pending canary verification) */}
        {currentVersion === "v1" ? (
          <V1Content />
        ) : (
          <V2Content hypotheses={hypotheses} setHypotheses={setHypotheses} />
        )}

        {/* Hypothesis Details */}
        {currentVersion === "v2" && (
          <div className="mt-8">
            <SectionLabel variant="gradient">
              Hypothesis Manifest ({hypotheses.length} Hypotheses)
            </SectionLabel>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hypotheses.map((h) => (
                <HypothesisSection
                  key={h.id}
                  id={h.id}
                  title={h.title}
                  description={h.claim}
                  status={h.status}
                  defaultExpanded={false}
                >
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span
                        className="font-mono text-neutral-500 shrink-0"
                        style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
                      >
                        TEST:
                      </span>
                      <span
                        className="font-mono text-neutral-300"
                        style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
                      >
                        {h.test}
                      </span>
                    </div>
                    {h.evidence && (
                      <div className="flex items-start gap-2">
                        <span
                          className="font-mono text-green-500 shrink-0"
                          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
                        >
                          EVIDENCE:
                        </span>
                        <span
                          className="font-mono text-green-300"
                          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
                        >
                          {h.evidence}
                        </span>
                      </div>
                    )}
                  </div>
                </HypothesisSection>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Public Export
// ─────────────────────────────────────────────────────────────

/**
 * Layer System v2 Testbed
 *
 * Wrapped with LayerProvider for registry context.
 */
export function LayerV2Testbed() {
  return (
    <LayerProvider>
      <LayerV2TestbedInner />
    </LayerProvider>
  )
}
