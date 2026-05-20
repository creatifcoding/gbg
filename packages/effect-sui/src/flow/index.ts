/** SuiFlow orchestration: reserve, compile, simulate, sign, execute, wait, verify. */

import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import {
  AutoGasPolicy,
  AutoPaymentPolicy,
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

export const makeSuiGasPlanner = (client?: ClientWithCoreGas): SuiGasPlannerShape => ({
  plan: (tx) => Effect.tryPromise({
    try: async () => {
      const policy = tx.gasPolicy ?? new AutoGasPolicy({});
      const price = await resolveGasPrice(policy, client);
      const budget = resolveGasBudget(policy);
      return {
        price,
        budget,
        requiresDryRun: budget === undefined,
        rationale: gasRationale(policy, price, budget),
      } satisfies SuiGasPlan;
    },
    catch: (cause) => new SuiInvariantViolation({
      invariant: 'SuiGasPlanner.plan',
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    }),
  }),
});

export const SuiGasPlannerFromClient = Layer.effect(SuiGasPlanner)(
  SuiClientService.useSync((service) => makeSuiGasPlanner(service.client as ClientWithCoreGas)),
);
export const SuiGasPlannerNoClient = Layer.succeed(SuiGasPlanner)(makeSuiGasPlanner());

export const makeSuiPaymentService = (): SuiPaymentServiceShape => ({
  plan: (tx, _gasPlan) => Effect.try({
    try: () => {
      const policy = tx.paymentPolicy ?? new AutoPaymentPolicy({ addressBalance: true });
      const objectInputIds = collectPtbObjectInputIds(tx);
      return planPayment(policy, objectInputIds);
    },
    catch: (cause) => new SuiInvariantViolation({
      invariant: 'SuiPaymentService.plan',
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    }),
  }),
});

export const SuiPaymentServiceLive = Layer.succeed(SuiPaymentService)(makeSuiPaymentService());

export const makeSuiAuthService = (client: ClientWithTransactionBuild): SuiAuthServiceShape => ({
  authorize: (tx, payment, artifact, gasPlan) => Effect.tryPromise({
    try: async () => authorizeWithPolicy({ client, tx, payment, artifact, gasPlan }),
    catch: (cause) => normalizeAuthError(cause),
  }),
});

export const SuiAuthServiceFromClient = Layer.effect(SuiAuthService)(
  SuiClientService.useSync((service) => makeSuiAuthService(service.client as ClientWithTransactionBuild)),
);

export const SuiPaymentAuthLive = Layer.mergeAll(
  SuiGasPlannerFromClient,
  SuiPaymentServiceLive,
  SuiAuthServiceFromClient,
);

async function resolveGasPrice(
  policy: SuiGasPolicy,
  client?: ClientWithCoreGas,
): Promise<bigint | undefined> {
  if (policy.price !== undefined) return BigInt(policy.price);
  const response = await client?.core.getReferenceGasPrice?.();
  return response?.referenceGasPrice === undefined ? undefined : BigInt(response.referenceGasPrice);
}

function resolveGasBudget(policy: SuiGasPolicy): bigint | undefined {
  return policy.budget === undefined ? undefined : BigInt(policy.budget);
}

function gasRationale(policy: SuiGasPolicy, price: bigint | undefined, budget: bigint | undefined): string {
  const source = policy instanceof ExplicitGasPolicy ? 'explicit' : 'auto';
  return `${source} gas policy; price=${price?.toString() ?? 'sdk-default'}; budget=${budget?.toString() ?? 'dry-run'}`;
}

function planPayment(
  policy: SuiPaymentPolicy,
  objectInputIds: ReadonlySet<SuiObjectId>,
): SuiPaymentPlan {
  if (policy instanceof ExplicitPaymentPolicy) {
    rejectGasOverlap(policy.gasPayment, objectInputIds);
    return {
      gasOwner: policy.gasOwner,
      gasPayment: policy.gasPayment,
      sponsored: false,
      addressBalance: false,
    };
  }

  if (policy instanceof SponsoredPaymentPolicy) {
    rejectGasOverlap(policy.gasPayment, objectInputIds);
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
}

function rejectGasOverlap(
  gasPayment: ReadonlyArray<SuiObjectRef>,
  objectInputIds: ReadonlySet<SuiObjectId>,
): void {
  const overlap = gasPayment.find((ref) => objectInputIds.has(ref.objectId));
  if (overlap) {
    throw new Error(`Gas payment overlaps PTB object input ${overlap.objectId}`);
  }
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

async function authorizeWithPolicy(options: {
  readonly client: ClientWithTransactionBuild;
  readonly tx: SuiTx<unknown, unknown, unknown>;
  readonly payment: SuiPaymentPlan;
  readonly artifact?: SuiPtbBuildArtifact<unknown>;
  readonly gasPlan?: SuiGasPlan;
}): Promise<SuiAuthResult> {
  const authPolicy = options.tx.authPolicy;
  if (!authPolicy) throw new Error(`SuiTx ${options.tx.label} has no auth policy`);

  const transaction = getTransaction(options.artifact);
  applyGasAndPayment(transaction, options.tx, options.payment, options.gasPlan);

  if (authPolicy instanceof OfflineAuthPolicy) {
    transaction.setSenderIfNotSet(authPolicy.sender);
    const transactionBytes = await transaction.build({ client: options.client as never });
    return {
      signatures: [],
      transactionBytes,
      offlinePayload: { sender: authPolicy.sender, transactionBytes },
    };
  }

  if (authPolicy instanceof KeypairAuthPolicy) {
    const signer = asSigner(authPolicy.signer);
    transaction.setSenderIfNotSet(authPolicy.sender ?? signerAddress(signer));
    const transactionBytes = await transaction.build({ client: options.client as never });
    const { signature } = await signer.signTransaction(transactionBytes);
    return { signatures: [signature], transactionBytes };
  }

  if (authPolicy instanceof SponsoredAuthPolicy) {
    const signer = asSigner(authPolicy.signer);
    transaction.setSenderIfNotSet(authPolicy.sender);
    transaction.setGasOwner(authPolicy.sponsor);
    const transactionBytes = await transaction.build({ client: options.client as never });
    const senderSignature = (await signer.signTransaction(transactionBytes)).signature;
    const sponsorSignature = authPolicy.sponsorSigner
      ? (await asSigner(authPolicy.sponsorSigner).signTransaction(transactionBytes)).signature
      : undefined;
    return {
      signatures: sponsorSignature ? [senderSignature, sponsorSignature] : [senderSignature],
      transactionBytes,
    };
  }

  throw new Error(`Unsupported auth policy ${(authPolicy as SuiAuthPolicy)._tag}`);
}

function getTransaction(artifact: SuiPtbBuildArtifact<unknown> | undefined): Transaction {
  if (artifact?.transaction instanceof Transaction) return artifact.transaction;
  throw new Error('SuiAuthService requires a SuiPtbBuildArtifact containing a Mysten Transaction');
}

function applyGasAndPayment(
  transaction: Transaction,
  tx: SuiTx<unknown, unknown, unknown>,
  payment: SuiPaymentPlan,
  gasPlan: SuiGasPlan | undefined,
): void {
  if (tx.sender) transaction.setSenderIfNotSet(tx.sender);
  if (gasPlan?.price !== undefined) transaction.setGasPrice(gasPlan.price);
  if (gasPlan?.budget !== undefined) transaction.setGasBudget(gasPlan.budget);
  if (payment.gasOwner) transaction.setGasOwner(payment.gasOwner);
  if (payment.gasPayment.length > 0) {
    transaction.setGasPayment(payment.gasPayment.map((ref) => ref.toMysten()));
  }
}

function asSigner(value: unknown): SignerLike {
  const signer = value as SignerLike;
  if (!signer || typeof signer.signTransaction !== 'function') {
    throw new Error('Auth policy signer does not expose signTransaction(bytes)');
  }
  return signer;
}

function signerAddress(signer: SignerLike): SuiAddress {
  const address = signer.toSuiAddress?.() ?? signer.getPublicKey?.().toSuiAddress();
  if (!address) throw new Error('Signer does not expose a Sui address');
  return address as SuiAddress;
}

function normalizeAuthError(cause: unknown): SuiExecutionError | SuiInvariantViolation {
  if (cause instanceof SuiExecutionError || cause instanceof SuiInvariantViolation) return cause;
  return new SuiExecutionError({
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  });
}
