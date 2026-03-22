import type { ChatSurfaceSpec } from '../schemas/surface-spec'

/** Rich artifact display — each message is a surface. */
export const Card: ChatSurfaceSpec = {
  _tag: 'Card',
  label: 'Card',
  composer: 'structured',
  thread: 'card',
  inlineTasks: 'hidden',
  agentSelector: 'tabs',
  connectionStatus: 'hidden',
  frameChrome: 'minimal',
  keyboardShortcuts: 'full',
  contextChips: 'read-only',
  scrollBehavior: 'manual',
}
