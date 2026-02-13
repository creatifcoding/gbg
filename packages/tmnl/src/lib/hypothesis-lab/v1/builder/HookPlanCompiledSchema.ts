import { Effect, Schema } from 'effect';
import {
  HookPlanCompiled,
  type HookPlanCompiled as HookPlanCompiledType,
} from '../schemas';

export const HookPlanCompiledSchema = HookPlanCompiled;
export type HookPlanCompiledSchema = HookPlanCompiledType;

export const decodeHookPlanCompiled = Schema.decodeUnknown(HookPlanCompiledSchema);
export const decodeHookPlanCompiledSync = Schema.decodeUnknownSync(HookPlanCompiledSchema);

export const ensureHookPlanCompiled = (input: unknown) =>
  decodeHookPlanCompiled(input).pipe(Effect.withSpan('HypothesisLab.HookPlan.ensureCompiled'));
