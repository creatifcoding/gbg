/** Test layers, fake clients, fixtures, and localnet harness helpers. */

import * as Effect from 'effect-v4/Effect';
import * as Exit from 'effect-v4/Exit';
import * as Layer from 'effect-v4/Layer';
import * as ManagedRuntime from 'effect-v4/ManagedRuntime';

import { makeClient as makeFlowClient, makeTxRunner, type SuiFlowClient, type SuiFlowRuntime } from '../flow';
import { makeClient as makeQueryClient, type SuiQueryClient, type SuiQueryRuntime } from '../query';
import { decodeSuiObjectId, decodeSuiTransactionDigest, SuiInvariantViolation, SuiPackageDescriptor } from '../schema';
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
  SuiTxRunner,
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
  wait: (request) => Effect.succeed({
    digest: request.execution.digest,
    transaction: request.execution.raw,
    events: [],
  }),
  ...overrides,
});

export const makeFakeReservationService = (
  overrides: Partial<SuiReservationServiceShape> = {},
): SuiReservationServiceShape => ({
  acquire: (request) => Effect.succeed({ id: `fake-reservation:${request.intent}`, intent: request.intent, resourceKeys: [] }),
  release: () => Effect.void,
  reconcile: () => Effect.void,
  ...overrides,
});

export const makeFakePackageRegistry = (
  overrides: Partial<SuiPackageRegistryShape> = {},
): SuiPackageRegistryShape => {
  const descriptors = new Map<string, SuiPackageDescriptor>([
    [fakePackageId, new SuiPackageDescriptor({ packageId: fakePackageId, modules: ['counter'] })],
  ]);

  return {
    register: (descriptor) => Effect.sync(() => {
      descriptors.set(descriptor.packageId, descriptor);
    }),
    get: (packageId) => {
      const descriptor = descriptors.get(packageId);
      return descriptor
        ? Effect.succeed(descriptor)
        : Effect.fail(new SuiInvariantViolation({
            invariant: 'FakeSuiPackageRegistry.get',
            message: `Unknown fake package ${packageId}`,
          }));
    },
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

export type FakeSuiRuntimeServices =
  | SuiClientService
  | SuiObjectResolver
  | SuiBcsBridge
  | SuiPtbAnalyzer
  | SuiPtbCompiler
  | SuiGasPlanner
  | SuiPaymentService
  | SuiAuthService
  | SuiPreflightService
  | SuiExecutionService
  | SuiFinalityService
  | SuiTxRunner
  | SuiReservationService
  | SuiPackageRegistry
  | SuiDiagnostics;

export type FakeSuiRuntime = ManagedRuntime.ManagedRuntime<FakeSuiRuntimeServices, never>;

export interface FakeSuiRuntimeOptions {
  readonly memoMap?: Layer.MemoMap;
}

export interface FakeSuiClient {
  readonly runtime: FakeSuiRuntime;
  readonly flow: SuiFlowClient;
  readonly query: SuiQueryClient;
  readonly run: <A, E, R extends FakeSuiRuntimeServices>(
    effect: Effect.Effect<A, E, R>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<A>;
  readonly runExit: <A, E, R extends FakeSuiRuntimeServices>(
    effect: Effect.Effect<A, E, R>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<Exit.Exit<A, E>>;
  readonly dispose: () => Promise<void>;
}

export const FakeSuiRuntimeLayer = (overrides: FakeSuiServiceOverrides = {}) => {
  const objectResolver = makeFakeObjectResolver(overrides.objectResolver);
  const bcsBridge = makeFakeBcsBridge(overrides.bcsBridge);
  const ptbAnalyzer = makeFakePtbAnalyzer(overrides.ptbAnalyzer);
  const ptbCompiler = makeFakePtbCompiler(overrides.ptbCompiler);
  const gasPlanner = makeFakeGasPlanner(overrides.gasPlanner);
  const paymentService = makeFakePaymentService(overrides.paymentService);
  const authService = makeFakeAuthService(overrides.authService);
  const preflightService = makeFakePreflightService(overrides.preflightService);
  const executionService = makeFakeExecutionService(overrides.executionService);
  const finalityService = makeFakeFinalityService(overrides.finalityService);
  const reservationService = makeFakeReservationService(overrides.reservationService);

  return Layer.mergeAll(
    SuiClientService.layer(overrides.client ?? fakeClient),
    Layer.succeed(SuiObjectResolver)(objectResolver),
    Layer.succeed(SuiBcsBridge)(bcsBridge),
    Layer.succeed(SuiPtbAnalyzer)(ptbAnalyzer),
    Layer.succeed(SuiPtbCompiler)(ptbCompiler),
    Layer.succeed(SuiGasPlanner)(gasPlanner),
    Layer.succeed(SuiPaymentService)(paymentService),
    Layer.succeed(SuiAuthService)(authService),
    Layer.succeed(SuiPreflightService)(preflightService),
    Layer.succeed(SuiExecutionService)(executionService),
    Layer.succeed(SuiFinalityService)(finalityService),
    Layer.succeed(SuiTxRunner)(makeTxRunner({
      ptbAnalyzer,
      ptbCompiler,
      gasPlanner,
      paymentService,
      authService,
      preflightService,
      executionService,
      finalityService,
      reservationService,
    })),
    Layer.succeed(SuiReservationService)(reservationService),
    Layer.succeed(SuiPackageRegistry)(makeFakePackageRegistry(overrides.packageRegistry)),
    Layer.succeed(SuiDiagnostics)(makeFakeDiagnostics(overrides.diagnostics)),
  );
};

export const makeFakeRuntime = (
  overrides: FakeSuiServiceOverrides = {},
  options: FakeSuiRuntimeOptions = {},
): FakeSuiRuntime => ManagedRuntime.make(FakeSuiRuntimeLayer(overrides), { memoMap: options.memoMap });

export const makeFakeClient = (
  overrides: FakeSuiServiceOverrides = {},
  options: FakeSuiRuntimeOptions = {},
): FakeSuiClient => {
  const runtime = makeFakeRuntime(overrides, options);
  return {
    runtime,
    flow: makeFlowClient(runtime as unknown as SuiFlowRuntime),
    query: makeQueryClient(runtime as unknown as SuiQueryRuntime),
    run: (effect, runOptions) => runtime.runPromise(effect, runOptions),
    runExit: (effect, runOptions) => runtime.runPromiseExit(effect, runOptions),
    dispose: () => runtime.dispose(),
  };
};
