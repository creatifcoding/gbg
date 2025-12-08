/**
 * ScadaCanvas
 *
 * Unified SCADA container demonstrating multiple overlays:
 * - TagBinding: Live process values with quality indicators
 * - Alarm: Annunciation banner with state machine
 * - Faceplate: Click-to-open detail panels
 * - Navigation: Screen transitions and breadcrumbs
 *
 * Visual Grammar: Nodal P&ID — process elements as nodes in a graph
 * with flowing connections and reactive state visualization.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import {
  useOverlayContainer,
  usePublish,
  OverlayRegistryProvider,
  type ContainerId,
} from "@/lib/overlays"
import {
  useTagBinding,
  useAlarm,
  useFaceplate,
  useNavigation,
  createTagValue,
  createAlarm,
  getPriorityColor,
  getStateStyle,
  getQualityColor,
  createScreenMeta,
  createScreenRegistry,
  type TagId,
  type TagQuality,
  type AlarmPriority,
  type ScreenId,
  tagPort,
  alarmPort,
} from "@/lib/overlays/scada"

// ─────────────────────────────────────────────────────────────
// Design Tokens (TMNL Palette)
// ─────────────────────────────────────────────────────────────

const TOKENS = {
  colors: {
    bg: {
      canvas: "#0a0a0f",
      node: "#141419",
      nodeBorder: "#2a2a35",
      nodeHover: "#1a1a22",
      panel: "#111116",
    },
    accent: {
      cyan: "#22d3ee",
      cyanMuted: "#0e7490",
      magenta: "#f472b6",
      amber: "#fbbf24",
      emerald: "#34d399",
    },
    quality: {
      good: "#22c55e",
      uncertain: "#f59e0b",
      stale: "#6b7280",
      bad: "#ef4444",
    },
    text: {
      primary: "#f4f4f5",
      secondary: "#a1a1aa",
      muted: "#71717a",
    },
  },
  spacing: {
    node: { width: 140, height: 80 },
    gap: 24,
  },
  animation: {
    fast: "150ms",
    normal: "300ms",
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const

// ─────────────────────────────────────────────────────────────
// Process Model
// ─────────────────────────────────────────────────────────────

interface ProcessNode {
  id: string
  tagId: TagId
  type: "tank" | "pump" | "valve" | "controller" | "sensor"
  label: string
  x: number
  y: number
  connections: string[] // IDs of downstream nodes
}

interface ProcessFlow {
  from: string
  to: string
  animated?: boolean
}

// Sample process: Feed Tank → Pump → Flow Controller → Product Tank
const PROCESS_NODES: ProcessNode[] = [
  { id: "n1", tagId: "TK-101" as TagId, type: "tank", label: "Feed Tank", x: 80, y: 120, connections: ["n2"] },
  { id: "n2", tagId: "P-101" as TagId, type: "pump", label: "Feed Pump", x: 280, y: 120, connections: ["n3"] },
  { id: "n3", tagId: "FIC-101" as TagId, type: "controller", label: "Flow Control", x: 480, y: 120, connections: ["n4"] },
  { id: "n4", tagId: "TK-102" as TagId, type: "tank", label: "Product Tank", x: 680, y: 120, connections: [] },
  { id: "n5", tagId: "TIC-101" as TagId, type: "controller", label: "Temp Control", x: 280, y: 280, connections: [] },
  { id: "n6", tagId: "PIC-101" as TagId, type: "controller", label: "Press Control", x: 480, y: 280, connections: [] },
]

const PROCESS_FLOWS: ProcessFlow[] = [
  { from: "n1", to: "n2", animated: true },
  { from: "n2", to: "n3", animated: true },
  { from: "n3", to: "n4", animated: true },
]

// Screen registry for navigation
const SCREENS = createScreenRegistry([
  createScreenMeta("overview" as ScreenId, "Plant Overview"),
  createScreenMeta("area-feed" as ScreenId, "Feed System", "overview" as ScreenId),
  createScreenMeta("area-product" as ScreenId, "Product System", "overview" as ScreenId),
  createScreenMeta("detail" as ScreenId, "Equipment Detail", "area-feed" as ScreenId),
])

// ─────────────────────────────────────────────────────────────
// Container ID
// ─────────────────────────────────────────────────────────────

const CONTAINER_ID = "scada-canvas" as ContainerId

// ─────────────────────────────────────────────────────────────
// ProcessNodeComponent — Individual equipment node
// ─────────────────────────────────────────────────────────────

interface ProcessNodeProps {
  node: ProcessNode
  containerId: ContainerId
  isSelected: boolean
  onSelect: (id: string) => void
}

function ProcessNodeComponent({ node, containerId, isSelected, onSelect }: ProcessNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null)

  // Tag binding for live value
  const tag = useTagBinding({
    containerId,
    tagId: node.tagId,
    qualityThreshold: "uncertain",
  })

  // Alarm binding
  const alarm = useAlarm({
    containerId,
    tagId: node.tagId,
    priority: "medium",
    message: `Alarm on ${node.label}`,
  })

  // Faceplate for details
  const faceplate = useFaceplate({
    containerId,
    tagId: node.tagId,
    faceplateType: node.type === "controller" ? "analog" : "discrete",
  })

  // Click handler opens faceplate
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect(node.id)

      const rect = nodeRef.current?.getBoundingClientRect()
      if (rect) {
        faceplate.open({
          x: rect.right + 16,
          y: rect.top,
        })
      }
    },
    [node.id, onSelect, faceplate]
  )

  // Node icon based on type
  const NodeIcon = useMemo(() => {
    switch (node.type) {
      case "tank":
        return TankIcon
      case "pump":
        return PumpIcon
      case "valve":
        return ValveIcon
      case "controller":
        return ControllerIcon
      case "sensor":
        return SensorIcon
      default:
        return ControllerIcon
    }
  }, [node.type])

  const hasAlarm = alarm.isActive || alarm.isAcknowledged
  const alarmStyle = alarm.stateStyle

  return (
    <div
      ref={nodeRef}
      className="absolute cursor-pointer transition-all"
      style={{
        left: node.x,
        top: node.y,
        width: TOKENS.spacing.node.width,
        transitionDuration: TOKENS.animation.fast,
      }}
      onClick={handleClick}
    >
      {/* Node container */}
      <div
        className="relative rounded-lg border-2 p-3 transition-all"
        style={{
          backgroundColor: isSelected ? TOKENS.colors.bg.nodeHover : TOKENS.colors.bg.node,
          borderColor: hasAlarm
            ? alarmStyle.color
            : isSelected
            ? TOKENS.colors.accent.cyan
            : TOKENS.colors.bg.nodeBorder,
          boxShadow: isSelected
            ? `0 0 20px ${TOKENS.colors.accent.cyan}40`
            : hasAlarm && alarmStyle.pulse
            ? `0 0 20px ${alarmStyle.color}60`
            : "none",
        }}
      >
        {/* Alarm indicator */}
        {hasAlarm && (
          <div
            className={`absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-zinc-900 ${
              alarmStyle.pulse ? "animate-pulse" : ""
            }`}
            style={{ backgroundColor: alarmStyle.color }}
          />
        )}

        {/* Icon */}
        <div className="flex justify-center mb-2">
          <NodeIcon
            className="w-8 h-8"
            style={{
              color: tag.isReliable ? TOKENS.colors.accent.cyan : tag.qualityColor,
            }}
          />
        </div>

        {/* Label */}
        <div
          className="text-center text-xs font-medium truncate"
          style={{ color: TOKENS.colors.text.primary }}
        >
          {node.label}
        </div>

        {/* Tag ID */}
        <div
          className="text-center font-mono mt-1"
          style={{ fontSize: "10px", color: TOKENS.colors.text.muted }}
        >
          {node.tagId}
        </div>

        {/* Value display */}
        <div
          className="text-center font-mono mt-2 text-lg font-bold"
          style={{ color: tag.qualityColor }}
        >
          {tag.value?.toFixed(1) ?? "—"}
          {tag.tagValue?.units && (
            <span
              className="text-xs ml-1"
              style={{ color: TOKENS.colors.text.muted }}
            >
              {tag.tagValue.units}
            </span>
          )}
        </div>

        {/* Quality indicator */}
        <div className="flex justify-center mt-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: tag.qualityColor }}
            title={tag.quality ?? "unknown"}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SVG Icons (P&ID style)
// ─────────────────────────────────────────────────────────────

function TankIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="12" y1="20" x2="12" y2="24" strokeLinecap="round" />
    </svg>
  )
}

function PumpIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4 L20 12 L12 20" />
    </svg>
  )
}

function ValveIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 12 L12 4 L20 12 L12 20 Z" />
      <line x1="12" y1="0" x2="12" y2="4" />
    </svg>
  )
}

function ControllerIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="12" cy="8" r="2" fill="currentColor" />
    </svg>
  )
}

function SensorIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="6" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// FlowConnections — SVG pipe connections between nodes
// ─────────────────────────────────────────────────────────────

function FlowConnections({ nodes, flows }: { nodes: ProcessNode[]; flows: ProcessFlow[] }) {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <defs>
        {/* Animated flow gradient */}
        <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={TOKENS.colors.accent.cyanMuted} stopOpacity="0.3" />
          <stop offset="50%" stopColor={TOKENS.colors.accent.cyan} stopOpacity="0.8" />
          <stop offset="100%" stopColor={TOKENS.colors.accent.cyanMuted} stopOpacity="0.3" />
          <animate attributeName="x1" values="-100%;100%" dur="2s" repeatCount="indefinite" />
          <animate attributeName="x2" values="0%;200%" dur="2s" repeatCount="indefinite" />
        </linearGradient>

        {/* Static pipe stroke */}
        <linearGradient id="pipe-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={TOKENS.colors.bg.nodeBorder} />
          <stop offset="100%" stopColor={TOKENS.colors.bg.nodeBorder} />
        </linearGradient>
      </defs>

      {flows.map((flow) => {
        const fromNode = nodeMap.get(flow.from)
        const toNode = nodeMap.get(flow.to)
        if (!fromNode || !toNode) return null

        const x1 = fromNode.x + TOKENS.spacing.node.width
        const y1 = fromNode.y + TOKENS.spacing.node.height / 2 + 20
        const x2 = toNode.x
        const y2 = toNode.y + TOKENS.spacing.node.height / 2 + 20

        // Bezier control points for curved pipe
        const cx1 = x1 + (x2 - x1) / 3
        const cx2 = x1 + (2 * (x2 - x1)) / 3

        const pathD = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`

        return (
          <g key={`${flow.from}-${flow.to}`}>
            {/* Pipe background */}
            <path
              d={pathD}
              fill="none"
              stroke={TOKENS.colors.bg.nodeBorder}
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Flow animation overlay */}
            {flow.animated && (
              <path
                d={pathD}
                fill="none"
                stroke="url(#flow-gradient)"
                strokeWidth="4"
                strokeLinecap="round"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// AlarmBanner — Top banner showing active alarms
// ─────────────────────────────────────────────────────────────

interface AlarmBannerProps {
  containerId: ContainerId
  nodes: ProcessNode[]
}

function AlarmBanner({ containerId, nodes }: AlarmBannerProps) {
  // Create alarm bindings for all nodes
  const alarms = nodes.map((node) => ({
    node,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    alarm: useAlarm({
      containerId,
      tagId: node.tagId,
      priority: "medium",
      message: `Alarm on ${node.label}`,
    }),
  }))

  const activeAlarms = alarms.filter(
    ({ alarm }) => alarm.isActive || alarm.isAcknowledged
  )

  if (activeAlarms.length === 0) {
    return (
      <div
        className="h-10 flex items-center justify-center border-b"
        style={{
          backgroundColor: TOKENS.colors.bg.panel,
          borderColor: TOKENS.colors.bg.nodeBorder,
        }}
      >
        <span style={{ color: TOKENS.colors.text.muted, fontSize: "12px" }}>
          No active alarms
        </span>
      </div>
    )
  }

  return (
    <div
      className="h-12 flex items-center gap-4 px-4 border-b overflow-x-auto"
      style={{
        backgroundColor: TOKENS.colors.bg.panel,
        borderColor: TOKENS.colors.bg.nodeBorder,
      }}
    >
      <span
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: TOKENS.colors.accent.amber }}
      >
        Alarms ({activeAlarms.length})
      </span>

      {activeAlarms.map(({ node, alarm }) => (
        <div
          key={node.id}
          className="flex items-center gap-2 px-3 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity"
          style={{
            backgroundColor: `${alarm.stateStyle.color}20`,
            borderLeft: `3px solid ${alarm.stateStyle.color}`,
          }}
          onClick={() => alarm.acknowledge("operator")}
        >
          <div
            className={`w-2 h-2 rounded-full ${alarm.stateStyle.pulse ? "animate-pulse" : ""}`}
            style={{ backgroundColor: alarm.stateStyle.color }}
          />
          <span className="text-xs font-mono" style={{ color: TOKENS.colors.text.primary }}>
            {node.tagId}
          </span>
          <span className="text-xs" style={{ color: TOKENS.colors.text.secondary }}>
            {alarm.alarm?.message}
          </span>
          {alarm.isActive && (
            <button
              className="text-xs px-2 py-0.5 rounded"
              style={{
                backgroundColor: TOKENS.colors.accent.amber,
                color: "#000",
              }}
              onClick={(e) => {
                e.stopPropagation()
                alarm.acknowledge("operator")
              }}
            >
              ACK
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// NavigationBar — Breadcrumbs and screen navigation
// ─────────────────────────────────────────────────────────────

interface NavigationBarProps {
  containerId: ContainerId
}

function NavigationBar({ containerId }: NavigationBarProps) {
  const nav = useNavigation({
    containerId,
    initialScreen: "overview" as ScreenId,
    screens: SCREENS,
  })

  return (
    <div
      className="h-10 flex items-center justify-between px-4 border-b"
      style={{
        backgroundColor: TOKENS.colors.bg.panel,
        borderColor: TOKENS.colors.bg.nodeBorder,
      }}
    >
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2">
        {nav.breadcrumbs.map((screen, i) => (
          <span key={screen} className="flex items-center gap-2">
            {i > 0 && (
              <span style={{ color: TOKENS.colors.text.muted }}>/</span>
            )}
            <button
              className="text-sm hover:underline"
              style={{
                color:
                  screen === nav.currentScreen
                    ? TOKENS.colors.accent.cyan
                    : TOKENS.colors.text.secondary,
              }}
              onClick={() => nav.navigate(screen)}
            >
              {nav.getScreenMeta(screen)?.title ?? screen}
            </button>
          </span>
        ))}
      </div>

      {/* Nav controls */}
      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 text-xs rounded disabled:opacity-30"
          style={{
            backgroundColor: TOKENS.colors.bg.nodeBorder,
            color: TOKENS.colors.text.secondary,
          }}
          disabled={!nav.canGoBack}
          onClick={nav.goBack}
        >
          ← Back
        </button>
        <button
          className="px-2 py-1 text-xs rounded disabled:opacity-30"
          style={{
            backgroundColor: TOKENS.colors.bg.nodeBorder,
            color: TOKENS.colors.text.secondary,
          }}
          disabled={!nav.canGoForward}
          onClick={nav.goForward}
        >
          Forward →
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// FaceplatePanel — Detail panel for selected equipment
// ─────────────────────────────────────────────────────────────

interface FaceplatePanelProps {
  containerId: ContainerId
  tagId: TagId
  position: { x: number; y: number }
  onClose: () => void
}

function FaceplatePanel({ containerId, tagId, position, onClose }: FaceplatePanelProps) {
  const tag = useTagBinding({
    containerId,
    tagId,
    qualityThreshold: "uncertain",
  })

  const alarm = useAlarm({
    containerId,
    tagId,
    priority: "medium",
  })

  const node = PROCESS_NODES.find((n) => n.tagId === tagId)

  return (
    <div
      className="fixed z-50 rounded-lg border shadow-2xl"
      style={{
        left: position.x,
        top: position.y,
        width: 280,
        backgroundColor: TOKENS.colors.bg.panel,
        borderColor: TOKENS.colors.accent.cyan,
        boxShadow: `0 0 40px ${TOKENS.colors.accent.cyan}30`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: TOKENS.colors.bg.nodeBorder }}
      >
        <div>
          <div className="text-sm font-medium" style={{ color: TOKENS.colors.text.primary }}>
            {node?.label ?? tagId}
          </div>
          <div className="text-xs font-mono" style={{ color: TOKENS.colors.text.muted }}>
            {tagId}
          </div>
        </div>
        <button
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700"
          onClick={onClose}
          style={{ color: TOKENS.colors.text.muted }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Process Value */}
        <div>
          <div className="text-xs mb-1" style={{ color: TOKENS.colors.text.muted }}>
            Process Value
          </div>
          <div
            className="text-3xl font-mono font-bold"
            style={{ color: tag.qualityColor }}
          >
            {tag.value?.toFixed(2) ?? "—"}
            <span className="text-sm ml-2" style={{ color: TOKENS.colors.text.muted }}>
              {tag.tagValue?.units ?? ""}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: tag.qualityColor }}
            />
            <span className="text-xs" style={{ color: TOKENS.colors.text.secondary }}>
              Quality: {tag.quality ?? "unknown"}
            </span>
          </div>
        </div>

        {/* Alarm Status */}
        {(alarm.isActive || alarm.isAcknowledged || alarm.isShelved) && (
          <div
            className="p-3 rounded border"
            style={{
              backgroundColor: `${alarm.stateStyle.color}10`,
              borderColor: alarm.stateStyle.color,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-3 h-3 rounded-full ${alarm.stateStyle.pulse ? "animate-pulse" : ""}`}
                style={{ backgroundColor: alarm.stateStyle.color }}
              />
              <span className="text-xs font-medium uppercase" style={{ color: alarm.stateStyle.color }}>
                {alarm.alarm?.state}
              </span>
            </div>
            <div className="text-xs" style={{ color: TOKENS.colors.text.secondary }}>
              {alarm.alarm?.message}
            </div>
            <div className="flex gap-2 mt-3">
              {alarm.isActive && (
                <button
                  className="px-3 py-1 text-xs rounded"
                  style={{
                    backgroundColor: TOKENS.colors.accent.amber,
                    color: "#000",
                  }}
                  onClick={() => alarm.acknowledge("operator")}
                >
                  Acknowledge
                </button>
              )}
              {alarm.isAcknowledged && (
                <button
                  className="px-3 py-1 text-xs rounded"
                  style={{
                    backgroundColor: TOKENS.colors.bg.nodeBorder,
                    color: TOKENS.colors.text.secondary,
                  }}
                  onClick={() => alarm.shelve()}
                >
                  Shelve
                </button>
              )}
              <button
                className="px-3 py-1 text-xs rounded"
                style={{
                  backgroundColor: TOKENS.colors.bg.nodeBorder,
                  color: TOKENS.colors.text.secondary,
                }}
                onClick={() => alarm.clear()}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Simulated controls */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs mb-1" style={{ color: TOKENS.colors.text.muted }}>
              Setpoint
            </div>
            <div className="text-lg font-mono" style={{ color: TOKENS.colors.accent.emerald }}>
              55.00
            </div>
          </div>
          <div>
            <div className="text-xs mb-1" style={{ color: TOKENS.colors.text.muted }}>
              Output
            </div>
            <div className="text-lg font-mono" style={{ color: TOKENS.colors.accent.magenta }}>
              42.3%
            </div>
          </div>
          <div>
            <div className="text-xs mb-1" style={{ color: TOKENS.colors.text.muted }}>
              Mode
            </div>
            <div className="text-sm font-medium" style={{ color: TOKENS.colors.accent.cyan }}>
              AUTO
            </div>
          </div>
          <div>
            <div className="text-xs mb-1" style={{ color: TOKENS.colors.text.muted }}>
              Status
            </div>
            <div className="text-sm font-medium" style={{ color: TOKENS.colors.quality.good }}>
              RUNNING
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SimulationControls — For testing/demo purposes
// ─────────────────────────────────────────────────────────────

interface SimulationControlsProps {
  containerId: ContainerId
  nodes: ProcessNode[]
}

function SimulationControls({ containerId, nodes }: SimulationControlsProps) {
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<number | null>(null)

  // Publishers for each tag
  const publishers = nodes.map((node) => ({
    node,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    publishTag: usePublish(containerId, tagPort.pv(node.tagId)),
    // eslint-disable-next-line react-hooks/rules-of-hooks
    publishAlarm: usePublish(containerId, alarmPort.state(node.tagId)),
  }))

  const simulateValues = useCallback(() => {
    publishers.forEach(({ node, publishTag }) => {
      const baseValue = 50 + Math.random() * 20
      const quality: TagQuality = Math.random() > 0.9 ? "uncertain" : "good"
      const units = node.type === "controller" ? "GPM" : node.type === "tank" ? "%" : "PSI"

      publishTag(createTagValue(baseValue, quality, units))
    })
  }, [publishers])

  const triggerAlarm = useCallback(
    (index: number) => {
      const { node, publishAlarm } = publishers[index]
      publishAlarm(
        createAlarm(node.tagId, "high" as AlarmPriority, `${node.label} exceeded limit`)
      )
    },
    [publishers]
  )

  const toggleSimulation = useCallback(() => {
    if (isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    } else {
      simulateValues() // Initial values
      intervalRef.current = window.setInterval(simulateValues, 2000)
    }
    setIsRunning(!isRunning)
  }, [isRunning, simulateValues])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return (
    <div
      className="absolute bottom-4 left-4 p-4 rounded-lg border"
      style={{
        backgroundColor: TOKENS.colors.bg.panel,
        borderColor: TOKENS.colors.bg.nodeBorder,
        zIndex: 40,
      }}
    >
      <div className="text-xs font-medium mb-3" style={{ color: TOKENS.colors.text.muted }}>
        Simulation Controls
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="px-3 py-1.5 text-xs rounded"
          style={{
            backgroundColor: isRunning ? TOKENS.colors.quality.good : TOKENS.colors.bg.nodeBorder,
            color: isRunning ? "#000" : TOKENS.colors.text.secondary,
          }}
          onClick={toggleSimulation}
        >
          {isRunning ? "Stop Sim" : "Start Sim"}
        </button>
        <button
          className="px-3 py-1.5 text-xs rounded"
          style={{
            backgroundColor: TOKENS.colors.accent.amber,
            color: "#000",
          }}
          onClick={() => triggerAlarm(2)}
        >
          Trigger Alarm (FIC-101)
        </button>
        <button
          className="px-3 py-1.5 text-xs rounded"
          style={{
            backgroundColor: TOKENS.colors.quality.bad,
            color: "#fff",
          }}
          onClick={() => triggerAlarm(0)}
        >
          Trigger Alarm (TK-101)
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ScadaCanvasInner — Main canvas component
// ─────────────────────────────────────────────────────────────

function ScadaCanvasInner() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [openFaceplate, setOpenFaceplate] = useState<{
    tagId: TagId
    position: { x: number; y: number }
  } | null>(null)

  // Initialize container
  const { exists } = useOverlayContainer({
    containerId: CONTAINER_ID,
    autoCreate: true,
  })

  // Handle node selection and faceplate
  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNode(nodeId)
  }, [])

  // Get faceplate state for selected node
  const selectedNodeData = PROCESS_NODES.find((n) => n.id === selectedNode)
  const faceplate = useFaceplate({
    containerId: CONTAINER_ID,
    tagId: selectedNodeData?.tagId ?? ("" as TagId),
    autoEnable: !!selectedNodeData,
  })

  // Canvas click clears selection
  const handleCanvasClick = useCallback(() => {
    setSelectedNode(null)
    if (faceplate.isOpen) {
      faceplate.close()
    }
  }, [faceplate])

  if (!exists) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: TOKENS.colors.bg.canvas }}
      >
        <div style={{ color: TOKENS.colors.text.muted }}>Initializing SCADA canvas...</div>
      </div>
    )
  }

  return (
    <div
      className="h-screen flex flex-col"
      style={{ backgroundColor: TOKENS.colors.bg.canvas }}
    >
      {/* Navigation bar */}
      <NavigationBar containerId={CONTAINER_ID} />

      {/* Alarm banner */}
      <AlarmBanner containerId={CONTAINER_ID} nodes={PROCESS_NODES} />

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden" onClick={handleCanvasClick}>
        {/* Flow connections (SVG layer) */}
        <FlowConnections nodes={PROCESS_NODES} flows={PROCESS_FLOWS} />

        {/* Process nodes */}
        {PROCESS_NODES.map((node) => (
          <ProcessNodeComponent
            key={node.id}
            node={node}
            containerId={CONTAINER_ID}
            isSelected={selectedNode === node.id}
            onSelect={handleNodeSelect}
          />
        ))}

        {/* Simulation controls */}
        <SimulationControls containerId={CONTAINER_ID} nodes={PROCESS_NODES} />
      </div>

      {/* Faceplate panel */}
      {faceplate.isOpen && selectedNodeData && faceplate.position && (
        <FaceplatePanel
          containerId={CONTAINER_ID}
          tagId={selectedNodeData.tagId}
          position={faceplate.position}
          onClose={faceplate.close}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Public Export
// ─────────────────────────────────────────────────────────────

export function ScadaCanvas() {
  return (
    <OverlayRegistryProvider>
      <ScadaCanvasInner />
    </OverlayRegistryProvider>
  )
}

export default ScadaCanvas
