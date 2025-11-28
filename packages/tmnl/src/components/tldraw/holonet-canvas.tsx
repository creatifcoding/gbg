"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Tldraw, useEditor, type TLComponents } from "tldraw"
import "tldraw/tldraw.css"
import { holonetShapeUtils, type ChartWidgetShape, type ControllerWidgetShape } from "./shapes"
import { SpawnToolbar, ToolsToolbar, ZoomToolbar, StatusOverlay, ActionsToolbar, MiniMap } from "./tactical-toolbar"
import { cloneMetadataWithValues } from "@/lib/types"

// Hide all default tldraw UI
const customComponents: TLComponents = {
  Toolbar: null,
  MainMenu: null,
  PageMenu: null,
  NavigationPanel: null,
  HelpMenu: null,
  ZoomMenu: null,
  ActionsMenu: null,
  QuickActions: null,
  ContextMenu: null,
  DebugMenu: null,
  DebugPanel: null,
  StylePanel: null,
  Minimap: null,
}

// ============================================
// DATA UPDATER
// Generates real-time chart data for all charts
// ============================================
function DataUpdater() {
  const editor = useEditor()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const chartShapes = editor.getCurrentPageShapes().filter((s) => s.type === "chart-widget") as ChartWidgetShape[]

      if (chartShapes.length > 0) {
        editor.run(
          () => {
            chartShapes.forEach((shape) => {
              const { amplitude = 50, frequency = 1 } = shape.props.parameters
              const time = Date.now() / 1000
              const baseValue = Math.sin(time * frequency) * 0.5 + 0.5
              const noise = Math.random() * 0.2 - 0.1
              const newValue = Math.floor((baseValue + noise) * amplitude) + (100 - amplitude) / 2

              const currentData = shape.props.chartData || []
              const newData = [...currentData, Math.max(5, Math.min(95, newValue))]
              if (newData.length > 24) newData.shift()

              editor.updateShape<ChartWidgetShape>({
                id: shape.id,
                type: "chart-widget",
                props: { chartData: newData },
              })
            })
          },
          { history: "ignore" },
        )
      }
    }, 800)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [editor])

  return null
}

// ============================================
// BINDING HANDLER
// Links controllers to charts via visitor pattern
// When both are selected, the controller binds to the chart
// ============================================
function BindingHandler() {
  const editor = useEditor()

  useEffect(() => {
    const handleSelectionChange = () => {
      const selectedIds = editor.getSelectedShapeIds()
      if (selectedIds.length !== 2) return

      const shapes = selectedIds.map((id) => editor.getShape(id)).filter(Boolean)
      const controller = shapes.find((s) => s?.type === "controller-widget") as ControllerWidgetShape | undefined
      const chart = shapes.find((s) => s?.type === "chart-widget") as ChartWidgetShape | undefined

      if (controller && chart) {
        // Visitor pattern: check if controller can control this chart
        const visitorId = controller.props.visitorId
        const canControl = visitorId.startsWith("controller")

        if (canControl) {
          // Clone metadata with current parameter values
          const metadata = cloneMetadataWithValues(chart.props.metadata, chart.props.parameters)

          // Hide glowColor if syncGlow is enabled
          if (metadata.parameters.syncGlow?.value) {
            metadata.parameters.glowColor.hidden = true
          }

          // Bind controller to chart
          editor.updateShape<ControllerWidgetShape>({
            id: controller.id,
            type: "controller-widget",
            props: {
              targetId: chart.id,
              targetMetadata: metadata,
            },
          })

          // Deselect to provide visual feedback
          editor.selectNone()
        }
      }
    }

    const unsubscribe = editor.store.listen(handleSelectionChange, {
      source: "user",
      scope: "document",
    })
    return () => unsubscribe()
  }, [editor])

  return null
}

// ============================================
// TACTICAL CANVAS UI
// Combines all UI overlays
// ============================================
function TacticalCanvasUI() {
  return (
    <>
      <DataUpdater />
      <BindingHandler />
      <ToolsToolbar />
      <SpawnToolbar />
      <ZoomToolbar />
      <StatusOverlay />
      <ActionsToolbar />
      <MiniMap />
    </>
  )
}

// ============================================
// MAIN CANVAS COMPONENT
// ============================================
interface HolonetCanvasProps {
  className?: string
}

export function HolonetCanvas({ className }: HolonetCanvasProps) {
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      setMounted(true)
    })
    return () => cancelAnimationFrame(timer)
  }, [])

  const handleMount = useCallback((editor: any) => {
    // Create initial shapes
    editor.createShape({
      type: "notes-widget",
      x: 80,
      y: 80,
      props: {
        title: "HOLONET_README",
        content:
          "// TACTICAL INTERFACE v2.1\n\n" +
          "// SPAWN widgets from bottom toolbar\n" +
          "// SELECT Chart + Controller to LINK\n" +
          "// Controllers modify chart parameters\n" +
          "// Double-click to edit notes/terminal",
      },
    })

    editor.createShape({
      type: "chart-widget",
      x: 320,
      y: 80,
    })

    editor.createShape({
      type: "controller-widget",
      x: 320,
      y: 260,
    })
  }, [])

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{ background: "#030303", minHeight: "400px" }}
    >
      {mounted && (
        <Tldraw shapeUtils={holonetShapeUtils} onMount={handleMount} inferDarkMode components={customComponents} licenseKey="tldraw-2026-03-05/WyJzelY2SUtmSiIsWyIqIl0sMTYsIjIwMjYtMDMtMDUiXQ.O1deyIAW6mfzNKtWH9CbpiFNs2BKJQjYjao3Sd3TuhPVumjRs5U3PiFQS6aAsKv2zNXmKnsCgCkKNlF7PabU+A">
          <TacticalCanvasUI />
        </Tldraw>
      )}
      {!mounted && (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-neutral-700 animate-pulse" />
            Initializing Canvas...
          </div>
        </div>
      )}
    </div>
  )
}
