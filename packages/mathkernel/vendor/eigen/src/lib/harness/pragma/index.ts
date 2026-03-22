/**
 * PRAGMA — Prompt Refinement via Automata-Guided Meaning Analysis
 *
 * Public API for the PRAGMA NLP annotation pipeline.
 *
 * Usage in harness prompt factory:
 *   import { pragmaBridge } from '@/lib/harness/pragma';
 *   const annotation = await pragmaBridge.annotate(userPrompt);
 *   if (annotation._tag === 'Ok') {
 *     systemPrompt = annotation.value.prefix_block + '\n' + systemPrompt;
 *   }
 */

export { PragmaBridge } from './bridge';
export type {
  PragmaBridgeConfig,
  AnnotateResponse,
  ScoreResponse,
  WarmupResponse,
  IntentType,
  ModelTier,
  DomainResult,
} from './bridge';

// Singleton bridge instance (lazy spawn)
import { PragmaBridge } from './bridge';
export const pragmaBridge = new PragmaBridge();
