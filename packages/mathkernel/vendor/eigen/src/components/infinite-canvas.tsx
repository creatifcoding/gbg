/**
 * @file InfiniteCanvas.tsx
 * @description The chart metadata now specifies which new control to use for each parameter.
 *
 * AI Adaptation Notes:
 * - The `chartMetadata` object now uses the new `control` property to demonstrate
 *   the `knob` and `fader` components.
 */

import type React from "react"
import { useCallback, useState, useRef } from "react"
import ReactFlow, { Background, Controls, MiniMap, type NodeTypes } from "reactflow"
import "reactflow/dist/style.css"

import { WidgetToolbar } from "@/components/widget-toolbar"
import { TextEditorWidget } from "@/components/widgets/text-editor-widget"
import { TerminalWidget } from "@/components/widgets/terminal-widget"
import { ChartWidgetNode } from "@/components/nodes/chart-widget-node"
import ParameterSetterNode from "@/components/nodes/parameter-setter-node"
import { NotesWidget } from "@/components/widgets/notes-widget"
import LogTextNode from "@/components/nodes/log-text-node"
import { SettingsWidget } from "@/components/widgets/settings-widget"
import type { CustomNode, CustomEdge } from "@/lib/types"

const nodeTypes: NodeTypes = {
  textEditor: TextEditorWidget,
  terminal: TerminalWidget,
  notes: NotesWidget,
  chartWidget: ChartWidgetNode,
  parameterSetter: ParameterSetterNode,
  logText: LogTextNode,
  settings: SettingsWidget,
}

interface InfiniteCanvasProps {
  nodes: CustomNode[]
  edges: CustomEdge[]
  onNodesChange: any
  onEdgesChange: any
  onConnect: any
  spawnWidget: (type: string, position: { x: number; y: number }) => void
}

/**
 * The InfiniteCanvas is now a "controlled" or "presentational" component.
 * It receives all its state and logic as props from the parent layout,
 * which uses the central useTmnlState hook.
 */
export function InfiniteCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  spawnWidget,
}: InfiniteCanvasProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  const onPaneInteraction = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY })
  }, [])

  const handleSpawn = (type: string) => {
    if (menu) {
      spawnWidget(type, { x: menu.x - 200, y: menu.y - 100 })
    }
    setMenu(null)
  }

  return (
    <div className="w-full h-full" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onPaneContextMenu={onPaneInteraction}
        onPaneClick={onPaneInteraction}
        fitView
        className="bg-black"
      >
        <Background variant="dots" gap={20} size={1} color="#333" />
        <Controls />
        <MiniMap
          className="bg-gray-900 border-gray-700"
          nodeColor={(n) => {
            if (n.type === "chartWidget") return n.data.parameters.glowColor
            if (n.type === "parameterSetter") return "#8b5cf6"
            return "#00ff41"
          }}
          maskColor="rgba(0,0,0,0.8)"
        />
      </ReactFlow>
      {menu && <WidgetToolbar position={menu} onSpawn={handleSpawn} onClose={() => setMenu(null)} />}
    </div>
  )
}