/**
 * FileBrowser Atoms
 *
 * Reactive state management for file browser.
 *
 * @module file-browser/atoms
 */

// State atoms
export {
  currentPathAtom,
  selectedFilesAtom,
  viewModeAtom,
  sortOrderAtom,
  filterPatternAtom,
  showHiddenAtom,
  directoryContentsAtom,
  focusedFileAtom,
  isLoadingAtom,
  historyAtom,
  activeOperationAtom,
  clipboardAtom,
  inspectorTabAtom,
  inspectorExpandedAtom,
  type ViewMode,
} from './state'

// Derived atoms
export {
  selectionInfoAtom,
  selectedFileAtom,
  filteredEntriesAtom,
  entryStatsAtom,
  breadcrumbsAtom,
  canGoBackAtom,
  canGoForwardAtom,
  canGoUpAtom,
  isInitialLoadAtom,
  hasErrorAtom,
  errorMessageAtom,
} from './derived'

// Operations
export {
  fileBrowserRuntimeAtom,
  navigationOps,
  selectionOps,
  clipboardOps,
  fileOps,
} from './operations'
