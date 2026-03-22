/**
 * Fix Agent Tools
 *
 * AI SDK tools for the DecodeError Fix Agent.
 * Provides minimal patching capabilities to fix UITree decode failures.
 *
 * @module morph-card/agents/tools/fix-agent-tools
 */

import { Schema, JSONSchema } from 'effect';
import { jsonSchema, tool } from 'ai';
import type { JsonPatch } from '../../schemas/patch-protocol';
import { UITree } from '@/lib/genifer';

// =============================================================================
// Tool Context (injected at runtime)
// =============================================================================

export interface FixAgentContext {
  /** Card ID being fixed */
  cardId: string;
  /** Current tree state (may be partial/invalid) */
  currentTree: unknown;
  /** Error path that triggered the fix */
  errorPath: string;
  /** Callback to emit patch to durable stream */
  emitPatch: (patches: JsonPatch[], description?: string) => Promise<{ success: boolean; seq?: number }>;
}

let _context: FixAgentContext | null = null;

export function setFixAgentContext(ctx: FixAgentContext) {
  _context = ctx;
}

export function clearFixAgentContext() {
  _context = null;
}

function getContext(): FixAgentContext {
  if (!_context) {
    throw new Error('Fix agent context not set. Call setFixAgentContext first.');
  }
  return _context;
}

// =============================================================================
// Tool Input Schemas
// =============================================================================

const GetErrorContextInputSchema = Schema.Struct({
  errorPath: Schema.String,
});
type GetErrorContextInput = Schema.Schema.Type<typeof GetErrorContextInputSchema>;

const PatchElementInputSchema = Schema.Struct({
  path: Schema.String,
  props: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  children: Schema.optional(Schema.Array(Schema.String)),
  type: Schema.optional(Schema.String),
});
type PatchElementInput = Schema.Schema.Type<typeof PatchElementInputSchema>;

const ValidateTreeInputSchema = Schema.Struct({
  tree: Schema.Unknown,
});
type ValidateTreeInput = Schema.Schema.Type<typeof ValidateTreeInputSchema>;

const EmitFixPatchInputSchema = Schema.Struct({
  patches: Schema.Array(
    Schema.Struct({
      op: Schema.Literal('add', 'remove', 'replace', 'set'),
      path: Schema.String,
      value: Schema.optional(Schema.Unknown),
    })
  ),
  description: Schema.optional(Schema.String),
});
type EmitFixPatchInput = Schema.Schema.Type<typeof EmitFixPatchInputSchema>;

// =============================================================================
// get_error_context - Retrieve error details and surrounding tree context
// =============================================================================

export const getErrorContextTool = tool({
  description: 'Get detailed error context including the failed element and its parent/siblings',
  inputSchema: jsonSchema<GetErrorContextInput>(
    JSONSchema.make(GetErrorContextInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: GetErrorContextInput) => {
    const { errorPath } = input;
    const ctx = getContext();
    const tree = ctx.currentTree as { root?: string; elements?: Record<string, unknown> } | null;

    if (!tree || !tree.elements) {
      return {
        element: null,
        parent: null,
        siblings: [] as string[],
        errorDetails: 'Tree is empty or invalid',
      };
    }

    // Extract element key from path (e.g., /elements/chart-1 -> chart-1)
    const pathParts = errorPath.split('/').filter(Boolean);
    let elementKey: string | null = null;

    if (pathParts[0] === 'elements' && pathParts[1]) {
      elementKey = pathParts[1];
    }

    const element = elementKey ? tree.elements[elementKey] : null;

    // Find parent by checking all elements for this key in children
    let parent: unknown = null;
    let siblings: string[] = [];

    if (elementKey) {
      for (const [key, el] of Object.entries(tree.elements)) {
        const elem = el as { children?: string[] };
        if (elem.children?.includes(elementKey)) {
          parent = { key, ...(elem as object) };
          siblings = elem.children.filter((c) => c !== elementKey);
          break;
        }
      }
    }

    return {
      element: element ? { key: elementKey, ...(element as object) } : null,
      parent,
      siblings,
      errorDetails: `Failed to decode element at ${errorPath}`,
      availableElements: Object.keys(tree.elements),
    };
  },
});

// =============================================================================
// patch_element - Apply a fix to a specific element
// =============================================================================

export const patchElementTool = tool({
  description: 'Patch a single element by path. Can update props, children, or type.',
  inputSchema: jsonSchema<PatchElementInput>(
    JSONSchema.make(PatchElementInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: PatchElementInput) => {
    const { path, props, children, type } = input;
    const ctx = getContext();
    const tree = ctx.currentTree as { elements?: Record<string, unknown> } | null;

    // Extract element key from path
    const pathParts = path.split('/').filter(Boolean);
    let elementKey: string | null = null;

    if (pathParts[0] === 'elements' && pathParts[1]) {
      elementKey = pathParts[1];
    } else if (pathParts.length === 1) {
      elementKey = pathParts[0];
    }

    if (!elementKey || !tree?.elements?.[elementKey]) {
      return {
        success: false,
        error: `Element not found at path: ${path}`,
        patches: [] as JsonPatch[],
      };
    }

    const currentElement = tree.elements[elementKey] as Record<string, unknown>;
    const patches: JsonPatch[] = [];

    // Build patches for requested changes
    if (type !== undefined) {
      patches.push({
        op: 'replace',
        path: `/elements/${elementKey}/type`,
        value: type,
      });
    }

    if (props !== undefined) {
      // Merge props rather than replace entirely
      const currentProps = (currentElement['props'] ?? {}) as Record<string, unknown>;
      const mergedProps = { ...currentProps, ...props };
      patches.push({
        op: 'replace',
        path: `/elements/${elementKey}/props`,
        value: mergedProps,
      });
    }

    if (children !== undefined) {
      patches.push({
        op: 'replace',
        path: `/elements/${elementKey}/children`,
        value: children,
      });
    }

    return {
      success: true,
      patches,
      element: elementKey,
      changes: {
        type: type !== undefined,
        props: props !== undefined,
        children: children !== undefined,
      },
    };
  },
});

// =============================================================================
// validate_tree - Validate the tree after patching
// =============================================================================

export const validateTreeTool = tool({
  description: 'Validate the patched tree against UITree schema. Returns validation result.',
  inputSchema: jsonSchema<ValidateTreeInput>(
    JSONSchema.make(ValidateTreeInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: ValidateTreeInput) => {
    const { tree } = input;
    try {
      Schema.decodeUnknownSync(UITree)(tree);
      return { valid: true, errors: [] as string[] };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Extract meaningful error parts
      const errors = message
        .split('\n')
        .filter((line) => line.includes('Expected') || line.includes('but got'))
        .slice(0, 5); // Limit to first 5 errors

      return {
        valid: false,
        errors: errors.length > 0 ? errors : [message.slice(0, 500)],
      };
    }
  },
});

// =============================================================================
// emit_fix_patch - Emit the final fix patch to durable stream
// =============================================================================

export const emitFixPatchTool = tool({
  description: 'Emit the validated fix patch to the durable stream for the card.',
  inputSchema: jsonSchema<EmitFixPatchInput>(
    JSONSchema.make(EmitFixPatchInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: EmitFixPatchInput) => {
    const { patches, description } = input;
    const ctx = getContext();
    const result = await ctx.emitPatch(patches as JsonPatch[], description ?? 'Fix decode error');
    return result;
  },
});

// =============================================================================
// Export all tools
// =============================================================================

export const fixAgentTools = {
  get_error_context: getErrorContextTool,
  patch_element: patchElementTool,
  validate_tree: validateTreeTool,
  emit_fix_patch: emitFixPatchTool,
};
