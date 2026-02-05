/**
 * Cursor Tools
 *
 * AI SDK tool definitions for:
 * - Position control (cursor movement)
 * - Design manipulation (styles, props, tokens)
 * - File operations (read, write, edit, search)
 *
 * NOTE: bash-tool.ts is NOT exported here because it imports child_process
 * which breaks browser bundles. Import bash-tool directly in server-only code:
 *   import { bashTools, setBashToolContext } from '@/lib/cursor/tools/bash-tool'
 */

export * from './position-tools'
export * from './design-tools'
export * from './file-tools'

// bash-tool is server-only - see note above
