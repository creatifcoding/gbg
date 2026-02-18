import type { ChatSurfaceSpec } from '../schemas/surface-spec'

/** Floating bubble — tap to talk, dismiss to hide. */
export const Widget: ChatSurfaceSpec = {
  _tag: 'Widget',
  label: 'Widget',
  composer: 'single-line',
  thread: 'compact',
  inlineTasks: 'hidden',
  agentSelector: 'hidden',
  connectionStatus: 'hidden',
  frameChrome: 'none',
  keyboardShortcuts: 'minimal',
  contextChips: 'hidden',
  scrollBehavior: 'pinned',
  maxHeight: 400,
  maxWidth: 360,
}
