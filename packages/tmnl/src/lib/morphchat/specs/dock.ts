import type { ChatSurfaceSpec } from '../schemas/surface-spec'

/** Persistent side companion — always there, never loud. */
export const Dock: ChatSurfaceSpec = {
  _tag: 'Dock',
  label: 'Dock',
  composer: 'full',
  thread: 'compact',
  inlineTasks: 'compact',
  agentSelector: 'dropdown',
  connectionStatus: 'badge',
  frameChrome: 'minimal',
  keyboardShortcuts: 'full',
  contextChips: 'full',
  scrollBehavior: 'auto-follow',
  enableTransferDrag: true,
  enableTransferDrop: true,
}
