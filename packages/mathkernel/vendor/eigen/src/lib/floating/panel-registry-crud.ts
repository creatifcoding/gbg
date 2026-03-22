/**
 * Panel Registry CRUD — singleton map operations.
 *
 * @module floating/panel-registry-crud
 */

import type { PanelRegistryEntry } from './PanelRegistry'

export const registryMap = new Map<string, PanelRegistryEntry>()

/** Track open panels and their props */
export const openPanelProps = new Map<string, unknown>()

/**
 * Register a panel type globally.
 * Call this at module initialization time.
 */
export function registerPanelType<P>(entry: PanelRegistryEntry<P>): void {
  console.log('[PanelRegistry] registerPanelType called with id:', entry.id)
  registryMap.set(entry.id, entry as PanelRegistryEntry)
  console.log('[PanelRegistry] registryMap now has', registryMap.size, 'entries:', Array.from(registryMap.keys()))
}

/**
 * Unregister a panel type.
 */
export function unregisterPanelType(id: string): void {
  registryMap.delete(id)
}

/**
 * Get a registered panel entry.
 */
export function getPanelEntry(id: string): PanelRegistryEntry | undefined {
  return registryMap.get(id)
}

/**
 * Get all registered panel entries.
 */
export function getAllPanelEntries(): PanelRegistryEntry[] {
  return Array.from(registryMap.values())
}

/**
 * Get the props for an open panel.
 */
export function getPanelProps<P>(panelId: string): P | undefined {
  return openPanelProps.get(panelId) as P | undefined
}

/**
 * Clear props when panel is closed.
 */
export function clearPanelProps(panelId: string): void {
  openPanelProps.delete(panelId)
}
