/** SuiFlow orchestration: reserve, compile, simulate, sign, execute, wait, verify. */

import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';
import * as Exit from 'effect-v4/Exit';
import type * as Fiber from 'effect-v4/Fiber';
import * as Layer from 'effect-v4/Layer';
import * as ManagedRuntime from 'effect-v4/ManagedRuntime';
import * as Ref from 'effect-v4/Ref';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import { SuiPtbLive } from '../ptb';
import { SuiReservationServiceLive } from '../reservation';
import {
  AutoGasPolicy,
  AutoPaymentPolicy,
  decodeSuiAddress,
  decodeSuiTransactionDigest,
  ExplicitGasPolicy,
  ExplicitPaymentPolicy,
  KeypairAuthPolicy,
  OfflineAuthPolicy,
  SponsoredAuthPolicy,
  SponsoredPaymentPolicy,
  SuiExecutionError,
  SuiInvariantViolation,
  type SuiAddress,
  type SuiAuthPolicy,
  type SuiGasPolicy,
  type SuiObjectId,
  type SuiObjectRef,
  type SuiPaymentPolicy,
} from '../schema';
import {
  SuiAuthService,
  type SuiAuthResult,
  type SuiAuthServiceShape,
  SuiClientService,
  SuiGasPlanner,
  type SuiGasPlan,
  type SuiGasPlannerShape,
  SuiPaymentService,
  type SuiPaymentPlan,
  type SuiPaymentServiceShape,
  SuiPreflightService,
  type SuiPreflightRequest,
  type SuiPreflightResult,
  type SuiPreflightServiceShape,
  SuiReservationService,
  type SuiReservationRequest,
  type SuiReservationServiceShape,
  type SuiReservationToken,
  SuiPtbAnalyzer,
  type SuiPtbAnalyzerShape,
  SuiPtbCompiler,
  type SuiPtbCompilerShape,
  SuiTxRunner,
  type SuiTxLifecycleResult,
  type SuiTxRunnerShape,
  SuiExecutionService,
  type SuiExecutionRequest,
  type SuiExecutionResultEnvelope,
  type SuiExecutionServiceShape,
  SuiFinalityService,
  type SuiFinalityRequest,
  type SuiFinalityResult,
  type SuiFinalityServiceShape,
} from '../services';

export interface ClientWithCoreGas {
  readonly core: {
    readonly getReferenceGasPrice?: () => Promise<{ readonly referenceGasPrice: string | number | bigint }>;
  };
}

export interface ClientWithTransactionBuild extends ClientWithCoreGas {
  readonly core: ClientWithCoreGas['core'];
}

export interface ClientWithTransactionLifecycle extends ClientWithTransactionBuild {
  readonly core: ClientWithTransactionBuild['core'] & {
    readonly simulateTransaction?: (options: {
      readonly transaction: Uint8Array;
      readonly include?: { readonly effects?: boolean; readonly transaction?: boolean; readonly events?: boolean; readonly balanceChanges?: boolean };
    }) => Promise<unknown>;
    readonly executeTransaction?: (options: {
      readonly transaction: Uint8Array;
      readonly signatures: ReadonlyArray<string>;
      readonly include?: { readonly effects?: boolean; readonly transaction?: boolean; readonly events?: boolean; readonly balanceChanges?: boolean };
    }) => Promise<unknown>;
    readonly waitForTransaction?: (options: {
      readonly digest: string;
      readonly include?: { readonly effects?: boolean; readonly transaction?: boolean; readonly events?: boolean; readonly balanceChanges?: boolean };
      readonly timeout?: number;
    }) => Promise<unknown>;
  };
}

export interface SignerLike {
  readonly signTransaction: (bytes: Uint8Array) => Promise<{ readonly signature: string; readonly bytes?: string }>;
  readonly toSuiAddress?: () => string;
  readonly getPublicKey?: () => { readonly toSuiAddress: () => string };
}

export const makeGasPlanner = (client?: ClientWithCoreGas): SuiGasPlannerShape => ({
  plan: (tx) => Effect.gen(function* () {
    const policy = tx.gasPolicy ?? new AutoGasPolicy({});
    const price = yield* resolveGasPrice(policy, client);
    const budget = yield* resolveGasBudget(policy);
    return {
      price,
      budget,
      requiresDryRun: budget === undefined,
      rationale: gasRationale(policy, price, budget),
    } satisfies SuiGasPlan;
  }),
});

export const SuiGasPlannerFromClient = Layer.effect(SuiGasPlanner)(
  SuiClientService.useSync((service) => makeGasPlanner(service.client as ClientWithCoreGas)),
);
export const SuiGasPlannerNoClient = Layer.succeed(SuiGasPlanner)(makeGasPlanner());

export const makePaymentService = (): SuiPaymentServiceShape => ({
  plan: (tx, _gasPlan) => Effect.gen(function* () {
    const policy = tx.paymentPolicy ?? new AutoPaymentPolicy({ addressBalance: true });
    const objectInputIds = collectPtbObjectInputIds(tx);
    return yield* planPayment(policy, objectInputIds);
  }),
});

export const SuiPaymentServiceLive = Layer.succeed(SuiPaymentService)(makePaymentService());

export const makeAuthService = (client: ClientWithTransactionBuild): SuiAuthServiceShape => ({
  authorize: (tx, payment, artifact, gasPlan) => authorizeWithPolicy({ client, tx, payment, artifact, gasPlan }),
});

export const SuiAuthServiceFromClient = Layer.effect(SuiAuthService)(
  SuiClientService.useSync((service) => makeAuthService(service.client as ClientWithTransactionBuild)),
);

export const SuiPaymentAuthLive = Layer.mergeAll(
  SuiGasPlannerFromClient,
  SuiPaymentServiceLive,
  SuiAuthServiceFromClient,
);

export const makePreflightService = (client: ClientWithTransactionLifecycle): SuiPreflightServiceShape => ({
  dryRun: (request) => dryRunTransaction(client, request),
});

export const SuiPreflightServiceFromClient = Layer.effect(SuiPreflightService)(
  SuiClientService.useSync((service) => makePreflightService(service.client as ClientWithTransactionLifecycle)),
);

export const makeExecutionService = (client: ClientWithTransactionLifecycle): SuiExecutionServiceShape => ({
  execute: (request) => executeTransaction(client, request),
});

export const SuiExecutionServiceFromClient = Layer.effect(SuiExecutionService)(
  SuiClientService.useSync((service) => makeExecutionService(service.client as ClientWithTransactionLifecycle)),
);

export const makeFinalityService = (client: ClientWithTransactionLifecycle): SuiFinalityServiceShape => ({
  wait: (request) => waitForTransaction(client, request),
});

export const SuiFinalityServiceFromClient = Layer.effect(SuiFinalityService)(
  SuiClientService.useSync((service) => makeFinalityService(service.client as ClientWithTransactionLifecycle)),
);

export interface SuiTxRunnerDependencies {
  readonly ptbAnalyzer: SuiPtbAnalyzerShape;
  readonly ptbCompiler: SuiPtbCompilerShape;
  readonly gasPlanner: SuiGasPlannerShape;
  readonly paymentService: SuiPaymentServiceShape;
  readonly authService: SuiAuthServiceShape;
  readonly preflightService: SuiPreflightServiceShape;
  readonly executionService: SuiExecutionServiceShape;
  readonly finalityService: SuiFinalityServiceShape;
  readonly reservationService: SuiReservationServiceShape;
}

export interface SuiTxRunnerOptions {
  readonly reconcile?: (
    partial: Partial<SuiTxLifecycleResult> & { readonly tx: SuiTx<unknown, unknown, unknown> },
    exit: Exit.Exit<SuiTxLifecycleResult, unknown>,
  ) => Effect.Effect<void, unknown, never>;
}

export const makeTxRunner = (
  dependencies: SuiTxRunnerDependencies,
  options: SuiTxRunnerOptions = {},
): SuiTxRunnerShape => ({
  run: (tx) => runTxLifecycle(tx, dependencies, options).pipe(
    Effect.withSpan('@tmnl/effect-sui/SuiTxRunner.run', { attributes: { label: tx.label, mode: tx.buildMode ?? 'execute' } }),
  ),
});

export const makeTxRunnerLayer = (options: SuiTxRunnerOptions = {}) => Layer.effect(SuiTxRunner)(
  Effect.gen(function* () {
    const ptbAnalyzer = yield* SuiPtbAnalyzer;
    const ptbCompiler = yield* SuiPtbCompiler;
    const gasPlanner = yield* SuiGasPlanner;
    const paymentService = yield* SuiPaymentService;
    const authService = yield* SuiAuthService;
    const preflightService = yield* SuiPreflightService;
    const executionService = yield* SuiExecutionService;
    const finalityService = yield* SuiFinalityService;
    const reservationService = yield* SuiReservationService;
    return makeTxRunner({ ptbAnalyzer, ptbCompiler, gasPlanner, paymentService, authService, preflightService, executionService, finalityService, reservationService }, options);
  }),
);

export const SuiTxRunnerLive = makeTxRunnerLayer();

export const SuiTxLifecycleServices = Layer.mergeAll(
  SuiPtbLive,
  SuiPaymentAuthLive,
  SuiPreflightServiceFromClient,
  SuiExecutionServiceFromClient,
  SuiFinalityServiceFromClient,
  SuiReservationServiceLive,
);

export const makeTxLifecycleLayer = (options: SuiTxRunnerOptions = {}) =>
  makeTxRunnerLayer(options).pipe(Layer.provideMerge(SuiTxLifecycleServices));

export const SuiTxLifecycleLive = makeTxLifecycleLayer();

export type SuiFlowServices =
  | SuiClientService
  | SuiPtbAnalyzer
  | SuiPtbCompiler
  | SuiGasPlanner
  | SuiPaymentService
  | SuiAuthService
  | SuiPreflightService
  | SuiExecutionService
  | SuiFinalityService
  | SuiReservationService
  | SuiTxRunner;

export type SuiFlowRuntime = ManagedRuntime.ManagedRuntime<SuiFlowServices, never>;

export interface SuiFlowRuntimeOptions extends SuiTxRunnerOptions {
  readonly memoMap?: Layer.MemoMap;
}

export interface SuiFlowClient {
  readonly runtime: SuiFlowRuntime;
  readonly run: (
    tx: SuiTx<unknown, unknown, unknown>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<SuiTxLifecycleResult>;
  readonly runExit: (
    tx: SuiTx<unknown, unknown, unknown>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<Exit.Exit<SuiTxLifecycleResult, unknown>>;
  readonly runFork: (
    tx: SuiTx<unknown, unknown, unknown>,
    options?: Effect.RunOptions,
  ) => Fiber.Fiber<SuiTxLifecycleResult, unknown>;
  readonly runCallback: (
    tx: SuiTx<unknown, unknown, unknown>,
    options: Effect.RunOptions & { readonly onExit: (exit: Exit.Exit<SuiTxLifecycleResult, unknown>) => void },
  ) => (interruptor?: number | undefined) => void;
  readonly dispose: () => Promise<void>;
}

export const makeLayer = (
  client: ClientWithTransactionLifecycle,
  options: SuiTxRunnerOptions = {},
): Layer.Layer<SuiFlowServices, never, never> => makeTxLifecycleLayer(options).pipe(
  Layer.provideMerge(SuiClientService.layer(client)),
);

export const makeRuntime = (
  client: ClientWithTransactionLifecycle,
  options: SuiFlowRuntimeOptions = {},
): SuiFlowRuntime => ManagedRuntime.make(makeLayer(client, options), { memoMap: options.memoMap });

export const makeClient = (
  clientOrRuntime: ClientWithTransactionLifecycle | SuiFlowRuntime,
  options: SuiFlowRuntimeOptions = {},
): SuiFlowClient => {
  const runtime = ManagedRuntime.isManagedRuntime(clientOrRuntime)
    ? clientOrRuntime as SuiFlowRuntime
    : makeRuntime(clientOrRuntime as ClientWithTransactionLifecycle, options);
  return {
    runtime,
    run: (tx, runOptions) => runtime.runPromise(runTx(tx), runOptions),
    runExit: (tx, runOptions) => runtime.runPromiseExit(runTx(tx), runOptions),
    runFork: (tx, runOptions) => runtime.runFork(runTx(tx), runOptions),
    runCallback: (tx, runOptions) => runtime.runCallback(runTx(tx), runOptions),
    dispose: () => runtime.dispose(),
  };
};

export const runTx = (
  tx: SuiTx<unknown, unknown, unknown>,
): Effect.Effect<SuiTxLifecycleResult, unknown, SuiTxRunner> => SuiTxRunner.use((runner) => runner.run(tx));

function resolveGasPrice(
  policy: SuiGasPolicy,
  client?: ClientWithCoreGas,
): Effect.Effect<bigint | undefined, SuiInvariantViolation> {
  if (policy.price !== undefined) return parseBigInt(policy.price, 'SuiGasPlanner.price');
  if (!client?.core.getReferenceGasPrice) return Effect.succeed(undefined);

  return Effect.flatMap(
    Effect.tryPromise({
      try: () => client.core.getReferenceGasPrice!(),
      catch: (cause) => invariant('SuiGasPlanner.referenceGasPrice', cause),
    }),
    (response) => parseBigInt(response.referenceGasPrice, 'SuiGasPlanner.referenceGasPrice'),
  );
}

function resolveGasBudget(policy: SuiGasPolicy): Effect.Effect<bigint | undefined, SuiInvariantViolation> {
  return policy.budget === undefined
    ? Effect.succeed(undefined)
    : parseBigInt(policy.budget, 'SuiGasPlanner.budget');
}

function parseBigInt(value: string | number | bigint, invariantName: string): Effect.Effect<bigint, SuiInvariantViolation> {
  return Effect.try({
    try: () => BigInt(value),
    catch: (cause) => invariant(invariantName, cause),
  });
}

function gasRationale(policy: SuiGasPolicy, price: bigint | undefined, budget: bigint | undefined): string {
  const source = policy instanceof ExplicitGasPolicy ? 'explicit' : 'auto';
  return `${source} gas policy; price=${price?.toString() ?? 'sdk-default'}; budget=${budget?.toString() ?? 'dry-run'}`;
}

function planPayment(
  policy: SuiPaymentPolicy,
  objectInputIds: ReadonlySet<SuiObjectId>,
): Effect.Effect<SuiPaymentPlan, SuiInvariantViolation> {
  return Effect.gen(function* () {
    if (policy instanceof ExplicitPaymentPolicy) {
      yield* rejectGasOverlap(policy.gasPayment, objectInputIds);
      return {
        gasOwner: policy.gasOwner,
        gasPayment: policy.gasPayment,
        sponsored: false,
        addressBalance: false,
      };
    }

    if (policy instanceof SponsoredPaymentPolicy) {
      yield* rejectGasOverlap(policy.gasPayment, objectInputIds);
      return {
        gasOwner: policy.sponsor,
        gasPayment: policy.gasPayment,
        sponsored: true,
        addressBalance: policy.gasPayment.length === 0,
      };
    }

    return {
      gasPayment: [],
      sponsored: false,
      addressBalance: policy.addressBalance,
    };
  });
}

function rejectGasOverlap(
  gasPayment: ReadonlyArray<SuiObjectRef>,
  objectInputIds: ReadonlySet<SuiObjectId>,
): Effect.Effect<void, SuiInvariantViolation> {
  const overlap = gasPayment.find((ref) => objectInputIds.has(ref.objectId));
  return overlap
    ? Effect.fail(invariant('SuiPaymentService.gasOverlap', `Gas payment overlaps PTB object input ${overlap.objectId}`))
    : Effect.void;
}

function collectPtbObjectInputIds(tx: SuiTx<unknown, unknown, unknown>): ReadonlySet<SuiObjectId> {
  const ids = new Set<SuiObjectId>();
  for (const input of tx.ptb?.inputs ?? []) {
    const entry = input as {
      readonly _tag?: string;
      readonly objectId?: SuiObjectId;
      readonly ref?: { readonly objectId?: SuiObjectId };
    };
    if (entry._tag === 'ObjectInput' && entry.objectId) ids.add(entry.objectId);
    if (
      (entry._tag === 'ObjectRefInput' ||
        entry._tag === 'SharedObjectInput' ||
        entry._tag === 'ReceivingObjectInput') &&
      entry.ref?.objectId
    ) {
      ids.add(entry.ref.objectId);
    }
  }
  return ids;
}

function authorizeWithPolicy(options: {
  readonly client: ClientWithTransactionBuild;
  readonly tx: SuiTx<unknown, unknown, unknown>;
  readonly payment: SuiPaymentPlan;
  readonly artifact?: SuiPtbBuildArtifact<unknown>;
  readonly gasPlan?: SuiGasPlan;
}): Effect.Effect<SuiAuthResult, SuiExecutionError | SuiInvariantViolation> {
  return Effect.gen(function* () {
    const authPolicy = yield* getAuthPolicy(options.tx);
    const transaction = yield* getTransaction(options.artifact);
    yield* applyGasAndPayment(transaction, options.tx, options.payment, options.gasPlan);

    if (authPolicy instanceof OfflineAuthPolicy) {
      transaction.setSenderIfNotSet(authPolicy.sender);
      const transactionBytes = yield* buildTransaction(transaction, options.client);
      return {
        signatures: [],
        transactionBytes,
        offlinePayload: { sender: authPolicy.sender, transactionBytes },
      };
    }

    if (authPolicy instanceof KeypairAuthPolicy) {
      const signer = yield* asSigner(authPolicy.signer);
      const sender = authPolicy.sender ?? (yield* signerAddress(signer));
      transaction.setSenderIfNotSet(sender);
      const transactionBytes = yield* buildTransaction(transaction, options.client);
      const signature = yield* signTransaction(signer, transactionBytes);
      return { signatures: [signature], transactionBytes };
    }

    if (authPolicy instanceof SponsoredAuthPolicy) {
      const signer = yield* asSigner(authPolicy.signer);
      transaction.setSenderIfNotSet(authPolicy.sender);
      transaction.setGasOwner(authPolicy.sponsor);
      const transactionBytes = yield* buildTransaction(transaction, options.client);
      const senderSignature = yield* signTransaction(signer, transactionBytes);
      const sponsorSignature = authPolicy.sponsorSigner
        ? yield* Effect.map(asSigner(authPolicy.sponsorSigner), (sponsorSigner) =>
            signTransaction(sponsorSigner, transactionBytes),
          ).pipe(Effect.flatten)
        : undefined;
      return {
        signatures: sponsorSignature ? [senderSignature, sponsorSignature] : [senderSignature],
        transactionBytes,
      };
    }

    return yield* Effect.fail(invariant('SuiAuthService.policy', `Unsupported auth policy ${(authPolicy as SuiAuthPolicy)._tag}`));
  });
}

function getAuthPolicy(tx: SuiTx<unknown, unknown, unknown>): Effect.Effect<SuiAuthPolicy, SuiInvariantViolation> {
  return tx.authPolicy
    ? Effect.succeed(tx.authPolicy)
    : Effect.fail(invariant('SuiAuthService.authPolicy', `SuiTx ${tx.label} has no auth policy`));
}

function getTransaction(
  artifact: SuiPtbBuildArtifact<unknown> | undefined,
): Effect.Effect<Transaction, SuiInvariantViolation> {
  return artifact?.transaction instanceof Transaction
    ? Effect.succeed(artifact.transaction)
    : Effect.fail(invariant('SuiAuthService.artifact', 'SuiAuthService requires a SuiPtbBuildArtifact containing a Mysten Transaction'));
}

function applyGasAndPayment(
  transaction: Transaction,
  tx: SuiTx<unknown, unknown, unknown>,
  payment: SuiPaymentPlan,
  gasPlan: SuiGasPlan | undefined,
): Effect.Effect<void, SuiInvariantViolation> {
  return Effect.try({
    try: () => {
      if (tx.sender) transaction.setSenderIfNotSet(tx.sender);
      if (gasPlan?.price !== undefined) transaction.setGasPrice(gasPlan.price);
      if (gasPlan?.budget !== undefined) transaction.setGasBudget(gasPlan.budget);
      if (payment.gasOwner) transaction.setGasOwner(payment.gasOwner);
      if (payment.gasPayment.length > 0) {
        transaction.setGasPayment(payment.gasPayment.map((ref) => ref.toMysten()));
      }
    },
    catch: (cause) => invariant('SuiAuthService.applyGasAndPayment', cause),
  });
}

function asSigner(value: unknown): Effect.Effect<SignerLike, SuiInvariantViolation> {
  const signer = value as SignerLike;
  return signer && typeof signer.signTransaction === 'function'
    ? Effect.succeed(signer)
    : Effect.fail(invariant('SuiAuthService.signer', 'Auth policy signer does not expose signTransaction(bytes)'));
}

function signerAddress(signer: SignerLike): Effect.Effect<SuiAddress, SuiInvariantViolation> {
  return Effect.try({
    try: () => decodeSuiAddress(signer.toSuiAddress?.() ?? signer.getPublicKey?.().toSuiAddress()),
    catch: (cause) => invariant('SuiAuthService.signerAddress', cause),
  });
}

function buildTransaction(
  transaction: Transaction,
  client: ClientWithTransactionBuild,
): Effect.Effect<Uint8Array, SuiExecutionError> {
  return Effect.tryPromise({
    try: () => transaction.build({ client: client as never }),
    catch: (cause) => execution('SuiAuthService.buildTransaction', cause),
  });
}

function signTransaction(signer: SignerLike, transactionBytes: Uint8Array): Effect.Effect<string, SuiExecutionError> {
  return Effect.tryPromise({
    try: () => signer.signTransaction(transactionBytes).then((result) => result.signature),
    catch: (cause) => execution('SuiAuthService.signTransaction', cause),
  });
}

function dryRunTransaction(
  client: ClientWithTransactionLifecycle,
  request: SuiPreflightRequest,
): Effect.Effect<SuiPreflightResult, SuiExecutionError | SuiInvariantViolation> {
  if (!client.core.simulateTransaction) {
    return Effect.fail(invariant('SuiPreflightService.client', 'Client does not expose core.simulateTransaction'));
  }

  return Effect.gen(function* () {
    const transactionBytes = yield* requireTransactionBytes(request.auth, 'SuiPreflightService.transactionBytes');
    const raw = yield* Effect.tryPromise({
      try: () => client.core.simulateTransaction!({
        transaction: transactionBytes,
        include: { effects: true, transaction: true, events: true, balanceChanges: true },
      }),
      catch: (cause) => execution('SuiPreflightService.simulateTransaction', cause),
    });
    const transaction = transactionPayload(raw);
    const status = transactionStatus(raw);
    return {
      status: status.success ? 'success' : 'failure',
      gasUsed: transaction?.effects?.gasUsed,
      diagnostics: status.diagnostics,
      raw,
    } satisfies SuiPreflightResult;
  });
}

function executeTransaction(
  client: ClientWithTransactionLifecycle,
  request: SuiExecutionRequest,
): Effect.Effect<SuiExecutionResultEnvelope, SuiExecutionError | SuiInvariantViolation> {
  if (!client.core.executeTransaction) {
    return Effect.fail(invariant('SuiExecutionService.client', 'Client does not expose core.executeTransaction'));
  }

  return Effect.gen(function* () {
    const transactionBytes = yield* requireTransactionBytes(request.auth, 'SuiExecutionService.transactionBytes');
    if (request.auth.signatures.length === 0) {
      return yield* Effect.fail(invariant('SuiExecutionService.signatures', 'Execution requires at least one signature'));
    }
    const raw = yield* Effect.tryPromise({
      try: () => client.core.executeTransaction!({
        transaction: transactionBytes,
        signatures: [...request.auth.signatures],
        include: { effects: true, transaction: true, events: true, balanceChanges: true },
      }),
      catch: (cause) => execution('SuiExecutionService.executeTransaction', cause),
    });
    const digest = yield* digestFromTransactionResult(raw, 'SuiExecutionService.executeTransaction');
    return { digest, raw } satisfies SuiExecutionResultEnvelope;
  });
}

function waitForTransaction(
  client: ClientWithTransactionLifecycle,
  request: SuiFinalityRequest,
): Effect.Effect<SuiFinalityResult, SuiExecutionError | SuiInvariantViolation> {
  if (!client.core.waitForTransaction) {
    return Effect.fail(invariant('SuiFinalityService.client', 'Client does not expose core.waitForTransaction'));
  }

  return Effect.gen(function* () {
    const raw = yield* Effect.tryPromise({
      try: () => client.core.waitForTransaction!({
        digest: request.execution.digest,
        include: { effects: true, transaction: true, events: true, balanceChanges: true },
        timeout: 60_000,
      }),
      catch: (cause) => execution('SuiFinalityService.waitForTransaction', cause),
    });
    const transaction = transactionPayload(raw);
    return {
      digest: request.execution.digest,
      transaction: raw,
      effects: transaction?.effects,
      events: transaction?.events ?? [],
    } satisfies SuiFinalityResult;
  });
}

function runTxLifecycle(
  tx: SuiTx<unknown, unknown, unknown>,
  dependencies: SuiTxRunnerDependencies,
  options: SuiTxRunnerOptions,
): Effect.Effect<SuiTxLifecycleResult, unknown, never> {
  return Effect.gen(function* () {
    const partialRef = yield* Ref.make<Partial<SuiTxLifecycleResult> & { tx: SuiTx<unknown, unknown, unknown> }>({ tx });
    const reservationRef = yield* Ref.make<SuiReservationToken | undefined>(undefined);
    const remember = (patch: Partial<SuiTxLifecycleResult>) => Ref.update(partialRef, (partial) => ({ ...partial, ...patch }));

    const program = Effect.gen(function* () {
      const ptb = yield* requirePtb(tx);
      const analysis = yield* dependencies.ptbAnalyzer.analyze(ptb);
      const artifact = yield* dependencies.ptbCompiler.compile({ ptb, analysis, buildMode: tx.buildMode });
      yield* remember({ artifact });

      const gasPlan = yield* dependencies.gasPlanner.plan(tx);
      yield* remember({ gasPlan });

      const payment = yield* dependencies.paymentService.plan(tx, gasPlan);
      yield* remember({ payment });

      const reservation = yield* dependencies.reservationService.acquire(makeLifecycleReservationRequest(tx, artifact, payment));
      yield* Ref.set(reservationRef, reservation);

      const auth = yield* dependencies.authService.authorize(tx, payment, artifact, gasPlan);
      yield* remember({ auth });

      const preflight = shouldPreflight(tx, gasPlan)
        ? yield* dependencies.preflightService.dryRun({ tx, artifact, auth, gasPlan, payment })
        : undefined;
      if (preflight) yield* remember({ preflight });

      if (tx.buildMode === 'build-only' || tx.buildMode === 'dry-run') {
        return yield* completeLifecycle(partialRef);
      }

      const executionResult = yield* dependencies.executionService.execute({ tx, artifact, auth, gasPlan, payment, preflight });
      yield* remember({ execution: executionResult });

      const finality = yield* dependencies.finalityService.wait({ tx, execution: executionResult });
      yield* remember({ finality });

      return yield* completeLifecycle(partialRef);
    });

    return yield* Effect.onExit(program, (exit) => Effect.gen(function* () {
      const token = yield* Ref.get(reservationRef);
      const partial = yield* Ref.get(partialRef);
      if (token) {
        yield* dependencies.reservationService.reconcile(token, { partial, exit });
      }
      if (options.reconcile) {
        yield* options.reconcile(partial, exit);
      }
    }));
  });
}

function makeLifecycleReservationRequest(
  tx: SuiTx<unknown, unknown, unknown>,
  artifact: SuiPtbBuildArtifact<unknown>,
  payment: SuiPaymentPlan,
): SuiReservationRequest {
  return {
    objectRefs: collectArtifactObjectRefs(artifact),
    objectIds: collectArtifactObjectIds(artifact),
    gasRefs: payment.gasPayment,
    sender: tx.sender,
    sponsor: payment.sponsored ? payment.gasOwner : undefined,
    intent: tx.label,
  };
}

function collectArtifactObjectRefs(artifact: SuiPtbBuildArtifact<unknown>): ReadonlyArray<SuiObjectRef> {
  const refs: Array<SuiObjectRef> = [];
  for (const input of artifact.inputs) {
    const entry = input as {
      readonly _tag?: string;
      readonly ref?: SuiObjectRef;
    };
    if ((entry._tag === 'ObjectRefInput' || entry._tag === 'ReceivingObjectInput') && entry.ref) {
      refs.push(entry.ref);
    }
  }
  return refs;
}

function collectArtifactObjectIds(artifact: SuiPtbBuildArtifact<unknown>): ReadonlyArray<SuiObjectId> {
  const ids: Array<SuiObjectId> = [];
  for (const input of artifact.inputs) {
    const entry = input as {
      readonly _tag?: string;
      readonly objectId?: SuiObjectId;
    };
    if (entry._tag === 'ObjectInput' && entry.objectId) ids.push(entry.objectId);
  }
  return ids;
}

function requirePtb(
  tx: SuiTx<unknown, unknown, unknown>,
): Effect.Effect<NonNullable<SuiTx<unknown, unknown, unknown>['ptb']>, SuiInvariantViolation> {
  return tx.ptb
    ? Effect.succeed(tx.ptb)
    : Effect.fail(invariant('SuiTxRunner.ptb', `SuiTx ${tx.label} has no PTB`));
}

function completeLifecycle(
  partialRef: Ref.Ref<Partial<SuiTxLifecycleResult> & { tx: SuiTx<unknown, unknown, unknown> }>,
): Effect.Effect<SuiTxLifecycleResult, SuiInvariantViolation> {
  return Effect.gen(function* () {
    const partial = yield* Ref.get(partialRef);
    if (!partial.artifact) return yield* Effect.fail(invariant('SuiTxRunner.artifact', 'Lifecycle completed without a PTB artifact'));
    if (!partial.gasPlan) return yield* Effect.fail(invariant('SuiTxRunner.gasPlan', 'Lifecycle completed without a gas plan'));
    if (!partial.payment) return yield* Effect.fail(invariant('SuiTxRunner.payment', 'Lifecycle completed without a payment plan'));
    if (!partial.auth) return yield* Effect.fail(invariant('SuiTxRunner.auth', 'Lifecycle completed without auth result'));
    return partial as SuiTxLifecycleResult;
  });
}

function shouldPreflight(tx: SuiTx<unknown, unknown, unknown>, gasPlan: SuiGasPlan): boolean {
  return tx.buildMode === 'dry-run' || tx.buildMode === 'execute' || tx.buildMode === undefined || gasPlan.requiresDryRun;
}

function requireTransactionBytes(auth: SuiAuthResult, invariantName: string): Effect.Effect<Uint8Array, SuiInvariantViolation> {
  return auth.transactionBytes
    ? Effect.succeed(auth.transactionBytes)
    : Effect.fail(invariant(invariantName, 'Auth result does not include transaction bytes'));
}

function digestFromTransactionResult(result: unknown, command: string): Effect.Effect<ReturnType<typeof decodeSuiTransactionDigest>, SuiExecutionError> {
  const digest = transactionPayload(result)?.digest;
  return digest
    ? Effect.try({
        try: () => decodeSuiTransactionDigest(digest),
        catch: (cause) => execution(command, cause),
      })
    : Effect.fail(execution(command, 'Transaction result did not include a digest'));
}

type TransactionPayloadLike = {
  readonly digest?: string;
  readonly status?: { readonly success?: boolean; readonly error?: unknown };
  readonly effects?: { readonly gasUsed?: unknown; readonly status?: { readonly success?: boolean; readonly error?: unknown } };
  readonly events?: ReadonlyArray<unknown>;
};

function transactionPayload(result: unknown): TransactionPayloadLike | undefined {
  const envelope = result as {
    readonly Transaction?: TransactionPayloadLike;
    readonly FailedTransaction?: TransactionPayloadLike;
    readonly digest?: string;
    readonly effects?: TransactionPayloadLike['effects'];
    readonly events?: ReadonlyArray<unknown>;
  };
  return envelope.Transaction ?? envelope.FailedTransaction ?? (
    envelope.digest ? { digest: envelope.digest, effects: envelope.effects, events: envelope.events } : undefined
  );
}

function transactionStatus(result: unknown): { readonly success: boolean; readonly diagnostics: ReadonlyArray<string> } {
  const envelope = result as { readonly $kind?: string };
  const transaction = transactionPayload(result);
  const status = transaction?.status ?? transaction?.effects?.status;
  const failedByKind = envelope.$kind === 'FailedTransaction';
  const success = failedByKind ? false : status?.success !== false;
  const diagnostics = success ? [] : [String(status?.error ?? 'transaction simulation failed')];
  return { success, diagnostics };
}

function invariant(invariantName: string, cause: unknown): SuiInvariantViolation {
  if (cause instanceof SuiInvariantViolation) return cause;
  return new SuiInvariantViolation({
    invariant: invariantName,
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  });
}

function execution(command: string, cause: unknown): SuiExecutionError {
  if (cause instanceof SuiExecutionError) return cause;
  return new SuiExecutionError({
    command,
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  });
}
