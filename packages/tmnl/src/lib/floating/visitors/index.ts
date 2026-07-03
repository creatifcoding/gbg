import { installPanelVisitorsFromLayer, makePanelVisitorCatalogLayer } from './catalog'
import {
  CorePanelVisitorCatalogLive,
  corePanelVisitors,
  registerCorePanelVisitors,
} from './core'
import {
  geointPanelVisitors,
  GeointPanelVisitorCatalogLive,
  registerGeointVisitors,
} from './geoint-visitor'
import {
  MorphChatPanelVisitorCatalogLive,
  morphChatPanelVisitors,
  registerMorphChatVisitors,
} from './morphchat-visitor'
import {
  MuseLogPanelVisitorCatalogLive,
  museLogPanelVisitors,
  registerMuseLogVisitor,
} from './muse-log-visitor'

export {
  CorePanelVisitorCatalogLive,
  GeointPanelVisitorCatalogLive,
  MorphChatPanelVisitorCatalogLive,
  MuseLogPanelVisitorCatalogLive,
  corePanelVisitors,
  geointPanelVisitors,
  morphChatPanelVisitors,
  museLogPanelVisitors,
  registerCorePanelVisitors,
  registerMorphChatVisitors,
  registerGeointVisitors,
  registerMuseLogVisitor,
}

export const allPanelVisitors = [
  ...corePanelVisitors,
  ...geointPanelVisitors,
] as const

export const AllPanelVisitorCatalogLive = makePanelVisitorCatalogLayer(allPanelVisitors)

/** Register all built-in panel visitors for full app/testbed hosts. */
export function registerAllVisitors() {
  installPanelVisitorsFromLayer(AllPanelVisitorCatalogLive)
}
