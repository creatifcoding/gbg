/**
 * Overlay System Testbed
 *
 * Validates the overlay architecture:
 * - Container lifecycle (create/destroy)
 * - Overlay registration and LIFO event dispatch
 * - Port pub/sub communication
 * - Handler results (handled/delegate/broadcast)
 *
 * @hypothesis
 * H1: Overlays receive events in LIFO order (most recently enabled first)
 * H2: "handled" result stops propagation
 * H3: "delegate" passes to next overlay
 * H4: "broadcast" continues to all overlays
 * H5: Ports provide reactive communication between overlays
 */

import { useEffect, useState, useRef, useCallback } from "react"
import * as Effect from "effect/Effect"
import {
  Overlay,
  useOverlayContainer,
  useOverlay,
  usePort,
  useEventStream,
  OverlayRegistryProvider,
  type ContainerId,
  type OverlayId,
  type PortId,
  type OverlayEvent,
  type PointerDown,
  type PointerMove,
  type PointerUp,
  type Modifiers,
  type PointerButton,
} from "@/lib/overlays"
import {
  TestbedHeader,
  SectionLabel,
  TestCard,
  Button,
  StatusIndicator,
  ValueDisplay,
  CollapsiblePanel,
  VersionBadge,
  HypothesisBadge,
  HypothesisSection,
  HypothesisSummary,
  DamageReport,
  type ValidationStatus,
  type DamageReportFinding,
} from "./shared"

// ─────────────────────────────────────────────────────────────
// Hypothesis Manifest
// ─────────────────────────────────────────────────────────────

interface OverlayHypothesis {
  readonly id: string
  readonly title: string
  readonly claim: string
  readonly test: string
  status: ValidationStatus
  evidence?: string
}

const HYPOTHESES: OverlayHypothesis[] = [
  {
    id: "OV-H1",
    title: "Container Lifecycle",
    claim: "Container creation emits to containerIdsAtom",
    test: "Create container → check containerIdsAtom includes ID",
    status: "pending",
  },
  {
    id: "OV-H2",
    title: "Overlay Registration",
    claim: "Overlay registration adds to activeOverlaysAtom",
    test: "Register overlay → verify in activeOverlays list",
    status: "pending",
  },
  {
    id: "OV-H3",
    title: "LIFO Dispatch Order",
    claim: "Most recently enabled overlay receives events first",
    test: "Enable A then B → dispatch → verify B called before A",
    status: "pending",
  },
  {
    id: "OV-H4",
    title: "Handled Stops Propagation",
    claim: "Handler returning 'handled' stops event propagation",
    test: "Return 'handled' in B → verify A not called",
    status: "pending",
  },
  {
    id: "OV-H5",
    title: "Port Pub/Sub",
    claim: "Port publish reaches all subscribers",
    test: "Publish to port → verify usePort value updates",
    status: "pending",
  },
  {
    id: "OV-H6",
    title: "Port Destroy Cleanup",
    claim: "Port destroy clears subscriptions cleanly",
    test: "Destroy port → verify no memory leaks",
    status: "pending",
  },
  {
    id: "OV-H7",
    title: "Overlay Disable",
    claim: "Disabled overlay removed from dispatch stack",
    test: "Disable overlay → dispatch → verify not called",
    status: "pending",
  },
  {
    id: "OV-H8",
    title: "Container Isolation",
    claim: "Multiple containers have isolated port namespaces",
    test: "Two containers → ports don't cross-pollinate",
    status: "pending",
  },
  {
    id: "OV-H9",
    title: "EventLog Replay",
    claim: "Event replay restores state after reload",
    test: "Persist events → reload → verify state restored",
    status: "pending",
  },
  {
    id: "OV-H10",
    title: "Reactive Overlay",
    claim: "Overlay updates on port message",
    test: "Bind overlay to port → publish → verify re-render",
    status: "pending",
  },
]

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const CONTAINER_ID = "overlay-testbed" as ContainerId

// Port IDs
const POINTER_PORT = "pointer:position" as PortId
const DRAG_PORT = "drag:state" as PortId
const KEY_PORT = "keyboard:last" as PortId
const EVENT_LOG_PORT = "events:log" as PortId

// ─────────────────────────────────────────────────────────────
// Port Payload Types
// ─────────────────────────────────────────────────────────────

interface PointerPosition {
  x: number
  y: number
  timestamp: number
}

interface DragState {
  dragging: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface KeyEvent {
  key: string
  code: string
  modifiers: string[]
  timestamp: number
}

interface EventLogEntry {
  id: number
  overlay: string
  event: string
  result: string
  timestamp: number
}

// ─────────────────────────────────────────────────────────────
// Overlay Definitions
// ─────────────────────────────────────────────────────────────

let eventIdCounter = 0

/**
 * Pointer Tracker Overlay
 * Tracks pointer movement and publishes to POINTER_PORT
 */
const PointerTrackerOverlay = new Overlay({
  id: "pointer-tracker" as OverlayId,
  name: "Pointer Tracker",
  visualPriority: 10,
  handlers: {
    PointerMove: (event, ctx) =>
      Effect.gen(function* () {
        yield* ctx.publish<PointerPosition>(POINTER_PORT, {
          x: event.position.x,
          y: event.position.y,
          timestamp: Date.now(),
        })
        // Log and delegate - we want other overlays to see pointer moves too
        yield* ctx.publish<EventLogEntry>(EVENT_LOG_PORT, {
          id: ++eventIdCounter,
          overlay: "pointer-tracker",
          event: "PointerMove",
          result: "delegate",
          timestamp: Date.now(),
        })
        return "delegate"
      }),
  },
  ports: {
    publications: [POINTER_PORT, EVENT_LOG_PORT],
  },
})

/**
 * Drag Overlay
 * Handles drag operations, publishes to DRAG_PORT
 * Only activates on left button
 */
const DragOverlay = new Overlay({
  id: "drag-handler" as OverlayId,
  name: "Drag Handler",
  visualPriority: 20,
  handlers: {
    PointerDown: (event, ctx) =>
      Effect.gen(function* () {
        if (event.button !== "left") {
          return "delegate"
        }
        yield* ctx.publish<DragState>(DRAG_PORT, {
          dragging: true,
          startX: event.position.x,
          startY: event.position.y,
          currentX: event.position.x,
          currentY: event.position.y,
        })
        yield* ctx.publish<EventLogEntry>(EVENT_LOG_PORT, {
          id: ++eventIdCounter,
          overlay: "drag-handler",
          event: "PointerDown",
          result: "handled",
          timestamp: Date.now(),
        })
        return "handled" // Stop propagation - we're handling this drag
      }),

    PointerMove: (event, ctx) =>
      Effect.gen(function* () {
        // Read current drag state to update it
        const currentState = yield* ctx.readPort<DragState>(DRAG_PORT)
        if (currentState._tag === "None" || !currentState.value.dragging) {
          return "delegate"
        }
        yield* ctx.publish<DragState>(DRAG_PORT, {
          ...currentState.value,
          currentX: event.position.x,
          currentY: event.position.y,
        })
        // Broadcast - let others (like pointer tracker) also see this
        return "broadcast"
      }),

    PointerUp: (event, ctx) =>
      Effect.gen(function* () {
        yield* ctx.publish<DragState>(DRAG_PORT, {
          dragging: false,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
        })
        yield* ctx.publish<EventLogEntry>(EVENT_LOG_PORT, {
          id: ++eventIdCounter,
          overlay: "drag-handler",
          event: "PointerUp",
          result: "handled",
          timestamp: Date.now(),
        })
        return "handled"
      }),
  },
  ports: {
    publications: [DRAG_PORT, EVENT_LOG_PORT],
  },
})

/**
 * Keyboard Overlay
 * Captures keyboard input, publishes to KEY_PORT
 */
const KeyboardOverlay = new Overlay({
  id: "keyboard-handler" as OverlayId,
  name: "Keyboard Handler",
  visualPriority: 30,
  handlers: {
    KeyDown: (event, ctx) =>
      Effect.gen(function* () {
        const modifiers: string[] = []
        if (event.modifiers.shift) modifiers.push("Shift")
        if (event.modifiers.ctrl) modifiers.push("Ctrl")
        if (event.modifiers.alt) modifiers.push("Alt")
        if (event.modifiers.meta) modifiers.push("Meta")

        yield* ctx.publish<KeyEvent>(KEY_PORT, {
          key: event.key,
          code: event.code,
          modifiers,
          timestamp: Date.now(),
        })
        yield* ctx.publish<EventLogEntry>(EVENT_LOG_PORT, {
          id: ++eventIdCounter,
          overlay: "keyboard-handler",
          event: `KeyDown(${event.key})`,
          result: "handled",
          timestamp: Date.now(),
        })
        return "handled"
      }),
  },
  ports: {
    publications: [KEY_PORT, EVENT_LOG_PORT],
  },
})

// ─────────────────────────────────────────────────────────────
// Interactive Canvas Component
// ─────────────────────────────────────────────────────────────

interface InteractiveCanvasProps {
  containerId: ContainerId
}

// ─────────────────────────────────────────────────────────────
// Event Construction Helpers (Type-safe)
// ─────────────────────────────────────────────────────────────

/** Convert React button number to PointerButton type */
function toPointerButton(button: number): PointerButton {
  switch (button) {
    case 0: return "left"
    case 1: return "middle"
    case 2: return "right"
    case 3: return "back"
    case 4: return "forward"
    default: return "left"
  }
}

/** Convert React buttons bitmask to array of PointerButton */
function toPointerButtons(buttons: number): PointerButton[] {
  const result: PointerButton[] = []
  if (buttons & 1) result.push("left")
  if (buttons & 2) result.push("right")
  if (buttons & 4) result.push("middle")
  if (buttons & 8) result.push("back")
  if (buttons & 16) result.push("forward")
  return result
}

/** Extract modifiers from React event */
function toModifiers(e: React.PointerEvent | React.KeyboardEvent): Modifiers {
  return {
    shift: e.shiftKey,
    ctrl: e.ctrlKey,
    alt: e.altKey,
    meta: e.metaKey,
  }
}

/** Create a PointerMove event (schema-typed) */
function createPointerMove(
  containerId: ContainerId,
  pe: React.PointerEvent,
  x: number,
  y: number
): PointerMove {
  return {
    _tag: "PointerMove",
    containerId,
    position: { x, y },
    delta: { x: pe.movementX, y: pe.movementY },
    buttons: toPointerButtons(pe.buttons),
    modifiers: toModifiers(pe),
    targetId: (pe.target as HTMLElement)?.id || null,
    timestamp: Date.now(),
    pointerId: pe.pointerId,
  }
}

/** Create a PointerDown event (schema-typed) */
function createPointerDown(
  containerId: ContainerId,
  pe: React.PointerEvent,
  x: number,
  y: number
): PointerDown {
  return {
    _tag: "PointerDown",
    containerId,
    position: { x, y },
    delta: { x: 0, y: 0 },
    button: toPointerButton(pe.button),
    buttons: toPointerButtons(pe.buttons),
    modifiers: toModifiers(pe),
    targetId: (pe.target as HTMLElement)?.id || null,
    timestamp: Date.now(),
    pointerId: pe.pointerId,
  }
}

/** Create a PointerUp event (schema-typed) */
function createPointerUp(
  containerId: ContainerId,
  pe: React.PointerEvent,
  x: number,
  y: number
): PointerUp {
  return {
    _tag: "PointerUp",
    containerId,
    position: { x, y },
    delta: { x: 0, y: 0 },
    button: toPointerButton(pe.button),
    buttons: toPointerButtons(pe.buttons),
    modifiers: toModifiers(pe),
    targetId: (pe.target as HTMLElement)?.id || null,
    timestamp: Date.now(),
    pointerId: pe.pointerId,
  }
}

function InteractiveCanvas({ containerId }: InteractiveCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)

  // Port subscriptions for visualization
  const pointer = usePort<PointerPosition>({
    containerId,
    portId: POINTER_PORT,
    initialValue: { x: 0, y: 0, timestamp: 0 },
  })

  const drag = usePort<DragState>({
    containerId,
    portId: DRAG_PORT,
    initialValue: { dragging: false, startX: 0, startY: 0, currentX: 0, currentY: 0 },
  })

  // Stream-based dispatch - single fiber consumes event queue
  // Queue.unsafeOffer is the TRUE hot path: zero fiber allocation per event
  const { enqueue, isRunning } = useEventStream({
    containerId,
    debug: false, // Set to true to see fiber lifecycle logs
  })

  const dispatchEvent = useCallback(
    (event: React.PointerEvent | React.KeyboardEvent) => {
      if (!isRunning) return
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      if (event.type === "pointermove") {
        const pe = event as React.PointerEvent
        const x = pe.clientX - rect.left
        const y = pe.clientY - rect.top
        enqueue(createPointerMove(containerId, pe, x, y))
      }

      if (event.type === "pointerdown") {
        const pe = event as React.PointerEvent
        const x = pe.clientX - rect.left
        const y = pe.clientY - rect.top
        enqueue(createPointerDown(containerId, pe, x, y))
      }

      if (event.type === "pointerup") {
        const pe = event as React.PointerEvent
        const x = pe.clientX - rect.left
        const y = pe.clientY - rect.top
        enqueue(createPointerUp(containerId, pe, x, y))
      }
    },
    [containerId, enqueue, isRunning]
  )

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-64 bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden cursor-crosshair"
      onPointerMove={dispatchEvent}
      onPointerDown={dispatchEvent}
      onPointerUp={dispatchEvent}
      onPointerLeave={() =>
        drag.publish({
          dragging: false,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
        })
      }
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, #333 1px, transparent 1px),
            linear-gradient(to bottom, #333 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />

      {/* Pointer indicator */}
      {pointer.value && (
        <div
          className="absolute w-4 h-4 border-2 border-cyan-400 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: pointer.value.x,
            top: pointer.value.y,
            boxShadow: "0 0 8px rgba(34, 211, 238, 0.5)",
          }}
        />
      )}

      {/* Drag visualization */}
      {drag.value?.dragging && (
        <>
          {/* Start point */}
          <div
            className="absolute w-3 h-3 bg-amber-400 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: drag.value.startX, top: drag.value.startY }}
          />
          {/* Drag line */}
          <svg className="absolute inset-0 pointer-events-none">
            <line
              x1={drag.value.startX}
              y1={drag.value.startY}
              x2={drag.value.currentX}
              y2={drag.value.currentY}
              stroke="#fbbf24"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          </svg>
          {/* Distance label */}
          <div
            className="absolute text-amber-400 font-mono pointer-events-none"
            style={{
              left: (drag.value.startX + drag.value.currentX) / 2,
              top: (drag.value.startY + drag.value.currentY) / 2 - 20,
              fontSize: "var(--tmnl-text-xs, 12px)",
            }}
          >
            {Math.round(
              Math.sqrt(
                Math.pow(drag.value.currentX - drag.value.startX, 2) +
                  Math.pow(drag.value.currentY - drag.value.startY, 2)
              )
            )}
            px
          </div>
        </>
      )}

      {/* Instructions */}
      <div
        className="absolute bottom-2 left-2 text-neutral-500 font-mono"
        style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
      >
        Move pointer / Click and drag
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Overlay Control Panel
// ─────────────────────────────────────────────────────────────

interface OverlayControlProps {
  containerId: ContainerId
  overlay: Overlay
}

function OverlayControl({ containerId, overlay }: OverlayControlProps) {
  const { isActive, enable, disable, toggle } = useOverlay({
    containerId,
    overlay,
    autoRegister: true,
    autoEnable: true,
  })

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-neutral-900/50 rounded border border-neutral-800">
      <div className="flex items-center gap-3">
        <StatusIndicator
          status={isActive ? "success" : "neutral"}
          label={isActive ? "ACTIVE" : "INACTIVE"}
        />
        <span
          className="font-mono text-neutral-200"
          style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
        >
          {overlay.name}
        </span>
        <span
          className="font-mono text-neutral-500"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          z:{overlay.visualPriority}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant={isActive ? "danger" : "primary"}
          onClick={toggle}
          style={{ fontSize: "var(--tmnl-text-xs, 12px)", padding: "4px 12px" }}
        >
          {isActive ? "Disable" : "Enable"}
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Port Monitor
// ─────────────────────────────────────────────────────────────

interface PortMonitorProps {
  containerId: ContainerId
}

function PortMonitor({ containerId }: PortMonitorProps) {
  const pointer = usePort<PointerPosition>({
    containerId,
    portId: POINTER_PORT,
  })

  const drag = usePort<DragState>({
    containerId,
    portId: DRAG_PORT,
  })

  const key = usePort<KeyEvent>({
    containerId,
    portId: KEY_PORT,
  })

  return (
    <div className="space-y-3">
      <div className="p-3 bg-neutral-900/50 rounded border border-neutral-800">
        <div
          className="font-mono text-cyan-400 mb-2"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          {POINTER_PORT}
        </div>
        <div className="flex gap-4">
          <ValueDisplay label="X" value={pointer.value?.x ?? 0} accent="cyan" size="sm" />
          <ValueDisplay label="Y" value={pointer.value?.y ?? 0} accent="cyan" size="sm" />
        </div>
      </div>

      <div className="p-3 bg-neutral-900/50 rounded border border-neutral-800">
        <div
          className="font-mono text-amber-400 mb-2"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          {DRAG_PORT}
        </div>
        <div className="flex items-center gap-4">
          <StatusIndicator
            status={drag.value?.dragging ? "warning" : "neutral"}
            label={drag.value?.dragging ? "DRAGGING" : "IDLE"}
          />
          {drag.value?.dragging && (
            <span
              className="font-mono text-neutral-400"
              style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
            >
              ({drag.value.startX.toFixed(0)}, {drag.value.startY.toFixed(0)}) →
              ({drag.value.currentX.toFixed(0)}, {drag.value.currentY.toFixed(0)})
            </span>
          )}
        </div>
      </div>

      <div className="p-3 bg-neutral-900/50 rounded border border-neutral-800">
        <div
          className="font-mono text-green-400 mb-2"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          {KEY_PORT}
        </div>
        {key.value ? (
          <div className="flex items-center gap-3">
            <span
              className="px-2 py-1 bg-neutral-800 rounded font-mono text-green-400"
              style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
            >
              {key.value.key}
            </span>
            {key.value.modifiers.length > 0 && (
              <span
                className="font-mono text-neutral-500"
                style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
              >
                +{key.value.modifiers.join("+")}
              </span>
            )}
          </div>
        ) : (
          <span
            className="font-mono text-neutral-500"
            style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
          >
            No key pressed
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Event Log
// ─────────────────────────────────────────────────────────────

interface EventLogProps {
  containerId: ContainerId
}

function EventLog({ containerId }: EventLogProps) {
  const [logs, setLogs] = useState<EventLogEntry[]>([])

  const eventLog = usePort<EventLogEntry>({
    containerId,
    portId: EVENT_LOG_PORT,
  })

  useEffect(() => {
    if (eventLog.value) {
      setLogs((prev) => [eventLog.value!, ...prev.slice(0, 19)])
    }
  }, [eventLog.value])

  const resultColors = {
    handled: "text-green-400",
    delegate: "text-cyan-400",
    broadcast: "text-amber-400",
  }

  return (
    <div className="h-48 overflow-y-auto font-mono" style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}>
      {logs.length === 0 ? (
        <div className="text-neutral-500 text-center py-4">No events yet</div>
      ) : (
        <table className="w-full">
          <thead className="sticky top-0 bg-neutral-950">
            <tr className="text-neutral-500 text-left">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Overlay</th>
              <th className="py-1 pr-2">Event</th>
              <th className="py-1">Result</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="text-neutral-300 border-t border-neutral-800">
                <td className="py-1 pr-2 text-neutral-600">{log.id}</td>
                <td className="py-1 pr-2 text-neutral-400">{log.overlay}</td>
                <td className="py-1 pr-2">{log.event}</td>
                <td className={`py-1 ${resultColors[log.result as keyof typeof resultColors] ?? "text-neutral-400"}`}>
                  {log.result}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Port Pub/Sub Test Component (OV-H5 Validation)
// ─────────────────────────────────────────────────────────────

const TEST_PORT = "test:manual" as PortId

interface TestMessage {
  count: number
  timestamp: number
}

function PortPubSubTest({ containerId }: { containerId: ContainerId }) {
  const [publishCount, setPublishCount] = useState(0)

  // Subscribe to test port
  const testPort = usePort<TestMessage>({
    containerId,
    portId: TEST_PORT,
    initialValue: { count: 0, timestamp: 0 },
  })

  const handlePublish = () => {
    const nextCount = publishCount + 1
    setPublishCount(nextCount)
    testPort.publish({
      count: nextCount,
      timestamp: Date.now(),
    })
    console.log(`[PortPubSubTest] Published count=${nextCount} to ${TEST_PORT}`)
  }

  const isReceiving = testPort.value?.count === publishCount && publishCount > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="primary" onClick={handlePublish}>
          Publish Test Message
        </Button>
        <span
          className="font-mono text-neutral-400"
          style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
        >
          Published: {publishCount}
        </span>
      </div>

      <div className="flex items-center gap-4 p-3 bg-neutral-900/50 rounded border border-neutral-800">
        <StatusIndicator
          status={isReceiving ? "success" : publishCount === 0 ? "neutral" : "error"}
          label={isReceiving ? "RECEIVING" : publishCount === 0 ? "WAITING" : "NOT RECEIVING"}
          pulse={isReceiving}
        />
        <div className="flex gap-4">
          <ValueDisplay label="Received Count" value={testPort.value?.count ?? 0} accent="cyan" size="sm" />
          <ValueDisplay
            label="Latency"
            value={testPort.value?.timestamp ? `${Date.now() - testPort.value.timestamp}ms` : "—"}
            accent="neutral"
            size="sm"
          />
        </div>
      </div>

      <div
        className="font-mono text-neutral-500"
        style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
      >
        {isReceiving ? (
          <span className="text-green-400">
            ✓ OV-H5 VALIDATED: usePort receives published messages via shared runtime
          </span>
        ) : publishCount > 0 ? (
          <span className="text-red-400">
            ✗ Messages published but not received — check console for TRACE logs
          </span>
        ) : (
          "Click 'Publish Test Message' to validate port pub/sub"
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Testbed Component
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Damage Report Findings
// ─────────────────────────────────────────────────────────────

const DAMAGE_FINDINGS: DamageReportFinding[] = [
  {
    id: "DM-OV-001",
    severity: "resolved",
    title: "Runtime Isolation Antipattern",
    description:
      "usePort hook was creating separate Effect runtime via Effect.provide(OverlayServicesLive), " +
      "causing different PortHub instance than atoms. Fixed by using shared overlayRuntimeAtom.",
    hypothesis: "OV-H5",
  },
  {
    id: "DM-OV-002",
    severity: "info",
    title: "TRACE Logging Added",
    description:
      "Effect.log() calls added to EventDispatcher.dispatch(), PortHub.publish(), and PortHub.subscribe() " +
      "for execution path verification.",
    hypothesis: "OV-H3",
  },
]

function OverlayTestbedInner() {
  // Hypothesis state
  const [hypotheses, setHypotheses] = useState<OverlayHypothesis[]>(HYPOTHESES)

  const container = useOverlayContainer({
    containerId: CONTAINER_ID,
    autoCreate: true,
    autoDestroy: true,
  })

  // Update hypothesis status based on container state
  useEffect(() => {
    setHypotheses((prev) =>
      prev.map((h) => {
        if (h.id === "OV-H1" && container.exists) {
          return { ...h, status: "validated" as ValidationStatus, evidence: `Container ${CONTAINER_ID} created` }
        }
        if (h.id === "OV-H2" && container.activeOverlays.length > 0) {
          return {
            ...h,
            status: "validated" as ValidationStatus,
            evidence: `${container.activeOverlays.length} overlays registered`,
          }
        }
        return h
      })
    )
  }, [container.exists, container.activeOverlays.length])

  // Keyboard event capture at testbed level
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Prevent default for certain keys
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault()
      }
    },
    []
  )

  return (
    <div
      className="min-h-screen bg-neutral-950 text-neutral-100 p-8"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="max-w-6xl mx-auto">
        <TestbedHeader
          title="Overlay System"
          subtitle="Container-scoped capability modules with LIFO event dispatch"
          actions={<VersionBadge version="v1" status="new" />}
        />

        {/* Container Status */}
        <div className="mb-6 flex items-center gap-4">
          <StatusIndicator
            status={container.exists ? "success" : "error"}
            label={container.exists ? "CONTAINER ACTIVE" : "NO CONTAINER"}
            pulse={container.exists}
          />
          <span
            className="font-mono text-neutral-500"
            style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
          >
            ID: {container.containerId}
          </span>
          <span
            className="font-mono text-neutral-500"
            style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
          >
            Active Overlays: {container.activeOverlays.length}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Interactive Canvas */}
            <TestCard
              title="Interactive Canvas"
              description="Pointer events dispatched through overlay stack"
            >
              <InteractiveCanvas containerId={CONTAINER_ID} />
            </TestCard>

            {/* Overlay Stack */}
            <TestCard
              title="Overlay Stack"
              description="LIFO order — last enabled handles events first"
            >
              <div className="space-y-2">
                <OverlayControl containerId={CONTAINER_ID} overlay={PointerTrackerOverlay} />
                <OverlayControl containerId={CONTAINER_ID} overlay={DragOverlay} />
                <OverlayControl containerId={CONTAINER_ID} overlay={KeyboardOverlay} />
              </div>
            </TestCard>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Port Monitor */}
            <TestCard
              title="Port Monitor"
              description="Real-time port values"
            >
              <PortMonitor containerId={CONTAINER_ID} />
            </TestCard>

            {/* Event Log */}
            <TestCard
              title="Event Log"
              description="Handler results: handled (stop) / delegate (continue) / broadcast (all)"
            >
              <EventLog containerId={CONTAINER_ID} />
            </TestCard>
          </div>
        </div>

        {/* Hypothesis Manifest */}
        <div className="mt-8">
          <SectionLabel variant="gradient">Hypothesis Manifest (10 Hypotheses)</SectionLabel>

          {/* Summary Grid */}
          <HypothesisSummary
            hypotheses={hypotheses.map((h) => ({
              id: h.id,
              title: h.title,
              status: h.status,
            }))}
            className="mb-6"
          />

          {/* Hypothesis Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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

          {/* Damage Report */}
          <DamageReport findings={DAMAGE_FINDINGS} className="mb-8" />

          {/* Port Pub/Sub Test Panel */}
          <TestCard
            title="Port Pub/Sub Validation (OV-H5)"
            description="Manual test for port publish/subscribe via shared runtime"
          >
            <PortPubSubTest containerId={CONTAINER_ID} />
          </TestCard>
        </div>
      </div>
    </div>
  )
}

/**
 * Public export wraps inner component with OverlayRegistryProvider
 * to ensure shared registry is available for all effect-atom operations.
 */
export function OverlayTestbed() {
  return (
    <OverlayRegistryProvider>
      <OverlayTestbedInner />
    </OverlayRegistryProvider>
  )
}
