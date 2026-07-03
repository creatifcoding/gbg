import { installPanelVisitorsFromLayer, makePanelVisitorCatalogLayer } from './catalog'
import { morphChatPanelVisitors } from './morphchat-visitor'
import { museLogPanelVisitors } from './muse-log-visitor'

export const corePanelVisitors = [
  ...morphChatPanelVisitors,
  ...museLogPanelVisitors,
] as const

export const CorePanelVisitorCatalogLive = makePanelVisitorCatalogLayer(corePanelVisitors)

/** Register core panel visitors expected in lightweight standalone panel builds. */
export function registerCorePanelVisitors() {
  installPanelVisitorsFromLayer(CorePanelVisitorCatalogLive)
}
