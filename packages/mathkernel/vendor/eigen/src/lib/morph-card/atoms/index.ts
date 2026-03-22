/**
 * MorphCard Atom Families
 *
 * Per-card state management using Effect-Atom.
 *
 * @module morph-card/atoms
 */

import { Atom } from '@effect-atom/atom';
import { Option } from 'effect';
import type { CardId, CardMode, CardState, SizePreset } from '../schemas';
import { DEFAULT_CARD_STATE, DEFAULT_SIZES } from '../schemas/card-state';
import type { TransitionGrammar, MorphCardConfig } from '../schemas';
import { DEFAULT_TRANSITION } from '../schemas/transition-grammar';
import { DEFAULT_CARD_CONFIG } from '../schemas/animation-config';
import { UITree } from '@/lib/genifer';
export { morphCardRegistry, MorphCardRegistryProvider } from './registry';

// =============================================================================
// State Atoms
// =============================================================================

/**
 * Per-card state atom family
 */
export const cardStateFamily = Atom.family(
  (_cardId: CardId) => Atom.make<CardState>(DEFAULT_CARD_STATE)
);

/**
 * Per-card configuration atom family
 */
export const cardConfigFamily = Atom.family(
  (_cardId: CardId) => Atom.make<MorphCardConfig>(DEFAULT_CARD_CONFIG)
);

/**
 * Per-card active transition grammar
 */
export const cardTransitionFamily = Atom.family(
  (_cardId: CardId) => Atom.make<TransitionGrammar>(DEFAULT_TRANSITION)
);

/**
 * Per-card custom sizes override
 */
export const cardSizesFamily = Atom.family(
  (_cardId: CardId) => Atom.make<Record<CardMode, SizePreset>>(DEFAULT_SIZES)
);

/**
 * Per-card UITree state for durable stream patches
 *
 * Stores the current UITree state that can be updated via patches
 * from the durable stream. Used by useDurableStreamPatches hook.
 */
export const uiTreeAtomFamily = Atom.family(
  (_cardId: CardId) => Atom.make<UITree>(UITree.empty())
);

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Derived atom for whether card controls should be visible
 */
export const cardShowControlsFamily = Atom.family((cardId: CardId) =>
  Atom.make((get) => {
    const state = get(cardStateFamily(cardId));
    return state.isHovered || state.isFocused;
  })
);

/**
 * Derived atom for current card dimensions
 */
export const cardDimensionsFamily = Atom.family((cardId: CardId) =>
  Atom.make((get) => {
    const state = get(cardStateFamily(cardId));
    const sizes = get(cardSizesFamily(cardId));
    const baseSize = sizes[state.mode] ?? DEFAULT_SIZES.default;

    return {
      width: Option.isSome(state.customWidth)
        ? state.customWidth.value
        : baseSize.width,
      height: Option.isSome(state.customHeight)
        ? state.customHeight.value
        : baseSize.height,
    };
  })
);

// =============================================================================
// Atom Accessor Factory
// =============================================================================

/**
 * Get all atoms for a specific card
 */
export interface CardAtoms {
  readonly state: ReturnType<typeof cardStateFamily>;
  readonly config: ReturnType<typeof cardConfigFamily>;
  readonly transition: ReturnType<typeof cardTransitionFamily>;
  readonly sizes: ReturnType<typeof cardSizesFamily>;
  readonly showControls: ReturnType<typeof cardShowControlsFamily>;
  readonly dimensions: ReturnType<typeof cardDimensionsFamily>;
  readonly uiTree: ReturnType<typeof uiTreeAtomFamily>;
}

/**
 * Factory to get all atoms for a card ID
 *
 * @example
 * const atoms = getCardAtoms('card-123' as CardId)
 * const state = registry.get(atoms.state)
 */
export function getCardAtoms(cardId: CardId): CardAtoms {
  return {
    state: cardStateFamily(cardId),
    config: cardConfigFamily(cardId),
    transition: cardTransitionFamily(cardId),
    sizes: cardSizesFamily(cardId),
    showControls: cardShowControlsFamily(cardId),
    dimensions: cardDimensionsFamily(cardId),
    uiTree: uiTreeAtomFamily(cardId),
  };
}

// =============================================================================
// Generative Atoms (Re-export)
// =============================================================================

export {
  generativeStateFamily,
  modeGenerationFamily,
  isModeLoadingFamily,
  hasModeContentFamily,
  currentModeStatusFamily,
  currentModeProgressFamily,
  currentModeErrorFamily,
  getGenerativeAtoms,
  type GenerativeCardAtoms,
} from './generative-atoms';

// =============================================================================
// Tab Atoms (Re-export)
// =============================================================================

export {
  tabsAtomFamily,
  cardTabStateFamily,
  setActiveTab,
  updateView,
  updateViewState,
  registerTab,
  unregisterTab,
  getActiveTab,
  getViewState,
  clearCardState,
  type AtomRegistry,
} from './tab-atoms';
