/** SuiFlow orchestration: reserve, compile, simulate, sign, execute, wait, verify. */

import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import {
  AutoGasPolicy,
  AutoPaymentPolicy,
  decodeSuiAddress,
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
} from '../services';

export interface ClientWithCoreGas {
  readonly core: {
    readonly getReferenceGasPrice?: () => Promise<{ readonly referenceGasPrice: string | number | bigint }>;
  };
}

export interface ClientWithTransactionBuild extends ClientWithCoreGas {
  readonly core: ClientWithCoreGas['core'];
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
    try: async () => (await signer.signTransaction(transactionBytes)).signature,
    catch: (cause) => execution('SuiAuthService.signTransaction', cause),
  });
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
