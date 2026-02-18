import type { ChatSurfaceSpec } from '../schemas/surface-spec'

/** Focused conversation — modal attention capture. */
export const Dialog: ChatSurfaceSpec = {
  _tag: 'Dialog',
  label: 'Dialog',
  composer: 'full',
  thread: 'full',
  inlineTasks: 'full',
  agentSelector: 'hidden',
  connectionStatus: 'toast-only',
  frameChrome: 'full',
  keyboardShortcuts: 'full',
  contextChips: 'full',
  scrollBehavior: 'auto-follow',
  maxHeight: 600,
  maxWidth: 720,
  enableTransferDrag: true,
  enableTransferDrop: true,
}
