/** Transaction lifecycle service contracts. */

import * as Context from 'effect-v4/Context';
import type * as Effect from 'effect-v4/Effect';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import type { SuiAddress, SuiObjectRef, SuiTransactionDigest } from '../schema';

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

export interface SuiPreflightRequest {
  readonly tx: SuiTx<unknown, unknown, unknown>;
  readonly artifact: SuiPtbBuildArtifact<unknown>;
  readonly auth: SuiAuthResult;
  readonly gasPlan: SuiGasPlan;
  readonly payment: SuiPaymentPlan;
}

export interface SuiPreflightResult {
  readonly status: 'success' | 'failure';
  readonly gasUsed?: unknown;
  readonly diagnostics: ReadonlyArray<string>;
  readonly raw?: unknown;
}

export interface SuiPreflightServiceShape {
  readonly dryRun: (
    request: SuiPreflightRequest,
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

export interface SuiExecutionRequest {
  readonly tx: SuiTx<unknown, unknown, unknown>;
  readonly artifact: SuiPtbBuildArtifact<unknown>;
  readonly auth: SuiAuthResult;
  readonly gasPlan: SuiGasPlan;
  readonly payment: SuiPaymentPlan;
  readonly preflight?: SuiPreflightResult;
}

export interface SuiExecutionServiceShape {
  readonly execute: (
    request: SuiExecutionRequest,
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

export interface SuiFinalityRequest {
  readonly tx: SuiTx<unknown, unknown, unknown>;
  readonly execution: SuiExecutionResultEnvelope;
}

export interface SuiFinalityServiceShape {
  readonly wait: (
    request: SuiFinalityRequest,
  ) => Effect.Effect<SuiFinalityResult, unknown, never>;
}

export class SuiFinalityService extends Context.Service<
  SuiFinalityService,
  SuiFinalityServiceShape
>()('@tmnl/effect-sui/SuiFinalityService') {}

export interface SuiTxLifecycleResult {
  readonly tx: SuiTx<unknown, unknown, unknown>;
  readonly artifact: SuiPtbBuildArtifact<unknown>;
  readonly gasPlan: SuiGasPlan;
  readonly payment: SuiPaymentPlan;
  readonly auth: SuiAuthResult;
  readonly preflight?: SuiPreflightResult;
  readonly execution?: SuiExecutionResultEnvelope;
  readonly finality?: SuiFinalityResult;
}

export interface SuiTxRunnerShape {
  readonly run: (
    tx: SuiTx<unknown, unknown, unknown>,
  ) => Effect.Effect<SuiTxLifecycleResult, unknown, never>;
}

export class SuiTxRunner extends Context.Service<SuiTxRunner, SuiTxRunnerShape>()(
  '@tmnl/effect-sui/SuiTxRunner',
) {}
