/**
 * PCT NATS control-plane host.
 *
 * This is the PCT-owned semantic adapter over MSH's generic micro endpoint
 * substrate. MSH hosts schema-backed request/reply endpoints; this module
 * decides which PCT registry operations those endpoints expose.
 *
 * @module @tmnl/pct/server/NatsControlPlane
 */

import * as Context from "effect-v4/Context"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Option from "effect-v4/Option"
import * as Schema from "effect-v4/Schema"
import type * as Scope from "effect-v4/Scope"

import {
  MshMicroEndpointHost,
  type MshHostedMicroService,
  type MshMicroEndpointSpec,
  type MshMicroErrorResponse,
} from "@tmnl/msh/nats"

import { Identity } from "../identity/Identity.js"
import { Manifest } from "../manifest/Manifest.js"
import { Registry } from "../registry/Registry.js"
import {
  CapabilitiesGetRequest,
  GetSchemaResponse,
  SchemaGetRequest,
} from "./wire.js"

type PureSchema = Schema.Top & {
  readonly DecodingServices: never
  readonly EncodingServices: never
}

// ─── Options ────────────────────────────────────────────────────────────────

export interface PctNatsControlPlaneOptions {
  /** Root for all PCT control-plane subjects. */
  readonly subjectRoot?: string
  /** NATS micro service name exposed through `$SRV.INFO`. */
  readonly serviceName?: string
  /** NATS micro service version exposed through `$SRV.INFO`. */
  readonly serviceVersion?: string
  /** Optional human description for service discovery. */
  readonly serviceDescription?: string
  /** Optional endpoint queue group. */
  readonly queue?: string
  /** Extra metadata exposed through NATS service discovery. */
  readonly metadata?: Record<string, string>
}

export interface ResolvedPctNatsControlPlaneOptions {
  readonly subjectRoot: string
  readonly serviceName: string
  readonly serviceVersion: string
  readonly serviceDescription: string
  readonly queue: string | undefined
  readonly metadata: Record<string, string>
  readonly subjects: {
    readonly schemaGet: string
    readonly capabilitiesGet: string
  }
}

export const DEFAULT_PCT_NATS_CONTROL_PLANE_OPTIONS = {
  subjectRoot: "pct.v1",
  serviceName: "pct-control-plane",
  serviceVersion: "0.1.0",
  serviceDescription: "PCT NATS control plane",
} as const

export const resolvePctNatsControlPlaneOptions = (
  options: PctNatsControlPlaneOptions = {},
): ResolvedPctNatsControlPlaneOptions => {
  const subjectRoot = options.subjectRoot ?? DEFAULT_PCT_NATS_CONTROL_PLANE_OPTIONS.subjectRoot
  return {
    subjectRoot,
    serviceName: options.serviceName ?? DEFAULT_PCT_NATS_CONTROL_PLANE_OPTIONS.serviceName,
    serviceVersion: options.serviceVersion ?? DEFAULT_PCT_NATS_CONTROL_PLANE_OPTIONS.serviceVersion,
    serviceDescription:
      options.serviceDescription ?? DEFAULT_PCT_NATS_CONTROL_PLANE_OPTIONS.serviceDescription,
    queue: options.queue,
    metadata: {
      domain: "pct",
      role: "control-plane",
      subjectRoot,
      ...(options.metadata ?? {}),
    },
    subjects: {
      schemaGet: `${subjectRoot}.schema.get`,
      capabilitiesGet: `${subjectRoot}.capabilities.get`,
    },
  }
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export class PctNatsSchemaNotFound extends Schema.TaggedErrorClass<PctNatsSchemaNotFound>()(
  "PctNatsSchemaNotFound",
  {
    schemaId: Schema.String,
  },
) {}

const errorMessage = (cause: unknown): string => {
  if (typeof cause === "object" && cause !== null && "message" in cause) {
    return String((cause as { readonly message?: unknown }).message ?? cause)
  }
  return String(cause)
}

const mapPctControlPlaneError = (cause: unknown): MshMicroErrorResponse => {
  if (cause instanceof PctNatsSchemaNotFound) {
    return {
      code: 404,
      message: `schema not found: ${cause.schemaId}`,
    }
  }
  return {
    code: 500,
    message: errorMessage(cause) || "PCT NATS control-plane endpoint failed",
  }
}

// ─── Service ────────────────────────────────────────────────────────────────

export interface PctNatsControlPlaneShape {
  readonly options: ResolvedPctNatsControlPlaneOptions
  readonly hosted: MshHostedMicroService
  readonly identity: MshHostedMicroService["identity"]
  readonly info: MshHostedMicroService["info"]
  readonly stats: MshHostedMicroService["stats"]
  readonly stop: MshHostedMicroService["stop"]
}

export class PctNatsControlPlane extends Context.Service<
  PctNatsControlPlane,
  PctNatsControlPlaneShape
>()("@tmnl/pct/server/NatsControlPlane") {}

export const make = (
  options: PctNatsControlPlaneOptions = {},
): Effect.Effect<
  PctNatsControlPlaneShape,
  never,
  MshMicroEndpointHost | Registry | Identity | Scope.Scope
> =>
  Effect.gen(function* () {
    const resolved = resolvePctNatsControlPlaneOptions(options)
    const host = yield* MshMicroEndpointHost
    const registry = yield* Registry
    const identity = yield* Identity

    const schemaGetEndpoint: MshMicroEndpointSpec<
      typeof SchemaGetRequest,
      typeof GetSchemaResponse
    > = {
      name: "schema-get",
      subject: resolved.subjects.schemaGet,
      ...(resolved.queue !== undefined ? { queue: resolved.queue } : {}),
      metadata: {
        domain: "pct",
        operation: "schema.get",
        request: "PctSchemaGetRequest",
        response: "PctGetSchemaResponse",
      },
      requestSchema: SchemaGetRequest,
      responseSchema: GetSchemaResponse,
      handle: (request) =>
        Effect.gen(function* () {
          const entry = yield* registry.getSchema(request.schemaId)
          if (entry === undefined) {
            return yield* Effect.fail(new PctNatsSchemaNotFound({ schemaId: request.schemaId }))
          }
          return {
            schemaId: entry.schemaId,
            version: entry.version,
            schemaDocument: entry.schemaDocument,
            description: entry.description ?? null,
            registeredAt: entry.registeredAt,
            originNodeId: entry.originNodeId,
            deprecated: entry.deprecated,
          }
        }),
      mapError: mapPctControlPlaneError,
    }

    const capabilitiesGetEndpoint: MshMicroEndpointSpec<
      typeof CapabilitiesGetRequest,
      typeof Manifest
    > = {
      name: "capabilities-get",
      subject: resolved.subjects.capabilitiesGet,
      ...(resolved.queue !== undefined ? { queue: resolved.queue } : {}),
      metadata: {
        domain: "pct",
        operation: "capabilities.get",
        request: "PctCapabilitiesGetRequest",
        response: "PctManifest",
      },
      requestSchema: CapabilitiesGetRequest,
      responseSchema: Manifest,
      handle: () =>
        Effect.gen(function* () {
          const state = yield* registry.snapshot
          return Manifest.fromState(state, {
            nodeId: identity.nodeId,
            ...(Option.isSome(identity.nodeUrl)
              ? { nodeUrl: identity.nodeUrl.value }
              : {}),
          })
        }),
      mapError: mapPctControlPlaneError,
    }

    const endpoints = [schemaGetEndpoint, capabilitiesGetEndpoint] as unknown as ReadonlyArray<
      MshMicroEndpointSpec<PureSchema, PureSchema>
    >

    const hosted = yield* host.host(
      {
        name: resolved.serviceName,
        version: resolved.serviceVersion,
        description: resolved.serviceDescription,
        metadata: resolved.metadata,
      },
      endpoints,
    )

    return PctNatsControlPlane.of({
      options: resolved,
      hosted,
      identity: hosted.identity,
      info: hosted.info,
      stats: hosted.stats,
      stop: hosted.stop,
    })
  }).pipe(Effect.orDie)

export const layer = (
  options: PctNatsControlPlaneOptions = {},
): Layer.Layer<PctNatsControlPlane, never, MshMicroEndpointHost | Registry | Identity> =>
  Layer.effect(PctNatsControlPlane, make(options))
