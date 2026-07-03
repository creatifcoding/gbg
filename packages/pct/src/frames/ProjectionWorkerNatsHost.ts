/**
 * ProjectionWorker NATS micro host adapter.
 *
 * This module binds ProjectionWorker semantic operations to MSH's generic
 * schema-backed micro endpoint host. MSH remains a substrate: it sees endpoint
 * schemas and handlers only. The control-plane semantics live in the injected
 * ProjectionWorkerControl service.
 *
 * @module @tmnl/pct/frames/ProjectionWorkerNatsHost
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"

import {
  MshMicroEndpointHost,
  type MshHostedMicroService,
  type MshMicroEndpointSpec,
  type MshMicroErrorResponse,
} from "@tmnl/msh/nats"

import {
  ProjectionPlanRequest,
  ProjectionPlanResponse,
  ProjectionRunOnceRequest,
  ProjectionRunOnceResponse,
  ProjectionStartRequest,
  ProjectionStartResponse,
  ProjectionStatusRequest,
  ProjectionStatusResponse,
  ProjectionStopRequest,
  ProjectionStopResponse,
  ProjectionTailRequest,
  ProjectionTailResponse,
  type ProjectionWorkerNatsOptions,
  type ResolvedProjectionWorkerNatsOptions,
  resolveProjectionWorkerNatsOptions,
} from "./NatsMicroContracts.js"

type PureSchema = Schema.Top & {
  readonly DecodingServices: never
  readonly EncodingServices: never
}

// ─── Control service ───────────────────────────────────────────────────────

export interface ProjectionWorkerControlShape {
  readonly plan: (
    request: ProjectionPlanRequest,
  ) => Effect.Effect<ProjectionPlanResponse, unknown, never>
  readonly start: (
    request: ProjectionStartRequest,
  ) => Effect.Effect<ProjectionStartResponse, unknown, never>
  readonly stop: (
    request: ProjectionStopRequest,
  ) => Effect.Effect<ProjectionStopResponse, unknown, never>
  readonly status: (
    request: ProjectionStatusRequest,
  ) => Effect.Effect<ProjectionStatusResponse, unknown, never>
  readonly runOnce: (
    request: ProjectionRunOnceRequest,
  ) => Effect.Effect<ProjectionRunOnceResponse, unknown, never>
  readonly tail: (
    request: ProjectionTailRequest,
  ) => Effect.Effect<ProjectionTailResponse, unknown, never>
}

export class ProjectionWorkerControl extends Context.Service<
  ProjectionWorkerControl,
  ProjectionWorkerControlShape
>()("@tmnl/pct/frames/ProjectionWorkerControl") {}

// ─── Errors ─────────────────────────────────────────────────────────────────

export class ProjectionWorkerControlFailure extends Schema.TaggedErrorClass<ProjectionWorkerControlFailure>()(
  "ProjectionWorkerControlFailure",
  {
    operation: Schema.String,
    message: Schema.String,
  },
) {}

const errorMessage = (cause: unknown): string => {
  if (typeof cause === "object" && cause !== null && "message" in cause) {
    return String((cause as { readonly message?: unknown }).message ?? cause)
  }
  return String(cause)
}

export const mapProjectionWorkerNatsError = (cause: unknown): MshMicroErrorResponse => {
  if (cause instanceof ProjectionWorkerControlFailure) {
    return {
      code: 500,
      message: `${cause.operation}: ${cause.message}`,
    }
  }
  return {
    code: 500,
    message: errorMessage(cause) || "ProjectionWorker NATS endpoint failed",
  }
}

// ─── Endpoint adapter ───────────────────────────────────────────────────────

const endpointMetadata = (
  operation: string,
  request: string,
  response: string,
): Record<string, string> => ({
  domain: "pct",
  role: "projection-worker",
  operation,
  request,
  response,
  boundary: "semantic-worker-over-msh-micro-substrate",
})

export const makeProjectionWorkerNatsEndpoints = (
  control: ProjectionWorkerControlShape,
  resolved: ResolvedProjectionWorkerNatsOptions,
): ReadonlyArray<MshMicroEndpointSpec<PureSchema, PureSchema>> => {
  const queue = resolved.queue
  const endpoints = [
    {
      name: "projection-plan",
      subject: resolved.subjects.plan,
      ...(queue !== undefined ? { queue } : {}),
      metadata: endpointMetadata("projection.plan", "ProjectionPlanRequest", "ProjectionPlanResponse"),
      requestSchema: ProjectionPlanRequest,
      responseSchema: ProjectionPlanResponse,
      handle: control.plan,
      mapError: mapProjectionWorkerNatsError,
    },
    {
      name: "projection-start",
      subject: resolved.subjects.start,
      ...(queue !== undefined ? { queue } : {}),
      metadata: endpointMetadata("projection.start", "ProjectionStartRequest", "ProjectionStartResponse"),
      requestSchema: ProjectionStartRequest,
      responseSchema: ProjectionStartResponse,
      handle: control.start,
      mapError: mapProjectionWorkerNatsError,
    },
    {
      name: "projection-stop",
      subject: resolved.subjects.stop,
      ...(queue !== undefined ? { queue } : {}),
      metadata: endpointMetadata("projection.stop", "ProjectionStopRequest", "ProjectionStopResponse"),
      requestSchema: ProjectionStopRequest,
      responseSchema: ProjectionStopResponse,
      handle: control.stop,
      mapError: mapProjectionWorkerNatsError,
    },
    {
      name: "projection-status",
      subject: resolved.subjects.status,
      ...(queue !== undefined ? { queue } : {}),
      metadata: endpointMetadata("projection.status", "ProjectionStatusRequest", "ProjectionStatusResponse"),
      requestSchema: ProjectionStatusRequest,
      responseSchema: ProjectionStatusResponse,
      handle: control.status,
      mapError: mapProjectionWorkerNatsError,
    },
    {
      name: "projection-run-once",
      subject: resolved.subjects.runOnce,
      ...(queue !== undefined ? { queue } : {}),
      metadata: endpointMetadata("projection.run_once", "ProjectionRunOnceRequest", "ProjectionRunOnceResponse"),
      requestSchema: ProjectionRunOnceRequest,
      responseSchema: ProjectionRunOnceResponse,
      handle: control.runOnce,
      mapError: mapProjectionWorkerNatsError,
    },
    {
      name: "projection-tail",
      subject: resolved.subjects.tail,
      ...(queue !== undefined ? { queue } : {}),
      metadata: endpointMetadata("projection.tail", "ProjectionTailRequest", "ProjectionTailResponse"),
      requestSchema: ProjectionTailRequest,
      responseSchema: ProjectionTailResponse,
      handle: control.tail,
      mapError: mapProjectionWorkerNatsError,
    },
  ]

  return endpoints as unknown as ReadonlyArray<MshMicroEndpointSpec<PureSchema, PureSchema>>
}

// ─── Hosted service ─────────────────────────────────────────────────────────

export interface ProjectionWorkerNatsHostShape {
  readonly options: ResolvedProjectionWorkerNatsOptions
  readonly hosted: MshHostedMicroService
  readonly identity: MshHostedMicroService["identity"]
  readonly info: MshHostedMicroService["info"]
  readonly stats: MshHostedMicroService["stats"]
  readonly stop: MshHostedMicroService["stop"]
}

export class ProjectionWorkerNatsHost extends Context.Service<
  ProjectionWorkerNatsHost,
  ProjectionWorkerNatsHostShape
>()("@tmnl/pct/frames/ProjectionWorkerNatsHost") {}

export const makeProjectionWorkerNatsHost = (
  options: ProjectionWorkerNatsOptions = {},
): Effect.Effect<
  ProjectionWorkerNatsHostShape,
  never,
  MshMicroEndpointHost | ProjectionWorkerControl | Scope.Scope
> =>
  Effect.gen(function* () {
    const resolved = resolveProjectionWorkerNatsOptions(options)
    const host = yield* MshMicroEndpointHost
    const control = yield* ProjectionWorkerControl
    const endpoints = makeProjectionWorkerNatsEndpoints(control, resolved)

    const hosted = yield* host.host(
      {
        name: resolved.serviceName,
        version: resolved.serviceVersion,
        description: resolved.serviceDescription,
        metadata: resolved.metadata,
      },
      endpoints,
    )

    return ProjectionWorkerNatsHost.of({
      options: resolved,
      hosted,
      identity: hosted.identity,
      info: hosted.info,
      stats: hosted.stats,
      stop: hosted.stop,
    })
  }).pipe(Effect.orDie)

export const projectionWorkerNatsHostLayer = (
  options: ProjectionWorkerNatsOptions = {},
): Layer.Layer<ProjectionWorkerNatsHost, never, MshMicroEndpointHost | ProjectionWorkerControl> =>
  Layer.effect(ProjectionWorkerNatsHost, makeProjectionWorkerNatsHost(options))
