import type React from "react"

import { track, useEditor } from "tldraw"
import {
  Activity,
  FileText,
  Sliders,
  Terminal,
  Plus,
  Minus,
  Maximize2,
  Grid3X3,
  MousePointer2,
  Hand,
  Trash2,
  Table2,
} from "lucide-react"

// ============================================================================
// TMNL TOOLBAR - Custom tldraw UI replacement
// ============================================================================

// Toolbar button primitive
function ToolbarButton({
  children,
  onClick,
  active = false,
  danger = false,
  disabled = false,
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-2 py-1.5 text-[9px] font-mono uppercase tracking-widest
        transition-colors flex items-center gap-1.5
        border-r border-neutral-800 last:border-r-0
        disabled:opacity-30 disabled:cursor-not-allowed
        ${
          active
            ? "bg-neutral-800 text-white"
            : danger
              ? "text-red-500 hover:bg-red-500/10 hover:text-red-400"
              : "text-neutral-500 hover:bg-neutral-900 hover:text-white"
        }
      `}
    >
      {children}
    </button>
  )
}

// Toolbar separator
function ToolbarSeparator() {
  return <div className="w-px h-4 bg-neutral-800 mx-1" />
}

// Toolbar section container
function ToolbarSection({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center">{children}</div>
}

// Main spawn toolbar for creating widgets
export const SpawnToolbar = track(() => {
  const editor = useEditor()

  const spawnShape = (type: string) => {
    const center = editor.getViewportScreenCenter()
    const point = editor.screenToPage(center)

    editor.createShape({
      type,
      x: point.x - 100,
      y: point.y - 70,
    })
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex bg-black border border-neutral-800 z-50">
      {/* Corner decoration */}
      <div className="absolute -top-px -left-px w-2 h-2 border-t border-l border-neutral-700" />
      <div className="absolute -top-px -right-px w-2 h-2 border-t border-r border-neutral-700" />
      <div className="absolute -bottom-px -left-px w-2 h-2 border-b border-l border-neutral-700" />
      <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-neutral-700" />

      <ToolbarSection>
        <ToolbarButton onClick={() => spawnShape("chart-widget")}>
          <Activity size={10} />
          Chart
        </ToolbarButton>
        <ToolbarButton onClick={() => spawnShape("notes-widget")}>
          <FileText size={10} />
          Notes
        </ToolbarButton>
        <ToolbarButton onClick={() => spawnShape("controller-widget")}>
          <Sliders size={10} />
          Controller
        </ToolbarButton>
        <ToolbarButton onClick={() => spawnShape("terminal-widget")}>
          <Terminal size={10} />
          Terminal
        </ToolbarButton>
        <ToolbarButton onClick={() => spawnShape("data-grid-widget")}>
          <Table2 size={10} />
          Grid
        </ToolbarButton>
      </ToolbarSection>
    </div>
  )
})

// Tools toolbar for selection/pan modes
export const ToolsToolbar = track(() => {
  const editor = useEditor()
  const currentTool = editor.getCurrentToolId()

  return (
    <div className="absolute top-4 left-4 flex flex-col bg-black border border-neutral-800 z-50">
      {/* Corner decoration */}
      <div className="absolute -top-px -left-px w-2 h-2 border-t border-l border-neutral-700" />
      <div className="absolute -top-px -right-px w-2 h-2 border-t border-r border-neutral-700" />
      <div className="absolute -bottom-px -left-px w-2 h-2 border-b border-l border-neutral-700" />
      <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-neutral-700" />

      <button
        onClick={() => editor.setCurrentTool("select")}
        className={`
          p-2 text-[9px] font-mono uppercase tracking-widest
          transition-colors flex items-center justify-center
          border-b border-neutral-800
          ${
            currentTool === "select"
              ? "bg-neutral-800 text-white"
              : "text-neutral-500 hover:bg-neutral-900 hover:text-white"
          }
        `}
        title="Select (V)"
      >
        <MousePointer2 size={12} />
      </button>
      <button
        onClick={() => editor.setCurrentTool("hand")}
        className={`
          p-2 text-[9px] font-mono uppercase tracking-widest
          transition-colors flex items-center justify-center
          ${
            currentTool === "hand"
              ? "bg-neutral-800 text-white"
              : "text-neutral-500 hover:bg-neutral-900 hover:text-white"
          }
        `}
        title="Pan (H)"
      >
        <Hand size={12} />
      </button>
    </div>
  )
})

// Zoom controls
export const ZoomToolbar = track(() => {
  const editor = useEditor()
  const zoom = editor.getZoomLevel()

  return (
    <div className="absolute bottom-4 right-4 flex bg-black border border-neutral-800 z-50">
      {/* Corner decoration */}
      <div className="absolute -top-px -left-px w-2 h-2 border-t border-l border-neutral-700" />
      <div className="absolute -top-px -right-px w-2 h-2 border-t border-r border-neutral-700" />
      <div className="absolute -bottom-px -left-px w-2 h-2 border-b border-l border-neutral-700" />
      <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-neutral-700" />

      <ToolbarButton onClick={() => editor.zoomOut()}>
        <Minus size={10} />
      </ToolbarButton>
      <div className="px-2 py-1.5 text-[9px] font-mono text-neutral-400 border-r border-neutral-800 min-w-[48px] text-center">
        {Math.round(zoom * 100)}%
      </div>
      <ToolbarButton onClick={() => editor.zoomIn()}>
        <Plus size={10} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.resetZoom()}>
        <Grid3X3 size={10} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.zoomToFit()}>
        <Maximize2 size={10} />
      </ToolbarButton>
    </div>
  )
})

// Status/info overlay
export const StatusOverlay = track(() => {
  const editor = useEditor()
  const shapeCount = editor.getCurrentPageShapes().length
  const selectedCount = editor.getSelectedShapeIds().length

  return (
    <div className="absolute top-4 right-4 text-[9px] font-mono bg-black border border-neutral-800 px-3 py-2 z-50">
      {/* Corner decoration */}
      <div className="absolute -top-px -left-px w-2 h-2 border-t border-l border-neutral-700" />
      <div className="absolute -top-px -right-px w-2 h-2 border-t border-r border-neutral-700" />
      <div className="absolute -bottom-px -left-px w-2 h-2 border-b border-l border-neutral-700" />
      <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-neutral-700" />

      <div className="flex items-center gap-2 text-neutral-500">
        <div className="w-1.5 h-1.5 bg-neutral-700" />
        <span>OBJECTS</span>
        <span className="text-white">{shapeCount}</span>
      </div>
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 text-neutral-500 mt-1">
          <div className="w-1.5 h-1.5 bg-green-700" />
          <span>SELECTED</span>
          <span className="text-green-400">{selectedCount}</span>
        </div>
      )}
      {selectedCount === 2 && (
        <div className="mt-2 pt-2 border-t border-neutral-800 text-amber-500">LINK AVAILABLE</div>
      )}
    </div>
  )
})

// Actions toolbar for delete, etc.
export const ActionsToolbar = track(() => {
  const editor = useEditor()
  const selectedCount = editor.getSelectedShapeIds().length

  const deleteSelected = () => {
    editor.deleteShapes(editor.getSelectedShapeIds())
  }

  if (selectedCount === 0) return null

  return (
    <div className="absolute top-16 left-4 flex bg-black border border-neutral-800 z-50">
      {/* Corner decoration */}
      <div className="absolute -top-px -left-px w-2 h-2 border-t border-l border-neutral-700" />
      <div className="absolute -top-px -right-px w-2 h-2 border-t border-r border-neutral-700" />
      <div className="absolute -bottom-px -left-px w-2 h-2 border-b border-l border-neutral-700" />
      <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-neutral-700" />

      <ToolbarButton onClick={deleteSelected} danger>
        <Trash2 size={10} />
        Delete
      </ToolbarButton>
    </div>
  )
})

// Mini-map placeholder
export const MiniMap = track(() => {
  const editor = useEditor()
  const bounds = editor.getViewportPageBounds()
  const shapes = editor.getCurrentPageShapes()

  return (
    <div className="absolute bottom-16 right-4 w-32 h-20 bg-black border border-neutral-800 z-50 overflow-hidden">
      {/* Corner decoration */}
      <div className="absolute -top-px -left-px w-2 h-2 border-t border-l border-neutral-700 z-10" />
      <div className="absolute -top-px -right-px w-2 h-2 border-t border-r border-neutral-700 z-10" />
      <div className="absolute -bottom-px -left-px w-2 h-2 border-b border-l border-neutral-700 z-10" />
      <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-neutral-700 z-10" />

      {/* Label */}
      <div className="absolute top-1 left-1.5 text-[7px] font-mono text-neutral-600 uppercase tracking-wider">Map</div>

      {/* Grid */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full">
          <defs>
            <pattern id="minimap-grid" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#333" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#minimap-grid)" />
        </svg>
      </div>

      {/* Shape dots */}
      {shapes.slice(0, 20).map((shape, i) => (
        <div
          key={shape.id}
          className="absolute w-1 h-1 bg-neutral-500"
          style={{
            left: `${Math.min(90, Math.max(10, (shape.x / 1000) * 100))}%`,
            top: `${Math.min(90, Math.max(20, (shape.y / 600) * 100))}%`,
          }}
        />
      ))}

      {/* Viewport indicator */}
      <div
        className="absolute border border-neutral-600"
        style={{
          left: "20%",
          top: "20%",
          width: "60%",
          height: "60%",
        }}
      />
    </div>
  )
})