/**
 * FileMetadata Schema
 *
 * Extended metadata for file inspection.
 *
 * @module file-browser/schemas
 */

import { Schema } from 'effect'

// =============================================================================
// Hash Algorithm
// =============================================================================

export const HashAlgorithm = Schema.Literal('sha256', 'sha512', 'md5', 'blake3')
export type HashAlgorithm = typeof HashAlgorithm.Type

// =============================================================================
// File Hash
// =============================================================================

export const FileHash = Schema.Struct({
  algorithm: HashAlgorithm,
  value: Schema.String,
  computedAt: Schema.Number,
})
export type FileHash = typeof FileHash.Type

// =============================================================================
// Encryption Info
// =============================================================================

export const EncryptionStatus = Schema.Literal('none', 'encrypted', 'partial', 'unknown')
export type EncryptionStatus = typeof EncryptionStatus.Type

export const EncryptionInfo = Schema.Struct({
  status: EncryptionStatus,
  algorithm: Schema.NullOr(Schema.String),
  keyId: Schema.NullOr(Schema.String),
})
export type EncryptionInfo = typeof EncryptionInfo.Type

// =============================================================================
// File Structure (for structured files)
// =============================================================================

export const StructureFormat = Schema.Literal(
  'json',
  'toml',
  'yaml',
  'xml',
  'binary',
  'text',
  'unknown'
)
export type StructureFormat = typeof StructureFormat.Type

export const FileStructure = Schema.Struct({
  format: StructureFormat,
  /** Key count for objects, element count for arrays */
  elementCount: Schema.NullOr(Schema.Number),
  /** Depth for nested structures */
  depth: Schema.NullOr(Schema.Number),
  /** Schema detected (e.g., "package.json", "tsconfig.json") */
  schemaId: Schema.NullOr(Schema.String),
  /** Parse errors if any */
  parseError: Schema.NullOr(Schema.String),
})
export type FileStructure = typeof FileStructure.Type

// =============================================================================
// Magic Bytes Detection
// =============================================================================

export const MagicBytesInfo = Schema.Struct({
  /** Detected file signature */
  signature: Schema.NullOr(Schema.String),
  /** Confidence 0-1 */
  confidence: Schema.Number,
  /** Detected MIME type from magic bytes */
  detectedMimeType: Schema.NullOr(Schema.String),
  /** First N bytes as hex string */
  headerHex: Schema.String,
})
export type MagicBytesInfo = typeof MagicBytesInfo.Type

// =============================================================================
// File Metadata (Extended)
// =============================================================================

export class FileMetadata extends Schema.TaggedClass<FileMetadata>()('FileMetadata', {
  /** File path */
  path: Schema.String,
  /** Basic stats */
  size: Schema.Number,
  createdAt: Schema.Number,
  modifiedAt: Schema.Number,
  accessedAt: Schema.Number,
  /** Unix mode (permissions) */
  mode: Schema.Number,
  /** User ID (Unix) */
  uid: Schema.NullOr(Schema.Number),
  /** Group ID (Unix) */
  gid: Schema.NullOr(Schema.Number),
  /** Inode number */
  inode: Schema.NullOr(Schema.Number),
  /** Device ID */
  device: Schema.NullOr(Schema.Number),
  /** Number of hard links */
  nlink: Schema.Number,
  /** Block size */
  blockSize: Schema.NullOr(Schema.Number),
  /** Blocks allocated */
  blocks: Schema.NullOr(Schema.Number),
  /** Is readonly */
  readonly: Schema.Boolean,
  /** Is symlink */
  isSymlink: Schema.Boolean,
  /** Symlink target (if symlink) */
  symlinkTarget: Schema.NullOr(Schema.String),
  /** Hash info (computed on demand) */
  hash: Schema.NullOr(FileHash),
  /** Encryption info */
  encryption: Schema.NullOr(EncryptionInfo),
  /** Structure info (for structured files) */
  structure: Schema.NullOr(FileStructure),
  /** Magic bytes detection */
  magicBytes: Schema.NullOr(MagicBytesInfo),
}) {
  /** Format mode as octal string (e.g., "755") */
  get modeOctal(): string {
    return (this.mode & 0o777).toString(8).padStart(3, '0')
  }

  /** Format mode as rwx string (e.g., "rwxr-xr-x") */
  get modeRwx(): string {
    const mode = this.mode & 0o777
    const chars = ['r', 'w', 'x']
    let result = ''
    for (let i = 2; i >= 0; i--) {
      const bits = (mode >> (i * 3)) & 0o7
      for (let j = 0; j < 3; j++) {
        result += bits & (1 << (2 - j)) ? chars[j] : '-'
      }
    }
    return result
  }
}
