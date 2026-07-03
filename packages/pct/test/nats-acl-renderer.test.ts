import { describe, expect, it } from "vitest"

import {
  MinimalPctRuntimePermissionProfile,
  PermissionContractSchemaVersion,
  PermissionProfile,
  renderNatsAclProfile,
} from "../src/hardening/index.js"

describe("NATS ACL renderer", () => {
  it("renders deterministic NATS authorization users from permission profiles", () => {
    const rendered = renderNatsAclProfile(MinimalPctRuntimePermissionProfile)

    expect(rendered).toContain("authorization {")
    expect(rendered).toContain('user: "diagnostics-readonly"')
    expect(rendered).toContain('user: "pct-runtime"')
    expect(rendered).toContain("password: $PCT_NATS_PASSWORD_PCT_RUNTIME")
    expect(rendered).toContain('allow: ["_INBOX.>", "pct.capabilities.get", "pct.schema.get"]')
    expect(rendered).toContain('allow: ["$JS.API.INFO"]')
  })

  it("maps KV bucket rules to NATS KV subjects", () => {
    const profile = PermissionProfile.make({
      schemaVersion: PermissionContractSchemaVersion,
      profileId: "lnk-bridge-kv@1",
      rules: [
        {
          persona: "lnk-bridge",
          resourceKind: "kv-bucket",
          resource: "lnk_metadata",
          actions: ["read", "write"],
          effect: "allow",
          reason: "Bridge metadata read/write.",
        },
      ],
    })

    const rendered = renderNatsAclProfile(profile)
    expect(rendered).toContain('allow: ["$KV.lnk_metadata.>"]')
  })

  it("renders deny rules separately from allow rules", () => {
    const profile = PermissionProfile.make({
      schemaVersion: PermissionContractSchemaVersion,
      profileId: "diagnostics-deny-write@1",
      rules: [
        {
          persona: "diagnostics-readonly",
          resourceKind: "kv-bucket",
          resource: "lnk_metadata",
          actions: ["write"],
          effect: "deny",
          reason: "Diagnostics must not mutate metadata.",
        },
      ],
    })

    const rendered = renderNatsAclProfile(profile)
    expect(rendered).toContain('deny: ["$KV.lnk_metadata.>"]')
  })

  it("supports private inbox subject override", () => {
    const rendered = renderNatsAclProfile(MinimalPctRuntimePermissionProfile, {
      inboxSubject: "_INBOX.pct-runtime.>",
      passwordEnvPrefix: "NATS_PASS",
    })

    expect(rendered).toContain('allow: ["_INBOX.pct-runtime.>", "pct.capabilities.get", "pct.schema.get"]')
    expect(rendered).toContain("password: $NATS_PASS_PCT_RUNTIME")
  })
})
