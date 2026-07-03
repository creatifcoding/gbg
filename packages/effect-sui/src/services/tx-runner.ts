import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import type { SuiAuthResult } from './tx-auth';
import type { SuiGasPlan, SuiPaymentPlan } from './tx-planning';
import type { SuiExecutionResultEnvelope, SuiFinalityResult, SuiPreflightResult } from './tx-rpc';

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
  readonly run: (tx: SuiTx<unknown, unknown, unknown>) => Effect.Effect<SuiTxLifecycleResult, unknown, never>;
}
export class SuiTxRunner extends Context.Service<SuiTxRunner, SuiTxRunnerShape>()('@tmnl/effect-sui/SuiTxRunner') {}
