/**
 * Panel Registry — open/spawn operations.
 *
 * @module floating/panel-registry-open
 */

import { nanoid } from 'nanoid'
import {
  registerPanel,
  bringPanelToFront,
  type PanelConfig,
} from './floating-stx'
import { registryMap, openPanelProps } from './panel-registry-crud'

/**
 * Open a floating panel with registered content.
 * Returns the panel ID if successful, null if type not found.
 */
export function openRegisteredPanel<P>(typeId: string, props?: P): string | null {
  console.log('[PanelRegistry] openRegisteredPanel called with typeId:', typeId)
  console.log('[PanelRegistry] registryMap size:', registryMap.size)
  console.log('[PanelRegistry] registryMap keys:', Array.from(registryMap.keys()))

  const entry = registryMap.get(typeId)
  if (!entry) {
    console.warn(`[PanelRegistry] Panel type not found: ${typeId}`)
    return null
  }

  console.log('[PanelRegistry] Found entry:', entry.title)

  const panelId = `${typeId}-${nanoid(8)}`

  if (props) {
    openPanelProps.set(panelId, props)
  }

  const defaultDims = entry.defaultDimensions ?? { width: 600, height: 400 }
  const x = Math.max(50, (window.innerWidth - defaultDims.width) / 2)
  const y = Math.max(50, (window.innerHeight - defaultDims.height) / 2)

  const config: PanelConfig = {
    id: panelId,
    title: entry.title,
    mode: 'floating',
    initialPosition: { x, y },
    initialDimensions: defaultDims,
    constraints: entry.minDimensions
      ? { minWidth: entry.minDimensions.width, minHeight: entry.minDimensions.height }
      : undefined,
    closable: entry.closable ?? true,
    minimizable: entry.minimizable ?? true,
    resizable: entry.resizable ?? true,
    visitorId: typeId,
    visitorData: props,
  }

  registerPanel(config)
  bringPanelToFront(panelId)

  return panelId
}
