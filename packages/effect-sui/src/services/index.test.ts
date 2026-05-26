import * as Effect from 'effect-v4/Effect';
import { describe, expect, it } from 'vitest';

import { decodeSuiObjectId } from '../schema';
import { SuiObject, SuiPTB, SuiTx } from '../effectable';
import {
  SuiAuthService,
  SuiBcsBridge,
  SuiClientService,
  SuiDiagnostics,
  SuiExecutionService,
  SuiFinalityService,
  SuiGasPlanner,
  SuiObjectResolver,
  SuiPackageRegistry,
  SuiPaymentService,
  SuiPreflightService,
  SuiPtbAnalyzer,
  SuiPtbCompiler,
  SuiReservationService,
  SuiTxRunner,
} from './index';

describe('Effect-Sui service contracts', () => {
  const objectId = decodeSuiObjectId('0x7');

  it('exposes stable service keys for the transaction ecosystem', () => {
    expect(SuiClientService.key).toBe('@tmnl/effect-sui/SuiClientService');
    expect(SuiObjectResolver.key).toBe('@tmnl/effect-sui/SuiObjectResolver');
    expect(SuiBcsBridge.key).toBe('@tmnl/effect-sui/SuiBcsBridge');
    expect(SuiPtbAnalyzer.key).toBe('@tmnl/effect-sui/SuiPtbAnalyzer');
    expect(SuiPtbCompiler.key).toBe('@tmnl/effect-sui/SuiPtbCompiler');
    expect(SuiGasPlanner.key).toBe('@tmnl/effect-sui/SuiGasPlanner');
    expect(SuiPaymentService.key).toBe('@tmnl/effect-sui/SuiPaymentService');
    expect(SuiAuthService.key).toBe('@tmnl/effect-sui/SuiAuthService');
    expect(SuiPreflightService.key).toBe('@tmnl/effect-sui/SuiPreflightService');
    expect(SuiExecutionService.key).toBe('@tmnl/effect-sui/SuiExecutionService');
    expect(SuiFinalityService.key).toBe('@tmnl/effect-sui/SuiFinalityService');
    expect(SuiTxRunner.key).toBe('@tmnl/effect-sui/SuiTxRunner');
    expect(SuiReservationService.key).toBe('@tmnl/effect-sui/SuiReservationService');
    expect(SuiPackageRegistry.key).toBe('@tmnl/effect-sui/SuiPackageRegistry');
    expect(SuiDiagnostics.key).toBe('@tmnl/effect-sui/SuiDiagnostics');
  });

  it('lets SuiObject refresh through an injected object resolver contract', () => {
    const object = new SuiObject<{ count: number }, unknown, SuiObjectResolver>({
      id: objectId,
      refresh: (self) => SuiObjectResolver.use((resolver) => resolver.refresh(self)),
    });

    const snapshot = Effect.runSync(
      object.pipe(
        Effect.provideService(SuiObjectResolver, {
          resolve: () => Effect.die('unused'),
          refresh: (self) => Effect.succeed({ id: self.id, content: { count: 9 } }),
        }),
      ),
    );

    expect(snapshot).toEqual({ id: objectId, content: { count: 9 } });
  });

  it('lets SuiPTB build through analyzer and compiler service contracts', () => {
    const ptb = new SuiPTB<unknown, unknown, SuiPtbAnalyzer | SuiPtbCompiler>({
      label: 'demo.ptb',
      inputs: [{ _tag: 'ObjectInput', name: 'counter' }],
      commands: [{ _tag: 'MoveCall', name: 'increment' }],
      build: (self) =>
        SuiPtbAnalyzer.use((analyzer) =>
          Effect.flatMap(analyzer.analyze(self), (analysis) =>
            SuiPtbCompiler.use((compiler) => compiler.compile({ ptb: self, analysis })),
          ),
        ),
    });

    const artifact = Effect.runSync(
      ptb.pipe(
        Effect.provideService(SuiPtbAnalyzer, {
          analyze: (self) => Effect.succeed({
            inputs: self.inputs,
            commands: self.commands,
            objectIds: [objectId],
            diagnostics: [],
          }),
        }),
        Effect.provideService(SuiPtbCompiler, {
          compile: ({ analysis }) => Effect.succeed({
            inputs: analysis?.inputs ?? [],
            commands: analysis?.commands ?? [],
            requirements: { requiresPayment: true, requiresAuth: true },
          }),
        }),
      ),
    );

    expect(artifact.commands).toEqual([{ _tag: 'MoveCall', name: 'increment' }]);
    expect(artifact.requirements).toEqual({ requiresPayment: true, requiresAuth: true });
  });

  it('lets SuiTx use gas, payment, auth, execution, and finality services in order', () => {
    const digest = '11111111111111111111111111111112' as any;
    const ptb = new SuiPTB({
      label: 'demo.ptb',
      build: () => Effect.succeed({ inputs: [], commands: [], requirements: {} }),
    });
    const tx = new SuiTx<unknown, unknown, SuiGasPlanner | SuiPaymentService | SuiAuthService | SuiExecutionService | SuiFinalityService>({
      label: 'demo.tx',
      ptb,
      execute: (self) =>
        SuiGasPlanner.use((gas) =>
          Effect.flatMap(gas.plan(self), (gasPlan) =>
            SuiPaymentService.use((payment) =>
              Effect.flatMap(payment.plan(self, gasPlan), (paymentPlan) =>
                SuiAuthService.use((auth) =>
                  Effect.flatMap(auth.authorize(self, paymentPlan), (authResult) =>
                    SuiExecutionService.use((executor) =>
                      Effect.flatMap(
                        executor.execute({
                          tx: self,
                          artifact: { inputs: [], commands: [], requirements: {} },
                          auth: authResult,
                          gasPlan,
                          payment: paymentPlan,
                        }),
                        (execution) => SuiFinalityService.use((finality) => finality.wait({ tx: self, execution })),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
    });

    const result = Effect.runSync(
      tx.pipe(
        Effect.provideService(SuiGasPlanner, {
          plan: () => Effect.succeed({ requiresDryRun: false, rationale: 'explicit test budget' }),
        }),
        Effect.provideService(SuiPaymentService, {
          plan: () => Effect.succeed({ gasPayment: [], sponsored: false, addressBalance: true }),
        }),
        Effect.provideService(SuiAuthService, {
          authorize: () => Effect.succeed({ signatures: ['sig'] }),
        }),
        Effect.provideService(SuiExecutionService, {
          execute: () => Effect.succeed({ digest, raw: { ok: true } }),
        }),
        Effect.provideService(SuiFinalityService, {
          wait: (request) => Effect.succeed({ digest: request.execution.digest, transaction: request.execution.raw }),
          waitForDigest: (request) => Effect.succeed({ digest: request.digest, transaction: { ok: true } }),
        }),
      ),
    );

    expect(result).toEqual({ digest, transaction: { ok: true } });
  });
});
