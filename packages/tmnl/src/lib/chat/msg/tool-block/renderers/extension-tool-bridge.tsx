/**
 * ExtensionToolBridge — reactive bridge between server-side tool discovery
 * and client-side React renderer registration.
 *
 * When the harness emits `chat:v2/tool_manifest`, the adapter calls
 * `bridge.syncManifest(tools)`. For each tool *not* already in the
 * renderer registry, a schema-aware generic renderer is auto-registered.
 *
 * Extensions (or consumers) can override auto-generated renderers by calling
 * `registerToolDefinition()` with a custom renderer *after* the bridge runs.
 * Because the renderer registry is last-write-wins, custom always wins.
 *
 * @module chat/msg/tool-block/renderers/extension-tool-bridge
 */

import { type ComponentType } from 'react'

import type { ToolManifestEntry } from '@/lib/harness/schemas'
import {
  hasToolRenderer,
  registerToolDefinition,
  unregisterToolRenderer,
  type ToolRendererProps,
  type ToolRendererDefinition,
} from './registry'
import { GenericToolRenderer } from './generic-renderer'
import {
  SchemaAwareRenderer,
  SchemaAwareHeaderMeta,
} from './schema-aware-renderer'

// =============================================================================
// Types
// =============================================================================

export interface ToolManifest {
  readonly tools: readonly ToolManifestEntry[]
}

export interface ExtensionToolBridgeShape {
  /**
   * Sync the tool manifest from the server.
   * Auto-registers schema-aware renderers for tools without custom renderers.
   * Returns the count of newly registered tools.
   */
  syncManifest(manifest: ToolManifest): number

  /**
   * Register a custom React renderer for an extension tool.
   * Overrides any auto-generated renderer.
   */
  registerCustomRenderer(def: ToolRendererDefinition): void

  /**
   * Clear all bridge-managed registrations (teardown / session disconnect).
   */
  clear(): void

  /** Get tool names managed by this bridge instance. */
  getManagedTools(): readonly string[]

  /** Get the last synced manifest, if any. */
  getManifest(): ToolManifest | null
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create an ExtensionToolBridge instance.
 *
 * Each harness adapter should own one bridge. On session open, call
 * `syncManifest()` with the tool manifest event payload. On disconnect,
 * call `clear()` to unregister extension tools.
 */
export function createExtensionToolBridge(): ExtensionToolBridgeShape {
  /** Tools auto-registered by this bridge (not custom overrides) */
  const autoRegistered = new Set<string>()
  /** Custom overrides registered through this bridge */
  const customRegistered = new Set<string>()
  /** Last synced manifest */
  let currentManifest: ToolManifest | null = null

  const syncManifest = (manifest: ToolManifest): number => {
    currentManifest = manifest
    let registered = 0

    for (const tool of manifest.tools) {
      // Skip tools that already have specialized renderers (built-in or custom)
      if (hasToolRenderer(tool.name) && !autoRegistered.has(tool.name)) {
        continue
      }

      // Register schema-aware renderer
      registerToolDefinition({
        name: tool.name,
        renderer: createSchemaAwareRenderer(tool),
        headerMeta: createSchemaAwareHeaderMeta(tool),
      })
      autoRegistered.add(tool.name)
      registered++
    }

    return registered
  }

  const registerCustomRenderer = (def: ToolRendererDefinition): void => {
    // Remove from auto-registered tracking (custom takes priority)
    autoRegistered.delete(def.name)
    customRegistered.add(def.name)
    registerToolDefinition(def)
  }

  const clear = (): void => {
    for (const name of autoRegistered) {
      unregisterToolRenderer(name)
    }
    for (const name of customRegistered) {
      unregisterToolRenderer(name)
    }
    autoRegistered.clear()
    customRegistered.clear()
    currentManifest = null
  }

  const getManagedTools = (): readonly string[] => {
    return [...autoRegistered, ...customRegistered]
  }

  const getManifest = (): ToolManifest | null => {
    return currentManifest
  }

  return {
    syncManifest,
    registerCustomRenderer,
    clear,
    getManagedTools,
    getManifest,
  }
}

// =============================================================================
// Schema-aware renderer factory
// =============================================================================

/**
 * Create a renderer component bound to a specific tool's schema metadata.
 *
 * Returns `SchemaAwareRenderer` with the tool description and parameter
 * schema baked into its props via closure.
 */
function createSchemaAwareRenderer(
  tool: ToolManifestEntry,
): ComponentType<ToolRendererProps> {
  const BoundRenderer: ComponentType<ToolRendererProps> = (props) => (
    <SchemaAwareRenderer
      {...props}
      toolName={tool.name}
      toolDescription={tool.description}
      toolParameters={tool.parameters}
    />
  )
  BoundRenderer.displayName = `SchemaAware(${tool.name})`
  return BoundRenderer
}

/**
 * Create a header-meta component bound to a specific tool's schema metadata.
 */
function createSchemaAwareHeaderMeta(
  tool: ToolManifestEntry,
): ComponentType<ToolRendererProps> {
  const BoundMeta: ComponentType<ToolRendererProps> = (props) => (
    <SchemaAwareHeaderMeta
      {...props}
      toolName={tool.name}
      toolDescription={tool.description}
      toolParameters={tool.parameters}
    />
  )
  BoundMeta.displayName = `SchemaAwareMeta(${tool.name})`
  return BoundMeta
}
