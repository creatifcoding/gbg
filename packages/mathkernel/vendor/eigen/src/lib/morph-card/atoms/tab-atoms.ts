/**
 * Tab Atoms for DynamicIslandCard
 *
 * Atom families for tab management with LRU eviction and localStorage persistence.
 *
 * @module morph-card/atoms/tab-atoms
 */

import { Atom } from '@effect-atom/atom';
import type { CardId } from '../schemas/card-state';
import type {
  TabView,
  DynamicIslandCardState,
  ViewState,
} from '../schemas/tab-schemas';
import { DEFAULT_DYNAMIC_ISLAND_STATE } from '../schemas/tab-schemas';
import type { ViewRegistry, ViewSpec } from '../types/view-registry';

// =============================================================================
// Constants
// =============================================================================

const STORAGE_PREFIX = 'dynamic-island-card:';
const LRU_MAX = 100;

// =============================================================================
// LRU Cache Management
// =============================================================================

const accessOrder: string[] = [];

/**
 * Touch a card ID to mark it as recently used.
 * Evicts oldest entries if over LRU limit.
 */
function touchLRU(cardId: string): void {
  const idx = accessOrder.indexOf(cardId);
  if (idx > -1) accessOrder.splice(idx, 1);
  accessOrder.push(cardId);

  // Evict oldest if over limit
  while (accessOrder.length > LRU_MAX) {
    const evicted = accessOrder.shift()!;
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${evicted}`);
    } catch {
      // localStorage may not be available
    }
    // Clear from caches
    tabsCache.delete(evicted);
    stateCache.delete(evicted);
  }
}

// =============================================================================
// Persistence Helpers
// =============================================================================

/**
 * Load card state from localStorage
 */
function loadCardState(cardId: string): DynamicIslandCardState {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${cardId}`);
    if (!raw) return { ...DEFAULT_DYNAMIC_ISLAND_STATE };
    return JSON.parse(raw) as DynamicIslandCardState;
  } catch {
    return { ...DEFAULT_DYNAMIC_ISLAND_STATE };
  }
}

/**
 * Save card state to localStorage
 */
function saveCardState(cardId: string, state: DynamicIslandCardState): void {
  touchLRU(cardId);
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${cardId}`, JSON.stringify(state));
  } catch {
    // localStorage may be full or unavailable
  }
}

// =============================================================================
// Atom Caches (Module-Level Singletons)
// =============================================================================

const tabsCache = new Map<string, ReturnType<typeof Atom.make<TabView[]>>>();
const stateCache = new Map<
  string,
  ReturnType<typeof Atom.make<DynamicIslandCardState>>
>();
const viewsCache = new Map<
  string,
  ReturnType<typeof Atom.make<ViewRegistry>>
>();

// =============================================================================
// Atom Families
// =============================================================================

/**
 * Atom family for registered tabs per card.
 * Tabs are registered by DynamicIslandCard.View components.
 */
export function tabsAtomFamily(
  cardId: CardId | string
): ReturnType<typeof Atom.make<TabView[]>> {
  const key = String(cardId);
  if (!tabsCache.has(key)) {
    tabsCache.set(key, Atom.make<TabView[]>([]));
  }
  return tabsCache.get(key)!;
}

/**
 * Atom family for card state (with persistence).
 * Automatically loads from localStorage and persists on changes.
 */
export function cardTabStateFamily(
  cardId: CardId | string
): ReturnType<typeof Atom.make<DynamicIslandCardState>> {
  const key = String(cardId);
  if (!stateCache.has(key)) {
    const initial = loadCardState(key);
    stateCache.set(key, Atom.make(initial));
  }
  touchLRU(key);
  return stateCache.get(key)!;
}

/**
 * Atom family for dynamic view registry per card.
 */
export function viewRegistryAtomFamily(
  cardId: CardId | string
): ReturnType<typeof Atom.make<ViewRegistry>> {
  const key = String(cardId);
  if (!viewsCache.has(key)) {
    viewsCache.set(key, Atom.make<ViewRegistry>({}));
  }
  return viewsCache.get(key)!;
}

// =============================================================================
// State Mutations
// =============================================================================

/**
 * Registry interface for synchronous atom operations.
 * Compatible with @effect-atom/atom-react RegistryContext.
 */
export interface AtomRegistry {
  get: <T>(atom: ReturnType<typeof Atom.make<T>>) => T;
  set: <T>(atom: ReturnType<typeof Atom.make<T>>, value: T) => void;
}

/**
 * Set the active tab for a card
 */
export function setActiveTab(
  cardId: CardId | string,
  tabId: string,
  registry: AtomRegistry
): void {
  const key = String(cardId);
  const stateAtom = cardTabStateFamily(cardId);
  const current = registry.get(stateAtom);
  const updated: DynamicIslandCardState = {
    ...current,
    activeTab: tabId,
    lastUpdated: Date.now(),
  };
  registry.set(stateAtom, updated);
  saveCardState(key, updated);
}

/**
 * Update view state for a specific view within a card
 */
export function updateViewState(
  cardId: CardId | string,
  viewId: string,
  viewState: Partial<ViewState>,
  registry: AtomRegistry
): void {
  const key = String(cardId);
  const stateAtom = cardTabStateFamily(cardId);
  const current = registry.get(stateAtom);
  const updated: DynamicIslandCardState = {
    ...current,
    viewStates: {
      ...current.viewStates,
      [viewId]: { ...current.viewStates[viewId], ...viewState },
    },
    lastUpdated: Date.now(),
  };
  registry.set(stateAtom, updated);
  saveCardState(key, updated);
}

/**
 * Register a tab for a card
 */
export function registerTab(
  cardId: CardId | string,
  tab: TabView,
  registry: AtomRegistry
): void {
  const tabsAtom = tabsAtomFamily(cardId);
  const currentTabs = registry.get(tabsAtom);
  if (!currentTabs.find((t) => t.id === tab.id)) {
    registry.set(tabsAtom, [...currentTabs, tab]);
  }
}

/**
 * Set the full view registry for a card
 */
export function setViewRegistry(
  cardId: CardId | string,
  views: ViewRegistry,
  registry: AtomRegistry
): void {
  const viewsAtom = viewRegistryAtomFamily(cardId);
  registry.set(viewsAtom, views);
}

/**
 * Add a view to the registry (by id)
 */
export function addView(
  cardId: CardId | string,
  view: ViewSpec,
  registry: AtomRegistry
): void {
  const viewsAtom = viewRegistryAtomFamily(cardId);
  const current = registry.get(viewsAtom);
  registry.set(viewsAtom, { ...current, [view.id]: view });
}

/**
 * Update a view in the registry
 */
export function updateView(
  cardId: CardId | string,
  viewId: string,
  patch: Partial<ViewSpec>,
  registry: AtomRegistry
): void {
  const viewsAtom = viewRegistryAtomFamily(cardId);
  const current = registry.get(viewsAtom);
  const existing = current[viewId];
  if (!existing) return;
  registry.set(viewsAtom, { ...current, [viewId]: { ...existing, ...patch } });
}

/**
 * Remove a view from the registry
 */
export function removeView(
  cardId: CardId | string,
  viewId: string,
  registry: AtomRegistry
): void {
  const viewsAtom = viewRegistryAtomFamily(cardId);
  const current = registry.get(viewsAtom);
  const { [viewId]: _removed, ...rest } = current;
  registry.set(viewsAtom, rest);
}

/**
 * Clear the registry for a card
 */
export function clearViews(
  cardId: CardId | string,
  registry: AtomRegistry
): void {
  const viewsAtom = viewRegistryAtomFamily(cardId);
  registry.set(viewsAtom, {});
}

/**
 * Unregister a tab from a card
 */
export function unregisterTab(
  cardId: CardId | string,
  tabId: string,
  registry: AtomRegistry
): void {
  const tabsAtom = tabsAtomFamily(cardId);
  const currentTabs = registry.get(tabsAtom);
  registry.set(
    tabsAtom,
    currentTabs.filter((t) => t.id !== tabId)
  );
}

/**
 * Get the active tab ID for a card
 */
export function getActiveTab(
  cardId: CardId | string,
  registry: AtomRegistry
): string {
  const stateAtom = cardTabStateFamily(cardId);
  return registry.get(stateAtom).activeTab;
}

/**
 * Get view state for a specific view
 */
export function getViewState(
  cardId: CardId | string,
  viewId: string,
  registry: AtomRegistry
): ViewState | undefined {
  const stateAtom = cardTabStateFamily(cardId);
  return registry.get(stateAtom).viewStates[viewId];
}

/**
 * Clear persisted state for a card
 */
export function clearCardState(cardId: CardId | string): void {
  const key = String(cardId);
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    // Ignore
  }
  tabsCache.delete(key);
  stateCache.delete(key);
  const idx = accessOrder.indexOf(key);
  if (idx > -1) accessOrder.splice(idx, 1);
}
