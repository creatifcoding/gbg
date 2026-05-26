import * as Context from 'effect-v4/Context';
import type * as Effect from 'effect-v4/Effect';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import type { SuiTransactionDigest } from '../schema';
import type { SuiAuthResult } from './tx-auth';
import type { SuiGasPlan, SuiPaymentPlan } from './tx-planning';

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
  readonly dryRun: (request: SuiPreflightRequest) => Effect.Effect<SuiPreflightResult, unknown, never>;
}
export class SuiPreflightService extends Context.Service<SuiPreflightService, SuiPreflightServiceShape>()('@tmnl/effect-sui/SuiPreflightService') {}

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
  readonly execute: (request: SuiExecutionRequest) => Effect.Effect<SuiExecutionResultEnvelope, unknown, never>;
}
export class SuiExecutionService extends Context.Service<SuiExecutionService, SuiExecutionServiceShape>()('@tmnl/effect-sui/SuiExecutionService') {}

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
  readonly wait: (request: SuiFinalityRequest) => Effect.Effect<SuiFinalityResult, unknown, never>;
}
export class SuiFinalityService extends Context.Service<SuiFinalityService, SuiFinalityServiceShape>()('@tmnl/effect-sui/SuiFinalityService') {}
