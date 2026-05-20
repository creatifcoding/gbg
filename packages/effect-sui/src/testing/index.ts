/** Test layers, fake clients, fixtures, and localnet harness helpers. */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import { decodeSuiObjectId, decodeSuiTransactionDigest } from '../schema';
import type { SuiPackageDescriptor } from '../effectable';
import {
  SuiAuthService,
  type SuiAuthServiceShape,
  SuiBcsBridge,
  type SuiBcsBridgeShape,
  SuiClientService,
  SuiDiagnostics,
  type SuiDiagnosticsShape,
  SuiExecutionService,
  type SuiExecutionServiceShape,
  SuiFinalityService,
  type SuiFinalityServiceShape,
  SuiGasPlanner,
  type SuiGasPlannerShape,
  SuiObjectResolver,
  type SuiObjectResolverShape,
  SuiPackageRegistry,
  type SuiPackageRegistryShape,
  SuiPaymentService,
  type SuiPaymentServiceShape,
  SuiPreflightService,
  type SuiPreflightServiceShape,
  SuiPtbAnalyzer,
  type SuiPtbAnalyzerShape,
  SuiPtbCompiler,
  type SuiPtbCompilerShape,
  SuiReservationService,
  type SuiReservationServiceShape,
} from '../services';

export const fakePackageId = decodeSuiObjectId('0x2');
export const fakeObjectId = decodeSuiObjectId('0x7');
export const fakeTransactionDigest = decodeSuiTransactionDigest(
  '11111111111111111111111111111112',
);

export const fakeClient = {
  network: 'localnet',
  transport: 'fake',
} as const;

export interface FakeSuiServiceOverrides {
  readonly client?: unknown;
  readonly objectResolver?: Partial<SuiObjectResolverShape>;
  readonly bcsBridge?: Partial<SuiBcsBridgeShape>;
  readonly ptbAnalyzer?: Partial<SuiPtbAnalyzerShape>;
  readonly ptbCompiler?: Partial<SuiPtbCompilerShape>;
  readonly gasPlanner?: Partial<SuiGasPlannerShape>;
  readonly paymentService?: Partial<SuiPaymentServiceShape>;
  readonly authService?: Partial<SuiAuthServiceShape>;
  readonly preflightService?: Partial<SuiPreflightServiceShape>;
  readonly executionService?: Partial<SuiExecutionServiceShape>;
  readonly finalityService?: Partial<SuiFinalityServiceShape>;
  readonly reservationService?: Partial<SuiReservationServiceShape>;
  readonly packageRegistry?: Partial<SuiPackageRegistryShape>;
  readonly diagnostics?: Partial<SuiDiagnosticsShape>;
}

export const makeFakeObjectResolver = (
  overrides: Partial<SuiObjectResolverShape> = {},
): SuiObjectResolverShape => ({
  resolve: (request) => Effect.succeed({ id: request.id }),
  refresh: (object) => Effect.succeed({ id: object.id, content: undefined as never }),
  ...overrides,
});

export const makeFakeBcsBridge = (
  overrides: Partial<SuiBcsBridgeShape> = {},
): SuiBcsBridgeShape => ({
  decode: () => Effect.succeed(undefined as never),
  encodePure: () => Effect.succeed(new Uint8Array()),
  serialize: () => Effect.succeed(new Uint8Array()),
  ...overrides,
});

export const makeFakePtbAnalyzer = (
  overrides: Partial<SuiPtbAnalyzerShape> = {},
): SuiPtbAnalyzerShape => ({
  analyze: (ptb) => Effect.succeed({
    inputs: ptb.inputs,
    commands: ptb.commands,
    objectIds: [],
    diagnostics: [],
  }),
  ...overrides,
});

export const makeFakePtbCompiler = (
  overrides: Partial<SuiPtbCompilerShape> = {},
): SuiPtbCompilerShape => ({
  compile: ({ ptb, analysis }) => Effect.succeed({
    inputs: analysis?.inputs ?? ptb.inputs,
    commands: analysis?.commands ?? ptb.commands,
    requirements: ptb.requirements,
    transaction: { _tag: 'FakeMystenTransaction', label: ptb.label },
  }),
  ...overrides,
});

export const makeFakeGasPlanner = (
  overrides: Partial<SuiGasPlannerShape> = {},
): SuiGasPlannerShape => ({
  plan: () => Effect.succeed({
    price: 1_000n,
    budget: 10_000_000n,
    requiresDryRun: false,
    rationale: 'fake fixed gas plan',
  }),
  ...overrides,
});

export const makeFakePaymentService = (
  overrides: Partial<SuiPaymentServiceShape> = {},
): SuiPaymentServiceShape => ({
  plan: () => Effect.succeed({
    gasPayment: [],
    sponsored: false,
    addressBalance: true,
  }),
  ...overrides,
});

export const makeFakeAuthService = (
  overrides: Partial<SuiAuthServiceShape> = {},
): SuiAuthServiceShape => ({
  authorize: () => Effect.succeed({ signatures: ['fake-signature'] }),
  ...overrides,
});

export const makeFakePreflightService = (
  overrides: Partial<SuiPreflightServiceShape> = {},
): SuiPreflightServiceShape => ({
  dryRun: () => Effect.succeed({ status: 'success', diagnostics: [] }),
  ...overrides,
});

export const makeFakeExecutionService = (
  overrides: Partial<SuiExecutionServiceShape> = {},
): SuiExecutionServiceShape => ({
  execute: () => Effect.succeed({ digest: fakeTransactionDigest, raw: { _tag: 'FakeExecution' } }),
  ...overrides,
});

export const makeFakeFinalityService = (
  overrides: Partial<SuiFinalityServiceShape> = {},
): SuiFinalityServiceShape => ({
  wait: (result) => Effect.succeed({
    digest: result.digest,
    transaction: result.raw,
    events: [],
  }),
  ...overrides,
});

export const makeFakeReservationService = (
  overrides: Partial<SuiReservationServiceShape> = {},
): SuiReservationServiceShape => ({
  acquire: (request) => Effect.succeed({ id: `fake-reservation:${request.intent}`, intent: request.intent }),
  release: () => Effect.void,
  reconcile: () => Effect.void,
  ...overrides,
});

export const makeFakePackageRegistry = (
  overrides: Partial<SuiPackageRegistryShape> = {},
): SuiPackageRegistryShape => {
  const descriptors = new Map<string, SuiPackageDescriptor>([
    [fakePackageId, { packageId: fakePackageId, modules: ['counter'] }],
  ]);

  return {
    register: (descriptor) => Effect.sync(() => {
      descriptors.set(descriptor.packageId, descriptor);
    }),
    get: (packageId) => Effect.sync(() => {
      const descriptor = descriptors.get(packageId);
      if (!descriptor) throw new Error(`Unknown fake package ${packageId}`);
      return descriptor;
    }),
    ...overrides,
  };
};

export const makeFakeDiagnostics = (
  overrides: Partial<SuiDiagnosticsShape> = {},
): SuiDiagnosticsShape => ({
  record: () => Effect.void,
  classify: () => Effect.succeed('fake-diagnostic'),
  ...overrides,
});

export const FakeSuiRuntimeLayer = (overrides: FakeSuiServiceOverrides = {}) =>
  Layer.mergeAll(
    SuiClientService.layer(overrides.client ?? fakeClient),
    Layer.succeed(SuiObjectResolver)(makeFakeObjectResolver(overrides.objectResolver)),
    Layer.succeed(SuiBcsBridge)(makeFakeBcsBridge(overrides.bcsBridge)),
    Layer.succeed(SuiPtbAnalyzer)(makeFakePtbAnalyzer(overrides.ptbAnalyzer)),
    Layer.succeed(SuiPtbCompiler)(makeFakePtbCompiler(overrides.ptbCompiler)),
    Layer.succeed(SuiGasPlanner)(makeFakeGasPlanner(overrides.gasPlanner)),
    Layer.succeed(SuiPaymentService)(makeFakePaymentService(overrides.paymentService)),
    Layer.succeed(SuiAuthService)(makeFakeAuthService(overrides.authService)),
    Layer.succeed(SuiPreflightService)(makeFakePreflightService(overrides.preflightService)),
    Layer.succeed(SuiExecutionService)(makeFakeExecutionService(overrides.executionService)),
    Layer.succeed(SuiFinalityService)(makeFakeFinalityService(overrides.finalityService)),
    Layer.succeed(SuiReservationService)(makeFakeReservationService(overrides.reservationService)),
    Layer.succeed(SuiPackageRegistry)(makeFakePackageRegistry(overrides.packageRegistry)),
    Layer.succeed(SuiDiagnostics)(makeFakeDiagnostics(overrides.diagnostics)),
  );
