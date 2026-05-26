import * as Context from 'effect-v4/Context';
import type * as Effect from 'effect-v4/Effect';

import type { SuiTx } from '../effectable';
import type { SuiTransactionDigest } from '../schema';
import type { SuiExecutionResultEnvelope } from './tx-execution';

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
