/** Doctor schema/redaction spike tests. */

import { describe, expect, it } from 'vitest';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import {
  MshDoctorService,
  MshDoctorServiceLive,
  REDACTED,
  redactDoctorValue,
  redactString,
} from '../src/doctor';
import {
  NatsInnerService,
  NatsKVService,
  NatsStreamService,
} from '../src/nats';
import { makeMockNatsFixture } from './support/mock-nats';

const makeInnerLayer = (fixture: ReturnType<typeof makeMockNatsFixture>) =>
  NatsInnerService.layerFromConnection.pipe(Layer.provide(fixture.layer));

const makeStreamLayer = (fixture: ReturnType<typeof makeMockNatsFixture>) =>
  NatsStreamService.layerFromInner.pipe(Layer.provide(makeInnerLayer(fixture)));

const makeKvLayer = (fixture: ReturnType<typeof makeMockNatsFixture>) =>
  NatsKVService.layerFromInner.pipe(Layer.provide(makeInnerLayer(fixture)));

const makeSubstrateLayer = (fixture: ReturnType<typeof makeMockNatsFixture>) =>
  Layer.mergeAll(fixture.layer, makeStreamLayer(fixture), makeKvLayer(fixture));

const makeDoctorLayer = (fixture: ReturnType<typeof makeMockNatsFixture>) => {
  const substrate = makeSubstrateLayer(fixture);
  return Layer.mergeAll(substrate, MshDoctorServiceLive.pipe(Layer.provide(substrate)));
};

describe('MshDoctorService spike', () => {
  it('redacts token, JWT, seed, and credential-shaped values', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwcmltZSJ9.signature';
    const seed = 'SUABCDEFGHIJKLMNOPQRSTUVWXYZ234567890';
    const text = `Bearer secret-token jwt=${jwt} seed=${seed}`;

    expect(redactString(text)).not.toContain('secret-token');
    expect(redactString(text)).not.toContain(jwt);
    expect(redactString(text)).not.toContain(seed);
    expect(redactString(text)).toContain(REDACTED);

    const redacted = redactDoctorValue({
      nested: {
        token: 'abc123',
        creds: '-----BEGIN NATS USER JWT----- secret -----END NATS USER JWT-----',
        message: `authorization=${jwt}`,
      },
    }) as { readonly nested: { readonly token: string; readonly creds: string; readonly message: string } };

    expect(redacted.nested.token).toBe(REDACTED);
    expect(redacted.nested.creds).toBe(REDACTED);
    expect(redacted.nested.message).not.toContain(jwt);
  });

  it('checks core flush over the mock NATS connection', async () => {
    const fixture = makeMockNatsFixture();

    const check = await Effect.runPromise(
      Effect.gen(function* () {
        const doctor = yield* MshDoctorService;
        return yield* doctor.checkCoreFlush;
      }).pipe(Effect.provide(makeDoctorLayer(fixture))),
    );

    expect(check.checkId).toBe('msh.core.flush');
    expect(check.status).toBe('passed');
    expect(check.severity).toBe('ok');
  });

  it('returns a safe package-local report without auth service in scope', async () => {
    const fixture = makeMockNatsFixture();

    const report = await Effect.runPromise(
      Effect.gen(function* () {
        const doctor = yield* MshDoctorService;
        return yield* doctor.report;
      }).pipe(Effect.provide(makeDoctorLayer(fixture))),
    );

    expect(report.layer).toBe('msh');
    expect(report.checks.map((check) => check.checkId)).toEqual([
      'msh.core.flush',
      'msh.jsm.access',
      'msh.auth.metadata',
    ]);
    expect(JSON.stringify(report)).not.toMatch(/token|seed|jwt=|Bearer secret/i);
  });

  it('reports JetStream manager access failures distinctly', async () => {
    const fixture = makeMockNatsFixture({}, { jetStreamManagerUnavailable: true });

    const check = await Effect.runPromise(
      Effect.gen(function* () {
        const doctor = yield* MshDoctorService;
        return yield* doctor.checkJetStreamManager;
      }).pipe(Effect.provide(makeDoctorLayer(fixture))),
    );

    expect(check.checkId).toBe('msh.jsm.access');
    expect(check.status).toBe('failed');
    expect(check.severity).toBe('critical');
    expect(check.findings[0]?.code).toBe('msh.jsm.access.failed');
  });

  it('checks stream info and KV bucket readability over the mock substrate', async () => {
    const fixture = makeMockNatsFixture();

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        yield* stream.ensureStream({ name: 'EVENTS', subjects: ['events.>'] });
        const doctor = yield* MshDoctorService;
        const streamCheck = yield* doctor.checkStreamInfo('EVENTS');
        const missingStreamCheck = yield* doctor.checkStreamInfo('MISSING');
        const kvCheck = yield* doctor.checkKvBucket('doctor');
        return { streamCheck, missingStreamCheck, kvCheck };
      }).pipe(Effect.provide(makeDoctorLayer(fixture))),
    );

    expect(result.streamCheck.status).toBe('passed');
    expect(result.streamCheck.findings[0]?.stream).toBe('EVENTS');
    expect(result.missingStreamCheck.status).toBe('degraded');
    expect(result.missingStreamCheck.findings[0]?.code).toBe('msh.stream.info.missing');
    expect(result.kvCheck.status).toBe('passed');
    expect(result.kvCheck.findings[0]?.bucket).toBe('doctor');
  });
});
