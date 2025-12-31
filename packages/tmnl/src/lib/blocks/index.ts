/**
 * Decoupled Block System
 *
 * Editor-agnostic block rendering with adapters for Tiptap, BlockSuite, etc.
 * Supports real-time sync via Durable Streams for Telegram WebApp integration.
 *
 * @example
 * ```tsx
 * // In Tiptap
 * import { tiptapToBlockContext } from '@/lib/blocks';
 * const context = tiptapToBlockContext(nodeViewProps);
 *
 * // Standalone
 * import { createStandaloneContext } from '@/lib/blocks';
 * const context = createStandaloneContext({ blockId: 'abc', ... });
 * ```
 */

// Types
export * from './types';

// Adapters
export * from './adapters';

// Services
export * from './services';

// Atoms
export * from './atoms';
