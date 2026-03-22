/**
 * GEOINT Workspace Browser Storage
 *
 * localStorage-based persistence for workspace state.
 * Supports multiple workspaces with indexing and quick hydration.
 *
 * Storage Layout:
 * - tmnl:geoint:workspace:index - Array of workspace IDs and metadata
 * - tmnl:geoint:workspace:{id} - Full workspace data
 * - tmnl:geoint:workspace:current - Currently active workspace ID
 *
 * @module geoint/workspace/browser-storage
 */

import {
  Workspace,
  WorkspaceListItem,
  WorkspaceId,
  createWorkspace,
  toListItem,
} from './schemas'

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_PREFIX = 'tmnl:geoint:workspace:'
const INDEX_KEY = `${STORAGE_PREFIX}index`
const CURRENT_KEY = `${STORAGE_PREFIX}current`
const workspaceKey = (id: WorkspaceId) => `${STORAGE_PREFIX}${id}`

// =============================================================================
// Index Entry (minimal metadata for fast listing)
// =============================================================================

interface IndexEntry {
  id: string
  name: string
  updatedAt: string
  lastOpenedAt: string | null
}

// =============================================================================
// Low-level Storage Helpers
// =============================================================================

function getIndex(): IndexEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setIndex(entries: IndexEntry[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries))
  } catch (e) {
    console.error('[geoint:workspace] Failed to persist index:', e)
  }
}

function getRawWorkspace(id: WorkspaceId): string | null {
  try {
    return localStorage.getItem(workspaceKey(id))
  } catch {
    return null
  }
}

function setRawWorkspace(id: WorkspaceId, data: string): void {
  try {
    localStorage.setItem(workspaceKey(id), data)
  } catch (e) {
    console.error(`[geoint:workspace] Failed to persist workspace ${id}:`, e)
  }
}

function removeRawWorkspace(id: WorkspaceId): void {
  try {
    localStorage.removeItem(workspaceKey(id))
  } catch (e) {
    console.error(`[geoint:workspace] Failed to remove workspace ${id}:`, e)
  }
}

// =============================================================================
// Serialization (Schema-based with fallback)
// =============================================================================

function serializeWorkspace(workspace: Workspace): string {
  // Use Schema.encode for proper serialization
  // Note: Effect Schema classes serialize to plain objects
  return JSON.stringify({
    ...workspace,
    // Ensure dates are ISO strings
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
    lastOpenedAt: workspace.lastOpenedAt?.toISOString() ?? null,
    // Serialize nested objects
    viewport: { ...workspace.viewport },
    layers: workspace.layers.map((l) => ({ ...l })),
    filters: {
      ...workspace.filters,
      timeRange: workspace.filters.timeRange
        ? {
            ...workspace.filters.timeRange,
            start: workspace.filters.timeRange.start?.toISOString(),
            end: workspace.filters.timeRange.end?.toISOString(),
          }
        : undefined,
    },
    panels: workspace.panels.map((p) => ({ ...p })),
    pinnedEntities: workspace.pinnedEntities.map((e) => ({
      ...e,
      pinnedAt: e.pinnedAt.toISOString(),
    })),
  })
}

function deserializeWorkspace(raw: string): Workspace | null {
  try {
    const data = JSON.parse(raw)

    // Reconstruct with proper types
    return new Workspace({
      id: data.id as WorkspaceId,
      name: data.name,
      description: data.description,
      viewport: data.viewport,
      layers: data.layers,
      filters: {
        ...data.filters,
        timeRange: data.filters.timeRange
          ? {
              ...data.filters.timeRange,
              start: data.filters.timeRange.start
                ? new Date(data.filters.timeRange.start)
                : undefined,
              end: data.filters.timeRange.end
                ? new Date(data.filters.timeRange.end)
                : undefined,
            }
          : undefined,
      },
      panels: data.panels,
      pinnedEntities: (data.pinnedEntities ?? []).map((e: any) => ({
        ...e,
        pinnedAt: new Date(e.pinnedAt),
      })),
      selectedEntityId: data.selectedEntityId,
      tags: data.tags ?? [],
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      lastOpenedAt: data.lastOpenedAt ? new Date(data.lastOpenedAt) : undefined,
    })
  } catch (e) {
    console.error('[geoint:workspace] Failed to deserialize workspace:', e)
    return null
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * List all workspaces (metadata only, for UI lists).
 */
export function listWorkspaces(): WorkspaceListItem[] {
  const index = getIndex()
  const items: WorkspaceListItem[] = []

  for (const entry of index) {
    const raw = getRawWorkspace(entry.id as WorkspaceId)
    if (!raw) continue

    const workspace = deserializeWorkspace(raw)
    if (workspace) {
      items.push(toListItem(workspace))
    }
  }

  // Sort by last opened (most recent first)
  items.sort((a, b) => {
    const aTime = a.lastOpenedAt?.getTime() ?? a.updatedAt.getTime()
    const bTime = b.lastOpenedAt?.getTime() ?? b.updatedAt.getTime()
    return bTime - aTime
  })

  return items
}

/**
 * Get a workspace by ID.
 */
export function getWorkspace(id: WorkspaceId): Workspace | null {
  const raw = getRawWorkspace(id)
  if (!raw) return null
  return deserializeWorkspace(raw)
}

/**
 * Save a workspace (create or update).
 */
export function saveWorkspace(workspace: Workspace): void {
  const index = getIndex()
  const existingIdx = index.findIndex((e) => e.id === workspace.id)

  // Update timestamp
  const updatedWorkspace = new Workspace({
    ...workspace,
    updatedAt: new Date(),
  })

  // Serialize and store
  setRawWorkspace(workspace.id, serializeWorkspace(updatedWorkspace))

  // Update index
  const entry: IndexEntry = {
    id: workspace.id,
    name: workspace.name,
    updatedAt: updatedWorkspace.updatedAt.toISOString(),
    lastOpenedAt: updatedWorkspace.lastOpenedAt?.toISOString() ?? null,
  }

  if (existingIdx >= 0) {
    index[existingIdx] = entry
  } else {
    index.push(entry)
  }
  setIndex(index)

  console.log(`[geoint:workspace] Saved workspace: ${workspace.name} (${workspace.id})`)
}

/**
 * Delete a workspace.
 */
export function deleteWorkspace(id: WorkspaceId): void {
  removeRawWorkspace(id)

  const index = getIndex()
  const filtered = index.filter((e) => e.id !== id)
  setIndex(filtered)

  // If this was the current workspace, clear that
  const current = getCurrentWorkspaceId()
  if (current === id) {
    localStorage.removeItem(CURRENT_KEY)
  }

  console.log(`[geoint:workspace] Deleted workspace: ${id}`)
}

/**
 * Get the currently active workspace ID.
 */
export function getCurrentWorkspaceId(): WorkspaceId | null {
  try {
    const id = localStorage.getItem(CURRENT_KEY)
    return id as WorkspaceId | null
  } catch {
    return null
  }
}

/**
 * Set the currently active workspace ID.
 */
export function setCurrentWorkspaceId(id: WorkspaceId | null): void {
  try {
    if (id) {
      localStorage.setItem(CURRENT_KEY, id)
    } else {
      localStorage.removeItem(CURRENT_KEY)
    }
  } catch (e) {
    console.error('[geoint:workspace] Failed to set current workspace:', e)
  }
}

/**
 * Get or create the current workspace.
 * Returns the current workspace if set and exists,
 * otherwise creates a new "Default" workspace.
 */
export function getOrCreateCurrentWorkspace(): Workspace {
  const currentId = getCurrentWorkspaceId()

  if (currentId) {
    const workspace = getWorkspace(currentId)
    if (workspace) {
      // Update last opened
      const updated = new Workspace({
        ...workspace,
        lastOpenedAt: new Date(),
      })
      saveWorkspace(updated)
      return updated
    }
  }

  // Create default workspace
  const defaultWorkspace = createWorkspace('Default Workspace', 'Auto-created workspace')
  saveWorkspace(defaultWorkspace)
  setCurrentWorkspaceId(defaultWorkspace.id)
  return defaultWorkspace
}

/**
 * Create a new workspace.
 */
export function createNewWorkspace(name: string, description?: string): Workspace {
  const workspace = createWorkspace(name, description)
  saveWorkspace(workspace)
  return workspace
}

/**
 * Duplicate a workspace.
 */
export function duplicateWorkspace(id: WorkspaceId): Workspace | null {
  const original = getWorkspace(id)
  if (!original) return null

  const now = new Date()
  const duplicate = new Workspace({
    ...original,
    id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` as WorkspaceId,
    name: `${original.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  })

  saveWorkspace(duplicate)
  return duplicate
}

/**
 * Export workspace as JSON string (for file download).
 */
export function exportWorkspace(id: WorkspaceId): string | null {
  const workspace = getWorkspace(id)
  if (!workspace) return null
  return serializeWorkspace(workspace)
}

/**
 * Import workspace from JSON string.
 */
export function importWorkspace(json: string): Workspace | null {
  const workspace = deserializeWorkspace(json)
  if (!workspace) return null

  // Generate new ID to avoid conflicts
  const imported = new Workspace({
    ...workspace,
    id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` as WorkspaceId,
    name: `${workspace.name} (Imported)`,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastOpenedAt: new Date(),
  })

  saveWorkspace(imported)
  return imported
}

// =============================================================================
// Debug / Maintenance
// =============================================================================

/**
 * Get storage statistics.
 */
export function getStorageStats(): {
  workspaceCount: number
  totalSizeBytes: number
  largestWorkspace: { id: string; sizeBytes: number } | null
} {
  const index = getIndex()
  let totalSize = 0
  let largest: { id: string; sizeBytes: number } | null = null

  for (const entry of index) {
    const raw = getRawWorkspace(entry.id as WorkspaceId)
    if (raw) {
      const size = new Blob([raw]).size
      totalSize += size
      if (!largest || size > largest.sizeBytes) {
        largest = { id: entry.id, sizeBytes: size }
      }
    }
  }

  return {
    workspaceCount: index.length,
    totalSizeBytes: totalSize,
    largestWorkspace: largest,
  }
}

/**
 * Clear all workspace data.
 */
export function clearAllWorkspaces(): void {
  const index = getIndex()
  for (const entry of index) {
    removeRawWorkspace(entry.id as WorkspaceId)
  }
  setIndex([])
  localStorage.removeItem(CURRENT_KEY)
  console.log('[geoint:workspace] Cleared all workspaces')
}
