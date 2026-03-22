/**
 * FileAnalysisService
 *
 * Layer 2: File type detection, hashing, and structure parsing.
 * Depends on FileAccessService for file reading.
 *
 * @module file-browser/services
 */

import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Context from 'effect/Context'

import { FileAccessService } from './FileAccessService'
import type {
  FileHash,
  HashAlgorithm,
  FileStructure,
  StructureFormat,
  MagicBytesInfo,
} from '../schemas/file-metadata'

// =============================================================================
// Magic Bytes Database
// =============================================================================

/** Known file signatures (magic bytes) */
const MAGIC_SIGNATURES: Array<{
  bytes: number[]
  offset?: number
  mimeType: string
  signature: string
}> = [
  // Images
  { bytes: [0x89, 0x50, 0x4e, 0x47], mimeType: 'image/png', signature: 'PNG' },
  { bytes: [0xff, 0xd8, 0xff], mimeType: 'image/jpeg', signature: 'JPEG' },
  { bytes: [0x47, 0x49, 0x46, 0x38], mimeType: 'image/gif', signature: 'GIF' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mimeType: 'image/webp', signature: 'WEBP' },

  // Documents
  { bytes: [0x25, 0x50, 0x44, 0x46], mimeType: 'application/pdf', signature: 'PDF' },

  // Archives
  { bytes: [0x50, 0x4b, 0x03, 0x04], mimeType: 'application/zip', signature: 'ZIP' },
  { bytes: [0x1f, 0x8b], mimeType: 'application/gzip', signature: 'GZIP' },
  { bytes: [0x42, 0x5a, 0x68], mimeType: 'application/x-bzip2', signature: 'BZIP2' },
  { bytes: [0x37, 0x7a, 0xbc, 0xaf], mimeType: 'application/x-7z-compressed', signature: '7ZIP' },
  { bytes: [0x52, 0x61, 0x72, 0x21], mimeType: 'application/x-rar-compressed', signature: 'RAR' },

  // Executables
  { bytes: [0x7f, 0x45, 0x4c, 0x46], mimeType: 'application/x-elf', signature: 'ELF' },
  { bytes: [0x4d, 0x5a], mimeType: 'application/x-msdownload', signature: 'PE/MZ' },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], mimeType: 'application/x-mach-binary', signature: 'Mach-O' },

  // Media
  { bytes: [0x49, 0x44, 0x33], mimeType: 'audio/mpeg', signature: 'MP3/ID3' },
  { bytes: [0xff, 0xfb], mimeType: 'audio/mpeg', signature: 'MP3' },
  { bytes: [0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70], mimeType: 'video/mp4', signature: 'MP4' },
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], mimeType: 'video/webm', signature: 'WEBM' },

  // Fonts
  { bytes: [0x00, 0x01, 0x00, 0x00], mimeType: 'font/ttf', signature: 'TTF' },
  { bytes: [0x4f, 0x54, 0x54, 0x4f], mimeType: 'font/otf', signature: 'OTF' },
  { bytes: [0x77, 0x4f, 0x46, 0x46], mimeType: 'font/woff', signature: 'WOFF' },
  { bytes: [0x77, 0x4f, 0x46, 0x32], mimeType: 'font/woff2', signature: 'WOFF2' },

  // Data
  { bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65], mimeType: 'application/x-sqlite3', signature: 'SQLite' },
]

// =============================================================================
// Service Interface
// =============================================================================

export interface FileAnalysisImpl {
  /** Detect file type from magic bytes */
  readonly detectFileType: (path: string) => Effect.Effect<MagicBytesInfo, Error, FileAccessService>

  /** Compute file hash */
  readonly computeHash: (
    path: string,
    algorithm: HashAlgorithm
  ) => Effect.Effect<FileHash, Error, FileAccessService>

  /** Parse file structure (for JSON, TOML, YAML, etc.) */
  readonly parseStructure: (path: string) => Effect.Effect<FileStructure, Error, FileAccessService>

  /** Get first N bytes as hex string */
  readonly getHeaderHex: (
    path: string,
    bytes?: number
  ) => Effect.Effect<string, Error, FileAccessService>
}

// =============================================================================
// Service Tag
// =============================================================================

export class FileAnalysisService extends Context.Tag('tmnl/file-browser/FileAnalysisService')<
  FileAnalysisService,
  FileAnalysisImpl
>() {}

// =============================================================================
// Helper Functions
// =============================================================================

/** Convert bytes to hex string */
function bytesToHex(bytes: Uint8Array, separator = ' '): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(separator)
}

/** Check if bytes match a signature */
function matchesMagic(data: Uint8Array, signature: number[], offset = 0): boolean {
  if (data.length < offset + signature.length) return false
  return signature.every((byte, i) => data[offset + i] === byte)
}

/** Detect format from extension */
function formatFromExtension(path: string): StructureFormat {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'json':
    case 'jsonc':
      return 'json'
    case 'toml':
      return 'toml'
    case 'yaml':
    case 'yml':
      return 'yaml'
    case 'xml':
    case 'svg':
    case 'html':
      return 'xml'
    case 'txt':
    case 'md':
    case 'rst':
      return 'text'
    default:
      return 'unknown'
  }
}

/** Detect schema from path */
function detectSchemaId(path: string): string | null {
  const filename = path.split('/').pop() || ''

  // Known config files
  const knownConfigs: Record<string, string> = {
    'package.json': 'npm/package',
    'tsconfig.json': 'typescript/tsconfig',
    'tsconfig.base.json': 'typescript/tsconfig',
    'eslint.config.js': 'eslint/config',
    '.eslintrc.json': 'eslint/config',
    'prettier.config.js': 'prettier/config',
    '.prettierrc': 'prettier/config',
    'vite.config.ts': 'vite/config',
    'vitest.config.ts': 'vitest/config',
    'tailwind.config.js': 'tailwind/config',
    'tailwind.config.ts': 'tailwind/config',
    'Cargo.toml': 'rust/cargo',
    'rust-toolchain.toml': 'rust/toolchain',
    'flake.nix': 'nix/flake',
    'docker-compose.yml': 'docker/compose',
    'docker-compose.yaml': 'docker/compose',
    'Dockerfile': 'docker/dockerfile',
  }

  return knownConfigs[filename] || null
}

// =============================================================================
// Implementation
// =============================================================================

const impl: FileAnalysisImpl = {
  detectFileType: (path: string) =>
    Effect.gen(function* () {
      const access = yield* FileAccessService
      const data = yield* access.readFile(path)

      // Check against known signatures
      for (const sig of MAGIC_SIGNATURES) {
        if (matchesMagic(data, sig.bytes, sig.offset ?? 0)) {
          return {
            signature: sig.signature,
            confidence: 1.0,
            detectedMimeType: sig.mimeType,
            headerHex: bytesToHex(data.slice(0, 16)),
          } satisfies MagicBytesInfo
        }
      }

      // No match - return unknown with header
      return {
        signature: null,
        confidence: 0,
        detectedMimeType: null,
        headerHex: bytesToHex(data.slice(0, 16)),
      } satisfies MagicBytesInfo
    }).pipe(Effect.withSpan('FileAnalysisService.detectFileType')),

  computeHash: (path: string, algorithm: HashAlgorithm) =>
    Effect.gen(function* () {
      const access = yield* FileAccessService
      const data = yield* access.readFile(path)

      // Use Web Crypto API
      const hashName = algorithm === 'sha256' ? 'SHA-256' :
                       algorithm === 'sha512' ? 'SHA-512' :
                       algorithm === 'md5' ? 'MD5' : 'SHA-256'

      // Note: MD5 is not supported by SubtleCrypto, would need polyfill
      const hashBuffer = yield* Effect.tryPromise({
        try: () => crypto.subtle.digest(hashName, data),
        catch: () => new Error(`Hash algorithm ${algorithm} not supported`),
      })

      const hashArray = new Uint8Array(hashBuffer)
      const hashHex = bytesToHex(hashArray, '')

      return {
        algorithm,
        value: hashHex.toLowerCase(),
        computedAt: Date.now(),
      } satisfies FileHash
    }).pipe(Effect.withSpan('FileAnalysisService.computeHash')),

  parseStructure: (path: string) =>
    Effect.gen(function* () {
      const access = yield* FileAccessService
      const format = formatFromExtension(path)

      if (format === 'unknown' || format === 'binary') {
        return {
          format,
          elementCount: null,
          depth: null,
          schemaId: null,
          parseError: null,
        } satisfies FileStructure
      }

      const text = yield* access.readFileText(path)
      const schemaId = detectSchemaId(path)

      // Parse based on format
      if (format === 'json') {
        const result = yield* Effect.try({
          try: () => {
            const parsed = JSON.parse(text)
            const isArray = Array.isArray(parsed)
            const elementCount = isArray ? parsed.length : Object.keys(parsed).length

            // Calculate depth
            const getDepth = (obj: unknown, d = 0): number => {
              if (typeof obj !== 'object' || obj === null) return d
              const children = Object.values(obj as Record<string, unknown>)
              if (children.length === 0) return d
              return Math.max(...children.map((c) => getDepth(c, d + 1)))
            }

            return {
              format: 'json' as const,
              elementCount,
              depth: getDepth(parsed),
              schemaId,
              parseError: null,
            } satisfies FileStructure
          },
          catch: (e) => ({
            format: 'json' as const,
            elementCount: null,
            depth: null,
            schemaId,
            parseError: String(e),
          } satisfies FileStructure),
        })

        return result
      }

      // For other formats, return basic info
      return {
        format,
        elementCount: text.split('\n').length,
        depth: null,
        schemaId,
        parseError: null,
      } satisfies FileStructure
    }).pipe(Effect.withSpan('FileAnalysisService.parseStructure')),

  getHeaderHex: (path: string, bytes = 64) =>
    Effect.gen(function* () {
      const access = yield* FileAccessService
      const data = yield* access.readFile(path)
      return bytesToHex(data.slice(0, bytes))
    }).pipe(Effect.withSpan('FileAnalysisService.getHeaderHex')),
}

// =============================================================================
// Layer Export
// =============================================================================

/**
 * FileAnalysisService layer
 *
 * Requires FileAccessService for file reading.
 */
export const FileAnalysisServiceLive = Layer.succeed(FileAnalysisService, impl)
