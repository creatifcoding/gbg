/**
 * Evolution Agent Tools
 *
 * AI SDK tools for the MorphCard Evolution Agent.
 * Provides full tree control for user-driven UI modifications.
 *
 * @module morph-card/agents/tools/evolution-agent-tools
 */

import { Schema, JSONSchema } from 'effect';
import { jsonSchema, tool } from 'ai';
import type { JsonPatch, SemanticMap, SemanticRegion } from '../../schemas/patch-protocol';
import { UITree } from '@/lib/genifer/core/schemas';

// =============================================================================
// Tool Context (injected at runtime)
// =============================================================================

export interface EvolutionAgentContext {
  /** Card ID being evolved */
  cardId: string;
  /** User ID for durable stream namespace */
  userId: string;
  /** Current tree state */
  currentTree: unknown;
  /** Semantic map (if pre-computed) */
  semanticMap?: SemanticMap;
  /** Callback to emit patch to durable stream */
  emitPatch: (patches: JsonPatch[], description: string) => Promise<{ success: boolean; seq?: number }>;
  /** Callback to regenerate a subtree (calls /ui-generate) */
  regenerateSubtree: (prompt: string) => Promise<{ root: string; elements: Record<string, unknown> }>;
}

let _context: EvolutionAgentContext | null = null;

export function setEvolutionAgentContext(ctx: EvolutionAgentContext) {
  _context = ctx;
}

export function clearEvolutionAgentContext() {
  _context = null;
}

function getContext(): EvolutionAgentContext {
  if (!_context) {
    throw new Error('Evolution agent context not set. Call setEvolutionAgentContext first.');
  }
  return _context;
}

// =============================================================================
// Tool Input Schemas
// =============================================================================

const EmptyInputSchema = Schema.Struct({});
type EmptyInput = Schema.Schema.Type<typeof EmptyInputSchema>;

const AddElementInputSchema = Schema.Struct({
  key: Schema.String,
  type: Schema.String,
  props: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  parentKey: Schema.String,
  children: Schema.optional(Schema.Array(Schema.String)),
});
type AddElementInput = Schema.Schema.Type<typeof AddElementInputSchema>;

const UpdateElementInputSchema = Schema.Struct({
  key: Schema.String,
  props: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  children: Schema.optional(Schema.Array(Schema.String)),
});
type UpdateElementInput = Schema.Schema.Type<typeof UpdateElementInputSchema>;

const RemoveElementInputSchema = Schema.Struct({
  key: Schema.String,
});
type RemoveElementInput = Schema.Schema.Type<typeof RemoveElementInputSchema>;

const TransformRegionInputSchema = Schema.Struct({
  regionId: Schema.String,
  prompt: Schema.String,
  preserveStructure: Schema.optional(Schema.Boolean),
});
type TransformRegionInput = Schema.Schema.Type<typeof TransformRegionInputSchema>;

const EmitPatchInputSchema = Schema.Struct({
  patches: Schema.Array(
    Schema.Struct({
      op: Schema.Literal('add', 'remove', 'replace', 'set'),
      path: Schema.String,
      value: Schema.optional(Schema.Unknown),
    })
  ),
  description: Schema.String,
});
type EmitPatchInput = Schema.Schema.Type<typeof EmitPatchInputSchema>;

// =============================================================================
// get_tree - Get current UITree state
// =============================================================================

export const getTreeTool = tool({
  description: 'Get the current UITree state for the card.',
  inputSchema: jsonSchema<EmptyInput>(
    JSONSchema.make(EmptyInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (_input: EmptyInput) => {
    const ctx = getContext();
    return ctx.currentTree;
  },
});

// =============================================================================
// get_semantic_map - Discover semantic regions in the tree
// =============================================================================

function extractSemanticRegions(tree: unknown): SemanticMap {
  const regions: SemanticRegion[] = [];
  const treeObj = tree as { elements?: Record<string, unknown> } | null;

  if (!treeObj?.elements) {
    return { regions };
  }

  // Traverse elements looking for SemanticRegion type or data-semantic-id props
  for (const [key, el] of Object.entries(treeObj.elements)) {
    const elem = el as {
      type?: string;
      props?: {
        'data-semantic-id'?: string;
        'data-semantic-label'?: string;
        'data-semantic-type'?: string;
      };
      children?: string[];
    };

    // Check if this is a SemanticRegion or has semantic attributes
    const semanticId = elem.props?.['data-semantic-id'];
    const semanticLabel = elem.props?.['data-semantic-label'];

    if (elem.type === 'SemanticRegion' || semanticId) {
      regions.push({
        id: semanticId ?? key,
        label: semanticLabel ?? key,
        type: elem.props?.['data-semantic-type'],
        path: `/elements/${key}`,
        children: elem.children ?? [],
      });
    }
  }

  return { regions };
}

export const getSemanticMapTool = tool({
  description:
    'Get a map of semantic regions in the tree. Use this to understand the tree structure and target specific regions for modification.',
  inputSchema: jsonSchema<EmptyInput>(
    JSONSchema.make(EmptyInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (_input: EmptyInput) => {
    const ctx = getContext();

    // Use pre-computed map if available
    if (ctx.semanticMap) {
      return ctx.semanticMap;
    }

    // Extract from tree
    return extractSemanticRegions(ctx.currentTree);
  },
});

// =============================================================================
// add_element - Add a new element to the tree
// =============================================================================

export const addElementTool = tool({
  description: 'Add a new element to the tree under a specified parent.',
  inputSchema: jsonSchema<AddElementInput>(
    JSONSchema.make(AddElementInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: AddElementInput) => {
    const { key, type, props, parentKey, children } = input;
    const ctx = getContext();
    const tree = ctx.currentTree as { elements?: Record<string, unknown> } | null;

    if (!tree?.elements?.[parentKey]) {
      return {
        success: false,
        error: `Parent element not found: ${parentKey}`,
        patches: [] as JsonPatch[],
      };
    }

    // Build patches
    const patches: JsonPatch[] = [];

    // Add the new element
    patches.push({
      op: 'add',
      path: `/elements/${key}`,
      value: {
        key,
        type,
        props,
        children: children ?? [],
        parentKey,
      },
    });

    // Update parent's children array
    const parent = tree.elements[parentKey] as { children?: string[] };
    const parentChildren = parent.children ?? [];
    patches.push({
      op: 'replace',
      path: `/elements/${parentKey}/children`,
      value: [...parentChildren, key],
    });

    return {
      success: true,
      patches,
      addedElement: key,
      parent: parentKey,
    };
  },
});

// =============================================================================
// update_element - Update an existing element
// =============================================================================

export const updateElementTool = tool({
  description: "Update an existing element's props or children.",
  inputSchema: jsonSchema<UpdateElementInput>(
    JSONSchema.make(UpdateElementInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: UpdateElementInput) => {
    const { key, props, children } = input;
    const ctx = getContext();
    const tree = ctx.currentTree as { elements?: Record<string, unknown> } | null;

    if (!tree?.elements?.[key]) {
      return {
        success: false,
        error: `Element not found: ${key}`,
        patches: [] as JsonPatch[],
      };
    }

    const currentElement = tree.elements[key] as Record<string, unknown>;
    const patches: JsonPatch[] = [];

    if (props !== undefined) {
      // Merge props
      const currentProps = (currentElement['props'] ?? {}) as Record<string, unknown>;
      const mergedProps = { ...currentProps, ...props };
      patches.push({
        op: 'replace',
        path: `/elements/${key}/props`,
        value: mergedProps,
      });
    }

    if (children !== undefined) {
      patches.push({
        op: 'replace',
        path: `/elements/${key}/children`,
        value: children,
      });
    }

    return {
      success: true,
      patches,
      element: key,
      changes: {
        props: props !== undefined,
        children: children !== undefined,
      },
    };
  },
});

// =============================================================================
// remove_element - Remove an element from the tree
// =============================================================================

export const removeElementTool = tool({
  description: 'Remove an element and its children from the tree.',
  inputSchema: jsonSchema<RemoveElementInput>(
    JSONSchema.make(RemoveElementInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: RemoveElementInput) => {
    const { key } = input;
    const ctx = getContext();
    const tree = ctx.currentTree as { elements?: Record<string, unknown> } | null;

    if (!tree?.elements?.[key]) {
      return {
        success: false,
        error: `Element not found: ${key}`,
        patches: [] as JsonPatch[],
      };
    }

    const element = tree.elements[key] as { parentKey?: string; children?: string[] };
    const patches: JsonPatch[] = [];

    // Recursively collect all descendants to remove
    const toRemove: string[] = [key];
    const collectDescendants = (elemKey: string) => {
      const elem = tree.elements?.[elemKey] as { children?: string[] } | undefined;
      if (elem?.children) {
        for (const childKey of elem.children) {
          toRemove.push(childKey);
          collectDescendants(childKey);
        }
      }
    };
    collectDescendants(key);

    // Remove all elements
    for (const elemKey of toRemove) {
      patches.push({
        op: 'remove',
        path: `/elements/${elemKey}`,
      });
    }

    // Update parent's children array if parent exists
    if (element.parentKey && tree.elements[element.parentKey]) {
      const parent = tree.elements[element.parentKey] as { children?: string[] };
      const parentChildren = (parent.children ?? []).filter((c) => c !== key);
      patches.push({
        op: 'replace',
        path: `/elements/${element.parentKey}/children`,
        value: parentChildren,
      });
    }

    return {
      success: true,
      patches,
      removedElements: toRemove,
    };
  },
});

// =============================================================================
// transform_region - Regenerate a semantic region with natural language
// =============================================================================

export const transformRegionTool = tool({
  description:
    'Transform a semantic region using natural language. The region will be regenerated based on the prompt while optionally preserving structure.',
  inputSchema: jsonSchema<TransformRegionInput>(
    JSONSchema.make(TransformRegionInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: TransformRegionInput) => {
    const { regionId, prompt, preserveStructure } = input;
    const ctx = getContext();
    const tree = ctx.currentTree as { elements?: Record<string, unknown> } | null;

    // Find the region element
    let regionKey: string | null = null;
    if (tree?.elements) {
      for (const [key, el] of Object.entries(tree.elements)) {
        const elem = el as { props?: { 'data-semantic-id'?: string } };
        if (elem.props?.['data-semantic-id'] === regionId || key === regionId) {
          regionKey = key;
          break;
        }
      }
    }

    if (!regionKey || !tree?.elements?.[regionKey]) {
      return {
        success: false,
        error: `Semantic region not found: ${regionId}`,
        patches: [] as JsonPatch[],
      };
    }

    const regionElement = tree.elements[regionKey] as { parentKey?: string; children?: string[] };

    try {
      // Call /ui-generate to regenerate the subtree
      const newSubtree = await ctx.regenerateSubtree(prompt);

      const patches: JsonPatch[] = [];

      if (preserveStructure) {
        // Only update children while keeping the wrapper
        // Remove old children first
        const collectDescendants = (elemKey: string): string[] => {
          const result: string[] = [];
          const elem = tree.elements?.[elemKey] as { children?: string[] } | undefined;
          if (elem?.children) {
            for (const childKey of elem.children) {
              result.push(childKey);
              result.push(...collectDescendants(childKey));
            }
          }
          return result;
        };

        const oldChildren = collectDescendants(regionKey);
        for (const childKey of oldChildren) {
          patches.push({
            op: 'remove',
            path: `/elements/${childKey}`,
          });
        }

        // Add new elements from generated subtree
        for (const [key, elem] of Object.entries(newSubtree.elements)) {
          patches.push({
            op: 'add',
            path: `/elements/${key}`,
            value: elem,
          });
        }

        // Update region's children to point to new root
        patches.push({
          op: 'replace',
          path: `/elements/${regionKey}/children`,
          value: [newSubtree.root],
        });
      } else {
        // Replace entire region with new subtree
        // Remove old region and all descendants
        const toRemove = [regionKey];
        const collectAllDescendants = (elemKey: string) => {
          const elem = tree.elements?.[elemKey] as { children?: string[] } | undefined;
          if (elem?.children) {
            for (const childKey of elem.children) {
              toRemove.push(childKey);
              collectAllDescendants(childKey);
            }
          }
        };
        collectAllDescendants(regionKey);

        for (const key of toRemove) {
          patches.push({
            op: 'remove',
            path: `/elements/${key}`,
          });
        }

        // Add new subtree
        for (const [key, elem] of Object.entries(newSubtree.elements)) {
          patches.push({
            op: 'add',
            path: `/elements/${key}`,
            value: elem,
          });
        }

        // Update parent to point to new root
        if (regionElement.parentKey && tree.elements[regionElement.parentKey]) {
          const parent = tree.elements[regionElement.parentKey] as { children?: string[] };
          const newChildren = (parent.children ?? []).map((c) => (c === regionKey ? newSubtree.root : c));
          patches.push({
            op: 'replace',
            path: `/elements/${regionElement.parentKey}/children`,
            value: newChildren,
          });
        }
      }

      return {
        success: true,
        patches,
        transformedRegion: regionId,
        newRoot: newSubtree.root,
      };
    } catch (e) {
      return {
        success: false,
        error: `Failed to transform region: ${e instanceof Error ? e.message : String(e)}`,
        patches: [] as JsonPatch[],
      };
    }
  },
});

// =============================================================================
// emit_patch - Emit patches to durable stream
// =============================================================================

export const emitPatchTool = tool({
  description: 'Emit patches to the durable stream. Call this after making all desired changes.',
  inputSchema: jsonSchema<EmitPatchInput>(
    JSONSchema.make(EmitPatchInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: EmitPatchInput) => {
    const { patches, description } = input;
    const ctx = getContext();
    const result = await ctx.emitPatch(patches as JsonPatch[], description);
    return result;
  },
});

// =============================================================================
// Export all tools
// =============================================================================

export const evolutionAgentTools = {
  get_tree: getTreeTool,
  get_semantic_map: getSemanticMapTool,
  add_element: addElementTool,
  update_element: updateElementTool,
  remove_element: removeElementTool,
  transform_region: transformRegionTool,
  emit_patch: emitPatchTool,
};
