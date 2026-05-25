/**
 * MSH substrate doctor service.
 *
 * This first slice is intentionally small and read-only: core flush and auth
 * metadata. Later slices add JSM, stream, KV, and micro-discovery checks.
 */

import * as Context from 'effect-v4/Context';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Option from 'effect-v4/Option';

import { MshAuthService, type AuthMetadata } from '../auth';
import { NatsConnectionService } from '../nats/connection';
import { NatsKVService } from '../nats/kv';
import { NatsStreamService } from '../nats/stream';
import {
  DoctorCheck,
  DoctorFinding,
  DoctorReport,
  maxSeverity,
} from './schemas';
import { redactDoctorValue, safeCauseText } from './redaction';

export interface MshDoctorShape {
  readonly checkCoreFlush: Effect.Effect<DoctorCheck>;
  readonly checkJetStreamManager: Effect.Effect<DoctorCheck>;
  readonly checkStreamInfo: (name: string) => Effect.Effect<DoctorCheck>;
  readonly checkKvBucket: (bucketName: string) => Effect.Effect<DoctorCheck>;
  readonly checkAuthMetadata: Effect.Effect<DoctorCheck>;
  readonly report: Effect.Effect<DoctorReport>;
}

export class MshDoctorService extends Context.Service<
  MshDoctorService,
  MshDoctorShape
>()('@tmnl/msh/doctor/MshDoctorService') {}

const finding = (input: typeof DoctorFinding.Type): DoctorFinding =>
  DoctorFinding.make(input);

const passedCheck = (
  checkId: string,
  component: string,
  durationMs: number,
  observedAt: number,
  findings: ReadonlyArray<DoctorFinding> = [],
): DoctorCheck => DoctorCheck.make({
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
  cause: unknown,
  remediation: string,
): DoctorCheck => DoctorCheck.make({
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
    safeCause: safeCauseText(cause),
    remediation,
  })],
  observedAt,
});

const skippedCheck = (
  checkId: string,
  component: string,
  message: string,
): DoctorCheck => DoctorCheck.make({
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

const authMetadataFinding = (metadata: AuthMetadata): DoctorFinding => {
  const safe = redactDoctorValue(metadata) as AuthMetadata;
  return finding({
    severity: 'ok',
    code: 'msh.auth.metadata.safe',
    message: `auth mode=${safe.mode} state=${safe.state}`,
    layer: 'msh',
    component: 'auth',
  });
};

export const makeMshDoctor = (): Effect.Effect<MshDoctorShape, never, NatsConnectionService | NatsStreamService | NatsKVService> =>
  Effect.gen(function* () {
    const connection = yield* NatsConnectionService;
    const stream = yield* NatsStreamService;
    const kv = yield* NatsKVService;
    const authOption = yield* Effect.serviceOption(MshAuthService);
    const auth = Option.isSome(authOption) ? authOption.value : undefined;

    const checkCoreFlush: Effect.Effect<DoctorCheck> = Effect.gen(function* () {
      const started = Date.now();
      const result = yield* Effect.result(Effect.tryPromise({
        try: () => connection.nc.flush(),
        catch: (cause) => cause,
      }));
      const observedAt = Date.now();
      const durationMs = observedAt - started;
      if (result._tag === 'Success') {
        return passedCheck('msh.core.flush', 'core', durationMs, observedAt);
      }
      return failedCheck(
        'msh.core.flush',
        'core',
        durationMs,
        observedAt,
        result.failure,
        'Verify NATS connectivity and core publish/request permissions.',
      );
    });

    const checkJetStreamManager: Effect.Effect<DoctorCheck> = Effect.gen(function* () {
      const started = Date.now();
      const result = yield* Effect.result(connection.getJsm());
      const observedAt = Date.now();
      const durationMs = observedAt - started;
      if (result._tag === 'Success') {
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
        result.failure,
        'Verify $JS.API.> publish and _INBOX.> subscribe permissions, and confirm JetStream is enabled.',
      );
    });

    const checkStreamInfo = (name: string): Effect.Effect<DoctorCheck> => Effect.gen(function* () {
      const started = Date.now();
      const result = yield* Effect.result(stream.getStreamInfo(name));
      const observedAt = Date.now();
      const durationMs = observedAt - started;
      if (result._tag === 'Failure') {
        return failedCheck(
          'msh.stream.info',
          'stream',
          durationMs,
          observedAt,
          result.failure,
          'Verify stream info permissions and stream name configuration.',
        );
      }
      if (result.success === null) {
        return DoctorCheck.make({
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

    const checkKvBucket = (bucketName: string): Effect.Effect<DoctorCheck> => Effect.gen(function* () {
      const started = Date.now();
      const result = yield* Effect.result(kv.keys(bucketName));
      const observedAt = Date.now();
      const durationMs = observedAt - started;
      if (result._tag === 'Failure') {
        return failedCheck(
          'msh.kv.bucket',
          'kv',
          durationMs,
          observedAt,
          result.failure,
          'Verify KV bucket existence and KV read permissions.',
        );
      }
      return passedCheck('msh.kv.bucket', 'kv', durationMs, observedAt, [finding({
        severity: 'ok',
        code: 'msh.kv.bucket.available',
        message: `kv bucket '${bucketName}' is readable (${result.success.length} keys)`,
        layer: 'msh',
        component: 'kv',
        bucket: bucketName,
      })]);
    });

    const checkAuthMetadata: Effect.Effect<DoctorCheck> = Effect.gen(function* () {
      if (auth === undefined) {
        return skippedCheck('msh.auth.metadata', 'auth', 'MshAuthService is not in scope.');
      }
      const started = Date.now();
      const result = yield* Effect.result(auth.metadata);
      const observedAt = Date.now();
      const durationMs = observedAt - started;
      if (result._tag === 'Success') {
        return passedCheck(
          'msh.auth.metadata',
          'auth',
          durationMs,
          observedAt,
          [authMetadataFinding(result.success)],
        );
      }
      return failedCheck(
        'msh.auth.metadata',
        'auth',
        durationMs,
        observedAt,
        result.failure,
        'Inspect auth configuration and credential source availability.',
      );
    });

    const report: Effect.Effect<DoctorReport> = Effect.gen(function* () {
      const checks = yield* Effect.all([
        checkCoreFlush,
        checkJetStreamManager,
        checkAuthMetadata,
      ], { concurrency: 'unbounded' });
      return DoctorReport.make({
        reportId: `msh:${Date.now()}`,
        layer: 'msh',
        severity: maxSeverity(checks.map((check) => check.severity)),
        checks,
        generatedAt: Date.now(),
      });
    });

    return MshDoctorService.of({
      checkCoreFlush,
      checkJetStreamManager,
      checkStreamInfo,
      checkKvBucket,
      checkAuthMetadata,
      report,
    });
  });

export const MshDoctorServiceLive: Layer.Layer<MshDoctorService, never, NatsConnectionService | NatsStreamService | NatsKVService> =
  Layer.effect(MshDoctorService, makeMshDoctor());
