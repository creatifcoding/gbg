/**
 * MorphCard Hooks
 *
 * React hooks for managing MorphCard state and behavior.
 *
 * @module morph-card/hooks
 */

export {
  useGenerativeMode,
  type UseGenerativeModeResult,
} from './useGenerativeMode';

export {
  useDurableStreamPatches,
  type UseDurableStreamPatchesResult,
  type StreamStatus,
} from './useDurableStreamPatches';

// DynamicIslandCard Hooks
export {
  useCardServer,
  type UseCardServerResult,
} from './useCardServer';

export {
  useDynamicIslandCard,
  type UseDynamicIslandCardResult,
} from './useDynamicIslandCard';
