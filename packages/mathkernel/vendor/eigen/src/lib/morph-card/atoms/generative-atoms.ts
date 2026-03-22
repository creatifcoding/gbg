/**
 * Generative Atoms
 *
 * Per-card generative state management using Atom.family.
 * Enables independent loading/error/retry per card with lazy mode caching.
 *
 * @module morph-card/atoms/generative-atoms
 */

import { Atom } from '@effect-atom/atom';
import { Option } from 'effect';
import type { CardId, CardMode, CardState } from '../schemas/card-state';
import { DEFAULT_CARD_STATE } from '../schemas/card-state';
import type { GenerativeCardState } from '../schemas/generative-state';
import {
  DEFAULT_MODE_GENERATION,
  DEFAULT_GENERATIVE_STATE,
} from '../schemas/generative-state';

// =============================================================================
// Internal Card State Atom (avoids circular import with ./index)
// =============================================================================

/**
 * Local reference to cardStateFamily to avoid circular dependency.
 * This is the same definition as in ./index.ts
 */
const cardStateFamily = Atom.family(
  (_cardId: CardId) => Atom.make<CardState>(DEFAULT_CARD_STATE)
);

// =============================================================================
// Generative State Family
// =============================================================================

/**
 * Per-card generative state (Atom.family for isolation)
 *
 * Each card gets its own generative state, enabling:
 * - Independent loading/error/retry per card
 * - Lazy mode generation with caching
 * - Isolated streaming state
 */
export const generativeStateFamily = Atom.family(
  (_cardId: CardId) => Atom.make<GenerativeCardState>({ ...DEFAULT_GENERATIVE_STATE })
);

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Derived: Get generation state for specific mode
 */
export const modeGenerationFamily = Atom.family((params: { cardId: CardId; mode: CardMode }) =>
  Atom.make((get) => {
    const state = get(generativeStateFamily(params.cardId));
    return state.modes[params.mode] ?? DEFAULT_MODE_GENERATION;
  })
);

/**
 * Derived: Is current mode loading?
 */
export const isModeLoadingFamily = Atom.family((cardId: CardId) =>
  Atom.make((get) => {
    const cardState = get(cardStateFamily(cardId));
    const genState = get(generativeStateFamily(cardId));
    const modeState = genState.modes[cardState.mode];
    return modeState?.status === 'loading' || modeState?.status === 'streaming';
  })
);

/**
 * Derived: Has current mode content (cache hit)?
 */
export const hasModeContentFamily = Atom.family((cardId: CardId) =>
  Atom.make((get) => {
    const cardState = get(cardStateFamily(cardId));
    const genState = get(generativeStateFamily(cardId));
    const modeState = genState.modes[cardState.mode];
    return Option.isSome(modeState?.content ?? Option.none());
  })
);

/**
 * Derived: Current mode generation status
 */
export const currentModeStatusFamily = Atom.family((cardId: CardId) =>
  Atom.make((get) => {
    const cardState = get(cardStateFamily(cardId));
    const genState = get(generativeStateFamily(cardId));
    const modeState = genState.modes[cardState.mode];
    return modeState?.status ?? 'idle';
  })
);

/**
 * Derived: Current mode progress (0-1)
 */
export const currentModeProgressFamily = Atom.family((cardId: CardId) =>
  Atom.make((get) => {
    const cardState = get(cardStateFamily(cardId));
    const genState = get(generativeStateFamily(cardId));
    const modeState = genState.modes[cardState.mode];
    return modeState?.progress ?? 0;
  })
);

/**
 * Derived: Current mode error (if any)
 */
export const currentModeErrorFamily = Atom.family((cardId: CardId) =>
  Atom.make((get) => {
    const cardState = get(cardStateFamily(cardId));
    const genState = get(generativeStateFamily(cardId));
    const modeState = genState.modes[cardState.mode];
    const error = modeState?.error ?? Option.none();
    return Option.isSome(error) ? error.value : undefined;
  })
);

// =============================================================================
// Atom Accessor Factory
// =============================================================================

/**
 * Bundle of generative atoms for a card
 */
export interface GenerativeCardAtoms {
  /** Main generative state atom */
  readonly state: ReturnType<typeof generativeStateFamily>;
  /** Is current mode loading/streaming? */
  readonly isLoading: ReturnType<typeof isModeLoadingFamily>;
  /** Has current mode cached content? */
  readonly hasContent: ReturnType<typeof hasModeContentFamily>;
  /** Current mode status */
  readonly status: ReturnType<typeof currentModeStatusFamily>;
  /** Current mode progress (0-1) */
  readonly progress: ReturnType<typeof currentModeProgressFamily>;
  /** Current mode error (if any) */
  readonly error: ReturnType<typeof currentModeErrorFamily>;
}

/**
 * Factory to get all generative atoms for a card ID
 *
 * @example
 * ```ts
 * const atoms = getGenerativeAtoms('card-123' as CardId)
 * const state = registry.get(atoms.state)
 * const isLoading = registry.get(atoms.isLoading)
 * ```
 */
export function getGenerativeAtoms(cardId: CardId): GenerativeCardAtoms {
  return {
    state: generativeStateFamily(cardId),
    isLoading: isModeLoadingFamily(cardId),
    hasContent: hasModeContentFamily(cardId),
    status: currentModeStatusFamily(cardId),
    progress: currentModeProgressFamily(cardId),
    error: currentModeErrorFamily(cardId),
  };
}
