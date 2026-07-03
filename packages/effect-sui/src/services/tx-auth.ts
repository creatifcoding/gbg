import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import type { SuiGasPlan, SuiPaymentPlan } from './tx-planning';

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
export class SuiAuthService extends Context.Service<SuiAuthService, SuiAuthServiceShape>()('@tmnl/effect-sui/SuiAuthService') {}
