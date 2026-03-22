/**
 * Interactive Chart Panel Schemas
 *
 * Re-exports all schema modules for convenient imports.
 *
 * @module charts/interactive-panel/schemas
 */

// Tab ID Schema
export {
  TabId,
  ALL_TAB_IDS,
  TabIdBrand,
  decodeTabId,
  tryDecodeTabId,
  isValidTabId,
  TAB_META,
  type TabMeta,
} from './tab-id';

// Tab Registry
export {
  TABS_BY_CATEGORY,
  getTabsForCategory,
  isTabAvailable,
  getDefaultTab,
  getCategoriesWithTab,
  isValidTabContract,
  type TabsForCategory,
  type TabContract,
} from './tab-registry';

// Panel State
export {
  PanelId,
  asPanelId,
  FoldState,
  StreamStatus,
  PanelState,
  DEFAULT_PANEL_STATE,
  createPanelState,
  applyPanelPatch,
  toPersistence,
  fromPersistence,
  type PanelStatePatch,
  type SerializablePanelState,
} from './panel-state';
