import { useCallback, useState, useEffect } from "react"
import {
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Connection,
  MarkerType,
  type OnNodesChange,
} from "reactflow"
import type { CustomNode, CustomEdge, ChartMetadata, NodeData, GlobalSettings } from "@/lib/types"

const chartMetadata: ChartMetadata = {
  name: "Live Pulse",
  type: "chart",
  parameters: {
    lineColor: { type: "color", label: "Line Color", defaultValue: "#00ff41" },
    glowColor: { type: "color", label: "Glow Color", defaultValue: "#00ff41", hidden: true },
    syncGlow: { type: "boolean", label: "Sync Glow with Line Color", defaultValue: true },
    lineWidth: { type: "range", label: "Line Width", defaultValue: 2, min: 1, max: 10, step: 0.5, control: "knob" },
    barSpacing: { type: "range", label: "Bar Spacing", defaultValue: 1, min: 0.5, max: 5, step: 0.1, control: "fader" },
    showPoints: { type: "boolean", label: "Show Data Points", defaultValue: true },
  },
}

const initialNodes: CustomNode[] = [
  {
    id: "welcome-note",
    type: "notes",
    position: { x: 150, y: 150 },
    data: {
      id: "welcome-note",
      title: "Tmnl Terminal",
      content: "State is now synchronized.\nWidgets and fullscreen views are one.",
      onDataChange: () => {},
    },
  },
]

/**
 * The new central nervous system of the application. This hook manages all
 * state for nodes, edges, and their interactions, ensuring data is always
 * synchronized between the canvas and any other view (like fullscreen).
 */
export function useTmnlState({
  onNodeSelect,
}: {
  onNodeSelect: (node: CustomNode | null) => void
}) {
  const [nodes, setNodes, onNodesChangeOriginal] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<CustomEdge>([])
  const [settings, setSettings] = useState<GlobalSettings>({ logDuration: 3 })
  const [lastLogPosition, setLastLogPosition] = useState<{ x: number; y: number } | null>(null)
  const { project, getNodes, getNode, deleteElements } = useReactFlow()

  const updateNodeData = useCallback(
    (nodeId: string, dataUpdate: Partial<NodeData>) => {
      setNodes((nds) =>
        nds.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...dataUpdate } } : node)),
      )
    },
    [setNodes],
  )

  // Centralized data generation for real-time widgets
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.type === "chartWidget") {
            const newValue = Math.floor(Math.random() * 90) + 10
            const currentChartData = node.data.chartData || []
            const newChartData = [...currentChartData, newValue]
            if (newChartData.length > 20) newChartData.shift()
            return { ...node, data: { ...node.data, chartData: newChartData } }
          }
          return node
        }),
      )
    }, 1500)
    return () => clearInterval(interval)
  }, [setNodes])

  const onNodesChange: OnNodesChange = (changes) => {
    onNodesChangeOriginal(changes)
    for (const change of changes) {
      if (change.type === "select") {
        if (change.selected) {
          onNodeSelect(getNode(change.id)!)
        } else {
          const anyOtherSelected = getNodes().some((n) => n.selected && n.id !== change.id)
          if (!anyOtherSelected) onNodeSelect(null)
        }
      }
    }
  }

  const onParameterChange = useCallback(
    (setterNodeId: string, paramKey: string, value: any) => {
      const setterNode = getNode(setterNodeId)
      if (!setterNode || setterNode.type !== "parameterSetter" || !setterNode.data.connectedComponentId) return

      const targetComponentId = setterNode.data.connectedComponentId
      const targetNode = getNode(targetComponentId)
      if (!targetNode || targetNode.type !== "chartWidget") return

      const newParameters = { ...targetNode.data.parameters, [paramKey]: value }
      if (paramKey === "syncGlow") {
        newParameters.glowColor = newParameters.syncGlow ? newParameters.lineColor : newParameters.glowColor
      }
      if (paramKey === "lineColor" && newParameters.syncGlow) {
        newParameters.glowColor = value
      }
      updateNodeData(targetComponentId, { parameters: newParameters })

      const newMeta = JSON.parse(JSON.stringify(setterNode.data.componentMetadata))
      if (newMeta) {
        newMeta.parameters[paramKey].value = value
        if (paramKey === "syncGlow") {
          newMeta.parameters.glowColor.hidden = value
          if (value) newMeta.parameters.glowColor.value = newMeta.parameters.lineColor.value
        }
        if (paramKey === "lineColor" && newMeta.parameters.syncGlow.value) {
          newMeta.parameters.glowColor.value = value
        }
        updateNodeData(setterNodeId, { componentMetadata: newMeta })
      }
    },
    [getNode, updateNodeData],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = getNode(connection.source!)
      const targetNode = getNode(connection.target!)

      if (
        !sourceNode ||
        sourceNode.type !== "parameterSetter" ||
        !targetNode ||
        targetNode.type !== "chartWidget" ||
        !targetNode.data.acceptVisitor(sourceNode.data.visitorId)
      )
        return

      const metadataWithValues = JSON.parse(JSON.stringify(targetNode.data.metadata))
      Object.keys(metadataWithValues.parameters).forEach((key) => {
        metadataWithValues.parameters[key].value = targetNode.data.parameters[key]
      })
      metadataWithValues.parameters.glowColor.hidden = targetNode.data.parameters.syncGlow
      updateNodeData(sourceNode.id, { connectedComponentId: targetNode.id, componentMetadata: metadataWithValues })

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            className: "animated-edge",
            style: { "--edge-color": targetNode.data.parameters.glowColor },
            markerEnd: { type: MarkerType.ArrowClosed, color: targetNode.data.parameters.glowColor },
          },
          eds,
        ),
      )
    },
    [getNode, setEdges, updateNodeData],
  )

  const spawnWidget = useCallback(
    (type: string, position: { x: number; y: number }) => {
      const id = `${type}-${Date.now()}`
      let data: NodeData

      switch (type) {
        case "chartWidget":
          data = {
            id,
            metadata: chartMetadata,
            parameters: Object.fromEntries(
              Object.entries(chartMetadata.parameters).map(([key, conf]) => [key, conf.defaultValue]),
            ),
            chartData: [],
            acceptVisitor: (visitorId) => visitorId.startsWith("param-setter"),
          }
          break
        case "parameterSetter":
          data = { id, title: "Controller", visitorId: `param-setter-${id}`, onParameterChange }
          break
        case "textEditor":
          data = { id, content: "", onContentChange: (content) => updateNodeData(id, { content }) }
          break
        case "notes":
          data = {
            id,
            title: "New Note",
            content: "",
            onDataChange: (d) => updateNodeData(id, d),
          }
          break
        default:
          return
      }

      const newNode: CustomNode = { id, type, position, data }
      setNodes((nds) => [...nds, newNode])
    },
    [setNodes, onParameterChange, updateNodeData],
  )

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    spawnWidget,
    updateNodeData,
  }
}
