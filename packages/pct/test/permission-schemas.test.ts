import { describe, expect, it } from "vitest"
import * as Schema from "effect/Schema"

import {
  DefaultPermissionMatrix,
  MinimalPctRuntimePermissionProfile,
  PermissionContractSchemaVersion,
  PermissionMatrix,
  PermissionProfile,
} from "../src/hardening/index.js"

describe("permission hardening schemas", () => {
  it("defines a minimal PCT runtime profile without changing LNK resolver API", () => {
    expect(MinimalPctRuntimePermissionProfile.profileId).toBe("pct-runtime-minimal@1")
    expect(MinimalPctRuntimePermissionProfile.rules.map((rule) => rule.resource)).toContain("pct.schema.get")
    expect(MinimalPctRuntimePermissionProfile.rules.map((rule) => rule.resource)).toContain("pct.capabilities.get")
  })

  it("round-trips permission profiles", () => {
    const profile = PermissionProfile.make({
      schemaVersion: PermissionContractSchemaVersion,
      profileId: "diagnostics-readonly@1",
      rules: [
        {
          persona: "diagnostics-readonly",
          resourceKind: "jetstream-api",
          resource: "$JS.API.INFO",
          actions: ["request", "read"],
          effect: "allow",
          reason: "Read-only diagnostics info request.",
        },
      ],
    })

    expect(Schema.decodeUnknownSync(PermissionProfile)(Schema.encodeUnknownSync(PermissionProfile)(profile))).toEqual(profile)
  })

  it("captures allow and deny probe expectations", () => {
    expect(DefaultPermissionMatrix.probes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ expected: "deny", resourceKind: "kv-bucket" }),
        expect.objectContaining({ expected: "allow", resource: "pct.schema.get" }),
      ]),
    )
  })

  it("rejects unknown permission personas", () => {
    expect(() =>
      Schema.decodeUnknownSync(PermissionMatrix)({
        schemaVersion: PermissionContractSchemaVersion,
        matrixId: "bad",
        profiles: [
          {
            schemaVersion: PermissionContractSchemaVersion,
            profileId: "bad-profile",
            rules: [
              {
                persona: "root",
                resourceKind: "nats-subject",
                resource: ">",
                actions: ["admin"],
                effect: "allow",
                reason: "nope",
              },
            ],
          },
        ],
        probes: [],
      }),
    ).toThrow(/pct-admin|pct-runtime|lnk-bridge/)
  })
})
