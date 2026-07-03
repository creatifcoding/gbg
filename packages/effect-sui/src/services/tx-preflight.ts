import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
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
