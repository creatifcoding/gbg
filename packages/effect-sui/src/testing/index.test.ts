import * as Effect from 'effect-v4/Effect';
import { describe, expect, it } from 'vitest';

import { SuiObject, SuiPTB, SuiTx } from '../effectable';
import {
  SuiAuthService,
  SuiClientService,
  SuiExecutionService,
  SuiFinalityService,
  SuiGasPlanner,
  SuiObjectResolver,
  SuiPaymentService,
  SuiPtbAnalyzer,
  SuiPtbCompiler,
} from '../services';
import {
  FakeSuiRuntimeLayer,
  fakeClient,
  fakeObjectId,
  fakeTransactionDigest,
} from './index';

describe('FakeSuiRuntimeLayer', () => {
  it('provides fake object resolution for SuiObject capabilities', () => {
    const object = new SuiObject({
      id: fakeObjectId,
      refresh: (self) => SuiObjectResolver.use((resolver) => resolver.refresh(self)),
    });

    const snapshot = Effect.runSync(
      object.pipe(
        Effect.provide(FakeSuiRuntimeLayer({
          objectResolver: {
            refresh: (self) => Effect.succeed({ id: self.id, content: { ok: true } }),
          },
        })),
      ),
    );

    expect(snapshot).toEqual({ id: fakeObjectId, content: { ok: true } });
  });

  it('provides analyzer/compiler contracts for SuiPTB capabilities', () => {
    const ptb = new SuiPTB({
      label: 'fake.ptb',
      commands: [{ _tag: 'MoveCall', name: 'increment' }],
      requirements: { requiresPayment: true },
      build: (self) =>
        SuiPtbAnalyzer.use((analyzer) =>
          Effect.flatMap(analyzer.analyze(self), (analysis) =>
            SuiPtbCompiler.use((compiler) => compiler.compile({ ptb: self, analysis })),
          ),
        ),
    });

    const artifact = Effect.runSync(ptb.pipe(Effect.provide(FakeSuiRuntimeLayer())));

    expect(artifact.commands).toEqual([{ _tag: 'MoveCall', name: 'increment' }]);
    expect(artifact.requirements).toEqual({ requiresPayment: true });
    expect(artifact.transaction).toEqual({ _tag: 'FakeMystenTransaction', label: 'fake.ptb' });
  });

  it('provides gas/payment/auth/execution/finality contracts for SuiTx capabilities', () => {
    const tx = new SuiTx({
      label: 'fake.tx',
      execute: (self) =>
        SuiGasPlanner.use((gas) =>
          Effect.flatMap(gas.plan(self), (gasPlan) =>
            SuiPaymentService.use((payment) =>
              Effect.flatMap(payment.plan(self, gasPlan), (paymentPlan) =>
                SuiAuthService.use((auth) =>
                  Effect.flatMap(auth.authorize(self, paymentPlan), (authResult) =>
                    SuiExecutionService.use((executor) =>
                      Effect.flatMap(
                        executor.execute({ inputs: [], commands: [], requirements: {} }, authResult),
                        (execution) => SuiFinalityService.use((finality) => finality.wait(execution)),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
    });

    const result = Effect.runSync(tx.pipe(Effect.provide(FakeSuiRuntimeLayer())));

    expect(result).toEqual({
      digest: fakeTransactionDigest,
      transaction: { _tag: 'FakeExecution' },
      events: [],
    });
  });

  it('allows overriding fake client payloads', () => {
    const result = Effect.runSync(
      SuiClientService.useSync((service) => service.client).pipe(
        Effect.provide(FakeSuiRuntimeLayer({ client: { transport: 'override' } })),
      ),
    );

    expect(result).toEqual({ transport: 'override' });
    expect(fakeClient.transport).toBe('fake');
  });
});
