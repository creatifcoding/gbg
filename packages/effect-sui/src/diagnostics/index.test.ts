import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { describe, expect, it } from 'vitest';

import { SuiPTB, SuiTx } from '../effectable';
import { makeTxRunner } from '../flow';
import {
  SuiDiagnosticEvent,
  SuiGasPlanningError,
  SuiMoveAbortError,
  SuiObjectStaleError,
  SuiWaitError,
} from '../schema';
import { classifyCause, classifyExit, classifyUnknown, makeDiagnosticEvent, makeDiagnostics } from './index';

const fakeTransactionDigest = '11111111111111111111111111111112' as never;

const diagnosticSnapshot = (input: ReturnType<typeof classifyUnknown>) => ({
  category: input.category,
  severity: input.severity,
  retryHint: input.retryHint,
  message: input.message,
  sourceTag: input.sourceTag,
  reasonKinds: input.reasonKinds,
});

describe('SuiDiagnostics', () => {
  it('classifies typed errors into stable retry hints', () => {
    const objectStale = classifyUnknown(new SuiObjectStaleError({ objectId: '0x0000000000000000000000000000000000000000000000000000000000000002' as never, message: 'stale' }));
    const moveAbort = classifyUnknown(new SuiMoveAbortError({ abortCode: '42', message: 'abort' }));
    const waitTimeout = classifyUnknown(new SuiWaitError({ kind: 'timeout', digest: fakeTransactionDigest, timeoutMs: 1, message: 'timeout' }));
    const gas = classifyUnknown(new SuiGasPlanningError({ policy: 'budget', message: 'bad budget' }));

    expect(diagnosticSnapshot(objectStale)).toEqual({
      category: 'object',
      severity: 'warn',
      retryHint: 'refreshObjects',
      message: 'stale',
      sourceTag: 'Sui/ObjectStale',
      reasonKinds: ['unknown'],
    });
    expect(diagnosticSnapshot(moveAbort)).toEqual({
      category: 'moveAbort',
      severity: 'error',
      retryHint: 'never',
      message: 'abort',
      sourceTag: 'Sui/MoveAbort',
      reasonKinds: ['unknown'],
    });
    expect(waitTimeout.retryHint).toBe('waitAndRetry');
    expect(gas.retryHint).toBe('increaseGas');
  });

  it('classifies Effect Cause reasons without squashing away structure', () => {
    const fail = classifyCause(Cause.fail(new SuiGasPlanningError({ policy: 'referenceGasPrice', message: 'rpc down' })));
    const defect = classifyCause(Cause.die({ name: 'DefectBoom', message: 'bug' }));
    const interrupt = classifyCause(Cause.interrupt(123));

    expect(diagnosticSnapshot(fail)).toEqual({
      category: 'gas',
      severity: 'error',
      retryHint: 'increaseGas',
      message: 'rpc down',
      sourceTag: 'Sui/GasPlanning',
      reasonKinds: ['fail'],
    });
    expect(defect.category).toBe('defect');
    expect(defect.severity).toBe('fatal');
    expect(defect.reasonKinds).toEqual(['die']);
    expect(interrupt.category).toBe('interrupt');
    expect(interrupt.retryHint).toBe('notApplicable');
  });

  it('classifies Exit failures and leaves successes unclassified', () => {
    const failed = classifyExit(Exit.fail(new SuiWaitError({ kind: 'aborted', message: 'cancelled' })));
    const succeeded = classifyExit(Exit.succeed('ok'));

    expect(failed?.category).toBe('finality');
    expect(failed?.severity).toBe('info');
    expect(succeeded).toBeUndefined();
  });

  it('records events through a degrading side-channel', async () => {
    const events: SuiDiagnosticEvent[] = [];
    const diagnostics = makeDiagnostics({
      sink: (event) => {
        events.push(event);
        throw { message: 'sink boom' };
      },
    });
    const diagnostic = classifyUnknown(new SuiWaitError({ kind: 'timeout', message: 'timeout' }));

    await Effect.runPromise(diagnostics.record(makeDiagnosticEvent({ name: 'test.diagnostic', diagnostic, stage: 'test' })));

    expect(events).toHaveLength(1);
    expect(events[0].diagnostic.retryHint).toBe('waitAndRetry');
  });

  it('records lifecycle failures without changing execution semantics', async () => {
    const events: SuiDiagnosticEvent[] = [];
    const runner = makeTxRunner({
      ptbAnalyzer: {
        analyze: (ptb) => Effect.succeed({ inputs: ptb.inputs, commands: ptb.commands, objectIds: [], diagnostics: [] }),
      },
      ptbCompiler: {
        compile: ({ ptb }) => Effect.succeed({ inputs: ptb.inputs, commands: ptb.commands, requirements: {} }),
      },
      gasPlanner: {
        plan: () => Effect.fail(new SuiGasPlanningError({ policy: 'referenceGasPrice', message: 'rpc down' })),
      },
      paymentService: {
        plan: () => Effect.succeed({ gasPayment: [], sponsored: false, addressBalance: true }),
      },
      authService: {
        authorize: () => Effect.succeed({ signatures: [] }),
      },
      preflightService: {
        dryRun: () => Effect.succeed({ status: 'success', diagnostics: [] }),
      },
      executionService: {
        execute: () => Effect.succeed({ digest: fakeTransactionDigest, raw: {} }),
      },
      finalityService: {
        wait: (request) => Effect.succeed({ digest: request.execution.digest, transaction: request.execution.raw }),
        waitForDigest: (request) => Effect.succeed({ digest: request.digest, transaction: {} }),
      },
      reservationService: {
        acquire: () => Effect.succeed({ id: 'reservation', intent: 'test', resourceKeys: [] }),
        release: () => Effect.void,
        reconcile: () => Effect.void,
      },
      diagnostics: {
        classify: (cause) => Effect.sync(() => classifyUnknown(cause)),
        classifyCause: (cause) => Effect.sync(() => classifyCause(cause)),
        classifyExit: (exit) => Effect.sync(() => classifyExit(exit)),
        record: (event) => Effect.sync(() => {
          events.push(event);
        }),
      },
    });
    const tx = new SuiTx({
      label: 'diagnostics.failure',
      ptb: new SuiPTB({ label: 'diagnostics.ptb' }),
      execute: () => Effect.void,
    });

    const exit = await Effect.runPromiseExit(runner.run(tx));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('@tmnl/effect-sui/SuiTxRunner.failure');
    expect(events[0].diagnostic.category).toBe('gas');
    expect(events[0].diagnostic.retryHint).toBe('increaseGas');
  });
});
