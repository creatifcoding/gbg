import type { ChatSurfaceSpec } from '../schemas/surface-spec'

/** Canvas citizen — lives inside something else. */
export const Embed: ChatSurfaceSpec = {
  _tag: 'Embed',
  label: 'Embed',
  composer: 'single-line',
  thread: 'compact',
  inlineTasks: 'compact',
  agentSelector: 'hidden',
  connectionStatus: 'hidden',
  frameChrome: 'none',
  keyboardShortcuts: 'minimal',
  contextChips: 'hidden',
  scrollBehavior: 'auto-follow',
}
