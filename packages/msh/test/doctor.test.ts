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
import { makeMockNatsFixture } from './support/mock-nats';

const makeDoctorLayer = (fixture: ReturnType<typeof makeMockNatsFixture>) =>
  MshDoctorServiceLive.pipe(Layer.provide(fixture.layer));

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
      'msh.auth.metadata',
    ]);
    expect(JSON.stringify(report)).not.toMatch(/token|seed|jwt=|Bearer secret/i);
  });
});
