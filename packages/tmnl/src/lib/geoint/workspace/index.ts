/**
 * GEOINT Workspace Module
 *
 * Persistence and state management for GEOINT workspaces.
 * Workspaces capture viewport state, layer configuration,
 * search filters, and panel layouts.
 *
 * @module geoint/workspace
 */

// Schemas
export {
  // IDs
  WorkspaceId,
  generateWorkspaceId,
  // Viewport
  ViewportState,
  DEFAULT_VIEWPORT,
  // Layers
  LayerConfig,
  DEFAULT_LAYERS,
  // Filters
  TimeRange,
  WorkspaceGeoFilter,
  FilterState,
  DEFAULT_FILTERS,
  // Panels
  PanelLayout,
  DEFAULT_PANEL_LAYOUTS,
  // Entities
  PinnedEntity,
  // Workspace
  Workspace,
  createWorkspace,
  // List
  WorkspaceListItem,
  toListItem,
} from './schemas'

// Browser Storage
export {
  // CRUD
  listWorkspaces,
  getWorkspace,
  saveWorkspace,
  deleteWorkspace,
  // Current workspace
  getCurrentWorkspaceId,
  setCurrentWorkspaceId,
  getOrCreateCurrentWorkspace,
  // Creation
  createNewWorkspace,
  duplicateWorkspace,
  // Import/Export
  exportWorkspace,
  importWorkspace,
  // Maintenance
  getStorageStats,
  clearAllWorkspaces,
} from './browser-storage'
