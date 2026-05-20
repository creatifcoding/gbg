/**
 * MSH Micro Endpoint Host
 *
 * Generic, schema-backed NATS microservice endpoint hosting.
 *
 * This module intentionally knows nothing about PCT, LNK, or domain policy.
 * It only provides the substrate seam: decode request bytes with Effect Schema,
 * run an Effect handler, encode the response, and map failures to NATS service
 * error headers via `ServiceMsg.respondError`.
 *
 * @module @tmnl/msh/nats/micro-host
 */

import * as Context from 'effect-v4/Context';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import type * as Scope from 'effect-v4/Scope';
import * as Schema from 'effect-v4/Schema';
import type {
  EndpointOptions,
  MsgHdrs,
  Service,
  ServiceConfig,
  ServiceIdentity,
  ServiceInfo,
  ServiceMsg,
  ServiceStats,
} from 'nats.ws';

import { MshSpan } from '../tracing';
import { NatsCodec } from './codec';
import { Micro } from './errors';
import { NatsMicroService } from './micro';

// =============================================================================
// Types
// =============================================================================

/** Schemas used by hosted micro endpoints must be pure at callback time. */
type PureSchema = Schema.Top & {
  readonly DecodingServices: never;
  readonly EncodingServices: never;
};

export interface MshMicroErrorResponse {
  readonly code: number;
  readonly message: string;
  readonly data?: Uint8Array;
}

export interface MshMicroEndpointContext {
  readonly endpointName: string;
  readonly subject: string;
  readonly reply: string;
  readonly headers?: MsgHdrs;
  readonly raw: ServiceMsg;
  readonly service: ServiceIdentity;
}

export interface MshMicroEndpointSpec<Req extends PureSchema, Res extends PureSchema> {
  /** Endpoint name visible in NATS service INFO metadata. Must be a simple endpoint token. */
  readonly name: string;
  /** Concrete NATS subject. Defaults to `name` or group-prefixed `name`. */
  readonly subject?: string;
  /** Endpoint queue override. Inherits service/group queue when omitted. */
  readonly queue?: string;
  /** Optional endpoint metadata exposed by `$SRV.INFO`. */
  readonly metadata?: Record<string, string>;
  /** Request schema for JSON payload bytes. */
  readonly requestSchema: Req;
  /** Response schema for JSON payload bytes. */
  readonly responseSchema: Res;
  /** Effect handler. Capture dependencies before building the endpoint so this remains `never`. */
  readonly handle: (
    request: Req['Type'],
    context: MshMicroEndpointContext,
  ) => Effect.Effect<Res['Type'], unknown, never>;
  /** Optional error mapper for domain-specific failures. */
  readonly mapError?: (cause: unknown) => MshMicroErrorResponse;
}

export interface MshHostedMicroService {
  readonly service: Service;
  readonly identity: Effect.Effect<ServiceIdentity>;
  readonly info: Effect.Effect<ServiceInfo>;
  readonly stats: Effect.Effect<ServiceStats, Micro.ClientCreationError>;
  readonly stop: (err?: Error) => Effect.Effect<void, Micro.StopServiceError>;
}

export interface MshMicroEndpointHostShape {
  readonly host: (
    config: ServiceConfig,
    endpoints: ReadonlyArray<MshMicroEndpointSpec<PureSchema, PureSchema>>,
  ) => Effect.Effect<MshHostedMicroService, Micro.AddServiceError, Scope.Scope>;
}

// =============================================================================
// Errors
// =============================================================================

export class MshMicroEndpointDecodeError extends Schema.TaggedErrorClass<MshMicroEndpointDecodeError>(
  '@tmnl/msh/nats/MicroEndpointDecodeError',
)('MicroEndpointDecodeError', {
  endpointName: Schema.String,
  subject: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class MshMicroEndpointEncodeError extends Schema.TaggedErrorClass<MshMicroEndpointEncodeError>(
  '@tmnl/msh/nats/MicroEndpointEncodeError',
)('MicroEndpointEncodeError', {
  endpointName: Schema.String,
  subject: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class MshMicroEndpointRespondError extends Schema.TaggedErrorClass<MshMicroEndpointRespondError>(
  '@tmnl/msh/nats/MicroEndpointRespondError',
)('MicroEndpointRespondError', {
  endpointName: Schema.String,
  subject: Schema.String,
  message: Schema.String,
}) {}

export type MshMicroEndpointHostError =
  | MshMicroEndpointDecodeError
  | MshMicroEndpointEncodeError
  | MshMicroEndpointRespondError;

// =============================================================================
// Internal helpers
// =============================================================================

const errorMessage = (cause: unknown): string => {
  if (typeof cause === 'object' && cause !== null && 'message' in cause) {
    return String((cause as { readonly message?: unknown }).message ?? cause);
  }
  return String(cause);
};

const defaultErrorResponse = (cause: unknown): MshMicroErrorResponse => {
  if (cause instanceof MshMicroEndpointDecodeError) {
    return { code: 400, message: cause.message };
  }
  if (cause instanceof MshMicroEndpointEncodeError) {
    return { code: 500, message: cause.message };
  }
  if (cause instanceof MshMicroEndpointRespondError) {
    return { code: 500, message: cause.message };
  }
  return { code: 500, message: errorMessage(cause) || 'Micro endpoint handler failed' };
};

const decodeRequest = <Req extends PureSchema, Res extends PureSchema>(
  endpoint: MshMicroEndpointSpec<Req, Res>,
  msg: ServiceMsg,
): Effect.Effect<Req['Type'], MshMicroEndpointDecodeError> =>
  NatsCodec.decodeJson(endpoint.requestSchema, { subject: msg.subject })(msg.data).pipe(
    Effect.mapError(
      (cause) =>
        new MshMicroEndpointDecodeError({
          endpointName: endpoint.name,
          subject: msg.subject,
          message: `Invalid request payload for micro endpoint '${endpoint.name}'`,
          cause,
        }),
    ),
  ) as Effect.Effect<Req['Type'], MshMicroEndpointDecodeError>;

const encodeResponse = <Req extends PureSchema, Res extends PureSchema>(
  endpoint: MshMicroEndpointSpec<Req, Res>,
  msg: ServiceMsg,
  response: Res['Type'],
): Effect.Effect<Uint8Array, MshMicroEndpointEncodeError> =>
  NatsCodec.encodeJson(endpoint.responseSchema, response).pipe(
    Effect.mapError(
      (cause) =>
        new MshMicroEndpointEncodeError({
          endpointName: endpoint.name,
          subject: msg.subject,
          message: `Invalid response payload for micro endpoint '${endpoint.name}'`,
          cause,
        }),
    ),
  ) as Effect.Effect<Uint8Array, MshMicroEndpointEncodeError>;

const respondOk = <Req extends PureSchema, Res extends PureSchema>(
  endpoint: MshMicroEndpointSpec<Req, Res>,
  msg: ServiceMsg,
  bytes: Uint8Array,
): Effect.Effect<void, MshMicroEndpointRespondError> =>
  Effect.sync(() => msg.respond(bytes)).pipe(
    Effect.flatMap((responded) =>
      responded
        ? Effect.void
        : Effect.fail(
            new MshMicroEndpointRespondError({
              endpointName: endpoint.name,
              subject: msg.subject,
              message: `No reply subject available for micro endpoint '${endpoint.name}'`,
            }),
          ),
    ),
  );

const respondError = <Req extends PureSchema, Res extends PureSchema>(
  endpoint: MshMicroEndpointSpec<Req, Res>,
  msg: ServiceMsg,
  cause: unknown,
): Effect.Effect<void> =>
  Effect.sync(() => {
    const response = endpoint.mapError?.(cause) ?? defaultErrorResponse(cause);
    msg.respondError(response.code, response.message, response.data);
  });

const handleServiceMsg = <Req extends PureSchema, Res extends PureSchema>(
  service: Service,
  endpoint: MshMicroEndpointSpec<Req, Res>,
  msg: ServiceMsg,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const request = yield* decodeRequest(endpoint, msg);
    const response = yield* endpoint.handle(request, {
      endpointName: endpoint.name,
      subject: msg.subject,
      reply: msg.reply ?? '',
      headers: msg.headers,
      raw: msg,
      service: service.ping(),
    });
    const bytes = yield* encodeResponse(endpoint, msg, response);
    yield* respondOk(endpoint, msg, bytes);
  }).pipe(
    Effect.catch((cause) => respondError(endpoint, msg, cause)),
    Effect.withSpan(MshSpan.MicroHost.handle),
  );

// =============================================================================
// Service Definition
// =============================================================================

export class MshMicroEndpointHost extends Context.Service<
  MshMicroEndpointHost,
  MshMicroEndpointHostShape
>()('@tmnl/msh/nats/MicroEndpointHost') {
  /** Injectable layer for tests/custom runtimes. Requires NatsMicroService. */
  static readonly layerFromMicro = Layer.effect(
    MshMicroEndpointHost,
    Effect.gen(function* () {
      const micro = yield* NatsMicroService;

      const host: MshMicroEndpointHostShape['host'] = (config, endpoints) =>
        Effect.gen(function* () {
          const service = yield* micro.addScoped(config);

          for (const endpoint of endpoints) {
            const options: EndpointOptions = {
              subject: endpoint.subject,
              queue: endpoint.queue,
              metadata: endpoint.metadata,
              handler: (err, msg) => {
                if (err) {
                  Effect.runFork(micro.stop(service, err).pipe(Effect.ignore));
                  return;
                }
                Effect.runFork(handleServiceMsg(service, endpoint, msg));
              },
            };
            service.addEndpoint(endpoint.name, options);
          }

          return {
            service,
            identity: Effect.sync(() => service.ping()),
            info: Effect.sync(() => service.info()),
            stats: Effect.tryPromise({
              try: () => service.stats(),
              catch: (cause) =>
                new Micro.ClientCreationError({
                  message: `Failed to retrieve micro service stats for '${config.name}'`,
                  cause,
                }),
            }),
            stop: (err?: Error) => micro.stop(service, err),
          } satisfies MshHostedMicroService;
        }).pipe(Effect.withSpan(MshSpan.MicroHost.host));

      return MshMicroEndpointHost.of({ host });
    }),
  );

  static readonly layer = MshMicroEndpointHost.layerFromMicro.pipe(
    Layer.provide(NatsMicroService.layer),
  );
}

export const MshMicroEndpointHostLive = MshMicroEndpointHost.layer;
