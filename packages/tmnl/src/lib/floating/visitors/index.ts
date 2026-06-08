/**
 * Panel Visitors — content providers for the panel system
 *
 * Call `registerAllVisitors()` once at app boot to populate
 * the panel registry with all available content types.
 *
 * @module floating/visitors
 */

import { registerMorphChatVisitors } from './morphchat-visitor'
import { registerGeointVisitors } from './geoint-visitor'
import { registerMuseLogVisitor } from './muse-log-visitor'

export { registerMorphChatVisitors, registerGeointVisitors, registerMuseLogVisitor }

/** Register all built-in panel visitors */
export function registerAllVisitors() {
  registerMorphChatVisitors()
  registerGeointVisitors()
  registerMuseLogVisitor()
}
