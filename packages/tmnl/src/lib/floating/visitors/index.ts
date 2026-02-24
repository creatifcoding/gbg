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

export { registerMorphChatVisitors, registerGeointVisitors }

/** Register all built-in panel visitors */
export function registerAllVisitors() {
  registerMorphChatVisitors()
  registerGeointVisitors()
}
