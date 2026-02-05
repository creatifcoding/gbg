/**
 * File Tools Tests
 *
 * TDD tests for AI SDK file manipulation tools.
 * Tests schema validation, tool execution, and context management.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Schema } from 'effect';

// Import tools (will fail until implemented)
import {
  // Context management
  setFileToolsContext,
  clearFileToolsContext,
  type FileToolsContext,
  // Tool schemas
  EditFileInputSchema,
  ReadFileInputSchema,
  ListFilesInputSchema,
  SearchFilesInputSchema,
  // Tools
  editFileTool,
  readFileTool,
  listFilesTool,
  searchFilesTool,
  // Tool collection
  fileTools,
} from '../file-tools';

// =============================================================================
// Test Fixtures
// =============================================================================

const mockFileSystem: Record<string, string> = {
  'src/components/Button.tsx': `import * as React from 'react';

export interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children }: ButtonProps) {
  return <button className={variant}>{children}</button>;
}
`,
  'src/components/Text.tsx': `import * as React from 'react';

export interface TextProps {
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Text({ size = 'md', children }: TextProps) {
  return <span className={\`text-\${size}\`}>{children}</span>;
}
`,
  'src/styles/tokens.css': `:root {
  --tmnl-color-primary: #3b82f6;
  --tmnl-color-secondary: #64748b;
  --tmnl-spacing-sm: 8px;
  --tmnl-spacing-md: 16px;
}
`,
};

const mockFileList = [
  'src/components/Button.tsx',
  'src/components/Text.tsx',
  'src/styles/tokens.css',
];

function createMockContext(): FileToolsContext {
  return {
    readFile: async (path) => {
      if (mockFileSystem[path]) {
        return { success: true, content: mockFileSystem[path] };
      }
      return { success: false, error: `File not found: ${path}` };
    },
    writeFile: async (path, content) => {
      mockFileSystem[path] = content;
      return { success: true };
    },
    editFile: async (path, oldContent, newContent) => {
      if (!mockFileSystem[path]) {
        return { success: false, error: `File not found: ${path}` };
      }
      if (!mockFileSystem[path].includes(oldContent)) {
        return { success: false, error: `Old content not found in file` };
      }
      mockFileSystem[path] = mockFileSystem[path].replace(oldContent, newContent);
      return { success: true };
    },
    listFiles: async (pattern) => {
      // Simple glob matching
      const regex = new RegExp(
        pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '.')
      );
      return mockFileList.filter((f) => regex.test(f));
    },
    searchFiles: async (query, options) => {
      const results: Array<{ path: string; line: number; content: string }> = [];
      for (const [path, content] of Object.entries(mockFileSystem)) {
        // Apply path filter if specified
        if (options?.path && !path.startsWith(options.path)) continue;

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(query)) {
            results.push({ path, line: i + 1, content: lines[i] });
          }
        }
      }
      return results;
    },
  };
}

// =============================================================================
// Schema Validation Tests
// =============================================================================

describe('File Tools Schemas', () => {
  describe('EditFileInputSchema', () => {
    it('should validate valid input with oldString/newString', () => {
      const input = {
        path: 'src/components/Button.tsx',
        oldString: "variant = 'primary'",
        newString: "variant = 'secondary'",
      };
      const result = Schema.decodeUnknownSync(EditFileInputSchema)(input);
      expect(result.path).toBe('src/components/Button.tsx');
      expect(result.oldString).toBe("variant = 'primary'");
      expect(result.newString).toBe("variant = 'secondary'");
    });

    it('should reject missing path', () => {
      const input = {
        oldString: "variant = 'primary'",
        newString: "variant = 'secondary'",
      };
      expect(() => Schema.decodeUnknownSync(EditFileInputSchema)(input)).toThrow();
    });

    it('should reject missing oldString', () => {
      const input = {
        path: 'src/components/Button.tsx',
        newString: "variant = 'secondary'",
      };
      expect(() => Schema.decodeUnknownSync(EditFileInputSchema)(input)).toThrow();
    });

    it('should reject missing newString', () => {
      const input = {
        path: 'src/components/Button.tsx',
        oldString: "variant = 'primary'",
      };
      expect(() => Schema.decodeUnknownSync(EditFileInputSchema)(input)).toThrow();
    });

    it('should validate with replaceAll option', () => {
      const input = {
        path: 'src/components/Button.tsx',
        oldString: 'variant',
        newString: 'style',
        replaceAll: true,
      };
      const result = Schema.decodeUnknownSync(EditFileInputSchema)(input);
      expect(result.replaceAll).toBe(true);
    });
  });

  describe('ReadFileInputSchema', () => {
    it('should validate valid input', () => {
      const input = { path: 'src/components/Button.tsx' };
      const result = Schema.decodeUnknownSync(ReadFileInputSchema)(input);
      expect(result.path).toBe('src/components/Button.tsx');
    });

    it('should validate with line range options', () => {
      const input = {
        path: 'src/components/Button.tsx',
        startLine: 5,
        endLine: 10,
      };
      const result = Schema.decodeUnknownSync(ReadFileInputSchema)(input);
      expect(result.startLine).toBe(5);
      expect(result.endLine).toBe(10);
    });
  });

  describe('ListFilesInputSchema', () => {
    it('should validate glob pattern', () => {
      const input = { pattern: 'src/**/*.tsx' };
      const result = Schema.decodeUnknownSync(ListFilesInputSchema)(input);
      expect(result.pattern).toBe('src/**/*.tsx');
    });

    it('should validate with path filter', () => {
      const input = { pattern: '*.tsx', path: 'src/components' };
      const result = Schema.decodeUnknownSync(ListFilesInputSchema)(input);
      expect(result.path).toBe('src/components');
    });
  });

  describe('SearchFilesInputSchema', () => {
    it('should validate search query', () => {
      const input = { query: 'ButtonProps' };
      const result = Schema.decodeUnknownSync(SearchFilesInputSchema)(input);
      expect(result.query).toBe('ButtonProps');
    });

    it('should validate with options', () => {
      const input = {
        query: 'interface',
        path: 'src/components',
        caseSensitive: false,
        maxResults: 10,
      };
      const result = Schema.decodeUnknownSync(SearchFilesInputSchema)(input);
      expect(result.path).toBe('src/components');
      expect(result.caseSensitive).toBe(false);
      expect(result.maxResults).toBe(10);
    });
  });
});

// =============================================================================
// Tool Execution Tests
// =============================================================================

describe('File Tools Execution', () => {
  beforeEach(() => {
    // Reset mock file system
    mockFileSystem['src/components/Button.tsx'] = `import * as React from 'react';

export interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children }: ButtonProps) {
  return <button className={variant}>{children}</button>;
}
`;
    setFileToolsContext(createMockContext());
  });

  afterEach(() => {
    clearFileToolsContext();
  });

  describe('editFileTool', () => {
    it('should edit file content', async () => {
      const result = await editFileTool.execute({
        path: 'src/components/Button.tsx',
        oldString: "variant = 'primary'",
        newString: "variant = 'secondary'",
      });

      expect(result.success).toBe(true);
      expect(mockFileSystem['src/components/Button.tsx']).toContain(
        "variant = 'secondary'"
      );
    });

    it('should fail for non-existent file', async () => {
      const result = await editFileTool.execute({
        path: 'src/components/NonExistent.tsx',
        oldString: 'foo',
        newString: 'bar',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when old content not found', async () => {
      const result = await editFileTool.execute({
        path: 'src/components/Button.tsx',
        oldString: 'this string does not exist',
        newString: 'replacement',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('readFileTool', () => {
    it('should read file content', async () => {
      const result = await readFileTool.execute({
        path: 'src/components/Button.tsx',
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('ButtonProps');
    });

    it('should fail for non-existent file', async () => {
      const result = await readFileTool.execute({
        path: 'src/components/NonExistent.tsx',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('listFilesTool', () => {
    it('should list files matching pattern', async () => {
      const result = await listFilesTool.execute({
        pattern: '**/*.tsx',
      });

      expect(result.files).toContain('src/components/Button.tsx');
      expect(result.files).toContain('src/components/Text.tsx');
      expect(result.files).not.toContain('src/styles/tokens.css');
    });

    it('should list all files with wildcard', async () => {
      const result = await listFilesTool.execute({
        pattern: '**/*',
      });

      expect(result.files.length).toBe(3);
    });
  });

  describe('searchFilesTool', () => {
    it('should search for content across files', async () => {
      const result = await searchFilesTool.execute({
        query: 'interface',
      });

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.some((m: { path: string }) => m.path.includes('Button'))).toBe(true);
    });

    it('should filter by path', async () => {
      const result = await searchFilesTool.execute({
        query: 'color',
        path: 'src/styles',
      });

      expect(result.matches.every((m: { path: string }) => m.path.startsWith('src/styles'))).toBe(true);
    });

    it('should return empty for no matches', async () => {
      const result = await searchFilesTool.execute({
        query: 'this string does not exist anywhere',
      });

      expect(result.matches).toEqual([]);
    });
  });
});

// =============================================================================
// Context Management Tests
// =============================================================================

describe('File Tools Context', () => {
  afterEach(() => {
    clearFileToolsContext();
  });

  it('should throw when context is not set', async () => {
    await expect(
      readFileTool.execute({ path: 'any-file.ts' })
    ).rejects.toThrow(/context not set/i);
  });

  it('should work after context is set', async () => {
    setFileToolsContext(createMockContext());
    const result = await readFileTool.execute({
      path: 'src/components/Button.tsx',
    });
    expect(result.success).toBe(true);
  });

  it('should throw after context is cleared', async () => {
    setFileToolsContext(createMockContext());
    clearFileToolsContext();
    await expect(
      readFileTool.execute({ path: 'any-file.ts' })
    ).rejects.toThrow(/context not set/i);
  });
});

// =============================================================================
// Tool Collection Tests
// =============================================================================

describe('File Tools Collection', () => {
  it('should export all required tools', () => {
    expect(fileTools).toHaveProperty('edit_file');
    expect(fileTools).toHaveProperty('read_file');
    expect(fileTools).toHaveProperty('list_files');
    expect(fileTools).toHaveProperty('search_files');
  });

  it('should have consistent tool structure', () => {
    for (const [name, tool] of Object.entries(fileTools)) {
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      expect(tool).toHaveProperty('execute');
      expect(typeof (tool as { description: string }).description).toBe('string');
      expect(typeof (tool as { execute: Function }).execute).toBe('function');
    }
  });
});
