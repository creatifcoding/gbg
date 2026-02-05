/**
 * TMNL Testbed System
 *
 * Registry and utilities for testbed navigation.
 *
 * NOTE: This module provides DATA only. Search is handled by consumers
 * using src/lib/search drivers. See TestbedSearchItem for the indexable shape.
 */

export {
  // Types
  type TestbedStatus,
  type TestbedCategory,
  type TestbedVersion,
  type TestbedEntry,
  type TestbedSearchItem,
  // Registry
  TESTBED_REGISTRY,
  CATEGORY_META,
  // Helpers
  getAllTestbedVersions,
  getTestbedsByCategory,
  getPrimaryVersion,
  getTestbedById,
  getSearchableTestbeds,
} from './registry'

// Source registry (populated by vite-plugin-source-extract)
export {
  type ComponentSourceMeta,
  getComponentSource,
  getComponentSourceMeta,
  getAllSources,
  getComponentIds,
  hasComponentSource,
  initSourceRegistry,
  getSourcesByFile,
  useComponentSource,
  useComponentSourceMeta,
} from './source-registry'

// Components
export { ComponentBox } from './ComponentBox'
export { SourceViewer } from './SourceViewer'
export { IsolationModal } from './IsolationModal'
export { IsolationChat, type IsolationChatProps } from './IsolationChat'
export { ScanlineDeclassify, type ScanlineDeclassifyProps } from './ScanlineDeclassify'
export {
  ScanlineMarkdownRenderer,
  StaticScanlineRenderer,
  DeclassifyRenderer,
  type ScanlineMarkdownRendererProps,
} from './ScanlineMarkdownRenderer'

// Provider and Hooks
export {
  TestbedProvider,
  useTestbed,
  useTestbedOptional,
  type TestbedProviderProps,
} from './TestbedProvider'

export {
  useDesignMode,
  useDesignModeOptional,
  useComponentDesignState,
  useComponentDesignStateOptional,
  type DesignModeHook,
  type ComponentDesignState,
} from './useDesignMode'

// Types
export type {
  PropDoc,
  ComponentBoxProps,
  IsolationModalProps,
  SourceViewerProps,
  StyleOverride,
  PropOverride,
  DesignModeState,
  RegisteredComponent,
  TestbedContextValue,
  DesignAction,
} from './types'
