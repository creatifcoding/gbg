import * as Context from 'effect-v4/Context';
import type * as Effect from 'effect-v4/Effect';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import type { SuiTransactionDigest } from '../schema';
import type { SuiAuthResult } from './tx-auth';
import type { SuiGasPlan, SuiPaymentPlan } from './tx-planning';
import type { SuiPreflightResult } from './tx-preflight';

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
