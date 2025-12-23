/**
 * KORI Testbed - Main Component
 *
 * Floating panel layout with:
 * - R3F canvas (main area)
 * - REPL panel (floating)
 * - Inspector panel (floating)
 * - Scenario runner panel (floating)
 *
 * @module
 */

import { useEffect, useCallback, useState, useRef, type ReactNode } from "react"

import { useStxData, useStx } from "@/lib/stx"
import {
  FloatingPanelProvider,
  FloatingPanel,
  FloatingDragOverlay,
  useFloatingPanel,
  registerPanel,
  unregisterPanel,
  getFloatingStx,
} from "@/lib/floating"
import { useSelector } from "@/lib/stx"
import type { DimensionConstraints } from "@/lib/floating/types"

import { getKoriTestbedStx, resetKoriTestbedStx } from "./kori-testbed-stx"
import { REPLPanel, InspectorPanel, ScenarioPanel } from "./panels"
import { EntityCanvas } from "./canvas"

// =============================================================================
// Types
// =============================================================================

interface ManagedPanelProps {
  id: string
  title: string
  initialPosition: { x: number; y: number }
  initialDimensions: { width: number; height: number }
  constraints?: DimensionConstraints
  show: boolean
  children: ReactNode
}

// =============================================================================
// Managed Panel Wrapper
// =============================================================================

function ManagedPanel({
  id,
  title,
  initialPosition,
  initialDimensions,
  constraints,
  show,
  children,
}: ManagedPanelProps) {
  const stx = getFloatingStx()
  const panelsMap = useSelector(stx.data.panels, (p) => p)
  const panel = panelsMap.get(id)

  useEffect(() => {
    if (show) {
      const existingPanel = getFloatingStx().data.panels.get().get(id)
      if (!existingPanel) {
        registerPanel({
          id,
          title,
          initialPosition,
          initialDimensions,
          constraints,
        })
      }
    } else {
      unregisterPanel(id)
    }

    return () => {
      if (show) {
        unregisterPanel(id)
      }
    }
  }, [show, id, title, initialPosition, initialDimensions, constraints])

  if (!show || !panel) {
    return null
  }

  return (
    <FloatingPanel id={id} title={title}>
      {children}
    </FloatingPanel>
  )
}

// =============================================================================
// Panel Definitions
// =============================================================================

interface PanelDef {
  id: string
  title: string
  x: number
  y: number
  w: number
  h: number
  key: "repl" | "inspector" | "scenario" | "canvas"
}

const PANEL_DEFS: PanelDef[] = [
  { id: "kori-repl", title: "REPL", x: 20, y: 80, w: 450, h: 320, key: "repl" },
  { id: "kori-inspector", title: "Inspector", x: 20, y: 420, w: 450, h: 300, key: "inspector" },
  { id: "kori-scenario", title: "Scenarios", x: 490, y: 80, w: 340, h: 400, key: "scenario" },
]

// =============================================================================
// Panel Toggle Button
// =============================================================================

interface ToggleButtonProps {
  label: string
  active: boolean
  onClick: () => void
}

function ToggleButton({ label, active, onClick }: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-2 py-1 rounded font-mono transition-colors
        ${
          active
            ? "bg-cyan-900/50 text-cyan-400 border border-cyan-700"
            : "text-neutral-600 hover:text-neutral-400 border border-transparent"
        }
      `}
      style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
    >
      {label}
    </button>
  )
}

// =============================================================================
// Header
// =============================================================================

function Header() {
  const testbed = getKoriTestbedStx()
  const { runEffect } = useStx(testbed)
  const panelVisibility = useStxData(testbed, (d) => d.panelVisibility.get())
  const entityCount = useStxData(testbed, (d) => d.entities.get().length)

  const togglePanel = (panel: keyof typeof panelVisibility) => {
    runEffect("togglePanel", panel)
  }

  return (
    <div className="fixed top-0 left-0 right-0 h-12 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-4 z-[200]">
      <div className="flex items-center gap-4">
        <span
          className="font-mono text-neutral-300"
          style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
        >
          KORI TESTBED
        </span>
        <span
          className="px-2 py-0.5 bg-cyan-900/30 text-cyan-400 rounded font-mono"
          style={{ fontSize: "10px" }}
        >
          ECS
        </span>
        <span
          className="text-neutral-500 font-mono"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          {entityCount} entities
        </span>
      </div>

      <div className="flex items-center gap-2">
        <ToggleButton
          label="REPL"
          active={panelVisibility.repl}
          onClick={() => togglePanel("repl")}
        />
        <ToggleButton
          label="Inspector"
          active={panelVisibility.inspector}
          onClick={() => togglePanel("inspector")}
        />
        <ToggleButton
          label="Scenarios"
          active={panelVisibility.scenario}
          onClick={() => togglePanel("scenario")}
        />
        <ToggleButton
          label="Canvas"
          active={panelVisibility.canvas}
          onClick={() => togglePanel("canvas")}
        />
      </div>

      <button
        onClick={() => runEffect("refreshEntities")}
        className="px-3 py-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded font-mono"
        style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
      >
        Refresh
      </button>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function KoriTestbed() {
  const testbed = getKoriTestbedStx()
  const { runEffect } = useStx(testbed)
  const panelVisibility = useStxData(testbed, (d) => d.panelVisibility.get())

  // Initialize world on mount
  useEffect(() => {
    runEffect("initWorld")
    runEffect("refreshEntities")

    return () => {
      resetKoriTestbedStx()
    }
  }, [runEffect])

  // Panel content map
  const panelContent: Record<string, ReactNode> = {
    "kori-repl": <REPLPanel />,
    "kori-inspector": <InspectorPanel />,
    "kori-scenario": <ScenarioPanel />,
  }

  return (
    <FloatingPanelProvider>
      <div className="min-h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
        <Header />

        {/* Main Canvas Area */}
        <div className="fixed inset-0 pt-12">
          {panelVisibility.canvas ? (
            <EntityCanvas />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-900">
              <span
                className="text-neutral-600 font-mono"
                style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
              >
                Canvas hidden. Click "Canvas" to show.
              </span>
            </div>
          )}
        </div>

        {/* Floating Panels */}
        {PANEL_DEFS.map((p) => (
          <ManagedPanel
            key={p.id}
            id={p.id}
            title={p.title}
            initialPosition={{ x: p.x, y: p.y }}
            initialDimensions={{ width: p.w, height: p.h }}
            show={panelVisibility[p.key]}
          >
            {panelContent[p.id]}
          </ManagedPanel>
        ))}

        {/* Drag Overlay */}
        <FloatingDragOverlay style="ghost" />

        {/* Keyboard Shortcuts Help */}
        <div
          className="fixed bottom-4 right-4 bg-neutral-900/80 border border-neutral-800 rounded p-2 z-50"
          style={{ fontSize: "10px" }}
        >
          <div className="text-neutral-500 font-mono">
            REPL: :help • Ctrl+L clear
          </div>
        </div>
      </div>
    </FloatingPanelProvider>
  )
}

export default KoriTestbed
