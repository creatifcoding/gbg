/**
 * Tool Renderer Registry — self-registering barrel.
 *
 * Import this module to register all built-in tool renderers.
 * Unknown tools fall back to GenericToolRenderer.
 *
 * @module chat/msg/tool-block/renderers
 */

export {
  registerToolRenderer,
  getToolRenderer,
  hasToolRenderer,
  type ToolRendererProps,
} from './registry'

export { GenericToolRenderer } from './generic-renderer'
export { ReadToolRenderer, WriteToolRenderer, EditToolRenderer } from './file-renderers'
export { BashToolRenderer, GrepToolRenderer, FindToolRenderer, LsToolRenderer } from './shell-renderers'

// =============================================================================
// Auto-register built-in SDK tool renderers
// =============================================================================

import { registerToolRenderer } from './registry'
import { ReadToolRenderer, WriteToolRenderer, EditToolRenderer } from './file-renderers'
import { BashToolRenderer, GrepToolRenderer, FindToolRenderer, LsToolRenderer } from './shell-renderers'

registerToolRenderer('Read', ReadToolRenderer)
registerToolRenderer('read', ReadToolRenderer)

registerToolRenderer('Write', WriteToolRenderer)
registerToolRenderer('write', WriteToolRenderer)

registerToolRenderer('Edit', EditToolRenderer)
registerToolRenderer('edit', EditToolRenderer)

registerToolRenderer('Bash', BashToolRenderer)
registerToolRenderer('bash', BashToolRenderer)

registerToolRenderer('Grep', GrepToolRenderer)
registerToolRenderer('grep', GrepToolRenderer)

registerToolRenderer('Find', FindToolRenderer)
registerToolRenderer('find', FindToolRenderer)

registerToolRenderer('Ls', LsToolRenderer)
registerToolRenderer('ls', LsToolRenderer)
