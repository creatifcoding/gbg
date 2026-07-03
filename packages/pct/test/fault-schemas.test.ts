import { describe, expect, it } from "vitest"
import * as Schema from "effect/Schema"

import {
  FaultRunReport,
  FaultScenario,
  FaultScenarioSchemaVersion,
  LocalNatsBounceScenario,
} from "../src/hardening/index.js"

describe("fault hardening schemas", () => {
  it("defines the local NATS bounce scenario as an explicit opt-in fault", () => {
    expect(LocalNatsBounceScenario.mode).toBe("local-nats-bounce")
    expect(LocalNatsBounceScenario.steps.map((step) => step.fault)).toEqual(["disconnect", "reconnect"])
    expect(LocalNatsBounceScenario.expectations.map((expectation) => expectation.expectation)).toEqual([
      "parks-work",
      "recovers",
    ])
  })

  it("round-trips fault scenarios", () => {
    const scenario = FaultScenario.make({
      schemaVersion: FaultScenarioSchemaVersion,
      scenarioId: "outbox-fail-n@1",
      description: "Outbox publish fails twice then succeeds without duplicate emitted frames.",
      mode: "mock",
      steps: [
        {
          stepId: "outbox-fail-twice",
          atMs: 0,
          targetLayer: "outbox",
          operation: "outbox.publish",
          fault: "fail-n-times-then-succeed",
          mode: "mock",
          failCount: 2,
        },
      ],
      expectations: [
        {
          stepId: "outbox-fail-twice",
          expectation: "recovers",
          maxRecoveryMs: 1_000,
          invariant: "Outbox replay remains duplicate-safe via idempotency key.",
        },
      ],
    })

    expect(Schema.decodeUnknownSync(FaultScenario)(Schema.encodeUnknownSync(FaultScenario)(scenario))).toEqual(scenario)
  })

  it("validates fault run reports", () => {
    const report = FaultRunReport.make({
      schemaVersion: FaultScenarioSchemaVersion,
      runId: "fault-run-1",
      scenarioId: LocalNatsBounceScenario.scenarioId,
      status: "passed",
      startedAt: "2026-05-26T00:00:00.000Z",
      completedAt: "2026-05-26T00:00:10.000Z",
      observedFailures: ["disconnect-nats"],
      satisfiedExpectations: ["disconnect-nats", "reconnect-nats"],
      unsatisfiedExpectations: [],
    })

    expect(Schema.decodeUnknownSync(FaultRunReport)(Schema.encodeUnknownSync(FaultRunReport)(report))).toEqual(report)
  })

  it("rejects unsupported fault kinds", () => {
    expect(() =>
      Schema.decodeUnknownSync(FaultScenario)({
        schemaVersion: FaultScenarioSchemaVersion,
        scenarioId: "bad",
        description: "bad",
        mode: "mock",
        steps: [
          {
            stepId: "bad-step",
            atMs: 0,
            targetLayer: "msh",
            operation: "core.request",
            fault: "cosmic-ray",
            mode: "mock",
          },
        ],
        expectations: [],
      }),
    ).toThrow(/timeout|disconnect|reconnect/)
  })
})
