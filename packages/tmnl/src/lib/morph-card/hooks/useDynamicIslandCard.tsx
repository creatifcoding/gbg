/**
 * useDynamicIslandCard Hook
 *
 * Unified hook for DynamicIslandCard state management.
 * Provides tab state, view state persistence, and server integration.
 *
 * @module morph-card/hooks/useDynamicIslandCard
 */

import { useContext, useMemo, useCallback } from 'react';
import { RegistryContext } from '@effect-atom/atom-react';
import {
  tabsAtomFamily,
  cardTabStateFamily,
  setActiveTab,
  updateViewState,
  getViewState,
} from '../atoms/tab-atoms';
import { useCardServer, type UseCardServerResult } from './useCardServer';
import type { TabView, DynamicIslandCardState, ViewState } from '../schemas/tab-schemas';

/**
 * Hook result type
 */
export interface UseDynamicIslandCardResult {
  // State
  /** Registered tabs */
  tabs: readonly TabView[];
  /** Currently active tab ID */
  activeTab: string;
  /** Full card state */
  cardState: DynamicIslandCardState;

  // Actions
  /** Switch to a different tab */
  switchTab: (tabId: string) => void;
  /** Save view state for a view */
  saveViewState: (viewId: string, state: Partial<ViewState>) => void;
  /** Get view state for a view */
  getViewState: (viewId: string) => ViewState | undefined;

  // Server integration
  /** Query server endpoint */
  query: UseCardServerResult['query'];
  /** Subscribe to server topic */
  subscribe: UseCardServerResult['subscribe'];
}

/**
 * Hook for DynamicIslandCard state management
 *
 * Provides:
 * - Tab state access
 * - View state persistence
 * - Server integration
 *
 * @example
 * ```tsx
 * function MyView({ cardId }: { cardId: string }) {
 *   const {
 *     tabs,
 *     activeTab,
 *     switchTab,
 *     saveViewState,
 *     query,
 *   } = useDynamicIslandCard(cardId);
 *
 *   // Save scroll position on unmount
 *   useEffect(() => {
 *     return () => saveViewState('my-view', { scrollTop: scrollRef.current });
 *   }, [saveViewState]);
 *
 *   // Query data
 *   useEffect(() => {
 *     query('/api/data').then(setData);
 *   }, [query]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useDynamicIslandCard(cardId: string): UseDynamicIslandCardResult {
  const registry = useContext(RegistryContext);

  // Atom subscriptions
  const tabsAtom = useMemo(() => tabsAtomFamily(cardId), [cardId]);
  const stateAtom = useMemo(() => cardTabStateFamily(cardId), [cardId]);

  // Server integration
  const { query, subscribe } = useCardServer(cardId);

  // Current state
  const tabs = registry.get(tabsAtom);
  const cardState = registry.get(stateAtom);
  const activeTab = cardState.activeTab;

  // Actions
  const switchTab = useCallback(
    (tabId: string) => {
      setActiveTab(cardId, tabId, registry);
    },
    [cardId, registry]
  );

  const saveViewState = useCallback(
    (viewId: string, state: Partial<ViewState>) => {
      updateViewState(cardId, viewId, state, registry);
    },
    [cardId, registry]
  );

  const getViewStateForView = useCallback(
    (viewId: string): ViewState | undefined => {
      return getViewState(cardId, viewId, registry);
    },
    [cardId, registry]
  );

  return {
    // State
    tabs,
    activeTab,
    cardState,

    // Actions
    switchTab,
    saveViewState,
    getViewState: getViewStateForView,

    // Server
    query,
    subscribe,
  };
}
