/**
 * Context.Service boundaries for Effect-Sui runtime capabilities.
 *
 * The Effectable ontology facades stay thin. These services own the machinery:
 * object resolution, BCS bridging, PTB analysis/compile, gas/payment/auth,
 * execution/finality, reservations, package registry, and diagnostics.
 */

import * as Context from 'effect-v4/Context';
import type * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import type {
  SharedObjectRef,
  SuiAddress,
  SuiObjectId,
  SuiObjectRef,
  SuiTransactionDigest,
  SuiTypeTagString,
} from '../schema';
import type {
  SuiObject,
  SuiObjectSnapshot,
  SuiPackageDescriptor,
  SuiPTB,
  SuiPtbBuildArtifact,
  SuiPtbCommand,
  SuiPtbInput,
  SuiTx,
} from '../effectable';

export interface SuiClientServiceShape {
  readonly client: unknown;
}

export class SuiClientService extends Context.Service<
  SuiClientService,
  SuiClientServiceShape
>()('@tmnl/effect-sui/SuiClientService') {
  static readonly layer = (client: unknown) => Layer.succeed(SuiClientService)({ client });
}

export interface SuiObjectResolveRequest<A = unknown> {
  readonly id: SuiObjectId;
  readonly object?: SuiObject<A, unknown, unknown>;
  readonly expectedType?: SuiTypeTagString;
  readonly requireFresh?: boolean;
  readonly decodeContent?: boolean;
}

export interface SuiObjectResolveResult<A = unknown> {
  readonly id: SuiObjectId;
  readonly ref?: SuiObjectRef;
  readonly sharedRef?: SharedObjectRef;
  readonly receivingRef?: SuiObjectRef;
  readonly snapshot?: SuiObjectSnapshot<A>;
}

export interface SuiObjectResolverShape {
  readonly resolve: <A>(
    request: SuiObjectResolveRequest<A>,
  ) => Effect.Effect<SuiObjectResolveResult<A>, unknown, never>;
  readonly refresh: <A>(
    object: SuiObject<A, unknown, unknown>,
  ) => Effect.Effect<SuiObjectSnapshot<A>, unknown, never>;
}

export class SuiObjectResolver extends Context.Service<
  SuiObjectResolver,
  SuiObjectResolverShape
>()('@tmnl/effect-sui/SuiObjectResolver') {}

export interface SuiBcsDecodeRequest<A = unknown> {
  readonly bytes: Uint8Array;
  readonly codec: unknown;
  readonly schema: unknown;
  readonly label?: string;
}

export interface SuiPureEncodeRequest<A = unknown> {
  readonly value: A;
  readonly typeTag: SuiTypeTagString;
  readonly codec?: unknown;
  readonly schema?: unknown;
}

export interface SuiBcsBridgeShape {
  readonly decode: <A>(request: SuiBcsDecodeRequest<A>) => Effect.Effect<A, unknown, never>;
  readonly encodePure: <A>(request: SuiPureEncodeRequest<A>) => Effect.Effect<Uint8Array, unknown, never>;
  readonly serialize: <A>(value: A, codec: unknown) => Effect.Effect<Uint8Array, unknown, never>;
}

export class SuiBcsBridge extends Context.Service<SuiBcsBridge, SuiBcsBridgeShape>()(
  '@tmnl/effect-sui/SuiBcsBridge',
) {}

export interface SuiPtbAnalysis {
  readonly inputs: ReadonlyArray<SuiPtbInput>;
  readonly commands: ReadonlyArray<SuiPtbCommand>;
  readonly objectIds: ReadonlyArray<SuiObjectId>;
  readonly diagnostics: ReadonlyArray<string>;
}

export interface SuiPtbAnalyzerShape {
  readonly analyze: (ptb: SuiPTB<unknown, unknown, unknown>) => Effect.Effect<SuiPtbAnalysis, unknown, never>;
}

export class SuiPtbAnalyzer extends Context.Service<SuiPtbAnalyzer, SuiPtbAnalyzerShape>()(
  '@tmnl/effect-sui/SuiPtbAnalyzer',
) {}

export interface SuiPtbCompileRequest {
  readonly ptb: SuiPTB<unknown, unknown, unknown>;
  readonly analysis?: SuiPtbAnalysis;
  readonly buildMode?: unknown;
}

export interface SuiPtbCompilerShape {
  readonly compile: (
    request: SuiPtbCompileRequest,
  ) => Effect.Effect<SuiPtbBuildArtifact<unknown>, unknown, never>;
}

export class SuiPtbCompiler extends Context.Service<SuiPtbCompiler, SuiPtbCompilerShape>()(
  '@tmnl/effect-sui/SuiPtbCompiler',
) {}

export interface SuiGasPlan {
  readonly price?: bigint;
  readonly budget?: bigint;
  readonly requiresDryRun: boolean;
  readonly rationale: string;
}

export interface SuiGasPlannerShape {
  readonly plan: (tx: SuiTx<unknown, unknown, unknown>) => Effect.Effect<SuiGasPlan, unknown, never>;
}

export class SuiGasPlanner extends Context.Service<SuiGasPlanner, SuiGasPlannerShape>()(
  '@tmnl/effect-sui/SuiGasPlanner',
) {}

export interface SuiPaymentPlan {
  readonly gasOwner?: SuiAddress;
  readonly gasPayment: ReadonlyArray<SuiObjectRef>;
  readonly sponsored: boolean;
  readonly addressBalance: boolean;
}

export interface SuiPaymentServiceShape {
  readonly plan: (
    tx: SuiTx<unknown, unknown, unknown>,
    gasPlan: SuiGasPlan,
  ) => Effect.Effect<SuiPaymentPlan, unknown, never>;
}

export class SuiPaymentService extends Context.Service<
  SuiPaymentService,
  SuiPaymentServiceShape
>()('@tmnl/effect-sui/SuiPaymentService') {}

export interface SuiAuthResult {
  readonly signatures: ReadonlyArray<string>;
  readonly transactionBytes?: Uint8Array;
  readonly walletPayload?: unknown;
  readonly offlinePayload?: unknown;
}

export interface SuiAuthServiceShape {
  readonly authorize: (
    tx: SuiTx<unknown, unknown, unknown>,
    payment: SuiPaymentPlan,
    artifact?: SuiPtbBuildArtifact<unknown>,
    gasPlan?: SuiGasPlan,
  ) => Effect.Effect<SuiAuthResult, unknown, never>;
}

export class SuiAuthService extends Context.Service<SuiAuthService, SuiAuthServiceShape>()(
  '@tmnl/effect-sui/SuiAuthService',
) {}

export interface SuiPreflightResult {
  readonly status: 'success' | 'failure';
  readonly gasUsed?: unknown;
  readonly diagnostics: ReadonlyArray<string>;
}

export interface SuiPreflightServiceShape {
  readonly dryRun: (
    artifact: SuiPtbBuildArtifact<unknown>,
  ) => Effect.Effect<SuiPreflightResult, unknown, never>;
}

export class SuiPreflightService extends Context.Service<
  SuiPreflightService,
  SuiPreflightServiceShape
>()('@tmnl/effect-sui/SuiPreflightService') {}

export interface SuiExecutionResultEnvelope {
  readonly digest: SuiTransactionDigest;
  readonly raw: unknown;
}

export interface SuiExecutionServiceShape {
  readonly execute: (
    artifact: SuiPtbBuildArtifact<unknown>,
    auth: SuiAuthResult,
  ) => Effect.Effect<SuiExecutionResultEnvelope, unknown, never>;
}

export class SuiExecutionService extends Context.Service<
  SuiExecutionService,
  SuiExecutionServiceShape
>()('@tmnl/effect-sui/SuiExecutionService') {}

export interface SuiFinalityResult {
  readonly digest: SuiTransactionDigest;
  readonly transaction: unknown;
  readonly effects?: unknown;
  readonly events?: ReadonlyArray<unknown>;
}

export interface SuiFinalityServiceShape {
  readonly wait: (
    result: SuiExecutionResultEnvelope,
  ) => Effect.Effect<SuiFinalityResult, unknown, never>;
}

export class SuiFinalityService extends Context.Service<
  SuiFinalityService,
  SuiFinalityServiceShape
>()('@tmnl/effect-sui/SuiFinalityService') {}

export interface SuiReservationRequest {
  readonly objectRefs: ReadonlyArray<SuiObjectRef>;
  readonly gasRefs: ReadonlyArray<SuiObjectRef>;
  readonly sender?: SuiAddress;
  readonly sponsor?: SuiAddress;
  readonly intent: string;
}

export interface SuiReservationToken {
  readonly id: string;
  readonly intent: string;
}

export interface SuiReservationServiceShape {
  readonly acquire: (request: SuiReservationRequest) => Effect.Effect<SuiReservationToken, unknown, never>;
  readonly release: (token: SuiReservationToken) => Effect.Effect<void, never, never>;
  readonly reconcile: (token: SuiReservationToken, result: unknown) => Effect.Effect<void, unknown, never>;
}

export class SuiReservationService extends Context.Service<
  SuiReservationService,
  SuiReservationServiceShape
>()('@tmnl/effect-sui/SuiReservationService') {}

export interface SuiPackageRegistryShape {
  readonly register: (descriptor: SuiPackageDescriptor) => Effect.Effect<void, unknown, never>;
  readonly get: (packageId: SuiObjectId) => Effect.Effect<SuiPackageDescriptor, unknown, never>;
}

export class SuiPackageRegistry extends Context.Service<
  SuiPackageRegistry,
  SuiPackageRegistryShape
>()('@tmnl/effect-sui/SuiPackageRegistry') {}

export interface SuiDiagnosticsShape {
  readonly record: (event: unknown) => Effect.Effect<void, never, never>;
  readonly classify: (cause: unknown) => Effect.Effect<string, never, never>;
}

export class SuiDiagnostics extends Context.Service<SuiDiagnostics, SuiDiagnosticsShape>()(
  '@tmnl/effect-sui/SuiDiagnostics',
) {}
