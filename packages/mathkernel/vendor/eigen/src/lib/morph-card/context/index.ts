/**
 * MorphCard Context
 *
 * React context for compound component pattern.
 *
 * @module morph-card/context
 */

import { createContext, useContext, useCallback, useMemo } from 'react';
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react';
import type { CardId, CardMode, CardState, SizePreset } from '../schemas';
import type { TransitionGrammar, MorphCardConfig } from '../schemas';
import { cardStateFamily, cardConfigFamily, cardTransitionFamily, cardSizesFamily, cardShowControlsFamily, cardDimensionsFamily } from '../atoms';

// =============================================================================
// Context Types
// =============================================================================

/**
 * Actions available on a MorphCard
 */
export interface CardActions {
  /** Transition to a new mode */
  setMode: (mode: CardMode, grammar?: TransitionGrammar) => void;
  /** Toggle between two modes */
  toggleMode: (modeA: CardMode, modeB: CardMode) => void;
  /** Expand to next larger mode */
  expand: () => void;
  /** Collapse to next smaller mode */
  collapse: () => void;
  /** Set hover state */
  setHovered: (hovered: boolean) => void;
  /** Set focus state */
  setFocused: (focused: boolean) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Update card configuration */
  updateConfig: (config: Partial<MorphCardConfig>) => void;
  /** Update custom sizes */
  updateSizes: (sizes: Partial<Record<CardMode, SizePreset>>) => void;
}

/**
 * MorphCard context value
 */
export interface CardContextValue {
  /** Unique card identifier */
  readonly cardId: CardId;
  /** Current card state */
  readonly state: CardState;
  /** Card configuration */
  readonly config: MorphCardConfig;
  /** Active transition grammar */
  readonly transition: TransitionGrammar;
  /** Current dimensions */
  readonly dimensions: { width: number; height: number };
  /** Whether controls should be visible */
  readonly showControls: boolean;
  /** Register a layout root for measurement */
  readonly registerContentNode?: (node: HTMLElement | null) => void;
  /** Available actions */
  readonly actions: CardActions;
}

// =============================================================================
// Context
// =============================================================================

export const CardContext = createContext<CardContextValue | null>(null);

// =============================================================================
// Hooks
// =============================================================================

/**
 * Access MorphCard context - throws if not within provider
 */
export function useCard(): CardContextValue {
  const ctx = useContext(CardContext);
  if (!ctx) {
    throw new Error('useCard must be used within a MorphCard component');
  }
  return ctx;
}

/**
 * Access MorphCard context - returns null if not within provider
 */
export function useCardOptional(): CardContextValue | null {
  return useContext(CardContext);
}

// =============================================================================
// Mode Ordering
// =============================================================================

const MODE_ORDER: CardMode[] = ['idle', 'compact', 'default', 'expanded', 'detail'];

function getNextMode(current: CardMode, direction: 'expand' | 'collapse'): CardMode {
  const idx = MODE_ORDER.indexOf(current);
  if (direction === 'expand') {
    return idx < MODE_ORDER.length - 1 ? MODE_ORDER[idx + 1] : current;
  }
  return idx > 0 ? MODE_ORDER[idx - 1] : current;
}

// =============================================================================
// Actions Hook
// =============================================================================

/**
 * Create card actions for a specific card ID
 */
export function useCardActions(cardId: CardId): CardActions {
  const registry = useContext(RegistryContext);

  const stateAtom = cardStateFamily(cardId);
  const configAtom = cardConfigFamily(cardId);
  const transitionAtom = cardTransitionFamily(cardId);
  const sizesAtom = cardSizesFamily(cardId);

  const setMode = useCallback(
    (mode: CardMode, grammar?: TransitionGrammar) => {
      const current = registry.get(stateAtom);
      registry.set(stateAtom, {
        ...current,
        previousMode: current.mode,
        mode,
      });
      if (grammar) {
        registry.set(transitionAtom, grammar);
      }
    },
    [registry, stateAtom, transitionAtom]
  );

  const toggleMode = useCallback(
    (modeA: CardMode, modeB: CardMode) => {
      const current = registry.get(stateAtom);
      const newMode = current.mode === modeA ? modeB : modeA;
      setMode(newMode);
    },
    [registry, stateAtom, setMode]
  );

  const expand = useCallback(() => {
    const current = registry.get(stateAtom);
    setMode(getNextMode(current.mode, 'expand'), { verb: 'expand' });
  }, [registry, stateAtom, setMode]);

  const collapse = useCallback(() => {
    const current = registry.get(stateAtom);
    setMode(getNextMode(current.mode, 'collapse'), { verb: 'collapse' });
  }, [registry, stateAtom, setMode]);

  const setHovered = useCallback(
    (hovered: boolean) => {
      const current = registry.get(stateAtom);
      registry.set(stateAtom, { ...current, isHovered: hovered });
    },
    [registry, stateAtom]
  );

  const setFocused = useCallback(
    (focused: boolean) => {
      const current = registry.get(stateAtom);
      registry.set(stateAtom, { ...current, isFocused: focused });
    },
    [registry, stateAtom]
  );

  const setLoading = useCallback(
    (loading: boolean) => {
      const current = registry.get(stateAtom);
      registry.set(stateAtom, { ...current, isLoading: loading });
    },
    [registry, stateAtom]
  );

  const updateConfig = useCallback(
    (config: Partial<MorphCardConfig>) => {
      const current = registry.get(configAtom);
      registry.set(configAtom, { ...current, ...config });
    },
    [registry, configAtom]
  );

  const updateSizes = useCallback(
    (sizes: Partial<Record<CardMode, SizePreset>>) => {
      const current = registry.get(sizesAtom);
      registry.set(sizesAtom, { ...current, ...sizes });
    },
    [registry, sizesAtom]
  );

  return useMemo(
    () => ({
      setMode,
      toggleMode,
      expand,
      collapse,
      setHovered,
      setFocused,
      setLoading,
      updateConfig,
      updateSizes,
    }),
    [setMode, toggleMode, expand, collapse, setHovered, setFocused, setLoading, updateConfig, updateSizes]
  );
}

// =============================================================================
// Context Value Hook
// =============================================================================

/**
 * Build complete context value for a card
 */
export function useCardContextValue(cardId: CardId): CardContextValue {
  const state = useAtomValue(cardStateFamily(cardId));
  const config = useAtomValue(cardConfigFamily(cardId));
  const transition = useAtomValue(cardTransitionFamily(cardId));
  const showControls = useAtomValue(cardShowControlsFamily(cardId));
  const dimensions = useAtomValue(cardDimensionsFamily(cardId));
  const actions = useCardActions(cardId);

  return useMemo(
    () => ({
      cardId,
      state,
      config,
      transition,
      dimensions,
      showControls,
      actions,
    }),
    [cardId, state, config, transition, dimensions, showControls, actions]
  );
}
