import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

import type { SuiTx } from '../effectable';
import type { SuiAddress, SuiObjectRef } from '../schema';

export interface SuiGasPlan {
  readonly price?: bigint;
  readonly budget?: bigint;
  readonly requiresDryRun: boolean;
  readonly rationale: string;
}

export interface SuiGasPlannerShape {
  readonly plan: (tx: SuiTx<unknown, unknown, unknown>) => Effect.Effect<SuiGasPlan, unknown, never>;
}
export class SuiGasPlanner extends Context.Service<SuiGasPlanner, SuiGasPlannerShape>()('@tmnl/effect-sui/SuiGasPlanner') {}

export interface SuiPaymentPlan {
  readonly gasOwner?: SuiAddress;
  readonly gasPayment: ReadonlyArray<SuiObjectRef>;
  readonly sponsored: boolean;
  readonly addressBalance: boolean;
}

export interface SuiPaymentServiceShape {
  readonly plan: (tx: SuiTx<unknown, unknown, unknown>, gasPlan: SuiGasPlan) => Effect.Effect<SuiPaymentPlan, unknown, never>;
}
export class SuiPaymentService extends Context.Service<SuiPaymentService, SuiPaymentServiceShape>()('@tmnl/effect-sui/SuiPaymentService') {}
