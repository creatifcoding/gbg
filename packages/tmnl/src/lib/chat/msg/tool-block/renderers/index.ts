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
  // Registration
  registerToolRenderer,
  registerToolDefinition,
  registerToolDefinitions,
  unregisterToolRenderer,
  registerToolHeaderMeta,
  // Static lookups
  getToolRenderer,
  getToolHeaderMeta,
  getToolRendererEntry,
  hasToolRenderer,
  getRegisteredToolNames,
  // React hooks (reactive)
  useToolRenderer,
  useToolRendererComponent,
  useToolHeaderMeta,
  // Types
  type ToolRendererProps,
  type ToolRendererEntry,
  type ToolRendererDefinition,
} from './registry'

export { GenericToolRenderer } from './generic-renderer'
export { SchemaAwareRenderer, SchemaAwareHeaderMeta, type SchemaAwareRendererProps } from './schema-aware-renderer'
export { createExtensionToolBridge, type ExtensionToolBridgeShape, type ToolManifest } from './extension-tool-bridge'
export { ReadToolRenderer, WriteToolRenderer, EditToolRenderer } from './file-renderers'
export { BashToolRenderer, GrepToolRenderer, FindToolRenderer, LsToolRenderer } from './shell-renderers'
export { InteractiveShellRenderer, InteractiveShellHeaderMeta } from './interactive-shell-renderer'

// =============================================================================
// Auto-register built-in SDK tools (single batch — one notification)
// =============================================================================

import { registerToolDefinitions } from './registry'
import { ReadToolRenderer, WriteToolRenderer, EditToolRenderer } from './file-renderers'
import { BashToolRenderer, GrepToolRenderer, FindToolRenderer, LsToolRenderer } from './shell-renderers'
import { InteractiveShellRenderer, InteractiveShellHeaderMeta } from './interactive-shell-renderer'
import {
  ReadHeaderMeta,
  WriteHeaderMeta,
  EditHeaderMeta,
  BashHeaderMeta,
  GrepHeaderMeta,
  FindHeaderMeta,
  LsHeaderMeta,
} from './header-metas'

registerToolDefinitions([
  { name: 'Read',  aliases: ['read'],  renderer: ReadToolRenderer,  headerMeta: ReadHeaderMeta },
  { name: 'Write', aliases: ['write'], renderer: WriteToolRenderer, headerMeta: WriteHeaderMeta },
  { name: 'Edit',  aliases: ['edit'],  renderer: EditToolRenderer,  headerMeta: EditHeaderMeta },
  { name: 'Bash',  aliases: ['bash'],  renderer: BashToolRenderer,  headerMeta: BashHeaderMeta },
  { name: 'Grep',  aliases: ['grep'],  renderer: GrepToolRenderer,  headerMeta: GrepHeaderMeta },
  { name: 'Find',  aliases: ['find'],  renderer: FindToolRenderer,  headerMeta: FindHeaderMeta },
  { name: 'Ls',    aliases: ['ls'],    renderer: LsToolRenderer,    headerMeta: LsHeaderMeta },
  { name: 'interactive_shell', renderer: InteractiveShellRenderer, headerMeta: InteractiveShellHeaderMeta },
])
