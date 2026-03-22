/**
 * Design Tools Tests
 *
 * TDD tests for AI SDK design manipulation tools.
 * Tests schema validation, tool execution, and context management.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Schema } from 'effect';
import type { CSSProperties } from 'react';

// Import tools (will fail until implemented)
import {
  // Context management
  setDesignToolsContext,
  clearDesignToolsContext,
  type DesignToolsContext,
  // Tool schemas
  UpdateStylesInputSchema,
  SetTokenInputSchema,
  ToggleVariantInputSchema,
  SetPropInputSchema,
  ResetPropsInputSchema,
  GetTreeInputSchema,
  ListPropsInputSchema,
  ExportCodeInputSchema,
  // Tools
  updateStylesTool,
  setTokenTool,
  toggleVariantTool,
  setPropTool,
  resetPropsTool,
  getTreeTool,
  listPropsTool,
  exportCodeTool,
  // Tool collection
  designTools,
} from '../design-tools';

// =============================================================================
// Test Fixtures
// =============================================================================

const mockComponentTree = {
  root: 'container-1',
  elements: {
    'container-1': {
      key: 'container-1',
      type: 'Stack',
      props: { direction: 'vertical', gap: 16 },
      children: ['button-1', 'text-1'],
    },
    'button-1': {
      key: 'button-1',
      type: 'Button',
      props: { variant: 'primary', size: 'md', label: 'Click me' },
      children: [],
      parentKey: 'container-1',
    },
    'text-1': {
      key: 'text-1',
      type: 'Text',
      props: { content: 'Hello world', size: 'base' },
      children: [],
      parentKey: 'container-1',
    },
  },
};

const mockStyleOverrides: Map<string, CSSProperties> = new Map();
const mockPropOverrides: Map<string, unknown> = new Map();

const mockTokenValues: Record<string, string> = {
  '--tmnl-color-primary': '#3b82f6',
  '--tmnl-spacing-md': '16px',
  '--tmnl-text-base': '16px',
};

const mockPropDocs: Record<string, Array<{ name: string; type: string; default?: string }>> = {
  Button: [
    { name: 'variant', type: "'primary' | 'secondary' | 'ghost'", default: 'primary' },
    { name: 'size', type: "'sm' | 'md' | 'lg'", default: 'md' },
    { name: 'label', type: 'string' },
    { name: 'disabled', type: 'boolean', default: 'false' },
  ],
  Text: [
    { name: 'content', type: 'string' },
    { name: 'size', type: "'xs' | 'sm' | 'base' | 'lg'", default: 'base' },
  ],
};

const mockSourceCode: Record<string, string> = {
  'button-1': '<Button variant="primary" size="md">Click me</Button>',
  'text-1': '<Text size="base">Hello world</Text>',
};

function createMockContext(): DesignToolsContext {
  return {
    getTree: async () => mockComponentTree,
    getStyleOverrides: () => new Map(mockStyleOverrides),
    getPropOverrides: () => new Map(mockPropOverrides),
    applyStyleOverride: async (componentId, styles) => {
      mockStyleOverrides.set(componentId, { ...mockStyleOverrides.get(componentId), ...styles });
      return { success: true };
    },
    applyPropOverride: async (componentId, propName, value) => {
      mockPropOverrides.set(`${componentId}:${propName}`, value);
      return { success: true };
    },
    clearOverrides: async (componentId) => {
      mockStyleOverrides.delete(componentId);
      // Clear all prop overrides for this component
      for (const key of mockPropOverrides.keys()) {
        if (key.startsWith(`${componentId}:`)) {
          mockPropOverrides.delete(key);
        }
      }
      return { success: true };
    },
    getTokenValue: async (tokenName) => mockTokenValues[tokenName] ?? null,
    setTokenValue: async (tokenName, value) => {
      mockTokenValues[tokenName] = value;
      return { success: true };
    },
    getPropDocs: async (componentType) => mockPropDocs[componentType] ?? [],
    getSourceCode: async (componentId) => mockSourceCode[componentId] ?? null,
  };
}

// =============================================================================
// Schema Validation Tests
// =============================================================================

describe('Design Tools Schemas', () => {
  describe('UpdateStylesInputSchema', () => {
    it('should validate valid input', () => {
      const input = {
        componentId: 'button-1',
        styles: { backgroundColor: '#ff0000', padding: '8px' },
      };
      const result = Schema.decodeUnknownSync(UpdateStylesInputSchema)(input);
      expect(result.componentId).toBe('button-1');
      expect(result.styles).toEqual({ backgroundColor: '#ff0000', padding: '8px' });
    });

    it('should reject missing componentId', () => {
      const input = { styles: { backgroundColor: '#ff0000' } };
      expect(() => Schema.decodeUnknownSync(UpdateStylesInputSchema)(input)).toThrow();
    });

    it('should reject missing styles', () => {
      const input = { componentId: 'button-1' };
      expect(() => Schema.decodeUnknownSync(UpdateStylesInputSchema)(input)).toThrow();
    });
  });

  describe('SetTokenInputSchema', () => {
    it('should validate valid input', () => {
      const input = {
        tokenName: '--tmnl-color-primary',
        value: '#3b82f6',
      };
      const result = Schema.decodeUnknownSync(SetTokenInputSchema)(input);
      expect(result.tokenName).toBe('--tmnl-color-primary');
      expect(result.value).toBe('#3b82f6');
    });

    it('should reject empty token name', () => {
      const input = { tokenName: '', value: '#3b82f6' };
      expect(() => Schema.decodeUnknownSync(SetTokenInputSchema)(input)).toThrow();
    });
  });

  describe('ToggleVariantInputSchema', () => {
    it('should validate valid input', () => {
      const input = {
        componentId: 'button-1',
        variant: 'secondary',
      };
      const result = Schema.decodeUnknownSync(ToggleVariantInputSchema)(input);
      expect(result.componentId).toBe('button-1');
      expect(result.variant).toBe('secondary');
    });
  });

  describe('SetPropInputSchema', () => {
    it('should validate with string value', () => {
      const input = {
        componentId: 'button-1',
        propName: 'label',
        value: 'New Label',
      };
      const result = Schema.decodeUnknownSync(SetPropInputSchema)(input);
      expect(result.value).toBe('New Label');
    });

    it('should validate with boolean value', () => {
      const input = {
        componentId: 'button-1',
        propName: 'disabled',
        value: true,
      };
      const result = Schema.decodeUnknownSync(SetPropInputSchema)(input);
      expect(result.value).toBe(true);
    });

    it('should validate with number value', () => {
      const input = {
        componentId: 'button-1',
        propName: 'tabIndex',
        value: 0,
      };
      const result = Schema.decodeUnknownSync(SetPropInputSchema)(input);
      expect(result.value).toBe(0);
    });
  });

  describe('ResetPropsInputSchema', () => {
    it('should validate with componentId only', () => {
      const input = { componentId: 'button-1' };
      const result = Schema.decodeUnknownSync(ResetPropsInputSchema)(input);
      expect(result.componentId).toBe('button-1');
      expect(result.propNames).toBeUndefined();
    });

    it('should validate with specific prop names', () => {
      const input = {
        componentId: 'button-1',
        propNames: ['variant', 'size'],
      };
      const result = Schema.decodeUnknownSync(ResetPropsInputSchema)(input);
      expect(result.propNames).toEqual(['variant', 'size']);
    });
  });

  describe('GetTreeInputSchema', () => {
    it('should validate empty input', () => {
      const input = {};
      const result = Schema.decodeUnknownSync(GetTreeInputSchema)(input);
      expect(result).toEqual({});
    });

    it('should validate with componentId filter', () => {
      const input = { componentId: 'container-1' };
      const result = Schema.decodeUnknownSync(GetTreeInputSchema)(input);
      expect(result.componentId).toBe('container-1');
    });
  });

  describe('ListPropsInputSchema', () => {
    it('should validate valid input', () => {
      const input = { componentType: 'Button' };
      const result = Schema.decodeUnknownSync(ListPropsInputSchema)(input);
      expect(result.componentType).toBe('Button');
    });
  });

  describe('ExportCodeInputSchema', () => {
    it('should validate valid input', () => {
      const input = { componentId: 'button-1' };
      const result = Schema.decodeUnknownSync(ExportCodeInputSchema)(input);
      expect(result.componentId).toBe('button-1');
    });

    it('should validate with format option', () => {
      const input = { componentId: 'button-1', format: 'jsx' };
      const result = Schema.decodeUnknownSync(ExportCodeInputSchema)(input);
      expect(result.format).toBe('jsx');
    });
  });
});

// =============================================================================
// Tool Execution Tests
// =============================================================================

describe('Design Tools Execution', () => {
  beforeEach(() => {
    mockStyleOverrides.clear();
    mockPropOverrides.clear();
    setDesignToolsContext(createMockContext());
  });

  afterEach(() => {
    clearDesignToolsContext();
  });

  describe('updateStylesTool', () => {
    it('should update styles on a component', async () => {
      const result = await updateStylesTool.execute({
        componentId: 'button-1',
        styles: { backgroundColor: '#ff0000', padding: '12px' },
      });

      expect(result.success).toBe(true);
      expect(result.componentId).toBe('button-1');
      expect(mockStyleOverrides.get('button-1')).toEqual({
        backgroundColor: '#ff0000',
        padding: '12px',
      });
    });

    it('should merge styles with existing overrides', async () => {
      mockStyleOverrides.set('button-1', { color: 'white' });

      await updateStylesTool.execute({
        componentId: 'button-1',
        styles: { backgroundColor: '#ff0000' },
      });

      expect(mockStyleOverrides.get('button-1')).toEqual({
        color: 'white',
        backgroundColor: '#ff0000',
      });
    });
  });

  describe('setTokenTool', () => {
    it('should set a design token value', async () => {
      const result = await setTokenTool.execute({
        tokenName: '--tmnl-color-accent',
        value: '#10b981',
      });

      expect(result.success).toBe(true);
      expect(mockTokenValues['--tmnl-color-accent']).toBe('#10b981');
    });

    it('should update existing token value', async () => {
      const result = await setTokenTool.execute({
        tokenName: '--tmnl-color-primary',
        value: '#ef4444',
      });

      expect(result.success).toBe(true);
      expect(mockTokenValues['--tmnl-color-primary']).toBe('#ef4444');
    });
  });

  describe('toggleVariantTool', () => {
    it('should toggle component variant', async () => {
      const result = await toggleVariantTool.execute({
        componentId: 'button-1',
        variant: 'secondary',
      });

      expect(result.success).toBe(true);
      expect(result.previousVariant).toBe('primary');
      expect(result.newVariant).toBe('secondary');
    });
  });

  describe('setPropTool', () => {
    it('should set a prop value', async () => {
      const result = await setPropTool.execute({
        componentId: 'button-1',
        propName: 'disabled',
        value: true,
      });

      expect(result.success).toBe(true);
      expect(mockPropOverrides.get('button-1:disabled')).toBe(true);
    });
  });

  describe('resetPropsTool', () => {
    it('should reset all props for a component', async () => {
      mockPropOverrides.set('button-1:variant', 'ghost');
      mockPropOverrides.set('button-1:size', 'lg');
      mockStyleOverrides.set('button-1', { color: 'red' });

      const result = await resetPropsTool.execute({
        componentId: 'button-1',
      });

      expect(result.success).toBe(true);
      expect(mockStyleOverrides.has('button-1')).toBe(false);
      expect(mockPropOverrides.has('button-1:variant')).toBe(false);
      expect(mockPropOverrides.has('button-1:size')).toBe(false);
    });
  });

  describe('getTreeTool', () => {
    it('should return the full component tree', async () => {
      const result = await getTreeTool.execute({});

      expect(result.root).toBe('container-1');
      expect(result.elements).toBeDefined();
      expect(Object.keys(result.elements)).toContain('button-1');
    });

    it('should return subtree when componentId is specified', async () => {
      const result = await getTreeTool.execute({
        componentId: 'button-1',
      });

      expect(result.root).toBe('button-1');
      // Should include the element and potentially its children
    });
  });

  describe('listPropsTool', () => {
    it('should list available props for a component type', async () => {
      const result = await listPropsTool.execute({
        componentType: 'Button',
      });

      expect(result.props).toHaveLength(4);
      expect(result.props.map((p: { name: string }) => p.name)).toContain('variant');
      expect(result.props.map((p: { name: string }) => p.name)).toContain('size');
    });

    it('should return empty array for unknown component type', async () => {
      const result = await listPropsTool.execute({
        componentType: 'UnknownComponent',
      });

      expect(result.props).toEqual([]);
    });
  });

  describe('exportCodeTool', () => {
    it('should export source code for a component', async () => {
      const result = await exportCodeTool.execute({
        componentId: 'button-1',
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('Button');
      expect(result.code).toContain('variant="primary"');
    });

    it('should return error for unknown component', async () => {
      const result = await exportCodeTool.execute({
        componentId: 'unknown-component',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

// =============================================================================
// Context Management Tests
// =============================================================================

describe('Design Tools Context', () => {
  afterEach(() => {
    clearDesignToolsContext();
  });

  it('should throw when context is not set', async () => {
    await expect(getTreeTool.execute({})).rejects.toThrow(
      /context not set/i
    );
  });

  it('should work after context is set', async () => {
    setDesignToolsContext(createMockContext());
    const result = await getTreeTool.execute({});
    expect(result.root).toBeDefined();
  });

  it('should throw after context is cleared', async () => {
    setDesignToolsContext(createMockContext());
    clearDesignToolsContext();
    await expect(getTreeTool.execute({})).rejects.toThrow(
      /context not set/i
    );
  });
});

// =============================================================================
// Tool Collection Tests
// =============================================================================

describe('Design Tools Collection', () => {
  it('should export all required tools', () => {
    expect(designTools).toHaveProperty('update_styles');
    expect(designTools).toHaveProperty('set_token');
    expect(designTools).toHaveProperty('toggle_variant');
    expect(designTools).toHaveProperty('set_prop');
    expect(designTools).toHaveProperty('reset_props');
    expect(designTools).toHaveProperty('get_tree');
    expect(designTools).toHaveProperty('list_props');
    expect(designTools).toHaveProperty('export_code');
  });

  it('should have consistent tool structure', () => {
    for (const [name, tool] of Object.entries(designTools)) {
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      expect(tool).toHaveProperty('execute');
      expect(typeof (tool as { description: string }).description).toBe('string');
      expect(typeof (tool as { execute: Function }).execute).toBe('function');
    }
  });
});
