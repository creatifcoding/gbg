import * as Context from 'effect-v4/Context';
import type * as Effect from 'effect-v4/Effect';

import type { SuiTx } from '../effectable';
import type { SuiTransactionDigest } from '../schema';
import type { SuiExecutionResultEnvelope } from './tx-execution';

export interface SuiFinalityIncludeOptions {
  readonly effects?: boolean;
  readonly transaction?: boolean;
  readonly events?: boolean;
  readonly balanceChanges?: boolean;
  readonly objectTypes?: boolean;
}

export interface SuiFinalityWaitOptions {
  readonly include?: SuiFinalityIncludeOptions;
  readonly timeoutMs?: number;
  readonly pollSchedule?: ReadonlyArray<number>;
}

export interface SuiFinalityResult {
  readonly digest: SuiTransactionDigest;
  readonly transaction: unknown;
  readonly effects?: unknown;
  readonly events?: ReadonlyArray<unknown>;
  readonly objectTypes?: Record<string, string>;
}

export interface SuiFinalityRequest extends SuiFinalityWaitOptions {
  readonly tx: SuiTx<unknown, unknown, unknown>;
  readonly execution: SuiExecutionResultEnvelope;
}

export interface SuiFinalityWatchRequest extends SuiFinalityWaitOptions {
  readonly digest: SuiTransactionDigest;
}

export interface SuiFinalityServiceShape {
  readonly wait: (request: SuiFinalityRequest) => Effect.Effect<SuiFinalityResult, unknown, never>;
  readonly waitForDigest: (request: SuiFinalityWatchRequest) => Effect.Effect<SuiFinalityResult, unknown, never>;
}

export class SuiFinalityService extends Context.Service<SuiFinalityService, SuiFinalityServiceShape>()('@tmnl/effect-sui/SuiFinalityService') {}
