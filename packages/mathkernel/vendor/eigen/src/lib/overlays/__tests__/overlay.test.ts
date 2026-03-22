/**
 * Overlay System Tests
 *
 * Validates 10 hypotheses about the overlay system:
 *
 * OV-H1: Container Lifecycle
 * OV-H2: Overlay Registration
 * OV-H3: LIFO Dispatch Order
 * OV-H4: Handled Stops Propagation
 * OV-H5: Port Pub/Sub
 * OV-H6: Port Destroy Cleanup
 * OV-H7: Overlay Disable
 * OV-H8: Container Isolation
 * OV-H9: EventLog Replay (skipped - requires full EventLog integration)
 * OV-H10: Reactive Overlay
 */

import { describe, expect, it, layer } from "@effect/vitest"
import { Effect, Layer, Option, Stream, Chunk } from "effect"
import * as Atom from "@effect-atom/atom/Atom"
import * as Registry from "@effect-atom/atom/Registry"
import * as Result from "@effect-atom/atom/Result"

import {
  type ContainerId,
  type OverlayId,
  type OverlayEventTag,
  type PointerDown,
} from "../schemas"
import {
  EventDispatcher,
  EventDispatcherLive,
  PortHub,
  PortHubLive,
} from "../services"
import {
  containersStateAtom,
  containerIdsAtom,
  containerAtom,
  activeOverlaysAtom,
} from "../atoms/state"
import {
  createContainer,
  destroyContainer,
  enableOverlay,
  disableOverlay,
  toggleOverlay,
} from "../atoms/state"

// ─────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────

const testContainerId = "test-container" as ContainerId
const testContainerId2 = "test-container-2" as ContainerId
const overlayA = "overlay-a" as OverlayId
const overlayB = "overlay-b" as OverlayId
const overlayC = "overlay-c" as OverlayId

/** Create a fresh registry with reset state */
const makeTestRegistry = () => {
  const r = Registry.make()
  // Reset atom state to empty map - use set() with direct value, not updater
  r.set(containersStateAtom, new Map())
  return r
}

/**
 * Helper to update atom state using pure mutation functions.
 * Registry.set takes direct values; Registry.update takes updater functions.
 */
const updateContainers = (
  r: ReturnType<typeof Registry.make>,
  updater: (current: Map<ContainerId, any>) => Map<ContainerId, any>
) => {
  r.update(containersStateAtom, updater)
}

/** Create a mock PointerDown event */
const mockPointerDown = (containerId: ContainerId): PointerDown => ({
  _tag: "PointerDown",
  containerId,
  position: { x: 100, y: 100 },
  delta: { x: 0, y: 0 },
  buttons: ["left"],
  button: "left",
  modifiers: { shift: false, ctrl: false, alt: false, meta: false },
  targetId: null,
  timestamp: Date.now(),
  pointerId: 1,
})

// ─────────────────────────────────────────────────────────────
// Combined Services Layer
// ─────────────────────────────────────────────────────────────

const TestServicesLive = Layer.mergeAll(EventDispatcherLive, PortHubLive)

// ─────────────────────────────────────────────────────────────
// OV-H1: Container Lifecycle
// ─────────────────────────────────────────────────────────────

describe("OV-H1: Container Lifecycle", () => {
  it("container creation adds to containerIdsAtom", () => {
    const r = makeTestRegistry()

    // Act: Create container via pure mutation function
    updateContainers(r, (current) =>
      createContainer(current, testContainerId)
    )

    // Assert: containerIdsAtom includes the new ID
    const ids = r.get(containerIdsAtom)
    expect(ids).toContain(testContainerId)
  })

  it("container destruction removes from containerIdsAtom", () => {
    const r = makeTestRegistry()

    // Setup: Create container
    updateContainers(r, (current) =>
      createContainer(current, testContainerId)
    )

    // Act: Destroy container
    updateContainers(r, (current) =>
      destroyContainer(current, testContainerId)
    )

    // Assert: containerIdsAtom no longer includes the ID
    const ids = r.get(containerIdsAtom)
    expect(ids).not.toContain(testContainerId)
  })

  it("create is idempotent", () => {
    const r = makeTestRegistry()

    // Act: Create same container twice
    updateContainers(r, (current) =>
      createContainer(current, testContainerId)
    )
    updateContainers(r, (current) =>
      createContainer(current, testContainerId)
    )

    // Assert: Only one container exists
    const ids = r.get(containerIdsAtom)
    expect(ids.filter((id: ContainerId) => id === testContainerId)).toHaveLength(1)
  })

  it("containerAtom returns container state", () => {
    const r = makeTestRegistry()

    // Act: Create container
    updateContainers(r, (current) =>
      createContainer(current, testContainerId)
    )

    // Assert: containerAtom returns the container
    const container = r.get(containerAtom(testContainerId))
    expect(container).not.toBeNull()
    expect(container?.id).toBe(testContainerId)
    expect(container?.activeOverlays).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────
// OV-H2: Overlay Registration
// ─────────────────────────────────────────────────────────────

describe("OV-H2: Overlay Registration", () => {
  it("overlay enable adds to activeOverlaysAtom", () => {
    const r = makeTestRegistry()

    // Setup: Create container
    updateContainers(r, (current) =>
      createContainer(current, testContainerId)
    )

    // Act: Enable overlay
    updateContainers(r, (current) =>
      enableOverlay(current, testContainerId, overlayA, "Overlay A", 0)
    )

    // Assert: activeOverlaysAtom includes the overlay
    const overlays = r.get(activeOverlaysAtom(testContainerId))
    expect(overlays).toHaveLength(1)
    expect(overlays[0].id).toBe(overlayA)
  })

  it("overlay enable auto-creates container if missing", () => {
    const r = makeTestRegistry()

    // Act: Enable overlay without creating container first
    updateContainers(r, (current) =>
      enableOverlay(current, testContainerId, overlayA, "Overlay A", 0)
    )

    // Assert: Container was created and overlay is active
    const ids = r.get(containerIdsAtom)
    expect(ids).toContain(testContainerId)

    const overlays = r.get(activeOverlaysAtom(testContainerId))
    expect(overlays).toHaveLength(1)
  })

  it("multiple overlays can be enabled in same container", () => {
    const r = makeTestRegistry()

    updateContainers(r, (current) =>
      createContainer(current, testContainerId)
    )

    // Act: Enable multiple overlays
    updateContainers(r, (current) =>
      enableOverlay(current, testContainerId, overlayA)
    )
    updateContainers(r, (current) =>
      enableOverlay(current, testContainerId, overlayB)
    )
    updateContainers(r, (current) =>
      enableOverlay(current, testContainerId, overlayC)
    )

    // Assert: All overlays are active
    const overlays = r.get(activeOverlaysAtom(testContainerId))
    expect(overlays).toHaveLength(3)
    expect(overlays.map((o: any) => o.id)).toContain(overlayA)
    expect(overlays.map((o: any) => o.id)).toContain(overlayB)
    expect(overlays.map((o: any) => o.id)).toContain(overlayC)
  })

  it("re-enabling same overlay is idempotent", () => {
    const r = makeTestRegistry()

    updateContainers(r, (current) =>
      createContainer(current, testContainerId)
    )

    // Act: Enable same overlay twice
    updateContainers(r, (current) =>
      enableOverlay(current, testContainerId, overlayA)
    )
    updateContainers(r, (current) =>
      enableOverlay(current, testContainerId, overlayA)
    )

    // Assert: Only one instance exists
    const overlays = r.get(activeOverlaysAtom(testContainerId))
    expect(overlays.filter((o: any) => o.id === overlayA)).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────
// OV-H3: LIFO Dispatch Order
// ─────────────────────────────────────────────────────────────

layer(TestServicesLive)("OV-H3: LIFO Dispatch Order", (it) => {
  it.effect("most recently enabled overlay receives events first", () =>
    Effect.gen(function* () {
      const r = makeTestRegistry()
      const dispatcher = yield* EventDispatcher

      // Setup: Create container and enable overlays in order: A, then B
      updateContainers(r, (current) =>
        createContainer(current, testContainerId)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayA, "Overlay A")
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayB, "Overlay B")
      )

      // Track call order
      const callOrder: OverlayId[] = []

      // Register handlers that track call order
      yield* dispatcher.registerHandler(
        testContainerId,
        overlayA,
        "PointerDown" as OverlayEventTag,
        () =>
          Effect.sync(() => {
            callOrder.push(overlayA)
            return "delegate" as const
          })
      )
      yield* dispatcher.registerHandler(
        testContainerId,
        overlayB,
        "PointerDown" as OverlayEventTag,
        () =>
          Effect.sync(() => {
            callOrder.push(overlayB)
            return "delegate" as const
          })
      )

      // Act: Dispatch event with active overlays
      const activeOverlays = r.get(activeOverlaysAtom(testContainerId))
      const event = mockPointerDown(testContainerId)
      yield* dispatcher.dispatch(testContainerId, event, activeOverlays)

      // Assert: B called before A (LIFO order)
      expect(callOrder).toEqual([overlayB, overlayA])
    })
  )

  it.effect("stack position reflects enable order", () =>
    Effect.gen(function* () {
      const r = makeTestRegistry()

      updateContainers(r, (current) =>
        createContainer(current, testContainerId)
      )

      // Enable in order: A, B, C
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayA)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayB)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayC)
      )

      const overlays = r.get(activeOverlaysAtom(testContainerId))

      // Assert: Stack positions reflect order
      const posA = overlays.find((o: any) => o.id === overlayA)?.stackPosition ?? -1
      const posB = overlays.find((o: any) => o.id === overlayB)?.stackPosition ?? -1
      const posC = overlays.find((o: any) => o.id === overlayC)?.stackPosition ?? -1

      expect(posA).toBeLessThan(posB)
      expect(posB).toBeLessThan(posC)
    })
  )
})

// ─────────────────────────────────────────────────────────────
// OV-H4: Handled Stops Propagation
// ─────────────────────────────────────────────────────────────

layer(TestServicesLive)("OV-H4: Handled Stops Propagation", (it) => {
  it.effect("returning 'handled' stops event propagation", () =>
    Effect.gen(function* () {
      const r = makeTestRegistry()
      const dispatcher = yield* EventDispatcher

      updateContainers(r, (current) =>
        createContainer(current, testContainerId)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayA)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayB)
      )

      let aWasCalled = false
      let bWasCalled = false

      // B handler returns "handled" - should stop propagation
      yield* dispatcher.registerHandler(
        testContainerId,
        overlayB,
        "PointerDown" as OverlayEventTag,
        () =>
          Effect.sync(() => {
            bWasCalled = true
            return "handled" as const
          })
      )

      // A handler should NOT be called
      yield* dispatcher.registerHandler(
        testContainerId,
        overlayA,
        "PointerDown" as OverlayEventTag,
        () =>
          Effect.sync(() => {
            aWasCalled = true
            return "delegate" as const
          })
      )

      // Act
      const activeOverlays = r.get(activeOverlaysAtom(testContainerId))
      const event = mockPointerDown(testContainerId)
      const result = yield* dispatcher.dispatch(
        testContainerId,
        event,
        activeOverlays
      )

      // Assert: B was called, A was NOT called
      expect(bWasCalled).toBe(true)
      expect(aWasCalled).toBe(false)
      expect(result.result).toBe("handled")
      expect(Option.isSome(result.handledBy)).toBe(true)
      expect(Option.getOrNull(result.handledBy)).toBe(overlayB)
    })
  )

  it.effect("returning 'delegate' continues propagation", () =>
    Effect.gen(function* () {
      const r = makeTestRegistry()
      const dispatcher = yield* EventDispatcher

      updateContainers(r, (current) =>
        createContainer(current, testContainerId)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayA)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayB)
      )

      let aWasCalled = false
      let bWasCalled = false

      // B delegates to A
      yield* dispatcher.registerHandler(
        testContainerId,
        overlayB,
        "PointerDown" as OverlayEventTag,
        () =>
          Effect.sync(() => {
            bWasCalled = true
            return "delegate" as const
          })
      )

      yield* dispatcher.registerHandler(
        testContainerId,
        overlayA,
        "PointerDown" as OverlayEventTag,
        () =>
          Effect.sync(() => {
            aWasCalled = true
            return "delegate" as const
          })
      )

      // Act
      const activeOverlays = r.get(activeOverlaysAtom(testContainerId))
      const event = mockPointerDown(testContainerId)
      yield* dispatcher.dispatch(testContainerId, event, activeOverlays)

      // Assert: Both were called
      expect(bWasCalled).toBe(true)
      expect(aWasCalled).toBe(true)
    })
  )

  it.effect("returning 'broadcast' continues but marks as handled", () =>
    Effect.gen(function* () {
      const r = makeTestRegistry()
      const dispatcher = yield* EventDispatcher

      updateContainers(r, (current) =>
        createContainer(current, testContainerId)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayA)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayB)
      )

      let aWasCalled = false

      // B broadcasts (handled but continues)
      yield* dispatcher.registerHandler(
        testContainerId,
        overlayB,
        "PointerDown" as OverlayEventTag,
        () => Effect.succeed("broadcast" as const)
      )

      // A should still see the event
      yield* dispatcher.registerHandler(
        testContainerId,
        overlayA,
        "PointerDown" as OverlayEventTag,
        () =>
          Effect.sync(() => {
            aWasCalled = true
            return "delegate" as const
          })
      )

      // Act
      const activeOverlays = r.get(activeOverlaysAtom(testContainerId))
      const event = mockPointerDown(testContainerId)
      const result = yield* dispatcher.dispatch(
        testContainerId,
        event,
        activeOverlays
      )

      // Assert: Both called, result is broadcast
      expect(aWasCalled).toBe(true)
      expect(result.result).toBe("broadcast")
    })
  )
})

// ─────────────────────────────────────────────────────────────
// OV-H5: Port Pub/Sub
// ─────────────────────────────────────────────────────────────

layer(TestServicesLive)("OV-H5: Port Pub/Sub", (it) => {
  it.scoped("port publish updates latest value", () =>
    Effect.gen(function* () {
      const hub = yield* PortHub

      const portId = "test-port" as any

      // Act: Publish a value
      yield* hub.publish(testContainerId, portId, { value: 42 })

      // Assert: read returns the value
      const result = yield* hub.read<{ value: number }>(testContainerId, portId)
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrNull(result)?.value).toBe(42)
    })
  )

  it.scoped("port subscription receives published messages", () =>
    Effect.gen(function* () {
      const hub = yield* PortHub

      const portId = "stream-port" as any

      // Subscribe first
      const stream = yield* hub.subscribe<{ msg: string }>(
        testContainerId,
        portId
      )

      // Publish in background, collect first message
      yield* hub.publish(testContainerId, portId, { msg: "hello" })

      // Take first element from stream
      const messages = yield* stream.pipe(Stream.take(1), Stream.runCollect)
      const chunk = Chunk.toReadonlyArray(messages)

      expect(chunk).toHaveLength(1)
      expect(chunk[0]).toEqual({ msg: "hello" })
    })
  )

  it.scoped("multiple subscribers receive same message", () =>
    Effect.gen(function* () {
      const hub = yield* PortHub

      const portId = "multi-sub-port" as any

      // Two subscribers
      const stream1 = yield* hub.subscribe<number>(testContainerId, portId)
      const stream2 = yield* hub.subscribe<number>(testContainerId, portId)

      // Publish
      yield* hub.publish(testContainerId, portId, 123)

      // Both should receive
      const [msgs1, msgs2] = yield* Effect.all([
        stream1.pipe(Stream.take(1), Stream.runCollect),
        stream2.pipe(Stream.take(1), Stream.runCollect),
      ])

      expect(Chunk.toReadonlyArray(msgs1)[0]).toBe(123)
      expect(Chunk.toReadonlyArray(msgs2)[0]).toBe(123)
    })
  )
})

// ─────────────────────────────────────────────────────────────
// OV-H6: Port Destroy Cleanup
// ─────────────────────────────────────────────────────────────

layer(TestServicesLive)("OV-H6: Port Destroy Cleanup", (it) => {
  it.scoped("destroyPort removes port", () =>
    Effect.gen(function* () {
      const hub = yield* PortHub

      const portId = "destroy-test" as any

      // Create port by publishing
      yield* hub.publish(testContainerId, portId, "data")

      // Verify exists
      const existsBefore = yield* hub.hasPort(testContainerId, portId)
      expect(existsBefore).toBe(true)

      // Destroy
      yield* hub.destroyPort(testContainerId, portId)

      // Verify gone
      const existsAfter = yield* hub.hasPort(testContainerId, portId)
      expect(existsAfter).toBe(false)
    })
  )

  it.scoped("destroyContainerPorts removes all ports in container", () =>
    Effect.gen(function* () {
      const hub = yield* PortHub

      const port1 = "port-1" as any
      const port2 = "port-2" as any

      // Create multiple ports
      yield* hub.publish(testContainerId, port1, "a")
      yield* hub.publish(testContainerId, port2, "b")

      // Verify they exist
      const ports = yield* hub.listPorts(testContainerId)
      expect(ports).toHaveLength(2)

      // Destroy all
      yield* hub.destroyContainerPorts(testContainerId)

      // Verify all gone
      const portsAfter = yield* hub.listPorts(testContainerId)
      expect(portsAfter).toHaveLength(0)
    })
  )

  it.scoped("read returns None after port destroy", () =>
    Effect.gen(function* () {
      const hub = yield* PortHub

      const portId = "ephemeral" as any

      yield* hub.publish(testContainerId, portId, "temp")
      yield* hub.destroyPort(testContainerId, portId)

      const result = yield* hub.read(testContainerId, portId)
      expect(Option.isNone(result)).toBe(true)
    })
  )
})

// ─────────────────────────────────────────────────────────────
// OV-H7: Overlay Disable
// ─────────────────────────────────────────────────────────────

layer(TestServicesLive)("OV-H7: Overlay Disable", (it) => {
  it.effect("disabled overlay removed from dispatch stack", () =>
    Effect.gen(function* () {
      const r = makeTestRegistry()
      const dispatcher = yield* EventDispatcher

      updateContainers(r, (current) =>
        createContainer(current, testContainerId)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayA)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayB)
      )

      let bWasCalled = false

      yield* dispatcher.registerHandler(
        testContainerId,
        overlayB,
        "PointerDown" as OverlayEventTag,
        () =>
          Effect.sync(() => {
            bWasCalled = true
            return "handled" as const
          })
      )

      // Disable overlayB
      updateContainers(r, (current) =>
        disableOverlay(current, testContainerId, overlayB)
      )

      // Verify B is no longer active
      const overlays = r.get(activeOverlaysAtom(testContainerId))
      expect(overlays.map((o: any) => o.id)).not.toContain(overlayB)
      expect(overlays.map((o: any) => o.id)).toContain(overlayA)

      // Dispatch - B should not be called
      const event = mockPointerDown(testContainerId)
      yield* dispatcher.dispatch(testContainerId, event, overlays)

      expect(bWasCalled).toBe(false)
    })
  )

  it.effect("toggle enables previously disabled overlay", () =>
    Effect.gen(function* () {
      const r = makeTestRegistry()

      updateContainers(r, (current) =>
        createContainer(current, testContainerId)
      )

      // Enable then disable
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayA)
      )
      updateContainers(r, (current) =>
        disableOverlay(current, testContainerId, overlayA)
      )

      // Toggle should re-enable
      updateContainers(r, (current) =>
        toggleOverlay(current, testContainerId, overlayA)
      )

      const overlays = r.get(activeOverlaysAtom(testContainerId))
      expect(overlays.map((o: any) => o.id)).toContain(overlayA)
    })
  )

  it.effect("toggle disables currently enabled overlay", () =>
    Effect.gen(function* () {
      const r = makeTestRegistry()

      updateContainers(r, (current) =>
        createContainer(current, testContainerId)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayA)
      )

      // Toggle should disable
      updateContainers(r, (current) =>
        toggleOverlay(current, testContainerId, overlayA)
      )

      const overlays = r.get(activeOverlaysAtom(testContainerId))
      expect(overlays.map((o: any) => o.id)).not.toContain(overlayA)
    })
  )
})

// ─────────────────────────────────────────────────────────────
// OV-H8: Container Isolation
// ─────────────────────────────────────────────────────────────

layer(TestServicesLive)("OV-H8: Container Isolation", (it) => {
  it.scoped("containers have isolated port namespaces", () =>
    Effect.gen(function* () {
      const hub = yield* PortHub

      const portId = "shared-name" as any

      // Publish different values to same port name in different containers
      yield* hub.publish(testContainerId, portId, { container: 1 })
      yield* hub.publish(testContainerId2, portId, { container: 2 })

      // Read from each - should get different values
      const val1 = yield* hub.read<{ container: number }>(
        testContainerId,
        portId
      )
      const val2 = yield* hub.read<{ container: number }>(
        testContainerId2,
        portId
      )

      expect(Option.getOrNull(val1)?.container).toBe(1)
      expect(Option.getOrNull(val2)?.container).toBe(2)
    })
  )

  it.effect("containers have isolated overlay stacks", () =>
    Effect.gen(function* () {
      const r = makeTestRegistry()

      // Enable overlayA in container1
      updateContainers(r, (current) =>
        createContainer(current, testContainerId)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayA)
      )

      // Enable overlayB in container2
      updateContainers(r, (current) =>
        createContainer(current, testContainerId2)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId2, overlayB)
      )

      // Check isolation
      const overlays1 = r.get(activeOverlaysAtom(testContainerId))
      const overlays2 = r.get(activeOverlaysAtom(testContainerId2))

      expect(overlays1.map((o: any) => o.id)).toContain(overlayA)
      expect(overlays1.map((o: any) => o.id)).not.toContain(overlayB)

      expect(overlays2.map((o: any) => o.id)).toContain(overlayB)
      expect(overlays2.map((o: any) => o.id)).not.toContain(overlayA)
    })
  )

  it.effect("destroying container does not affect other containers", () =>
    Effect.gen(function* () {
      const r = makeTestRegistry()

      updateContainers(r, (current) =>
        createContainer(current, testContainerId)
      )
      updateContainers(r, (current) =>
        createContainer(current, testContainerId2)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayA)
      )
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId2, overlayB)
      )

      // Destroy container1
      updateContainers(r, (current) =>
        destroyContainer(current, testContainerId)
      )

      // Container2 should be unaffected
      const ids = r.get(containerIdsAtom)
      expect(ids).not.toContain(testContainerId)
      expect(ids).toContain(testContainerId2)

      const overlays2 = r.get(activeOverlaysAtom(testContainerId2))
      expect(overlays2.map((o: any) => o.id)).toContain(overlayB)
    })
  )
})

// ─────────────────────────────────────────────────────────────
// OV-H9: EventLog Replay
// ─────────────────────────────────────────────────────────────

describe.skip("OV-H9: EventLog Replay", () => {
  // This test requires full EventLog/EventJournal integration
  // which needs persistent storage backend. Skip for now.
  it("event replay restores state after reload", () => {
    // Would test:
    // 1. Create containers and enable overlays
    // 2. Simulate "reload" by resetting atom state
    // 3. Call replayEvents()
    // 4. Verify state matches original
  })
})

// ─────────────────────────────────────────────────────────────
// OV-H10: Reactive Overlay
// ─────────────────────────────────────────────────────────────

layer(TestServicesLive)("OV-H10: Reactive Overlay", (it) => {
  it.scoped("overlay state updates trigger atom reactivity", () =>
    Effect.gen(function* () {
      const r = makeTestRegistry()

      // Track state changes
      const stateHistory: number[] = []

      // Subscribe to overlay count changes (immediate: true fires initial value)
      const unsubscribe = r.subscribe(
        activeOverlaysAtom(testContainerId),
        (overlays) => {
          stateHistory.push(overlays.length)
        },
        { immediate: true }
      )

      try {
        updateContainers(r, (current) =>
          createContainer(current, testContainerId)
        )

        // Enable overlays
        updateContainers(r, (current) =>
          enableOverlay(current, testContainerId, overlayA)
        )
        updateContainers(r, (current) =>
          enableOverlay(current, testContainerId, overlayB)
        )

        // Disable one
        updateContainers(r, (current) =>
          disableOverlay(current, testContainerId, overlayA)
        )

        // State history should reflect changes
        // Initial subscription call + 3 operations
        expect(stateHistory.length).toBeGreaterThanOrEqual(3)
        // Should end with 1 overlay (B enabled, A disabled)
        expect(stateHistory[stateHistory.length - 1]).toBe(1)
      } finally {
        unsubscribe()
      }
    })
  )

  it.scoped("port message triggers subscriber update", () =>
    Effect.gen(function* () {
      const hub = yield* PortHub

      const portId = "reactive-port" as any

      // Subscribe
      const stream = yield* hub.subscribe<number>(testContainerId, portId)

      // Publish multiple values
      yield* hub.publish(testContainerId, portId, 1)
      yield* hub.publish(testContainerId, portId, 2)
      yield* hub.publish(testContainerId, portId, 3)

      // Collect all
      const messages = yield* stream.pipe(Stream.take(3), Stream.runCollect)
      const values = Chunk.toReadonlyArray(messages)

      expect(values).toEqual([1, 2, 3])
    })
  )

  it.effect("derived atoms update when source changes", () =>
    Effect.gen(function* () {
      const r = makeTestRegistry()

      updateContainers(r, (current) =>
        createContainer(current, testContainerId)
      )

      // containerAtom derives from containersStateAtom
      const containerBefore = r.get(containerAtom(testContainerId))
      expect(containerBefore?.activeOverlays).toHaveLength(0)

      // Mutate source
      updateContainers(r, (current) =>
        enableOverlay(current, testContainerId, overlayA)
      )

      // Derived should update
      const containerAfter = r.get(containerAtom(testContainerId))
      expect(containerAfter?.activeOverlays).toHaveLength(1)
    })
  )
})
