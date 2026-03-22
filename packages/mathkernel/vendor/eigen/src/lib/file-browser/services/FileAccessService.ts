/**
 * FileAccessService
 *
 * Layer 1: Tauri IPC for file system operations.
 * Provides both mock and live (Tauri) implementations.
 *
 * @module file-browser/services
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import { invoke } from '@tauri-apps/api/core';

import { FileEntry, FileMetadata, DirectoryContents } from '../schemas';

// =============================================================================
// Tauri IPC Types (from Rust)
// =============================================================================

/** Raw file entry from Tauri (matches Rust struct) */
interface TauriFileEntry {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  extension: string | null;
  hidden: boolean;
  readable: boolean;
  writable: boolean;
  executable: boolean;
  createdAt: number;
  modifiedAt: number;
  accessedAt: number;
}

/** Raw file metadata from Tauri */
interface TauriFileMetadata {
  size: number;
  type: 'file' | 'directory' | 'symlink';
  permissions: number;
  hidden: boolean;
  readonly: boolean;
  createdAt: number;
  modifiedAt: number;
  accessedAt: number;
  inode: number | null;
  device: number | null;
  nlink: number | null;
  mimeType: string | null;
}

// =============================================================================
// Service Interface
// =============================================================================

export interface FileAccessImpl {
  /** List directory contents (single level) */
  readonly listDirectory: (
    path: string
  ) => Effect.Effect<readonly FileEntry[], Error>;

  /** Scan directory recursively with ignore patterns */
  readonly scanDirectory: (
    path: string,
    ignorePatterns: readonly string[],
    maxDepth?: number
  ) => Effect.Effect<readonly FileEntry[], Error>;

  /** Read file as bytes */
  readonly readFile: (path: string) => Effect.Effect<Uint8Array, Error>;

  /** Read file as text */
  readonly readFileText: (path: string) => Effect.Effect<string, Error>;

  /** Write file */
  readonly writeFile: (
    path: string,
    data: Uint8Array
  ) => Effect.Effect<void, Error>;

  /** Delete file or directory */
  readonly deleteFile: (
    path: string,
    recursive?: boolean
  ) => Effect.Effect<void, Error>;

  /** Create directory */
  readonly createDirectory: (path: string) => Effect.Effect<void, Error>;

  /** Check if path exists */
  readonly exists: (path: string) => Effect.Effect<boolean, Error>;

  /** Get file metadata */
  readonly getMetadata: (path: string) => Effect.Effect<FileMetadata, Error>;

  /** Rename/move file */
  readonly rename: (source: string, dest: string) => Effect.Effect<void, Error>;

  /** Copy file */
  readonly copy: (source: string, dest: string) => Effect.Effect<void, Error>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class FileAccessService extends Context.Tag(
  'tmnl/file-browser/FileAccessService'
)<FileAccessService, FileAccessImpl>() {}

// =============================================================================
// Mock Data
// =============================================================================

const MOCK_FILES: readonly FileEntry[] = [
  new FileEntry({
    id: '/home/user/documents',
    name: 'documents',
    path: '/home/user/documents',
    type: 'directory',
    size: 0,
    mimeType: null,
    extension: null,
    permissions: { readable: true, writable: true, executable: true },
    hidden: false,
    createdAt: Date.now() - 86400000 * 30,
    modifiedAt: Date.now() - 86400000 * 2,
    accessedAt: Date.now() - 3600000,
  }),
  new FileEntry({
    id: '/home/user/projects',
    name: 'projects',
    path: '/home/user/projects',
    type: 'directory',
    size: 0,
    mimeType: null,
    extension: null,
    permissions: { readable: true, writable: true, executable: true },
    hidden: false,
    createdAt: Date.now() - 86400000 * 60,
    modifiedAt: Date.now() - 86400000,
    accessedAt: Date.now() - 1800000,
  }),
  new FileEntry({
    id: '/home/user/.config',
    name: '.config',
    path: '/home/user/.config',
    type: 'directory',
    size: 0,
    mimeType: null,
    extension: null,
    permissions: { readable: true, writable: true, executable: true },
    hidden: true,
    createdAt: Date.now() - 86400000 * 90,
    modifiedAt: Date.now() - 86400000 * 5,
    accessedAt: Date.now() - 7200000,
  }),
  new FileEntry({
    id: '/home/user/readme.md',
    name: 'readme.md',
    path: '/home/user/readme.md',
    type: 'file',
    size: 4096,
    mimeType: 'text/markdown',
    extension: 'md',
    permissions: { readable: true, writable: true, executable: false },
    hidden: false,
    createdAt: Date.now() - 86400000 * 7,
    modifiedAt: Date.now() - 86400000,
    accessedAt: Date.now() - 3600000,
  }),
  new FileEntry({
    id: '/home/user/package.json',
    name: 'package.json',
    path: '/home/user/package.json',
    type: 'file',
    size: 2048,
    mimeType: 'application/json',
    extension: 'json',
    permissions: { readable: true, writable: true, executable: false },
    hidden: false,
    createdAt: Date.now() - 86400000 * 14,
    modifiedAt: Date.now() - 3600000,
    accessedAt: Date.now() - 1800000,
  }),
  new FileEntry({
    id: '/home/user/tsconfig.json',
    name: 'tsconfig.json',
    path: '/home/user/tsconfig.json',
    type: 'file',
    size: 1024,
    mimeType: 'application/json',
    extension: 'json',
    permissions: { readable: true, writable: true, executable: false },
    hidden: false,
    createdAt: Date.now() - 86400000 * 14,
    modifiedAt: Date.now() - 86400000 * 3,
    accessedAt: Date.now() - 7200000,
  }),
  new FileEntry({
    id: '/home/user/data.bin',
    name: 'data.bin',
    path: '/home/user/data.bin',
    type: 'file',
    size: 1048576,
    mimeType: 'application/octet-stream',
    extension: 'bin',
    permissions: { readable: true, writable: false, executable: false },
    hidden: false,
    createdAt: Date.now() - 86400000 * 21,
    modifiedAt: Date.now() - 86400000 * 7,
    accessedAt: Date.now() - 86400000,
  }),
  new FileEntry({
    id: '/home/user/archive.tar.gz',
    name: 'archive.tar.gz',
    path: '/home/user/archive.tar.gz',
    type: 'file',
    size: 52428800,
    mimeType: 'application/gzip',
    extension: 'gz',
    permissions: { readable: true, writable: true, executable: false },
    hidden: false,
    createdAt: Date.now() - 86400000 * 3,
    modifiedAt: Date.now() - 86400000 * 2,
    accessedAt: Date.now() - 43200000,
  }),
];

// =============================================================================
// Mock Implementation
// =============================================================================

const mockImpl: FileAccessImpl = {
  listDirectory: (path: string) =>
    Effect.sync(() => {
      // Simulate directory structure
      if (path === '/' || path === '/home/user') {
        return MOCK_FILES;
      }
      // Empty for other paths
      return [];
    }).pipe(Effect.withSpan('FileAccessService.listDirectory')),

  scanDirectory: (
    _path: string,
    _ignorePatterns: readonly string[],
    _maxDepth?: number
  ) =>
    Effect.sync(() => {
      // Mock scan - return flat list of mock files
      return MOCK_FILES.filter((f) => f.type === 'file');
    }).pipe(Effect.withSpan('FileAccessService.scanDirectory')),

  readFile: (path: string) =>
    Effect.sync(() => {
      // Return mock binary data
      const encoder = new TextEncoder();
      return encoder.encode(`Mock content for ${path}`);
    }).pipe(Effect.withSpan('FileAccessService.readFile')),

  readFileText: (path: string) =>
    Effect.sync(() => {
      // Return mock text content
      if (path.endsWith('.json')) {
        return JSON.stringify({ mock: true, path }, null, 2);
      }
      if (path.endsWith('.md')) {
        return `# Mock File\n\nThis is mock content for \`${path}\`.`;
      }
      return `Mock content for ${path}`;
    }).pipe(Effect.withSpan('FileAccessService.readFileText')),

  writeFile: (_path: string, _data: Uint8Array) =>
    Effect.sync(() => {
      // Mock write - no-op
    }).pipe(Effect.withSpan('FileAccessService.writeFile')),

  deleteFile: (_path: string, _recursive?: boolean) =>
    Effect.sync(() => {
      // Mock delete - no-op
    }).pipe(Effect.withSpan('FileAccessService.deleteFile')),

  createDirectory: (_path: string) =>
    Effect.sync(() => {
      // Mock create directory - no-op
    }).pipe(Effect.withSpan('FileAccessService.createDirectory')),

  exists: (path: string) =>
    Effect.sync(() => {
      // Check if path is in mock data
      return MOCK_FILES.some(
        (f) => f.path === path || f.path.startsWith(path + '/')
      );
    }).pipe(Effect.withSpan('FileAccessService.exists')),

  getMetadata: (path: string) =>
    Effect.sync(() => {
      const file = MOCK_FILES.find((f) => f.path === path);
      const now = Date.now();

      return new FileMetadata({
        path,
        size: file?.size ?? 0,
        createdAt: file?.createdAt ?? now,
        modifiedAt: file?.modifiedAt ?? now,
        accessedAt: file?.accessedAt ?? now,
        mode: 0o644,
        uid: 1000,
        gid: 1000,
        inode: Math.floor(Math.random() * 1000000),
        device: 1,
        nlink: 1,
        blockSize: 4096,
        blocks: Math.ceil((file?.size ?? 0) / 512),
        readonly: file?.permissions.writable === false,
        isSymlink: false,
        symlinkTarget: null,
        hash: null,
        encryption: { status: 'none', algorithm: null, keyId: null },
        structure: null,
        magicBytes: null,
      });
    }).pipe(Effect.withSpan('FileAccessService.getMetadata')),

  rename: (_source: string, _dest: string) =>
    Effect.sync(() => {
      // Mock rename - no-op
    }).pipe(Effect.withSpan('FileAccessService.rename')),

  copy: (_source: string, _dest: string) =>
    Effect.sync(() => {
      // Mock copy - no-op
    }).pipe(Effect.withSpan('FileAccessService.copy')),
};

// =============================================================================
// Tauri Implementation
// =============================================================================

/** Convert Tauri file entry to FileEntry schema */
function toFileEntry(raw: TauriFileEntry): FileEntry {
  return new FileEntry({
    id: raw.id,
    name: raw.name,
    path: raw.path,
    type: raw.type,
    size: raw.size,
    mimeType: null, // Will be filled by FileAnalysisService
    extension: raw.extension,
    permissions: {
      readable: raw.readable,
      writable: raw.writable,
      executable: raw.executable,
    },
    hidden: raw.hidden,
    createdAt: raw.createdAt,
    modifiedAt: raw.modifiedAt,
    accessedAt: raw.accessedAt,
  });
}

/** Convert Tauri metadata to FileMetadata schema */
function toFileMetadata(raw: TauriFileMetadata, path: string): FileMetadata {
  return new FileMetadata({
    path,
    size: raw.size,
    createdAt: raw.createdAt,
    modifiedAt: raw.modifiedAt,
    accessedAt: raw.accessedAt,
    mode: raw.permissions,
    uid: 1000, // Not available via Tauri
    gid: 1000,
    inode: raw.inode ?? 0,
    device: raw.device ?? 0,
    nlink: raw.nlink ?? 1,
    blockSize: 4096,
    blocks: Math.ceil(raw.size / 512),
    readonly: raw.readonly,
    isSymlink: raw.type === 'symlink',
    symlinkTarget: null,
    hash: null,
    encryption: { status: 'none', algorithm: null, keyId: null },
    structure: null,
    magicBytes: null,
  });
}

const tauriImpl: FileAccessImpl = {
  listDirectory: (path: string) =>
    Effect.tryPromise({
      try: async () => {
        const entries = await invoke<TauriFileEntry[]>('fs_list_directory', {
          path,
        });
        return entries.map(toFileEntry);
      },
      catch: (error) => new Error(`Failed to list directory: ${error}`),
    }).pipe(Effect.withSpan('FileAccessService.listDirectory')),

  scanDirectory: (
    path: string,
    ignorePatterns: readonly string[],
    maxDepth?: number
  ) =>
    Effect.tryPromise({
      try: async () => {
        const entries = await invoke<TauriFileEntry[]>('fs_scan_directory', {
          path,
          ignorePatterns: [...ignorePatterns], // Convert readonly to mutable for Tauri
          maxDepth: maxDepth ?? null,
        });
        return entries.map(toFileEntry);
      },
      catch: (error) => new Error(`Failed to scan directory: ${error}`),
    }).pipe(Effect.withSpan('FileAccessService.scanDirectory')),

  readFile: (path: string) =>
    Effect.tryPromise({
      try: () =>
        invoke<number[]>('fs_read_file', { path }).then(
          (arr) => new Uint8Array(arr)
        ),
      catch: (error) => new Error(`Failed to read file: ${error}`),
    }).pipe(Effect.withSpan('FileAccessService.readFile')),

  readFileText: (path: string) =>
    Effect.tryPromise({
      try: async () => {
        const bytes = await invoke<number[]>('fs_read_file', { path });
        const decoder = new TextDecoder();
        return decoder.decode(new Uint8Array(bytes));
      },
      catch: (error) => new Error(`Failed to read file as text: ${error}`),
    }).pipe(Effect.withSpan('FileAccessService.readFileText')),

  writeFile: (path: string, data: Uint8Array) =>
    Effect.tryPromise({
      try: () => invoke('fs_write_file', { path, data: Array.from(data) }),
      catch: (error) => new Error(`Failed to write file: ${error}`),
    }).pipe(Effect.withSpan('FileAccessService.writeFile')),

  deleteFile: (path: string, recursive: boolean = false) =>
    Effect.tryPromise({
      try: () => invoke('fs_delete_file', { path, recursive }),
      catch: (error) => new Error(`Failed to delete file: ${error}`),
    }).pipe(Effect.withSpan('FileAccessService.deleteFile')),

  createDirectory: (path: string) =>
    Effect.tryPromise({
      try: () => invoke('fs_create_directory', { path }),
      catch: (error) => new Error(`Failed to create directory: ${error}`),
    }).pipe(Effect.withSpan('FileAccessService.createDirectory')),

  exists: (path: string) =>
    Effect.tryPromise({
      try: async () => {
        try {
          await invoke('fs_file_metadata', { path });
          return true;
        } catch {
          return false;
        }
      },
      catch: () => new Error(`Failed to check existence`),
    }).pipe(Effect.withSpan('FileAccessService.exists')),

  getMetadata: (path: string) =>
    Effect.tryPromise({
      try: async () => {
        const raw = await invoke<TauriFileMetadata>('fs_file_metadata', {
          path,
        });
        return toFileMetadata(raw, path);
      },
      catch: (error) => new Error(`Failed to get metadata: ${error}`),
    }).pipe(Effect.withSpan('FileAccessService.getMetadata')),

  rename: (source: string, dest: string) =>
    Effect.tryPromise({
      try: () => invoke('fs_rename_file', { source, dest }),
      catch: (error) => new Error(`Failed to rename: ${error}`),
    }).pipe(Effect.withSpan('FileAccessService.rename')),

  copy: (source: string, dest: string) =>
    Effect.tryPromise({
      try: () => invoke('fs_copy_file', { source, dest }),
      catch: (error) => new Error(`Failed to copy: ${error}`),
    }).pipe(Effect.withSpan('FileAccessService.copy')),
};

// =============================================================================
// Layer Export
// =============================================================================

/**
 * Mock FileAccessService layer
 *
 * For development/testing without Tauri.
 */
export const FileAccessServiceMock = Layer.succeed(FileAccessService, mockImpl);

/**
 * Tauri FileAccessService layer
 *
 * Real file system access via Tauri IPC.
 */
export const FileAccessServiceTauri = Layer.succeed(
  FileAccessService,
  tauriImpl
);

/**
 * Detect if running in Tauri
 */
const isTauri = (): boolean => {
  // Tauri v2 uses __TAURI_INTERNALS__, v1 used __TAURI__
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
};

/**
 * Default layer - auto-selects based on environment
 *
 * - Tauri app: Uses real file system via IPC
 * - Browser/dev: Uses mock data
 */
export const FileAccessServiceLive = isTauri()
  ? FileAccessServiceTauri
  : FileAccessServiceMock;
