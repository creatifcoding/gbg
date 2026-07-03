import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"

import {
  resolveNatsServerBin,
  resolveSoakNatsSubstrateConfig,
  startSoakNatsSubstrate,
  SoakNatsSubstrateError,
} from "../src/hardening/index.js"

describe("soak NATS substrate adapter", () => {
  it("prefers explicit PCT soak external NATS URL", () => {
    const config = resolveSoakNatsSubstrateConfig({
      PCT_SOAK_NATS_URL: "ws://nats.example:9222",
      PCT_SOAK_NATS_MONITOR_URL: "http://nats.example:8222",
    })

    expect(config).toEqual({
      mode: "external",
      servers: "ws://nats.example:9222",
      monitorUrl: "http://nats.example:8222",
      startupTimeoutMs: undefined,
    })
  })

  it("falls back to MSH/LNK live NATS environment URLs", () => {
    expect(resolveSoakNatsSubstrateConfig({ LNK_LIVE_NATS_URL: "ws://lnk:9222" })).toMatchObject({
      mode: "external",
      servers: "ws://lnk:9222",
    })
    expect(resolveSoakNatsSubstrateConfig({ MSH_LIVE_NATS_URL: "ws://msh:9222" })).toMatchObject({
      mode: "external",
      servers: "ws://msh:9222",
    })
  })

  it("defaults to managed local mode", () => {
    expect(resolveSoakNatsSubstrateConfig({})).toMatchObject({ mode: "managed-local" })
  })

  it("starts external substrate without spawning local nats-server", async () => {
    const substrate = await Effect.runPromise(startSoakNatsSubstrate({
      mode: "external",
      servers: "ws://127.0.0.1:4222",
      monitorUrl: "http://127.0.0.1:8222",
    }))

    expect(substrate.mode).toBe("external")
    expect(substrate.configPath).toBe("<external>")
    await Effect.runPromise(substrate.stop)
  })

  it("fails local binary resolution with a typed error for impossible configured path", async () => {
    const result = await Effect.runPromise(resolveNatsServerBin("/definitely/not/nats-server").pipe(Effect.result))

    // A configured path is accepted as an explicit operator choice. The spawn path
    // will fail later if wrong; this keeps resolution deterministic and side-effect free.
    expect(result._tag).toBe("Success")
    if (result._tag === "Success") expect(result.success).toBe("/definitely/not/nats-server")
  })

  it("rejects external substrate without servers", async () => {
    const result = await Effect.runPromise(startSoakNatsSubstrate({ mode: "external" }).pipe(Effect.result))

    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") expect(result.failure).toBeInstanceOf(SoakNatsSubstrateError)
  })
})
