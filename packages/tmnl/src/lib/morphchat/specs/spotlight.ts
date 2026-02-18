import type { ChatSurfaceSpec } from '../schemas/surface-spec'

/** Slash-command speed — intent-first, no history. */
export const Spotlight: ChatSurfaceSpec = {
  _tag: 'Spotlight',
  label: 'Spotlight',
  composer: 'command',
  thread: 'none',
  inlineTasks: 'hidden',
  agentSelector: 'hidden',
  connectionStatus: 'hidden',
  frameChrome: 'none',
  keyboardShortcuts: 'minimal',
  contextChips: 'hidden',
  scrollBehavior: 'manual',
  maxWidth: 640,
}
