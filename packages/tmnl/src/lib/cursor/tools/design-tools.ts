/**
 * Design Tools for Cursor Server
 *
 * AI SDK tool definitions for component design manipulation.
 * Integrates with the ComponentBox testbed system to provide
 * style overrides, prop manipulation, and tree introspection.
 *
 * Uses Effect Schema for type-safe input validation.
 * Pattern follows evolution-agent-tools.ts archetype.
 *
 * @module cursor/tools/design-tools
 */

import { Schema, JSONSchema } from 'effect';
import { jsonSchema, tool } from 'ai';
import type { CSSProperties } from 'react';

// =============================================================================
// Tool Context (injected at runtime)
// =============================================================================

/**
 * Context interface for design tools.
 * Injected at runtime to provide access to the component tree and overrides.
 */
export interface DesignToolsContext {
  /** Get the current component tree */
  getTree: () => Promise<{
    root: string;
    elements: Record<string, unknown>;
  }>;
  /** Get current style overrides */
  getStyleOverrides: () => Map<string, CSSProperties>;
  /** Get current prop overrides */
  getPropOverrides: () => Map<string, unknown>;
  /** Apply a style override to a component */
  applyStyleOverride: (
    componentId: string,
    styles: CSSProperties
  ) => Promise<{ success: boolean; error?: string }>;
  /** Apply a prop override to a component */
  applyPropOverride: (
    componentId: string,
    propName: string,
    value: unknown
  ) => Promise<{ success: boolean; error?: string }>;
  /** Clear all overrides for a component */
  clearOverrides: (
    componentId: string
  ) => Promise<{ success: boolean; error?: string }>;
  /** Get a design token value */
  getTokenValue: (tokenName: string) => Promise<string | null>;
  /** Set a design token value */
  setTokenValue: (
    tokenName: string,
    value: string
  ) => Promise<{ success: boolean; error?: string }>;
  /** Get prop documentation for a component type */
  getPropDocs: (
    componentType: string
  ) => Promise<Array<{ name: string; type: string; default?: string }>>;
  /** Get source code for a component */
  getSourceCode: (componentId: string) => Promise<string | null>;
}

let _context: DesignToolsContext | null = null;

/**
 * Set the design tools context.
 * Must be called before using any design tools.
 */
export function setDesignToolsContext(ctx: DesignToolsContext): void {
  _context = ctx;
}

/**
 * Clear the design tools context.
 */
export function clearDesignToolsContext(): void {
  _context = null;
}

function getContext(): DesignToolsContext {
  if (!_context) {
    throw new Error(
      'Design tools context not set. Call setDesignToolsContext first.'
    );
  }
  return _context;
}

// =============================================================================
// Tool Input Schemas
// =============================================================================

/**
 * Schema for updating inline styles on a component
 */
export const UpdateStylesInputSchema = Schema.Struct({
  componentId: Schema.String.pipe(
    Schema.annotations({ description: 'The unique ID of the component to style' })
  ),
  styles: Schema.Record({
    key: Schema.String,
    value: Schema.Union(Schema.String, Schema.Number),
  }).pipe(
    Schema.annotations({
      description: 'CSS properties to apply (e.g., backgroundColor, padding)',
    })
  ),
});
export type UpdateStylesInput = Schema.Schema.Type<typeof UpdateStylesInputSchema>;

/**
 * Schema for setting a design token value
 */
export const SetTokenInputSchema = Schema.Struct({
  tokenName: Schema.String.pipe(
    Schema.nonEmptyString(),
    Schema.annotations({
      description: 'CSS variable name (e.g., --tmnl-color-primary)',
    })
  ),
  value: Schema.String.pipe(
    Schema.annotations({ description: 'The value to set (e.g., #3b82f6, 16px)' })
  ),
});
export type SetTokenInput = Schema.Schema.Type<typeof SetTokenInputSchema>;

/**
 * Schema for toggling a component variant
 */
export const ToggleVariantInputSchema = Schema.Struct({
  componentId: Schema.String.pipe(
    Schema.annotations({ description: 'The unique ID of the component' })
  ),
  variant: Schema.String.pipe(
    Schema.annotations({
      description: 'The variant to switch to (e.g., primary, secondary, ghost)',
    })
  ),
});
export type ToggleVariantInput = Schema.Schema.Type<typeof ToggleVariantInputSchema>;

/**
 * Schema for setting a prop value on a component
 */
export const SetPropInputSchema = Schema.Struct({
  componentId: Schema.String.pipe(
    Schema.annotations({ description: 'The unique ID of the component' })
  ),
  propName: Schema.String.pipe(
    Schema.annotations({ description: 'The prop name to set' })
  ),
  value: Schema.Unknown.pipe(
    Schema.annotations({
      description: 'The value to set (can be string, number, boolean, etc.)',
    })
  ),
});
export type SetPropInput = Schema.Schema.Type<typeof SetPropInputSchema>;

/**
 * Schema for resetting component props to defaults
 */
export const ResetPropsInputSchema = Schema.Struct({
  componentId: Schema.String.pipe(
    Schema.annotations({ description: 'The unique ID of the component' })
  ),
  propNames: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({
        description:
          'Specific props to reset (if omitted, resets all overrides)',
      })
    )
  ),
});
export type ResetPropsInput = Schema.Schema.Type<typeof ResetPropsInputSchema>;

/**
 * Schema for getting the component tree
 */
export const GetTreeInputSchema = Schema.Struct({
  componentId: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Optional component ID to get subtree from',
      })
    )
  ),
});
export type GetTreeInput = Schema.Schema.Type<typeof GetTreeInputSchema>;

/**
 * Schema for listing available props for a component type
 */
export const ListPropsInputSchema = Schema.Struct({
  componentType: Schema.String.pipe(
    Schema.annotations({
      description: 'The component type (e.g., Button, Text, Stack)',
    })
  ),
});
export type ListPropsInput = Schema.Schema.Type<typeof ListPropsInputSchema>;

/**
 * Schema for exporting component source code
 */
export const ExportCodeInputSchema = Schema.Struct({
  componentId: Schema.String.pipe(
    Schema.annotations({ description: 'The unique ID of the component' })
  ),
  format: Schema.optional(
    Schema.Literal('tsx', 'jsx').pipe(
      Schema.annotations({ description: 'Output format (default: tsx)' })
    )
  ),
});
export type ExportCodeInput = Schema.Schema.Type<typeof ExportCodeInputSchema>;

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Update inline styles on a component
 */
export const updateStylesTool = tool({
  description:
    'Update inline styles on a component. Styles are merged with existing overrides.',
  inputSchema: jsonSchema<UpdateStylesInput>(
    JSONSchema.make(UpdateStylesInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: UpdateStylesInput) => {
    const ctx = getContext();
    const styles = input.styles as CSSProperties;
    const result = await ctx.applyStyleOverride(input.componentId, styles);

    return {
      ...result,
      componentId: input.componentId,
      appliedStyles: styles,
    };
  },
});

/**
 * Set a design token value
 */
export const setTokenTool = tool({
  description:
    'Set a design token (CSS custom property) value. Affects all components using the token.',
  inputSchema: jsonSchema<SetTokenInput>(
    JSONSchema.make(SetTokenInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: SetTokenInput) => {
    const ctx = getContext();
    const previousValue = await ctx.getTokenValue(input.tokenName);
    const result = await ctx.setTokenValue(input.tokenName, input.value);

    return {
      ...result,
      tokenName: input.tokenName,
      previousValue,
      newValue: input.value,
    };
  },
});

/**
 * Toggle component variant
 */
export const toggleVariantTool = tool({
  description:
    'Toggle a component variant. This sets the variant prop to a new value.',
  inputSchema: jsonSchema<ToggleVariantInput>(
    JSONSchema.make(ToggleVariantInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: ToggleVariantInput) => {
    const ctx = getContext();
    const tree = await ctx.getTree();
    const element = tree.elements[input.componentId] as
      | { props?: { variant?: string } }
      | undefined;

    const previousVariant = element?.props?.variant ?? 'default';
    const result = await ctx.applyPropOverride(
      input.componentId,
      'variant',
      input.variant
    );

    return {
      ...result,
      componentId: input.componentId,
      previousVariant,
      newVariant: input.variant,
    };
  },
});

/**
 * Set a prop value on a component
 */
export const setPropTool = tool({
  description: 'Set a prop value on a component.',
  inputSchema: jsonSchema<SetPropInput>(
    JSONSchema.make(SetPropInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: SetPropInput) => {
    const ctx = getContext();
    const result = await ctx.applyPropOverride(
      input.componentId,
      input.propName,
      input.value
    );

    return {
      ...result,
      componentId: input.componentId,
      propName: input.propName,
      value: input.value,
    };
  },
});

/**
 * Reset component props to defaults
 */
export const resetPropsTool = tool({
  description:
    'Reset component props and styles to defaults. Can reset all overrides or specific props.',
  inputSchema: jsonSchema<ResetPropsInput>(
    JSONSchema.make(ResetPropsInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: ResetPropsInput) => {
    const ctx = getContext();
    const result = await ctx.clearOverrides(input.componentId);

    return {
      ...result,
      componentId: input.componentId,
      resetProps: input.propNames ?? 'all',
    };
  },
});

/**
 * Get the component hierarchy tree
 */
export const getTreeTool = tool({
  description:
    'Get the component hierarchy tree. Can return full tree or subtree from a specific component.',
  inputSchema: jsonSchema<GetTreeInput>(
    JSONSchema.make(GetTreeInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: GetTreeInput) => {
    const ctx = getContext();
    const tree = await ctx.getTree();

    if (input.componentId) {
      // Return subtree starting from the specified component
      const element = tree.elements[input.componentId];
      if (!element) {
        return {
          error: `Component not found: ${input.componentId}`,
          root: null,
          elements: {},
        };
      }

      // Collect element and all descendants
      const subtreeElements: Record<string, unknown> = {};
      const collectDescendants = (key: string) => {
        const el = tree.elements[key] as { children?: string[] } | undefined;
        if (el) {
          subtreeElements[key] = el;
          if (el.children) {
            for (const childKey of el.children) {
              collectDescendants(childKey);
            }
          }
        }
      };
      collectDescendants(input.componentId);

      return {
        root: input.componentId,
        elements: subtreeElements,
      };
    }

    return tree;
  },
});

/**
 * List available props for a component type
 */
export const listPropsTool = tool({
  description:
    'List available props for a component type, including types and default values.',
  inputSchema: jsonSchema<ListPropsInput>(
    JSONSchema.make(ListPropsInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: ListPropsInput) => {
    const ctx = getContext();
    const props = await ctx.getPropDocs(input.componentType);

    return {
      componentType: input.componentType,
      props,
    };
  },
});

/**
 * Export component source code
 */
export const exportCodeTool = tool({
  description:
    'Export the source code for a component, including any applied overrides.',
  inputSchema: jsonSchema<ExportCodeInput>(
    JSONSchema.make(ExportCodeInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: ExportCodeInput) => {
    const ctx = getContext();
    const code = await ctx.getSourceCode(input.componentId);

    if (!code) {
      return {
        success: false,
        error: `Source code not found for component: ${input.componentId}`,
        code: null,
      };
    }

    return {
      success: true,
      componentId: input.componentId,
      format: input.format ?? 'tsx',
      code,
    };
  },
});

// =============================================================================
// Export Tool Collection
// =============================================================================

/**
 * All design tools for AI SDK integration
 */
export const designTools = {
  update_styles: updateStylesTool,
  set_token: setTokenTool,
  toggle_variant: toggleVariantTool,
  set_prop: setPropTool,
  reset_props: resetPropsTool,
  get_tree: getTreeTool,
  list_props: listPropsTool,
  export_code: exportCodeTool,
} as const;

export type DesignToolName = keyof typeof designTools;
