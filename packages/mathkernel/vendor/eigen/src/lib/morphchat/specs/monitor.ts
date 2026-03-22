import type { ChatSurfaceSpec } from '../schemas/surface-spec'

/** Read-only feed — observe the stream. */
export const Monitor: ChatSurfaceSpec = {
  _tag: 'Monitor',
  label: 'Monitor',
  composer: 'none',
  thread: 'log',
  inlineTasks: 'compact',
  agentSelector: 'hidden',
  connectionStatus: 'badge',
  frameChrome: 'minimal',
  keyboardShortcuts: 'disabled',
  contextChips: 'hidden',
  scrollBehavior: 'pinned',
}
