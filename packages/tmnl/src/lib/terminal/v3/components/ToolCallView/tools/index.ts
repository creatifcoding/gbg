/**
 * Tool View Registry Initialization
 *
 * Registers all specialized tool view components.
 * Import this module to enable specialized tool rendering.
 */

import { registerToolComponent } from '../registry'
import { ReadToolView } from './ReadToolView'
import { BashToolView } from './BashToolView'
import { EditToolView } from './EditToolView'
import { GrepToolView } from './GrepToolView'
import { MapToolView } from './MapToolView'
import { MAP_PRODUCING_TOOLS } from '../detection/map-detector'

// =============================================================================
// Register Specialized Tools
// =============================================================================

// File system tools
registerToolComponent('Read', {
  component: ReadToolView,
  displayName: 'Read File',
  icon: 'FileText',
  description: 'Read file contents',
})

registerToolComponent('Write', {
  component: EditToolView, // Reuse Edit view for Write
  displayName: 'Write File',
  icon: 'Edit3',
  description: 'Write file contents',
})

registerToolComponent('Edit', {
  component: EditToolView,
  displayName: 'Edit File',
  icon: 'Edit3',
  description: 'Edit file with search/replace',
})

// Search tools
registerToolComponent('Grep', {
  component: GrepToolView,
  displayName: 'Grep Search',
  icon: 'Search',
  description: 'Search file contents with regex',
})

registerToolComponent('Glob', {
  component: GrepToolView, // Reuse Grep view for Glob
  displayName: 'Glob Search',
  icon: 'FolderSearch',
  description: 'Find files by pattern',
})

// Shell tools
registerToolComponent('Bash', {
  component: BashToolView,
  displayName: 'Bash Command',
  icon: 'Terminal',
  description: 'Execute shell command',
})

// Map-producing tools (explicit registration for explicit tool name trigger)
// These are registered but detection in ToolCallViewRoot also catches them via auto-detect
for (const toolName of MAP_PRODUCING_TOOLS) {
  registerToolComponent(toolName, {
    component: MapToolView,
    displayName: 'Map Result',
    icon: 'Map',
    description: 'Geographic data visualization',
  })
}

// =============================================================================
// Re-exports
// =============================================================================

export { ReadToolView } from './ReadToolView'
export { BashToolView } from './BashToolView'
export { EditToolView } from './EditToolView'
export { GrepToolView } from './GrepToolView'
export { MapToolView } from './MapToolView'
