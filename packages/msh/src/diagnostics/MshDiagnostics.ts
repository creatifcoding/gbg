/**
 * MSH substrate diagnostics service.
 *
 * This first slice is intentionally small and read-only: core flush and auth
 * metadata. Later slices add JSM, stream, KV, and micro-discovery checks.
 */

import * as Cause from 'effect/Cause';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';

import { MshAuthService, type AuthMetadata } from '../auth';
import { NatsConnectionService } from '../nats/connection';
import { NatsKVService } from '../nats/kv';
import { NatsStreamService } from '../nats/stream';
import {
  DiagnosticCheck,
  DiagnosticFinding,
  DiagnosticReport,
  maxSeverity,
} from './schemas';
import { redactCause, redactDiagnosticValue } from './redaction';

export interface MshDiagnosticsShape {
  readonly checkCoreFlush: Effect.Effect<DiagnosticCheck>;
  readonly checkJetStreamManager: Effect.Effect<DiagnosticCheck>;
  readonly checkStreamInfo: (name: string) => Effect.Effect<DiagnosticCheck>;
  readonly checkKvBucket: (bucketName: string) => Effect.Effect<DiagnosticCheck>;
  readonly checkAuthMetadata: Effect.Effect<DiagnosticCheck>;
  readonly report: Effect.Effect<DiagnosticReport>;
}

export class MshDiagnosticsService extends Context.Service<
  MshDiagnosticsService,
  MshDiagnosticsShape
>()('@tmnl/msh/diagnostics/MshDiagnosticsService') {}

const finding = (input: typeof DiagnosticFinding.Type): DiagnosticFinding =>
  DiagnosticFinding.make(input);

const passedCheck = (
  checkId: string,
  component: string,
  durationMs: number,
  observedAt: number,
  findings: ReadonlyArray<DiagnosticFinding> = [],
): DiagnosticCheck => DiagnosticCheck.make({
  checkId,
  layer: 'msh',
  component,
  status: 'passed',
  severity: maxSeverity(findings.map((item) => item.severity)),
  durationMs,
  findings: [...findings],
  observedAt,
});

const failedCheck = (
  checkId: string,
  component: string,
  durationMs: number,
  observedAt: number,
  cause: Cause.Cause<unknown>,
  remediation: string,
): DiagnosticCheck => DiagnosticCheck.make({
  checkId,
  layer: 'msh',
  component,
  status: 'failed',
  severity: 'critical',
  durationMs,
  findings: [finding({
    severity: 'critical',
    code: `${checkId}.failed`,
    message: `${component} check failed`,
    layer: 'msh',
    component,
    safeCause: redactCause(cause),
    remediation,
  })],
  observedAt,
});

const skippedCheck = (
  checkId: string,
  component: string,
  message: string,
): DiagnosticCheck => DiagnosticCheck.make({
  checkId,
  layer: 'msh',
  component,
  status: 'skipped',
  severity: 'unknown',
  durationMs: 0,
  findings: [finding({
    severity: 'unknown',
    code: `${checkId}.skipped`,
    message,
    layer: 'msh',
    component,
  })],
  observedAt: Date.now(),
});

const authMetadataFinding = (metadata: AuthMetadata): DiagnosticFinding => {
  const safe = redactDiagnosticValue(metadata) as AuthMetadata;
  return finding({
    severity: 'ok',
    code: 'msh.auth.metadata.safe',
    message: `auth mode=${safe.mode} state=${safe.state}`,
    layer: 'msh',
    component: 'auth',
  });
};

export const makeMshDiagnostics = (): Effect.Effect<MshDiagnosticsShape, never, NatsConnectionService | NatsStreamService | NatsKVService> =>
  Effect.gen(function* () {
    const connection = yield* NatsConnectionService;
    const stream = yield* NatsStreamService;
    const kv = yield* NatsKVService;
    const authOption = yield* Effect.serviceOption(MshAuthService);
    const auth = Option.isSome(authOption) ? authOption.value : undefined;

    const checkCoreFlush: Effect.Effect<DiagnosticCheck> = Effect.gen(function* () {
      const started = Date.now();
      const exit = yield* Effect.exit(Effect.tryPromise({
        try: () => connection.nc.flush(),
        catch: (cause) => cause,
      }));
      const observedAt = Date.now();
      const durationMs = observedAt - started;
      if (exit._tag === 'Success') {
        return passedCheck('msh.core.flush', 'core', durationMs, observedAt);
      }
      return failedCheck(
        'msh.core.flush',
        'core',
        durationMs,
        observedAt,
        exit.cause,
        'Verify NATS connectivity and core publish/request permissions.',
      );
    });

    const checkJetStreamManager: Effect.Effect<DiagnosticCheck> = Effect.gen(function* () {
      const started = Date.now();
      const exit = yield* Effect.exit(connection.getJsm());
      const observedAt = Date.now();
      const durationMs = observedAt - started;
      if (exit._tag === 'Success') {
        return passedCheck('msh.jsm.access', 'jetstream-manager', durationMs, observedAt, [finding({
          severity: 'ok',
          code: 'msh.jsm.access.available',
          message: 'JetStream manager is available',
          layer: 'msh',
          component: 'jetstream-manager',
        })]);
      }
      return failedCheck(
        'msh.jsm.access',
        'jetstream-manager',
        durationMs,
        observedAt,
        exit.cause,
        'Verify $JS.API.> publish and _INBOX.> subscribe permissions, and confirm JetStream is enabled.',
      );
    });

    const checkStreamInfo = (name: string): Effect.Effect<DiagnosticCheck> => Effect.gen(function* () {
      const started = Date.now();
      const exit = yield* Effect.exit(stream.getStreamInfo(name));
      const observedAt = Date.now();
      const durationMs = observedAt - started;
      if (exit._tag === 'Failure') {
        return failedCheck(
          'msh.stream.info',
          'stream',
          durationMs,
          observedAt,
          exit.cause,
          'Verify stream info permissions and stream name configuration.',
        );
      }
      if (exit.value === null) {
        return DiagnosticCheck.make({
          checkId: 'msh.stream.info',
          layer: 'msh',
          component: 'stream',
          status: 'degraded',
          severity: 'warn',
          durationMs,
          findings: [finding({
            severity: 'warn',
            code: 'msh.stream.info.missing',
            message: `stream '${name}' was not found`,
            layer: 'msh',
            component: 'stream',
            stream: name,
            remediation: 'Create the stream or correct the configured stream name.',
          })],
          observedAt,
        });
      }
      return passedCheck('msh.stream.info', 'stream', durationMs, observedAt, [finding({
        severity: 'ok',
        code: 'msh.stream.info.available',
        message: `stream '${name}' is available`,
        layer: 'msh',
        component: 'stream',
        stream: name,
      })]);
    });

    const checkKvBucket = (bucketName: string): Effect.Effect<DiagnosticCheck> => Effect.gen(function* () {
      const started = Date.now();
      const exit = yield* Effect.exit(kv.keys(bucketName));
      const observedAt = Date.now();
      const durationMs = observedAt - started;
      if (exit._tag === 'Failure') {
        return failedCheck(
          'msh.kv.bucket',
          'kv',
          durationMs,
          observedAt,
          exit.cause,
          'Verify KV bucket existence and KV read permissions.',
        );
      }
      return passedCheck('msh.kv.bucket', 'kv', durationMs, observedAt, [finding({
        severity: 'ok',
        code: 'msh.kv.bucket.available',
        message: `kv bucket '${bucketName}' is readable (${exit.value.length} keys)`,
        layer: 'msh',
        component: 'kv',
        bucket: bucketName,
      })]);
    });

    const checkAuthMetadata: Effect.Effect<DiagnosticCheck> = Effect.gen(function* () {
      if (auth === undefined) {
        return skippedCheck('msh.auth.metadata', 'auth', 'MshAuthService is not in scope.');
      }
      const started = Date.now();
      const exit = yield* Effect.exit(auth.metadata);
      const observedAt = Date.now();
      const durationMs = observedAt - started;
      if (exit._tag === 'Success') {
        return passedCheck(
          'msh.auth.metadata',
          'auth',
          durationMs,
          observedAt,
          [authMetadataFinding(exit.value)],
        );
      }
      return failedCheck(
        'msh.auth.metadata',
        'auth',
        durationMs,
        observedAt,
        exit.cause,
        'Inspect auth configuration and credential source availability.',
      );
    });

    const report: Effect.Effect<DiagnosticReport> = Effect.gen(function* () {
      const checks = yield* Effect.all([
        checkCoreFlush,
        checkJetStreamManager,
        checkAuthMetadata,
      ], { concurrency: 'unbounded' });
      return DiagnosticReport.make({
        reportId: `msh:${Date.now()}`,
        layer: 'msh',
        severity: maxSeverity(checks.map((check) => check.severity)),
        checks,
        generatedAt: Date.now(),
      });
    });

    return MshDiagnosticsService.of({
      checkCoreFlush,
      checkJetStreamManager,
      checkStreamInfo,
      checkKvBucket,
      checkAuthMetadata,
      report,
    });
  });

export const MshDiagnosticsServiceLive: Layer.Layer<MshDiagnosticsService, never, NatsConnectionService | NatsStreamService | NatsKVService> =
  Layer.effect(MshDiagnosticsService, makeMshDiagnostics());
