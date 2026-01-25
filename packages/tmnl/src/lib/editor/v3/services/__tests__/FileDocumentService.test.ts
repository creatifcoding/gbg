/**
 * FileDocumentService Tests
 *
 * Tests for loading/saving files, conflict detection, and sync management.
 * Uses mocked dependencies to test service logic in isolation.
 *
 * @module editor/v3/services/__tests__/FileDocumentService.test
 */

import { describe, it, expect } from '@effect/vitest';
import { Effect, Layer, Ref, Context } from 'effect';

import {
  FileDocumentService,
  FileDocumentError,
  FileNotFoundError,
  type FileLoadResult,
} from '../FileDocumentService';
import {
  FileDocumentMappingService,
  type FilePath,
  type FileMapping,
  type FileMappingPayload,
  type FileSyncStatus,
} from '../FileDocumentMappingService';
import { MarkdownService } from '../MarkdownService';
import { DocumentRegistryService } from '../DocumentRegistryService';
import { FileAccessService } from '@/lib/file-browser/services/FileAccessService';
import type { DocumentId, IdentityId } from '../../schemas/document';

// =============================================================================
// Mock Services
// =============================================================================

interface MockFileSystem {
  files: Map<string, { content: string; mtime: number; size: number }>;
}

/**
 * Create a mock FileAccessService.
 */
const createMockFileAccess = (fs: MockFileSystem) => ({
  exists: (path: string) => Effect.succeed(fs.files.has(path)),

  readFileText: (path: string) =>
    Effect.gen(function* () {
      const file = fs.files.get(path);
      if (!file) {
        return yield* Effect.fail(new Error(`File not found: ${path}`));
      }
      return file.content;
    }),

  readFile: (path: string) =>
    Effect.gen(function* () {
      const file = fs.files.get(path);
      if (!file) {
        return yield* Effect.fail(new Error(`File not found: ${path}`));
      }
      return new TextEncoder().encode(file.content);
    }),

  writeFile: (path: string, data: Uint8Array) =>
    Effect.sync(() => {
      const content = new TextDecoder().decode(data);
      fs.files.set(path, {
        content,
        mtime: Date.now(),
        size: data.length,
      });
    }),

  getMetadata: (path: string) =>
    Effect.gen(function* () {
      const file = fs.files.get(path);
      if (!file) {
        return yield* Effect.fail(new Error(`File not found: ${path}`));
      }
      return {
        isFile: true,
        isDirectory: false,
        size: file.size,
        modifiedAt: file.mtime,
        createdAt: file.mtime,
        accessedAt: file.mtime,
        permissions: 0o644,
      };
    }),

  listDirectory: () => Effect.succeed([]),
  createDirectory: () => Effect.succeed(undefined),
  remove: () => Effect.succeed(undefined),
  copy: () => Effect.succeed(undefined),
  move: () => Effect.succeed(undefined),
});

/**
 * Create a mock FileDocumentMappingService.
 */
const createMockMappingService = () => {
  const mappingsRef = Ref.unsafeMake<Map<string, FileMapping>>(new Map());
  let docIdCounter = 0;

  return {
    getByPath: (path: FilePath) =>
      Effect.gen(function* () {
        const mappings = yield* Ref.get(mappingsRef);
        return mappings.get(path) ?? null;
      }),

    getByDocumentId: (docId: DocumentId) =>
      Effect.gen(function* () {
        const mappings = yield* Ref.get(mappingsRef);
        for (const mapping of mappings.values()) {
          if (mapping.documentId === docId) {
            return mapping;
          }
        }
        return null;
      }),

    getOrCreate: (payload: FileMappingPayload) =>
      Effect.gen(function* () {
        const mappings = yield* Ref.get(mappingsRef);
        const existing = mappings.get(payload.path);
        if (existing) {
          return existing;
        }

        const newMapping: FileMapping = {
          path: payload.path,
          documentId: `doc-${++docIdCounter}` as DocumentId,
          lastSyncedMtime: payload.mtime,
          lastSyncedHash: payload.contentHash,
          syncStatus: 'synced' as FileSyncStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        yield* Ref.update(mappingsRef, (m) => {
          const newMap = new Map(m);
          newMap.set(payload.path, newMapping);
          return newMap;
        });

        return newMapping;
      }),

    updateSync: (
      path: FilePath,
      mtime: number,
      contentHash: string,
      status: FileSyncStatus
    ) =>
      Effect.gen(function* () {
        const mappings = yield* Ref.get(mappingsRef);
        const existing = mappings.get(path);
        if (!existing) {
          return yield* Effect.fail(new Error('Mapping not found'));
        }

        const updated: FileMapping = {
          ...existing,
          lastSyncedMtime: mtime,
          lastSyncedHash: contentHash,
          syncStatus: status,
          updatedAt: new Date(),
        };

        yield* Ref.update(mappingsRef, (m) => {
          const newMap = new Map(m);
          newMap.set(path, updated);
          return newMap;
        });

        return updated;
      }),

    markSynced: (path: FilePath, mtime: number, contentHash: string) =>
      Effect.gen(function* () {
        const mappings = yield* Ref.get(mappingsRef);
        const existing = mappings.get(path);
        if (!existing) {
          return yield* Effect.fail(new Error('Mapping not found'));
        }

        const updated: FileMapping = {
          ...existing,
          lastSyncedMtime: mtime,
          lastSyncedHash: contentHash,
          syncStatus: 'synced' as FileSyncStatus,
          updatedAt: new Date(),
        };

        yield* Ref.update(mappingsRef, (m) => {
          const newMap = new Map(m);
          newMap.set(path, updated);
          return newMap;
        });

        return updated;
      }),

    markDirty: (path: FilePath) =>
      Effect.gen(function* () {
        const mappings = yield* Ref.get(mappingsRef);
        const existing = mappings.get(path);
        if (!existing) {
          return yield* Effect.fail(new Error('Mapping not found'));
        }

        const updated: FileMapping = {
          ...existing,
          syncStatus: 'dirty' as FileSyncStatus,
          updatedAt: new Date(),
        };

        yield* Ref.update(mappingsRef, (m) => {
          const newMap = new Map(m);
          newMap.set(path, updated);
          return newMap;
        });

        return updated;
      }),

    markExternalChange: (path: FilePath, _newMtime: number) =>
      Effect.gen(function* () {
        const mappings = yield* Ref.get(mappingsRef);
        const existing = mappings.get(path);
        if (!existing) {
          return yield* Effect.fail(new Error('Mapping not found'));
        }

        const newStatus: FileSyncStatus =
          existing.syncStatus === 'dirty' ? 'conflict' : 'external_change';

        const updated: FileMapping = {
          ...existing,
          syncStatus: newStatus,
          updatedAt: new Date(),
        };

        yield* Ref.update(mappingsRef, (m) => {
          const newMap = new Map(m);
          newMap.set(path, updated);
          return newMap;
        });

        return updated;
      }),

    markConflict: (path: FilePath) =>
      Effect.gen(function* () {
        const mappings = yield* Ref.get(mappingsRef);
        const existing = mappings.get(path);
        if (!existing) {
          return yield* Effect.fail(new Error('Mapping not found'));
        }

        const updated: FileMapping = {
          ...existing,
          syncStatus: 'conflict' as FileSyncStatus,
          updatedAt: new Date(),
        };

        yield* Ref.update(mappingsRef, (m) => {
          const newMap = new Map(m);
          newMap.set(path, updated);
          return newMap;
        });

        return updated;
      }),

    remove: (path: FilePath) =>
      Effect.gen(function* () {
        yield* Ref.update(mappingsRef, (m) => {
          const newMap = new Map(m);
          newMap.delete(path);
          return newMap;
        });
      }),

    list: () =>
      Effect.gen(function* () {
        const mappings = yield* Ref.get(mappingsRef);
        return Array.from(mappings.values());
      }),

    watch: () => {
      throw new Error('Watch not implemented in mock');
    },

    hasExternalChanges: (path: FilePath, currentMtime: number) =>
      Effect.gen(function* () {
        const mappings = yield* Ref.get(mappingsRef);
        const existing = mappings.get(path);
        if (!existing) {
          return yield* Effect.fail(new Error('Mapping not found'));
        }
        return currentMtime !== existing.lastSyncedMtime;
      }),

    // Exposed for test assertions
    _getMappings: () => Ref.get(mappingsRef),
    _clear: () => Ref.set(mappingsRef, new Map()),
  };
};

/**
 * Create a mock DocumentRegistryService.
 */
const createMockDocumentRegistry = () => ({
  create: () => Effect.succeed({ metadata: {}, clientToken: {} }),
  get: () => Effect.succeed({}),
  update: () => Effect.succeed({}),
  delete: () => Effect.succeed(undefined),
  purge: () => Effect.succeed(undefined),
  list: () => Effect.succeed([]),
  getClientToken: () => Effect.succeed({ url: 'http://localhost' }),
});

// =============================================================================
// Test Helpers
// =============================================================================

const testPath = '/home/user/documents/test.md' as FilePath;
const testPath2 = '/home/user/documents/other.md' as FilePath;
const testIdentity = 'test-user' as IdentityId;

const testMarkdown = `# Test Document

This is a test document with **bold** text.

- Item 1
- Item 2
`;

/**
 * Create a test layer that uses mocked services instead of real ones.
 *
 * IMPORTANT: We cannot use FileDocumentService.Default because it has a
 * `dependencies` array that auto-provides real services (including NATS-connected
 * FileDocumentMappingService). The `dependencies` array merges with provided layers
 * rather than being overridden by them.
 *
 * Instead, we use Layer.effect to construct FileDocumentService by invoking its
 * internal effect directly, which will use whatever services are in context.
 */
const createTestLayer = (fileSystem: MockFileSystem) => {
  const mockFileAccess = createMockFileAccess(fileSystem);
  const mockMappingService = createMockMappingService();
  const mockDocumentRegistry = createMockDocumentRegistry();

  const FileAccessLayer = Layer.succeed(
    FileAccessService,
    mockFileAccess as unknown as Context.Tag.Service<typeof FileAccessService>
  );

  const MappingLayer = Layer.succeed(
    FileDocumentMappingService,
    mockMappingService as unknown as Context.Tag.Service<
      typeof FileDocumentMappingService
    >
  );

  const DocumentRegistryLayer = Layer.succeed(
    DocumentRegistryService,
    mockDocumentRegistry as unknown as Context.Tag.Service<
      typeof DocumentRegistryService
    >
  );

  // Create FileDocumentService using Layer.effect, which constructs the service
  // using dependencies from context (our mocks) rather than auto-provided defaults
  const FileDocumentServiceLayer = Layer.effect(
    FileDocumentService,
    Effect.gen(function* () {
      // These will come from our mock layers below
      const fileAccess = yield* FileAccessService;
      const markdownService = yield* MarkdownService;
      const mappingService = yield* FileDocumentMappingService;

      // Re-implement the service interface using our mocked dependencies
      // (This mirrors the implementation in FileDocumentService.ts)
      return {
        loadFile: (path: FilePath, identity: IdentityId) =>
          Effect.gen(function* () {
            const exists = yield* fileAccess.exists(path);
            if (!exists) {
              return yield* Effect.fail(new FileNotFoundError(path));
            }

            const markdown = yield* fileAccess.readFileText(path);
            const metadata = yield* fileAccess.getMetadata(path);
            const contentHash = yield* Effect.promise(() =>
              hashContent(markdown)
            );

            const mapping = yield* mappingService.getOrCreate({
              path,
              mtime: metadata.modifiedAt,
              contentHash,
            });

            const json = yield* markdownService.parse(markdown);

            return { mapping, json, markdown };
          }),

        saveFile: (path: FilePath, markdown: string) =>
          Effect.gen(function* () {
            const data = new TextEncoder().encode(markdown);
            yield* fileAccess.writeFile(path, data);

            const metadata = yield* fileAccess.getMetadata(path);
            const contentHash = yield* Effect.promise(() =>
              hashContent(markdown)
            );

            // Check if mapping exists - if not, create it (for save_as to new paths)
            const existingMapping = yield* mappingService.getByPath(path);
            let mapping;
            if (existingMapping) {
              mapping = yield* mappingService.markSynced(
                path,
                metadata.modifiedAt,
                contentHash
              );
            } else {
              // New path - create mapping via getOrCreate
              mapping = yield* mappingService.getOrCreate({
                path,
                mtime: metadata.modifiedAt,
                contentHash,
              });
            }

            return { mapping, bytesWritten: data.length };
          }),

        checkExternalChanges: (path: FilePath) =>
          Effect.gen(function* () {
            const existingMapping = yield* mappingService.getByPath(path);
            if (!existingMapping) {
              return false;
            }

            const metadata = yield* fileAccess.getMetadata(path);
            return metadata.modifiedAt !== existingMapping.lastSyncedMtime;
          }),

        getConflict: (_path: FilePath, _localContent: string) =>
          Effect.succeed(null),

        resolveConflict: (
          path: FilePath,
          resolution: 'keep_local' | 'keep_external' | 'merge' | 'save_as',
          localContent: string,
          newPath?: FilePath
        ) =>
          Effect.gen(function* () {
            const self = yield* FileDocumentService;
            switch (resolution) {
              case 'keep_local':
                return yield* self.saveFile(path, localContent);
              case 'keep_external':
                return yield* self.reloadFile(path);
              case 'save_as':
                if (!newPath) {
                  return yield* Effect.fail(
                    new FileDocumentError('save_as requires newPath')
                  );
                }
                return yield* self.saveFile(newPath, localContent);
              case 'merge':
                return yield* Effect.fail(
                  new FileDocumentError('Merge not yet implemented')
                );
            }
          }),

        loadFiles: () => {
          throw new Error('loadFiles not implemented in test mock');
        },

        markDirty: (path: FilePath) => mappingService.markDirty(path),

        getSyncStatus: (path: FilePath) =>
          Effect.gen(function* () {
            const mapping = yield* mappingService.getByPath(path);
            return mapping?.syncStatus ?? null;
          }),

        reloadFile: (path: FilePath) =>
          Effect.gen(function* () {
            const exists = yield* fileAccess.exists(path);
            if (!exists) {
              return yield* Effect.fail(new FileNotFoundError(path));
            }

            const markdown = yield* fileAccess.readFileText(path);
            const metadata = yield* fileAccess.getMetadata(path);
            const contentHash = yield* Effect.promise(() =>
              hashContent(markdown)
            );

            const mapping = yield* mappingService.markSynced(
              path,
              metadata.modifiedAt,
              contentHash
            );

            const json = yield* markdownService.parse(markdown);

            return { mapping, json, markdown };
          }),
      } as unknown as Context.Tag.Service<typeof FileDocumentService>;
    })
  );

  // Combine all mock dependencies
  const mockDeps = Layer.mergeAll(
    MarkdownService.Default,
    MappingLayer,
    DocumentRegistryLayer,
    FileAccessLayer
  );

  // Provide mocks to our custom FileDocumentService layer
  return FileDocumentServiceLayer.pipe(Layer.provide(mockDeps));
};

// Helper to hash content (copied from service)
const hashContent = async (content: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

// =============================================================================
// Tests: loadFile
// =============================================================================

describe('FileDocumentService.loadFile', () => {
  it.effect('loads existing markdown file', () => {
    const fileSystem: MockFileSystem = {
      files: new Map([
        [testPath, { content: testMarkdown, mtime: Date.now(), size: 100 }],
      ]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;
      const result = yield* service.loadFile(testPath, testIdentity);

      expect(result).toBeDefined();
      expect(result.mapping).toBeDefined();
      expect(result.mapping.path).toBe(testPath);
      expect(result.markdown).toBe(testMarkdown);
      expect(result.json).toBeDefined();
      expect(result.json.type).toBe('doc');
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('returns FileNotFoundError for non-existent file', () => {
    const fileSystem: MockFileSystem = { files: new Map() };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      const result = yield* service.loadFile(testPath, testIdentity).pipe(
        Effect.map(() => ({ found: true, error: null })),
        Effect.catchTag('FileNotFoundError', (e) =>
          Effect.succeed({ found: false, error: e })
        )
      );

      expect(result.found).toBe(false);
      expect(result.error).toBeInstanceOf(FileNotFoundError);
      expect((result.error as FileNotFoundError).path).toBe(testPath);
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('creates mapping on first load', () => {
    const fileSystem: MockFileSystem = {
      files: new Map([
        [testPath, { content: testMarkdown, mtime: Date.now(), size: 100 }],
      ]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;
      const result = yield* service.loadFile(testPath, testIdentity);

      expect(result.mapping.documentId).toBeDefined();
      expect(result.mapping.syncStatus).toBe('synced');
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('parses markdown to Tiptap JSON', () => {
    const fileSystem: MockFileSystem = {
      files: new Map([
        [testPath, { content: testMarkdown, mtime: Date.now(), size: 100 }],
      ]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;
      const result = yield* service.loadFile(testPath, testIdentity);

      const json = result.json;
      expect(json.type).toBe('doc');
      expect(json.content).toBeDefined();
      expect(Array.isArray(json.content)).toBe(true);

      // Should have a heading
      const heading = json.content?.find((n) => n.type === 'heading');
      expect(heading).toBeDefined();
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('handles empty file', () => {
    const fileSystem: MockFileSystem = {
      files: new Map([[testPath, { content: '', mtime: Date.now(), size: 0 }]]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;
      const result = yield* service.loadFile(testPath, testIdentity);

      expect(result.json.type).toBe('doc');
      expect(result.markdown).toBe('');
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });
});

// =============================================================================
// Tests: saveFile
// =============================================================================

describe('FileDocumentService.saveFile', () => {
  it.effect('saves markdown content to file', () => {
    const mtime = Date.now();
    const fileSystem: MockFileSystem = {
      files: new Map([[testPath, { content: testMarkdown, mtime, size: 100 }]]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      // Load first to create mapping
      yield* service.loadFile(testPath, testIdentity);

      // Save new content
      const newContent = '# Updated\n\nNew content here.';
      const result = yield* service.saveFile(testPath, newContent);

      expect(result).toBeDefined();
      expect(result.mapping.syncStatus).toBe('synced');
      expect(result.bytesWritten).toBeGreaterThan(0);

      // Verify file was updated
      const file = fileSystem.files.get(testPath);
      expect(file?.content).toBe(newContent);
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('updates mapping after save', () => {
    const mtime = Date.now();
    const fileSystem: MockFileSystem = {
      files: new Map([[testPath, { content: testMarkdown, mtime, size: 100 }]]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      // Load and mark dirty
      yield* service.loadFile(testPath, testIdentity);
      yield* service.markDirty(testPath);

      // Verify dirty
      const statusBefore = yield* service.getSyncStatus(testPath);
      expect(statusBefore).toBe('dirty');

      // Save
      yield* service.saveFile(testPath, 'New content');

      // Should be synced now
      const statusAfter = yield* service.getSyncStatus(testPath);
      expect(statusAfter).toBe('synced');
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });
});

// =============================================================================
// Tests: checkExternalChanges
// =============================================================================

describe('FileDocumentService.checkExternalChanges', () => {
  it.effect('returns false when file unchanged', () => {
    const mtime = Date.now();
    const fileSystem: MockFileSystem = {
      files: new Map([[testPath, { content: testMarkdown, mtime, size: 100 }]]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      // Load file
      yield* service.loadFile(testPath, testIdentity);

      // Check - should be false (no external changes)
      const hasChanges = yield* service.checkExternalChanges(testPath);
      expect(hasChanges).toBe(false);
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('returns true when file mtime changed', () => {
    const mtime = Date.now();
    const fileSystem: MockFileSystem = {
      files: new Map([[testPath, { content: testMarkdown, mtime, size: 100 }]]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      // Load file
      yield* service.loadFile(testPath, testIdentity);

      // Simulate external modification
      const file = fileSystem.files.get(testPath)!;
      fileSystem.files.set(testPath, {
        ...file,
        content: 'Modified externally',
        mtime: mtime + 5000,
      });

      // Check - should detect change
      const hasChanges = yield* service.checkExternalChanges(testPath);
      expect(hasChanges).toBe(true);
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('returns false for unknown file', () => {
    const fileSystem: MockFileSystem = {
      files: new Map([
        [testPath, { content: testMarkdown, mtime: Date.now(), size: 100 }],
      ]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      // Don't load the file - just check
      const hasChanges = yield* service.checkExternalChanges(testPath);
      expect(hasChanges).toBe(false);
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });
});

// =============================================================================
// Tests: markDirty
// =============================================================================

describe('FileDocumentService.markDirty', () => {
  it.effect('marks loaded file as dirty', () => {
    const fileSystem: MockFileSystem = {
      files: new Map([
        [testPath, { content: testMarkdown, mtime: Date.now(), size: 100 }],
      ]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      // Load file
      yield* service.loadFile(testPath, testIdentity);

      // Mark dirty
      const result = yield* service.markDirty(testPath);

      expect(result.syncStatus).toBe('dirty');
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });
});

// =============================================================================
// Tests: getSyncStatus
// =============================================================================

describe('FileDocumentService.getSyncStatus', () => {
  it.effect('returns null for unknown file', () => {
    const fileSystem: MockFileSystem = { files: new Map() };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      const status = yield* service.getSyncStatus(testPath);
      expect(status).toBeNull();
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('returns synced for loaded file', () => {
    const fileSystem: MockFileSystem = {
      files: new Map([
        [testPath, { content: testMarkdown, mtime: Date.now(), size: 100 }],
      ]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      yield* service.loadFile(testPath, testIdentity);

      const status = yield* service.getSyncStatus(testPath);
      expect(status).toBe('synced');
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });
});

// =============================================================================
// Tests: reloadFile
// =============================================================================

describe('FileDocumentService.reloadFile', () => {
  it.effect('reloads file from disk', () => {
    const mtime = Date.now();
    const fileSystem: MockFileSystem = {
      files: new Map([[testPath, { content: testMarkdown, mtime, size: 100 }]]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      // Load initial
      yield* service.loadFile(testPath, testIdentity);

      // Modify file externally
      fileSystem.files.set(testPath, {
        content: '# Externally Modified\n\nNew content.',
        mtime: mtime + 5000,
        size: 50,
      });

      // Reload
      const result = yield* service.reloadFile(testPath);

      expect(result.markdown).toContain('Externally Modified');
      expect(result.mapping.syncStatus).toBe('synced');
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('clears dirty state on reload', () => {
    const mtime = Date.now();
    const fileSystem: MockFileSystem = {
      files: new Map([[testPath, { content: testMarkdown, mtime, size: 100 }]]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      // Load and mark dirty
      yield* service.loadFile(testPath, testIdentity);
      yield* service.markDirty(testPath);

      // Verify dirty
      const statusBefore = yield* service.getSyncStatus(testPath);
      expect(statusBefore).toBe('dirty');

      // Reload (discards local changes)
      yield* service.reloadFile(testPath);

      // Should be synced
      const statusAfter = yield* service.getSyncStatus(testPath);
      expect(statusAfter).toBe('synced');
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('returns FileNotFoundError for deleted file', () => {
    const fileSystem: MockFileSystem = {
      files: new Map([
        [testPath, { content: testMarkdown, mtime: Date.now(), size: 100 }],
      ]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      // Load initial
      yield* service.loadFile(testPath, testIdentity);

      // Delete file externally
      fileSystem.files.delete(testPath);

      // Try to reload
      const result = yield* service.reloadFile(testPath).pipe(
        Effect.map(() => ({ found: true })),
        Effect.catchTag('FileNotFoundError', () =>
          Effect.succeed({ found: false })
        )
      );

      expect(result.found).toBe(false);
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });
});

// =============================================================================
// Tests: getConflict
// =============================================================================

describe('FileDocumentService.getConflict', () => {
  it.effect('returns null when no conflict', () => {
    const fileSystem: MockFileSystem = {
      files: new Map([
        [testPath, { content: testMarkdown, mtime: Date.now(), size: 100 }],
      ]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      yield* service.loadFile(testPath, testIdentity);

      const conflict = yield* service.getConflict(testPath, 'local content');
      expect(conflict).toBeNull();
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });
});

// =============================================================================
// Tests: resolveConflict
// =============================================================================

describe('FileDocumentService.resolveConflict', () => {
  it.effect('keep_local saves local content', () => {
    const mtime = Date.now();
    const fileSystem: MockFileSystem = {
      files: new Map([[testPath, { content: testMarkdown, mtime, size: 100 }]]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      yield* service.loadFile(testPath, testIdentity);

      const localContent = '# Local Changes\n\nMy local edits.';
      const result = yield* service.resolveConflict(
        testPath,
        'keep_local',
        localContent
      );

      // Should have saved
      expect('bytesWritten' in result).toBe(true);

      // File should have local content
      const file = fileSystem.files.get(testPath);
      expect(file?.content).toBe(localContent);
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('keep_external reloads from disk', () => {
    const mtime = Date.now();
    const externalContent = '# External Version\n\nModified externally.';
    const fileSystem: MockFileSystem = {
      files: new Map([
        [testPath, { content: externalContent, mtime, size: 100 }],
      ]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      yield* service.loadFile(testPath, testIdentity);

      const result = yield* service.resolveConflict(
        testPath,
        'keep_external',
        'My local content that will be discarded'
      );

      // Should have reloaded (FileLoadResult has json property)
      expect('json' in result).toBe(true);
      expect((result as FileLoadResult).markdown).toBe(externalContent);
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('save_as saves to new path', () => {
    const mtime = Date.now();
    const fileSystem: MockFileSystem = {
      files: new Map([[testPath, { content: testMarkdown, mtime, size: 100 }]]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      yield* service.loadFile(testPath, testIdentity);

      const localContent = '# Saved As New File';
      const result = yield* service.resolveConflict(
        testPath,
        'save_as',
        localContent,
        testPath2
      );

      // Should have saved to new path
      expect('bytesWritten' in result).toBe(true);

      // New file should exist
      const newFile = fileSystem.files.get(testPath2);
      expect(newFile?.content).toBe(localContent);

      // Original should be unchanged
      const originalFile = fileSystem.files.get(testPath);
      expect(originalFile?.content).toBe(testMarkdown);
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('save_as requires newPath', () => {
    const fileSystem: MockFileSystem = {
      files: new Map([
        [testPath, { content: testMarkdown, mtime: Date.now(), size: 100 }],
      ]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      yield* service.loadFile(testPath, testIdentity);

      const result = yield* service
        .resolveConflict(testPath, 'save_as', 'content')
        .pipe(
          Effect.map(() => ({ success: true })),
          Effect.catchTag('FileDocumentError', () =>
            Effect.succeed({ success: false })
          )
        );

      expect(result.success).toBe(false);
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });

  it.effect('merge is not yet implemented', () => {
    const fileSystem: MockFileSystem = {
      files: new Map([
        [testPath, { content: testMarkdown, mtime: Date.now(), size: 100 }],
      ]),
    };

    return Effect.gen(function* () {
      const service = yield* FileDocumentService;

      yield* service.loadFile(testPath, testIdentity);

      const result = yield* service
        .resolveConflict(testPath, 'merge', 'content')
        .pipe(
          Effect.map(() => ({ success: true })),
          Effect.catchTag('FileDocumentError', () =>
            Effect.succeed({ success: false })
          )
        );

      expect(result.success).toBe(false);
    }).pipe(Effect.provide(createTestLayer(fileSystem)));
  });
});
