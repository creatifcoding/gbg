/**
 * FoldablePanel Context
 *
 * Provides atoms and state to FoldablePanel children.
 * Framework-agnostic: works with or without TipTap.
 *
 * @module foldable-panel/context
 */

import { createContext, useContext, type ReactNode, type JSX } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import type { FoldablePanelContextValue, PanelBadge, SettingsTab } from './types';
import { useFoldablePanelActions, type FoldablePanelAtoms } from './atoms';

// =============================================================================
// Context
// =============================================================================

export const FoldablePanelContext = createContext<FoldablePanelContextValue | null>(null);

export function useFoldablePanel(): FoldablePanelContextValue {
  const ctx = useContext(FoldablePanelContext);
  if (!ctx) {
    throw new Error('useFoldablePanel must be used within FoldablePanelProvider');
  }
  return ctx;
}

export function useFoldablePanelOptional(): FoldablePanelContextValue | null {
  return useContext(FoldablePanelContext);
}

// =============================================================================
// Provider Props
// =============================================================================

export interface FoldablePanelProviderProps {
  /** Atoms for this panel instance */
  readonly atoms: FoldablePanelAtoms;
  /** Panel badge configuration */
  readonly badge: PanelBadge;
  /** Settings tabs */
  readonly tabs?: readonly SettingsTab[];
  /** Whether panel content is editable */
  readonly isEditable?: boolean;
  /** Children to render */
  readonly children: ReactNode;
}

// =============================================================================
// Provider Component
// =============================================================================

/**
 * FoldablePanelProvider
 *
 * Wraps children with FoldablePanel context, providing atoms and actions.
 *
 * @example
 * ```tsx
 * const atoms = getFoldablePanelAtoms('my-panel');
 *
 * <FoldablePanelProvider
 *   atoms={atoms}
 *   badge={{ tag: 'chart', label: 'Chart' }}
 *   tabs={[{ id: 'style', label: 'Style', content: <StyleSettings /> }]}
 * >
 *   <MyChartComponent />
 * </FoldablePanelProvider>
 * ```
 */
export function FoldablePanelProvider({
  atoms,
  badge,
  tabs = [],
  isEditable = true,
  children,
}: FoldablePanelProviderProps): JSX.Element {
  const state = useAtomValue(atoms.stateAtom);
  const actions = useFoldablePanelActions(atoms);

  const contextValue: FoldablePanelContextValue = {
    state,
    badge,
    tabs,
    isEditable,
    actions,
  };

  return (
    <FoldablePanelContext.Provider value={contextValue}>
      {children}
    </FoldablePanelContext.Provider>
  );
}
