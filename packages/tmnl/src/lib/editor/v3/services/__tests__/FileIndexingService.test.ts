/**
 * FileIndexingService Tests
 *
 * Comprehensive test suite proving efficient traversal and indexing of markdown files.
 *
 * Test Categories:
 * 1. Directory Traversal (recursive, depth limits, exclusions)
 * 2. File Discovery (extension filtering, pattern matching)
 * 3. File Indexing (parsing, metadata extraction)
 * 4. Batch Indexing (concurrency, progress, metrics)
 * 5. Performance (timing, throughput)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Effect, Layer, Chunk, Stream } from 'effect';
import { WebSocket } from 'ws';

import {
  FileIndexingService,
  FileIndexingError,
  TraversalError,
  type DiscoveredFile,
  type IndexedFile,
  type IndexingProgress,
  type IndexingResult,
} from '../FileIndexingService';
import {
  FileDocumentMappingService,
  type FilePath,
} from '../FileDocumentMappingService';
import { MarkdownService } from '../MarkdownService';
import {
  FileAccessService,
  type FileAccessImpl,
} from '@/lib/file-browser/services/FileAccessService';
import { FileEntry, FileMetadata } from '@/lib/file-browser/schemas';
import { NatsKVService } from '@/lib/nats/NatsKVService';

// =============================================================================
// WebSocket polyfill for Node.js
// =============================================================================

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
    WebSocket;
}

// =============================================================================
// Test Fixtures: Mock File System
// =============================================================================

/**
 * In-memory file system for testing.
 * Structure:
 * /project
 *   /docs
 *     README.md
 *     guide.md
 *     /api
 *       endpoints.md
 *       authentication.md
 *   /src
 *     index.ts (not .md, should be ignored)
 *     /components
 *       Button.tsx (not .md)
 *   /notes
 *     daily.md
 *     .hidden.md (hidden file)
 *   /node_modules (should be excluded)
 *     /some-package
 *       README.md (should NOT be indexed)
 *   /.git (should be excluded)
 *     config
 *   CHANGELOG.md
 *   TODO.markdown
 */
interface MockFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
  content?: string;
  modifiedAt: number;
  hidden: boolean;
}

const NOW = Date.now();
const HOUR = 3600000;
const DAY = 86400000;

const MOCK_FILES: MockFile[] = [
  // Root
  {
    path: '/project',
    name: 'project',
    type: 'directory',
    size: 0,
    modifiedAt: NOW,
    hidden: false,
  },
  {
    path: '/project/CHANGELOG.md',
    name: 'CHANGELOG.md',
    type: 'file',
    size: 2048,
    modifiedAt: NOW - DAY,
    hidden: false,
    content: '# Changelog\n\n## v1.0.0\n\n- Initial release\n- Added features',
  },
  {
    path: '/project/TODO.markdown',
    name: 'TODO.markdown',
    type: 'file',
    size: 512,
    modifiedAt: NOW - HOUR,
    hidden: false,
    content: '# TODO\n\n- [ ] First task\n- [x] Completed task',
  },

  // /docs
  {
    path: '/project/docs',
    name: 'docs',
    type: 'directory',
    size: 0,
    modifiedAt: NOW,
    hidden: false,
  },
  {
    path: '/project/docs/README.md',
    name: 'README.md',
    type: 'file',
    size: 4096,
    modifiedAt: NOW - 2 * DAY,
    hidden: false,
    content:
      '# Documentation\n\nWelcome to the docs.\n\n## Getting Started\n\nRead the [guide](./guide.md) first.\n\n## API Reference\n\nSee [API docs](./api/endpoints.md).',
  },
  {
    path: '/project/docs/guide.md',
    name: 'guide.md',
    type: 'file',
    size: 8192,
    modifiedAt: NOW - 3 * DAY,
    hidden: false,
    content:
      '# User Guide\n\n## Installation\n\nRun `npm install`.\n\n## Configuration\n\nCreate a config file.\n\n## Usage\n\nImport and use:\n\n```js\nimport { thing } from "package";\n```',
  },

  // /docs/api
  {
    path: '/project/docs/api',
    name: 'api',
    type: 'directory',
    size: 0,
    modifiedAt: NOW,
    hidden: false,
  },
  {
    path: '/project/docs/api/endpoints.md',
    name: 'endpoints.md',
    type: 'file',
    size: 3072,
    modifiedAt: NOW - 4 * DAY,
    hidden: false,
    content:
      '# API Endpoints\n\n## GET /users\n\nReturns list of users.\n\n## POST /users\n\nCreates a new user.',
  },
  {
    path: '/project/docs/api/authentication.md',
    name: 'authentication.md',
    type: 'file',
    size: 2560,
    modifiedAt: NOW - 5 * DAY,
    hidden: false,
    content:
      '# Authentication\n\nUse Bearer tokens.\n\n## Getting a Token\n\nPOST to `/auth/login`.\n\n## Using the Token\n\nAdd header: `Authorization: Bearer <token>`',
  },

  // /src (non-markdown files)
  {
    path: '/project/src',
    name: 'src',
    type: 'directory',
    size: 0,
    modifiedAt: NOW,
    hidden: false,
  },
  {
    path: '/project/src/index.ts',
    name: 'index.ts',
    type: 'file',
    size: 1024,
    modifiedAt: NOW,
    hidden: false,
    content: 'export * from "./components";',
  },
  {
    path: '/project/src/components',
    name: 'components',
    type: 'directory',
    size: 0,
    modifiedAt: NOW,
    hidden: false,
  },
  {
    path: '/project/src/components/Button.tsx',
    name: 'Button.tsx',
    type: 'file',
    size: 2048,
    modifiedAt: NOW,
    hidden: false,
    content: 'export function Button() {}',
  },

  // /notes
  {
    path: '/project/notes',
    name: 'notes',
    type: 'directory',
    size: 0,
    modifiedAt: NOW,
    hidden: false,
  },
  {
    path: '/project/notes/daily.md',
    name: 'daily.md',
    type: 'file',
    size: 1536,
    modifiedAt: NOW - HOUR,
    hidden: false,
    content:
      '# Daily Notes\n\n## 2024-01-15\n\nWorked on feature X.\n\n## 2024-01-14\n\nFixed bug Y.',
  },
  {
    path: '/project/notes/.hidden.md',
    name: '.hidden.md',
    type: 'file',
    size: 256,
    modifiedAt: NOW,
    hidden: true,
    content: "# Secret Notes\n\nDon't tell anyone.",
  },

  // /node_modules (should be excluded)
  {
    path: '/project/node_modules',
    name: 'node_modules',
    type: 'directory',
    size: 0,
    modifiedAt: NOW,
    hidden: false,
  },
  {
    path: '/project/node_modules/some-package',
    name: 'some-package',
    type: 'directory',
    size: 0,
    modifiedAt: NOW,
    hidden: false,
  },
  {
    path: '/project/node_modules/some-package/README.md',
    name: 'README.md',
    type: 'file',
    size: 1024,
    modifiedAt: NOW,
    hidden: false,
    content: '# Some Package\n\nThis should NOT be indexed.',
  },

  // /.git (should be excluded)
  {
    path: '/project/.git',
    name: '.git',
    type: 'directory',
    size: 0,
    modifiedAt: NOW,
    hidden: true,
  },
  {
    path: '/project/.git/config',
    name: 'config',
    type: 'file',
    size: 256,
    modifiedAt: NOW,
    hidden: false,
    content: '[core]\n\trepositoryformatversion = 0',
  },
];

/**
 * Get mock files for a directory path.
 */
const getDirectoryContents = (dirPath: string): MockFile[] => {
  return MOCK_FILES.filter((f) => {
    if (f.path === dirPath) return false; // Exclude self
    const parent = f.path.substring(0, f.path.lastIndexOf('/')) || '/';
    return parent === dirPath;
  });
};

/**
 * Get mock file by path.
 */
const getFile = (path: string): MockFile | undefined => {
  return MOCK_FILES.find((f) => f.path === path);
};

// =============================================================================
// Mock FileAccessService
// =============================================================================

const createMockFileAccess = (): FileAccessImpl => ({
  listDirectory: (path: string) =>
    Effect.sync(() => {
      const contents = getDirectoryContents(path);
      return contents.map(
        (f) =>
          new FileEntry({
            id: f.path,
            name: f.name,
            path: f.path,
            type: f.type,
            size: f.size,
            mimeType: f.type === 'file' ? 'text/markdown' : null,
            extension: f.name.includes('.')
              ? f.name.split('.').pop() ?? null
              : null,
            permissions: { readable: true, writable: true, executable: false },
            hidden: f.hidden,
            createdAt: f.modifiedAt - DAY,
            modifiedAt: f.modifiedAt,
            accessedAt: NOW,
          })
      );
    }),

  readFile: (path: string) =>
    Effect.sync(() => {
      const file = getFile(path);
      if (!file || file.type !== 'file') {
        throw new Error(`File not found: ${path}`);
      }
      return new TextEncoder().encode(file.content ?? '');
    }),

  readFileText: (path: string) =>
    Effect.sync(() => {
      const file = getFile(path);
      if (!file || file.type !== 'file') {
        throw new Error(`File not found: ${path}`);
      }
      return file.content ?? '';
    }),

  writeFile: (_path: string, _data: Uint8Array) => Effect.void,

  deleteFile: (_path: string, _recursive?: boolean) => Effect.void,

  createDirectory: (_path: string) => Effect.void,

  exists: (path: string) =>
    Effect.sync(() => MOCK_FILES.some((f) => f.path === path)),

  getMetadata: (path: string) =>
    Effect.sync(() => {
      const file = getFile(path);
      if (!file) {
        throw new Error(`File not found: ${path}`);
      }
      return new FileMetadata({
        path: file.path,
        size: file.size,
        createdAt: file.modifiedAt - DAY,
        modifiedAt: file.modifiedAt,
        accessedAt: NOW,
        mode: 0o644,
        uid: 1000,
        gid: 1000,
        inode: Math.abs(hashCode(file.path)),
        device: 1,
        nlink: 1,
        blockSize: 4096,
        blocks: Math.ceil(file.size / 512),
        readonly: false,
        isSymlink: false,
        symlinkTarget: null,
        hash: null,
        encryption: { status: 'none', algorithm: null, keyId: null },
        structure: null,
        magicBytes: null,
      });
    }),

  rename: (_source: string, _dest: string) => Effect.void,

  copy: (_source: string, _dest: string) => Effect.void,
});

// Simple string hash for inode
const hashCode = (s: string): number => {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
};

// =============================================================================
// Test Layer Setup
// =============================================================================

const runId = `test-${Date.now()}`;

/**
 * Creates a test layer with mocked FileAccessService and real NATS.
 *
 * Layer dependency chain:
 * - FileIndexingService depends on: FileAccessService, MarkdownService, FileDocumentMappingService
 * - FileDocumentMappingService depends on: NatsKVService
 *
 * We build from the bottom up:
 * 1. NatsKVService (leaf dependency)
 * 2. MockFileAccess + MarkdownService (leaf dependencies)
 * 3. FileDocumentMappingService (depends on NatsKVService)
 * 4. FileIndexingService (depends on all above)
 */
const createTestLayer = () => {
  // Mock FileAccessService implementation
  const MockFileAccessLayer = Layer.succeed(
    FileAccessService,
    createMockFileAccess()
  );

  // Base dependencies layer (leaf services)
  const BaseDependencies = Layer.mergeAll(
    MockFileAccessLayer,
    MarkdownService.Default,
    NatsKVService.Default
  );

  // FileDocumentMappingService needs NatsKVService
  const MappingLayer = FileDocumentMappingService.Default.pipe(
    Layer.provide(NatsKVService.Default)
  );

  // FileIndexingService needs all dependencies
  const IndexingLayer = FileIndexingService.Default.pipe(
    Layer.provide(
      Layer.mergeAll(MockFileAccessLayer, MarkdownService.Default, MappingLayer)
    )
  );

  // Final layer exports FileIndexingService with all deps satisfied
  return IndexingLayer;
};

const TestLayer = createTestLayer();

const runTest = <A, E>(effect: Effect.Effect<A, E, FileIndexingService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

// =============================================================================
// Test Suite
// =============================================================================

describe('FileIndexingService', () => {
  // ---------------------------------------------------------------------------
  // 1. Directory Traversal Tests
  // ---------------------------------------------------------------------------
  describe('traverse', () => {
    it('discovers all markdown files recursively', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const stream = service.traverse('/project' as FilePath);
          const discovered = yield* Stream.runCollect(stream);
          const files = Chunk.toReadonlyArray(discovered);

          // Should find: CHANGELOG.md, TODO.markdown, README.md, guide.md,
          // endpoints.md, authentication.md, daily.md
          // Should NOT find: .hidden.md (hidden), node_modules/*, .git/*
          expect(files.length).toBe(7);

          const paths = files.map((f) => f.path);
          expect(paths).toContain('/project/CHANGELOG.md');
          expect(paths).toContain('/project/TODO.markdown');
          expect(paths).toContain('/project/docs/README.md');
          expect(paths).toContain('/project/docs/guide.md');
          expect(paths).toContain('/project/docs/api/endpoints.md');
          expect(paths).toContain('/project/docs/api/authentication.md');
          expect(paths).toContain('/project/notes/daily.md');

          // Verify exclusions
          expect(paths).not.toContain('/project/notes/.hidden.md');
          expect(paths).not.toContain(
            '/project/node_modules/some-package/README.md'
          );
        })
      );
    });

    it('respects maxDepth option', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;

          // Depth 0 = only root level
          const depth0 = yield* service.discoverFiles('/project' as FilePath, {
            maxDepth: 0,
          });
          expect(depth0.length).toBe(2); // CHANGELOG.md, TODO.markdown

          // Depth 1 = root + one level down
          const depth1 = yield* service.discoverFiles('/project' as FilePath, {
            maxDepth: 1,
          });
          expect(depth1.length).toBe(5); // +README.md, guide.md, daily.md
        })
      );
    });

    it('can include hidden files', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const files = yield* service.discoverFiles('/project' as FilePath, {
            includeHidden: true,
          });

          const paths = files.map((f) => f.path);
          expect(paths).toContain('/project/notes/.hidden.md');
        })
      );
    });

    it('filters by custom extensions', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;

          // Only .md, not .markdown
          const mdOnly = yield* service.discoverFiles('/project' as FilePath, {
            extensions: ['.md'],
          });

          const paths = mdOnly.map((f) => f.path);
          expect(paths).toContain('/project/CHANGELOG.md');
          expect(paths).not.toContain('/project/TODO.markdown');
        })
      );
    });

    it('includes file metadata (size, modifiedAt, depth)', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const files = yield* service.discoverFiles('/project' as FilePath);

          const changelog = files.find(
            (f) => f.path === '/project/CHANGELOG.md'
          );
          expect(changelog).toBeDefined();
          expect(changelog!.size).toBe(2048);
          expect(changelog!.depth).toBe(0);
          expect(changelog!.modifiedAt).toBe(NOW - DAY);

          const endpoints = files.find(
            (f) => f.path === '/project/docs/api/endpoints.md'
          );
          expect(endpoints).toBeDefined();
          expect(endpoints!.depth).toBe(2);
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 2. File Indexing Tests
  // ---------------------------------------------------------------------------
  describe('indexFile', () => {
    it('indexes a single file and extracts metadata', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const indexed = yield* service.indexFile(
            '/project/docs/README.md' as FilePath
          );

          expect(indexed.path).toBe('/project/docs/README.md');
          expect(indexed.markdown).toContain('# Documentation');
          expect(indexed.wordCount).toBeGreaterThan(10);
          expect(indexed.headings).toContain('Documentation');
          expect(indexed.headings).toContain('Getting Started');
          expect(indexed.headings).toContain('API Reference');
          expect(indexed.links.length).toBe(2);
          expect(indexed.links).toContain('./guide.md');
          expect(indexed.links).toContain('./api/endpoints.md');
          expect(indexed.parseTimeMs).toBeGreaterThan(0);
          expect(indexed.indexedAt).toBeInstanceOf(Date);
        })
      );
    });

    it('creates mapping for indexed file', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const path = `/project/docs/guide-${runId}.md` as FilePath;

          // Mock doesn't have this file, but we can test mapping creation
          // by using an existing file
          const indexed = yield* service.indexFile(
            '/project/docs/guide.md' as FilePath,
            true
          );

          expect(indexed.mapping).toBeDefined();
          expect(indexed.mapping.documentId).toMatch(/^doc-/);
          expect(indexed.mapping.syncStatus).toBe('synced');
        })
      );
    });

    it('extracts word count accurately (strips code blocks)', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const indexed = yield* service.indexFile(
            '/project/docs/guide.md' as FilePath,
            true
          );

          // guide.md has a code block - verify word count doesn't include code
          // Content: "# User Guide\n\n## Installation\n\nRun `npm install`.\n\n## Configuration\n\nCreate a config file.\n\n## Usage\n\nImport and use:\n\n```js\nimport { thing } from \"package\";\n```"
          // Expected words: User, Guide, Installation, Run, npm, install, Configuration, Create, a, config, file, Usage, Import, and, use = ~13 words (code block stripped)
          expect(indexed.wordCount).toBeGreaterThan(10);
          expect(indexed.wordCount).toBeLessThan(25); // Not counting code block
        })
      );
    });

    it('parses markdown to valid JSONContent', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const indexed = yield* service.indexFile(
            '/project/CHANGELOG.md' as FilePath,
            true
          );

          expect(indexed.json).toBeDefined();
          expect(indexed.json.type).toBe('doc');
          expect(indexed.json.content).toBeInstanceOf(Array);
          expect(indexed.json.content!.length).toBeGreaterThan(0);
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Batch Indexing Tests
  // ---------------------------------------------------------------------------
  describe('indexDirectory', () => {
    it('indexes all files in directory via stream', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const stream = service.indexDirectory('/project' as FilePath, {
            forceReindex: true,
          });
          const indexed = yield* Stream.runCollect(stream);
          const files = Chunk.toReadonlyArray(indexed);

          expect(files.length).toBe(7);
          files.forEach((f) => {
            expect(f.mapping).toBeDefined();
            expect(f.json).toBeDefined();
            expect(f.wordCount).toBeGreaterThan(0);
          });
        })
      );
    });

    it('respects concurrency option', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;

          // Low concurrency should still work
          const stream = service.indexDirectory('/project' as FilePath, {
            concurrency: 1,
            forceReindex: true,
          });
          const indexed = yield* Stream.runCollect(stream);

          expect(Chunk.size(indexed)).toBe(7);
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Full Indexing with Results & Metrics
  // ---------------------------------------------------------------------------
  describe('indexDirectoryWithResult', () => {
    it('returns comprehensive indexing result', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const result = yield* service.indexDirectoryWithResult(
            '/project' as FilePath,
            {
              forceReindex: true,
            }
          );

          expect(result.rootPath).toBe('/project');
          expect(result.filesDiscovered).toBe(7);
          expect(result.filesIndexed).toBe(7);
          expect(result.filesSkipped).toBe(0);
          expect(result.filesErrored).toBe(0);
          expect(result.totalBytes).toBeGreaterThan(0);
          expect(result.totalWords).toBeGreaterThan(50);
          expect(result.elapsedMs).toBeGreaterThan(0);
          expect(result.throughputFilesPerSec).toBeGreaterThan(0);
          expect(result.throughputBytesPerSec).toBeGreaterThan(0);
          expect(result.errors.length).toBe(0);
        })
      );
    });

    it('tracks progress during indexing', async () => {
      const progressEvents: IndexingProgress[] = [];

      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          yield* service.indexDirectoryWithResult(
            '/project' as FilePath,
            { forceReindex: true },
            (progress) => progressEvents.push(progress)
          );
        })
      );

      expect(progressEvents.length).toBeGreaterThan(0);

      // First event should be 'indexing' phase
      const firstIndexing = progressEvents.find((p) => p.phase === 'indexing');
      expect(firstIndexing).toBeDefined();

      // Last event should be 'complete'
      const lastEvent = progressEvents[progressEvents.length - 1];
      expect(lastEvent.phase).toBe('complete');
      expect(lastEvent.filesIndexed).toBe(7);
    });

    it('provides estimated remaining time', async () => {
      const progressEvents: IndexingProgress[] = [];

      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          yield* service.indexDirectoryWithResult(
            '/project' as FilePath,
            { forceReindex: true, concurrency: 1 }, // Low concurrency to get more events
            (progress) => progressEvents.push(progress)
          );
        })
      );

      // After at least one file is indexed, we should have estimates
      const midProgress = progressEvents.find(
        (p) => p.filesIndexed > 0 && p.filesIndexed < 7
      );
      if (midProgress) {
        expect(midProgress.estimatedRemainingMs).not.toBeNull();
        expect(midProgress.estimatedRemainingMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Performance Tests
  // ---------------------------------------------------------------------------
  describe('performance', () => {
    it('indexes 7 files in under 2 seconds', async () => {
      const startTime = performance.now();

      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          yield* service.indexDirectoryWithResult('/project' as FilePath, {
            forceReindex: true,
          });
        })
      );

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(2000);
    });

    it('reports reasonable throughput metrics', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const result = yield* service.indexDirectoryWithResult(
            '/project' as FilePath,
            {
              forceReindex: true,
            }
          );

          // Should process at least 1 file per second
          expect(result.throughputFilesPerSec).toBeGreaterThan(1);

          // Should process at least 1KB per second
          expect(result.throughputBytesPerSec).toBeGreaterThan(1000);
        })
      );
    });

    it('traversal alone is fast (under 100ms for 7 files)', async () => {
      const startTime = performance.now();

      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          yield* service.discoverFiles('/project' as FilePath);
        })
      );

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(100);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Edge Cases & Error Handling
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles empty directory gracefully', async () => {
      // src/components has no .md files
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const files = yield* service.discoverFiles(
            '/project/src' as FilePath
          );

          expect(files.length).toBe(0);
        })
      );
    });

    it('excludes node_modules by default', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const files = yield* service.discoverFiles('/project' as FilePath);

          const nodeModulesFiles = files.filter((f) =>
            f.path.includes('node_modules')
          );
          expect(nodeModulesFiles.length).toBe(0);
        })
      );
    });

    it('excludes .git by default', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;
          const files = yield* service.discoverFiles('/project' as FilePath, {
            includeHidden: true, // Even with hidden enabled
          });

          const gitFiles = files.filter((f) => f.path.includes('.git/'));
          expect(gitFiles.length).toBe(0);
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Stats Endpoint
  // ---------------------------------------------------------------------------
  describe('getStats', () => {
    it('returns accurate statistics after indexing', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* FileIndexingService;

          // Index first
          yield* service.indexDirectoryWithResult('/project' as FilePath, {
            forceReindex: true,
          });

          // Get stats
          const stats = yield* service.getStats('/project' as FilePath);

          expect(stats.totalFiles).toBe(7);
          expect(stats.indexedFiles).toBeGreaterThan(0);
          expect(stats.lastIndexedAt).toBeInstanceOf(Date);
        })
      );
    });
  });
});
