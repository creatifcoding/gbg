import type { ChatSurfaceSpec } from '../schemas/surface-spec'

/** Full workstation — every dial, every readout. */
export const Conductor: ChatSurfaceSpec = {
  _tag: 'Conductor',
  label: 'Conductor',
  composer: 'full',
  thread: 'full',
  inlineTasks: 'full',
  agentSelector: 'dropdown',
  connectionStatus: 'badge',
  frameChrome: 'full',
  keyboardShortcuts: 'full',
  contextChips: 'full',
  scrollBehavior: 'auto-follow',
  enableTransferDrag: true,
  enableTransferDrop: true,
}
