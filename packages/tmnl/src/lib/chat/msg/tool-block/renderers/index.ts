/**
 * Tool Renderer Registry — self-registering barrel.
 *
 * Import this module to register all built-in tool renderers + header metas.
 * Each `registerToolRenderer(name, Renderer, HeaderMeta?)` call is one
 * registration — renderer and its collapsed-header summary in the same shot.
 *
 * Unknown tools fall back to GenericToolRenderer with no header meta.
 *
 * @module chat/msg/tool-block/renderers
 */

export {
  registerToolRenderer,
  registerToolHeaderMeta,
  getToolRenderer,
  getToolHeaderMeta,
  hasToolRenderer,
  type ToolRendererProps,
} from './registry'

export { GenericToolRenderer } from './generic-renderer'
export { ReadToolRenderer, WriteToolRenderer, EditToolRenderer } from './file-renderers'
export { BashToolRenderer, GrepToolRenderer, FindToolRenderer, LsToolRenderer } from './shell-renderers'

// =============================================================================
// Auto-register: renderer + header meta in one call per tool
// =============================================================================

import { registerToolRenderer } from './registry'
import { ReadToolRenderer, WriteToolRenderer, EditToolRenderer } from './file-renderers'
import { BashToolRenderer, GrepToolRenderer, FindToolRenderer, LsToolRenderer } from './shell-renderers'
import {
  ReadHeaderMeta,
  WriteHeaderMeta,
  EditHeaderMeta,
  BashHeaderMeta,
  GrepHeaderMeta,
  FindHeaderMeta,
  LsHeaderMeta,
} from './header-metas'

registerToolRenderer('Read',  ReadToolRenderer,  ReadHeaderMeta)
registerToolRenderer('read',  ReadToolRenderer,  ReadHeaderMeta)

registerToolRenderer('Write', WriteToolRenderer, WriteHeaderMeta)
registerToolRenderer('write', WriteToolRenderer, WriteHeaderMeta)

registerToolRenderer('Edit',  EditToolRenderer,  EditHeaderMeta)
registerToolRenderer('edit',  EditToolRenderer,  EditHeaderMeta)

registerToolRenderer('Bash',  BashToolRenderer,  BashHeaderMeta)
registerToolRenderer('bash',  BashToolRenderer,  BashHeaderMeta)

registerToolRenderer('Grep',  GrepToolRenderer,  GrepHeaderMeta)
registerToolRenderer('grep',  GrepToolRenderer,  GrepHeaderMeta)

registerToolRenderer('Find',  FindToolRenderer,  FindHeaderMeta)
registerToolRenderer('find',  FindToolRenderer,  FindHeaderMeta)

registerToolRenderer('Ls',    LsToolRenderer,    LsHeaderMeta)
registerToolRenderer('ls',    LsToolRenderer,    LsHeaderMeta)
