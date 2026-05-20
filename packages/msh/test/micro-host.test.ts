/**
 * MshMicroEndpointHost Unit Tests
 *
 * Pure tests for the schema-backed NATS micro endpoint host seam.
 * No live NATS server required.
 */

import { describe, it, expect } from 'vitest';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Schema from 'effect-v4/Schema';
import type {
  EndpointOptions,
  Service,
  ServiceConfig,
  ServiceIdentity,
  ServiceInfo,
  ServiceMsg,
  ServiceStats,
} from 'nats.ws';

import { MshMicroEndpointHost } from '../src/nats/micro-host';
import { NatsMicroService, type NatsMicroServiceShape } from '../src/nats/micro';

// =============================================================================
// Schemas
// =============================================================================

const SchemaGetRequest = Schema.Struct({
  schemaId: Schema.String,
});

const SchemaGetResponse = Schema.Struct({
  schemaId: Schema.String,
  found: Schema.Boolean,
});

// =============================================================================
// Fake NATS micro service
// =============================================================================

interface FakeEndpoint {
  readonly name: string;
  readonly options: EndpointOptions;
}

const makeIterator = (): any => ({
  [Symbol.asyncIterator]: async function* () {},
  stop: () => undefined,
  getProcessed: () => 0,
  getPending: () => 0,
  getReceived: () => 0,
  push: () => undefined,
});

const makeFakeService = (config: ServiceConfig, endpoints: FakeEndpoint[]): Service => {
  const identity: ServiceIdentity = {
    type: 'io.nats.micro.v1.ping_response' as any,
    name: config.name,
    id: 'fake-service-id',
    version: config.version,
    metadata: config.metadata,
  };

  const service: Service = {
    stopped: Promise.resolve(null),
    isStopped: false,
    ping: () => identity,
    info: (): ServiceInfo => ({
      ...identity,
      type: 'io.nats.micro.v1.info_response' as any,
      description: config.description ?? '',
      endpoints: endpoints.map((endpoint) => ({
        name: endpoint.name,
        subject: endpoint.options.subject ?? endpoint.name,
        metadata: endpoint.options.metadata,
        queue_group: endpoint.options.queue ?? config.queue ?? 'q',
      })),
    }),
    stats: async (): Promise<ServiceStats> => ({
      ...identity,
      type: 'io.nats.micro.v1.stats_response' as any,
      started: new Date(0).toISOString(),
      endpoints: endpoints.map((endpoint) => ({
        name: endpoint.name,
        subject: endpoint.options.subject ?? endpoint.name,
        queue_group: endpoint.options.queue ?? config.queue ?? 'q',
        num_requests: 0,
        num_errors: 0,
        processing_time: 0,
        average_processing_time: 0,
      })),
    }),
    reset: () => undefined,
    stop: async () => null,
    addGroup: () => service,
    addEndpoint: (name: string, opts?: any) => {
      const options = typeof opts === 'function' ? { handler: opts } : opts ?? {};
      endpoints.push({ name, options });
      return makeIterator();
    },
  } as Service;

  return service;
};

const makeFakeMicroLayer = (state: { endpoints: FakeEndpoint[]; stoppedWith?: Error }) => {
  const service = makeFakeService({ name: 'placeholder', version: '0.0.0' }, state.endpoints);

  const fakeMicro: NatsMicroServiceShape = {
    add: (config) => Effect.succeed(makeFakeService(config, state.endpoints)),
    addScoped: (config) => Effect.succeed(makeFakeService(config, state.endpoints)),
    client: () => Effect.fail(new Error('not used') as any),
    stop: (_service, err) => Effect.sync(() => {
      state.stoppedWith = err;
    }),
  };

  void service;
  return Layer.succeed(NatsMicroService, NatsMicroService.of(fakeMicro));
};

const encodeJson = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value));

const makeMsg = (
  subject: string,
  data: Uint8Array,
  onRespond: (data: Uint8Array) => void,
  onError: (code: number, description: string, data?: Uint8Array) => void,
): ServiceMsg => ({
  data,
  subject,
  reply: '_INBOX.reply',
  headers: undefined,
  sid: 1,
  respond: (payload?: Uint8Array) => {
    onRespond(payload ?? new Uint8Array());
    return true;
  },
  respondError: (code: number, description: string, payload?: Uint8Array) => {
    onError(code, description, payload);
    return true;
  },
  json: () => JSON.parse(new TextDecoder().decode(data)),
  string: () => new TextDecoder().decode(data),
} as ServiceMsg);

const runWithHost = <A>(effect: Effect.Effect<A, unknown, MshMicroEndpointHost>) => {
  const state = { endpoints: [] as FakeEndpoint[] };
  const layer = MshMicroEndpointHost.layerFromMicro.pipe(
    Layer.provide(makeFakeMicroLayer(state)),
  );
  return {
    state,
    promise: Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(layer))),
  };
};

// =============================================================================
// Tests
// =============================================================================

describe('MshMicroEndpointHost', () => {
  it('registers schema-backed endpoints with metadata visible through service info', async () => {
    const { state, promise } = runWithHost(
      Effect.gen(function* () {
        const host = yield* MshMicroEndpointHost;
        const hosted = yield* host.host(
          {
            name: 'pct-control',
            version: '0.1.0',
            description: 'PCT control plane proof seam',
            metadata: { domain: 'pct' },
            queue: 'pct-control',
          },
          [
            {
              name: 'schema-get',
              subject: 'pct.v1.schema.get',
              metadata: { request: 'SchemaGetRequest', response: 'SchemaGetResponse' },
              requestSchema: SchemaGetRequest,
              responseSchema: SchemaGetResponse,
              handle: (request) => Effect.succeed({ schemaId: request.schemaId, found: true }),
            },
          ],
        );
        return yield* hosted.info;
      }),
    );

    const info = await promise;
    expect(state.endpoints).toHaveLength(1);
    expect(info.name).toBe('pct-control');
    expect(info.endpoints[0]).toMatchObject({
      name: 'schema-get',
      subject: 'pct.v1.schema.get',
      queue_group: 'pct-control',
      metadata: { request: 'SchemaGetRequest', response: 'SchemaGetResponse' },
    });
  });

  it('decodes request payloads, runs the Effect handler, and encodes responses', async () => {
    const response = await new Promise<unknown>((resolve, reject) => {
      const { state, promise } = runWithHost(
        Effect.gen(function* () {
          const host = yield* MshMicroEndpointHost;
          yield* host.host(
            { name: 'pct-control', version: '0.1.0' },
            [
              {
                name: 'schema-get',
                subject: 'pct.v1.schema.get',
                requestSchema: SchemaGetRequest,
                responseSchema: SchemaGetResponse,
                handle: (request) => Effect.succeed({ schemaId: request.schemaId, found: true }),
              },
            ],
          );
        }),
      );

      promise.then(() => {
        const handler = state.endpoints[0].options.handler;
        if (!handler) return reject(new Error('missing handler'));
        handler(null, makeMsg(
          'pct.v1.schema.get',
          encodeJson({ schemaId: 'Vitals@1.0.0' }),
          (bytes) => resolve(JSON.parse(new TextDecoder().decode(bytes))),
          (code, message) => reject(new Error(`${code}: ${message}`)),
        ));
      }).catch(reject);
    });

    expect(response).toEqual({ schemaId: 'Vitals@1.0.0', found: true });
  });

  it('maps request decode failures to NATS service error responses', async () => {
    const error = await new Promise<{ code: number; message: string }>((resolve, reject) => {
      const { state, promise } = runWithHost(
        Effect.gen(function* () {
          const host = yield* MshMicroEndpointHost;
          yield* host.host(
            { name: 'pct-control', version: '0.1.0' },
            [
              {
                name: 'schema-get',
                subject: 'pct.v1.schema.get',
                requestSchema: SchemaGetRequest,
                responseSchema: SchemaGetResponse,
                handle: () => Effect.succeed({ schemaId: 'never', found: false }),
              },
            ],
          );
        }),
      );

      promise.then(() => {
        const handler = state.endpoints[0].options.handler;
        if (!handler) return reject(new Error('missing handler'));
        handler(null, makeMsg(
          'pct.v1.schema.get',
          encodeJson({ wrong: 'shape' }),
          () => reject(new Error('unexpected success response')),
          (code, message) => resolve({ code, message }),
        ));
      }).catch(reject);
    });

    expect(error.code).toBe(400);
    expect(error.message).toContain("Invalid request payload for micro endpoint 'schema-get'");
  });

  it('uses endpoint-specific error mapping for handler failures', async () => {
    class NotFound extends Error {}

    const error = await new Promise<{ code: number; message: string }>((resolve, reject) => {
      const { state, promise } = runWithHost(
        Effect.gen(function* () {
          const host = yield* MshMicroEndpointHost;
          yield* host.host(
            { name: 'pct-control', version: '0.1.0' },
            [
              {
                name: 'schema-get',
                subject: 'pct.v1.schema.get',
                requestSchema: SchemaGetRequest,
                responseSchema: SchemaGetResponse,
                handle: () => Effect.fail(new NotFound('schema missing')),
                mapError: (cause) => cause instanceof NotFound
                  ? { code: 404, message: cause.message }
                  : { code: 500, message: 'unexpected' },
              },
            ],
          );
        }),
      );

      promise.then(() => {
        const handler = state.endpoints[0].options.handler;
        if (!handler) return reject(new Error('missing handler'));
        handler(null, makeMsg(
          'pct.v1.schema.get',
          encodeJson({ schemaId: 'Missing@1.0.0' }),
          () => reject(new Error('unexpected success response')),
          (code, message) => resolve({ code, message }),
        ));
      }).catch(reject);
    });

    expect(error).toEqual({ code: 404, message: 'schema missing' });
  });
});
