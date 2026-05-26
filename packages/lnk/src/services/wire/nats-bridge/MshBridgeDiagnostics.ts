/** Read-only diagnostics checks for the LNK MSH bridge substrate. */

import * as Cause from "effect-v4/Cause"
import * as Context from "effect-v4/Context"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import {
  DiagnosticCheck,
  DiagnosticFinding,
  DiagnosticReport,
  maxSeverity,
  redactCause,
} from "@tmnl/msh/diagnostics"
import { NatsKVService, NatsStreamService } from "@tmnl/msh/nats"

import type { StreamId } from "../../../contracts/StreamId.js"
import {
  metadataKeyForStream,
  resolveMshBridgeSubstrateOptions,
  streamNameForStream,
  type MshBridgeSubstrateOptions,
  type ResolvedMshBridgeSubstrateOptions,
} from "./MshBridgeConfig.js"

export interface MshBridgeDiagnosticsShape {
  readonly options: ResolvedMshBridgeSubstrateOptions
  readonly checkMetadataBucket: Effect.Effect<DiagnosticCheck>
  readonly checkDataStream: (streamId: StreamId) => Effect.Effect<DiagnosticCheck>
  readonly report: Effect.Effect<DiagnosticReport>
}

export class MshBridgeDiagnostics extends Context.Service<
  MshBridgeDiagnostics,
  MshBridgeDiagnosticsShape
>()("@tmnl/lnk/wire/nats-bridge/MshBridgeDiagnostics") {}

const finding = (input: typeof DiagnosticFinding.Type): DiagnosticFinding =>
  DiagnosticFinding.make(input)

const failedCheck = (
  checkId: string,
  component: string,
  durationMs: number,
  observedAt: number,
  cause: Cause.Cause<unknown>,
  remediation: string,
): DiagnosticCheck => DiagnosticCheck.make({
  checkId,
  layer: "lnk",
  component,
  status: "failed",
  severity: "critical",
  durationMs,
  findings: [finding({
    severity: "critical",
    code: `${checkId}.failed`,
    message: `${component} check failed`,
    layer: "lnk",
    component,
    safeCause: redactCause(cause),
    remediation,
  })],
  observedAt,
})

const passedCheck = (
  checkId: string,
  component: string,
  durationMs: number,
  observedAt: number,
  findings: ReadonlyArray<DiagnosticFinding>,
): DiagnosticCheck => DiagnosticCheck.make({
  checkId,
  layer: "lnk",
  component,
  status: "passed",
  severity: maxSeverity(findings.map((item) => item.severity)),
  durationMs,
  findings: [...findings],
  observedAt,
})

export const makeMshBridgeDiagnostics = (
  options: MshBridgeSubstrateOptions = {},
): Effect.Effect<MshBridgeDiagnosticsShape, never, NatsKVService | NatsStreamService> =>
  Effect.gen(function* () {
    const resolved = resolveMshBridgeSubstrateOptions(options)
    const kv = yield* NatsKVService
    const stream = yield* NatsStreamService

    const checkMetadataBucket: Effect.Effect<DiagnosticCheck> = Effect.gen(function* () {
      const started = Date.now()
      const exit = yield* Effect.exit(kv.keys(resolved.metadataBucket))
      const observedAt = Date.now()
      const durationMs = observedAt - started
      if (exit._tag === "Failure") {
        return failedCheck(
          "lnk.mshBridge.metadata.bucket",
          "metadata",
          durationMs,
          observedAt,
          exit.cause,
          "Verify the MSH bridge metadata bucket exists and KV read permissions are granted.",
        )
      }
      return passedCheck("lnk.mshBridge.metadata.bucket", "metadata", durationMs, observedAt, [finding({
        severity: "ok",
        code: "lnk.mshBridge.metadata.bucket.available",
        message: `metadata bucket '${resolved.metadataBucket}' is readable (${exit.value.length} keys)`,
        layer: "lnk",
        component: "metadata",
        bucket: resolved.metadataBucket,
      })])
    })

    const checkDataStream = (streamId: StreamId): Effect.Effect<DiagnosticCheck> => Effect.gen(function* () {
      const name = streamNameForStream(streamId, resolved)
      const started = Date.now()
      const exit = yield* Effect.exit(stream.getStreamInfo(name))
      const observedAt = Date.now()
      const durationMs = observedAt - started
      if (exit._tag === "Failure") {
        return failedCheck(
          "lnk.mshBridge.stream.info",
          "stream",
          durationMs,
          observedAt,
          exit.cause,
          "Verify the MSH bridge data stream and stream info permissions.",
        )
      }
      if (exit.value === null) {
        const metadataKey = metadataKeyForStream(streamId)
        return DiagnosticCheck.make({
          checkId: "lnk.mshBridge.stream.info",
          layer: "lnk",
          component: "stream",
          status: "degraded",
          severity: "warn",
          durationMs,
          findings: [finding({
            severity: "warn",
            code: "lnk.mshBridge.stream.info.missing",
            message: `bridge data stream '${name}' for stream '${streamId as string}' was not found`,
            layer: "lnk",
            component: "stream",
            stream: name,
            remediation: `Create or append the durable stream; metadata key would be '${metadataKey}'.`,
          })],
          observedAt,
        })
      }
      return passedCheck("lnk.mshBridge.stream.info", "stream", durationMs, observedAt, [finding({
        severity: "ok",
        code: "lnk.mshBridge.stream.info.available",
        message: `bridge data stream '${name}' is available`,
        layer: "lnk",
        component: "stream",
        stream: name,
      })])
    })

    const report: Effect.Effect<DiagnosticReport> = Effect.gen(function* () {
      const checks = yield* Effect.all([checkMetadataBucket], { concurrency: "unbounded" })
      return DiagnosticReport.make({
        reportId: `lnk-msh-bridge:${Date.now()}`,
        layer: "lnk",
        severity: maxSeverity(checks.map((check) => check.severity)),
        checks,
        generatedAt: Date.now(),
      })
    })

    return MshBridgeDiagnostics.of({
      options: resolved,
      checkMetadataBucket,
      checkDataStream,
      report,
    })
  })

export const mshBridgeDiagnosticsLayer = (
  options: MshBridgeSubstrateOptions = {},
): Layer.Layer<MshBridgeDiagnostics, never, NatsKVService | NatsStreamService> =>
  Layer.effect(MshBridgeDiagnostics, makeMshBridgeDiagnostics(options))
