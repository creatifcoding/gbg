/**
 * FileEntry Schema
 *
 * Core file/directory entry representation.
 *
 * @module file-browser/schemas
 */

import { Schema } from 'effect'

// =============================================================================
// File Type
// =============================================================================

export const FileType = Schema.Literal(
  'file',
  'directory',
  'symlink',
  'unknown'
)
export type FileType = typeof FileType.Type

// =============================================================================
// File Permissions
// =============================================================================

export const FilePermissions = Schema.Struct({
  readable: Schema.Boolean,
  writable: Schema.Boolean,
  executable: Schema.Boolean,
})
export type FilePermissions = typeof FilePermissions.Type

// =============================================================================
// File Entry
// =============================================================================

export class FileEntry extends Schema.TaggedClass<FileEntry>()('FileEntry', {
  /** Unique identifier (full path) */
  id: Schema.String,
  /** File/directory name */
  name: Schema.NonEmptyString,
  /** Full path */
  path: Schema.String,
  /** Entry type */
  type: FileType,
  /** Size in bytes (0 for directories) */
  size: Schema.Number,
  /** MIME type (null for directories) */
  mimeType: Schema.NullOr(Schema.String),
  /** File extension (without dot, null for directories) */
  extension: Schema.NullOr(Schema.String),
  /** Permissions */
  permissions: FilePermissions,
  /** Is hidden file (starts with .) */
  hidden: Schema.Boolean,
  /** Created timestamp (ms since epoch) */
  createdAt: Schema.Number,
  /** Modified timestamp (ms since epoch) */
  modifiedAt: Schema.Number,
  /** Accessed timestamp (ms since epoch) */
  accessedAt: Schema.Number,
}) {
  /** Check if entry is a directory */
  get isDirectory(): boolean {
    return this.type === 'directory'
  }

  /** Check if entry is a file */
  get isFile(): boolean {
    return this.type === 'file'
  }

  /** Human-readable size */
  get formattedSize(): string {
    if (this.type === 'directory') return '—'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = this.size
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
  }

  /** Parent directory path */
  get parentPath(): string {
    const parts = this.path.split('/')
    parts.pop()
    return parts.join('/') || '/'
  }
}

// =============================================================================
// Directory Contents
// =============================================================================

export const DirectoryContents = Schema.Struct({
  path: Schema.String,
  entries: Schema.Array(FileEntry),
  totalSize: Schema.Number,
  fileCount: Schema.Number,
  directoryCount: Schema.Number,
})
export type DirectoryContents = typeof DirectoryContents.Type

// =============================================================================
// Sort Order
// =============================================================================

export const SortField = Schema.Literal('name', 'size', 'type', 'modifiedAt', 'createdAt')
export type SortField = typeof SortField.Type

export const SortDirection = Schema.Literal('asc', 'desc')
export type SortDirection = typeof SortDirection.Type

export const SortOrder = Schema.Struct({
  field: SortField,
  direction: SortDirection,
})
export type SortOrder = typeof SortOrder.Type
