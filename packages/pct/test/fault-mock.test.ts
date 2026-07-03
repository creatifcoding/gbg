import { describe, expect, it } from "vitest"

import { FaultScenario, FaultScenarioSchemaVersion, makeFaultMockDriver } from "../src/hardening/index.js"

const scenario = FaultScenario.make({
  schemaVersion: FaultScenarioSchemaVersion,
  scenarioId: "mock-faults@1",
  description: "Deterministic mock faults for publish and KV operations.",
  mode: "mock",
  steps: [
    {
      stepId: "publish-timeout",
      atMs: 100,
      targetLayer: "msh",
      operation: "jetstream.publish",
      fault: "timeout",
      mode: "mock",
      failCount: 2,
    },
    {
      stepId: "kv-window",
      atMs: 200,
      durationMs: 100,
      targetLayer: "msh",
      operation: "kv.update",
      fault: "permission-denied",
      mode: "mock",
    },
    {
      stepId: "live-only",
      atMs: 50,
      targetLayer: "nats",
      operation: "connection.status",
      fault: "disconnect",
      mode: "local-nats-bounce",
    },
  ],
  expectations: [],
})

describe("deterministic mock fault DSL", () => {
  it("matches mock faults by layer, operation, time, and attempt", () => {
    const driver = makeFaultMockDriver(scenario)

    expect(driver.match({ atMs: 100, targetLayer: "msh", operation: "jetstream.publish", attempt: 1 })?.fault).toBe("timeout")
    expect(driver.match({ atMs: 100, targetLayer: "msh", operation: "jetstream.publish", attempt: 2 })?.fault).toBe("timeout")
    expect(driver.match({ atMs: 100, targetLayer: "msh", operation: "jetstream.publish", attempt: 3 })).toBeNull()
  })

  it("supports duration windows", () => {
    const driver = makeFaultMockDriver(scenario)

    expect(driver.shouldFail({ atMs: 199, targetLayer: "msh", operation: "kv.update" })).toBe(false)
    expect(driver.shouldFail({ atMs: 200, targetLayer: "msh", operation: "kv.update" })).toBe(true)
    expect(driver.shouldFail({ atMs: 299, targetLayer: "msh", operation: "kv.update" })).toBe(true)
    expect(driver.shouldFail({ atMs: 300, targetLayer: "msh", operation: "kv.update" })).toBe(false)
  })

  it("ignores non-mock scenario steps", () => {
    const driver = makeFaultMockDriver(scenario)

    expect(driver.match({ atMs: 50, targetLayer: "nats", operation: "connection.status" })).toBeNull()
  })

  it("returns deterministic first step ordering", () => {
    const overlapping = FaultScenario.make({
      ...scenario,
      steps: [
        {
          stepId: "b",
          atMs: 10,
          targetLayer: "outbox",
          operation: "outbox.publish",
          fault: "timeout",
          mode: "mock",
        },
        {
          stepId: "a",
          atMs: 10,
          targetLayer: "outbox",
          operation: "outbox.publish",
          fault: "poison-message",
          mode: "mock",
        },
      ],
    })

    expect(makeFaultMockDriver(overlapping).match({ atMs: 10, targetLayer: "outbox", operation: "outbox.publish" })?.step.stepId).toBe("a")
  })
})
