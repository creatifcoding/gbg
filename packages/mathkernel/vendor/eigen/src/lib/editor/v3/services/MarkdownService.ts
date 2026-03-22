/**
 * MarkdownService
 *
 * Effect.Service for bidirectional markdown ↔ Tiptap JSON conversion.
 * Uses @tiptap/markdown's MarkdownManager for parsing and serialization.
 *
 * @module editor/v3/services/MarkdownService
 */

import { Effect, Context, Layer } from 'effect';
import { MarkdownManager } from '@tiptap/markdown';
import { StarterKit } from '@tiptap/starter-kit';
import type { JSONContent, AnyExtension } from '@tiptap/core';

// =============================================================================
// Errors
// =============================================================================

export class MarkdownParseError extends Error {
  readonly _tag = 'MarkdownParseError';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'MarkdownParseError';
  }
}

export class MarkdownSerializeError extends Error {
  readonly _tag = 'MarkdownSerializeError';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'MarkdownSerializeError';
  }
}

// =============================================================================
// Configuration
// =============================================================================

export interface MarkdownConfig {
  /**
   * Tiptap extensions to register for markdown parsing/serialization.
   * Defaults to StarterKit extensions.
   */
  readonly extensions?: AnyExtension[];

  /**
   * Indentation settings for lists and code blocks.
   */
  readonly indentation?: {
    readonly style?: 'space' | 'tab';
    readonly size?: number;
  };
}

export class MarkdownConfigTag extends Context.Tag(
  'tmnl/editor/MarkdownConfig'
)<MarkdownConfigTag, MarkdownConfig>() {
  static Default = Layer.succeed(this, {
    extensions: [StarterKit],
    indentation: { style: 'space', size: 2 },
  });

  static Custom = (config: MarkdownConfig) => Layer.succeed(this, config);
}

// =============================================================================
// Service Interface
// =============================================================================

export interface MarkdownServiceShape {
  /**
   * Parse markdown string into Tiptap JSONContent.
   *
   * @param markdown - The markdown string to parse
   * @returns Tiptap JSON document
   */
  readonly parse: (
    markdown: string
  ) => Effect.Effect<JSONContent, MarkdownParseError>;

  /**
   * Serialize Tiptap JSONContent to markdown string.
   *
   * @param json - The Tiptap JSON document to serialize
   * @returns Markdown string
   */
  readonly serialize: (
    json: JSONContent
  ) => Effect.Effect<string, MarkdownSerializeError>;

  /**
   * Parse markdown and immediately serialize back.
   * Useful for normalizing markdown formatting.
   *
   * @param markdown - The markdown string to normalize
   * @returns Normalized markdown string
   */
  readonly normalize: (
    markdown: string
  ) => Effect.Effect<string, MarkdownParseError | MarkdownSerializeError>;

  /**
   * Check if a string appears to be valid markdown.
   * This is a heuristic check, not a full validation.
   *
   * @param content - The string to check
   * @returns true if content appears to be markdown
   */
  readonly isMarkdown: (content: string) => Effect.Effect<boolean, never>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class MarkdownService extends Effect.Service<MarkdownService>()(
  'tmnl/editor/MarkdownService',
  {
    effect: Effect.gen(function* () {
      const config = yield* MarkdownConfigTag;

      // Initialize MarkdownManager with configured extensions
      const manager = new MarkdownManager({
        extensions: config.extensions ?? [StarterKit],
        indentation: config.indentation ?? { style: 'space', size: 2 },
      });

      // --- PARSE ---
      const parse = (
        markdown: string
      ): Effect.Effect<JSONContent, MarkdownParseError> =>
        Effect.try({
          try: () => {
            // Handle empty/whitespace-only input
            if (!markdown || markdown.trim() === '') {
              return {
                type: 'doc',
                content: [{ type: 'paragraph' }],
              };
            }

            return manager.parse(markdown);
          },
          catch: (error) =>
            new MarkdownParseError(
              `Failed to parse markdown: ${
                error instanceof Error ? error.message : String(error)
              }`,
              error
            ),
        });

      // --- SERIALIZE ---
      const serialize = (
        json: JSONContent
      ): Effect.Effect<string, MarkdownSerializeError> =>
        Effect.try({
          try: () => {
            // Handle empty document
            if (!json || !json.content || json.content.length === 0) {
              return '';
            }

            return manager.serialize(json);
          },
          catch: (error) =>
            new MarkdownSerializeError(
              `Failed to serialize to markdown: ${
                error instanceof Error ? error.message : String(error)
              }`,
              error
            ),
        });

      // --- NORMALIZE ---
      const normalize = (
        markdown: string
      ): Effect.Effect<string, MarkdownParseError | MarkdownSerializeError> =>
        Effect.gen(function* () {
          const json = yield* parse(markdown);
          return yield* serialize(json);
        });

      // --- IS MARKDOWN ---
      const isMarkdown = (content: string): Effect.Effect<boolean, never> =>
        Effect.sync(() => {
          if (!content || content.trim() === '') {
            return false;
          }

          // Heuristic checks for common markdown patterns
          const markdownPatterns = [
            /^#{1,6}\s+/m, // Headers
            /\*\*[^*]+\*\*/, // Bold
            /\*[^*]+\*/, // Italic
            /\[[^\]]+\]\([^)]+\)/, // Links
            /```[\s\S]*?```/, // Code blocks
            /`[^`]+`/, // Inline code
            /^\s*[-*+]\s+/m, // Unordered lists
            /^\s*\d+\.\s+/m, // Ordered lists
            /^\s*>\s+/m, // Blockquotes
            /^---+$/m, // Horizontal rules
            /!\[[^\]]*\]\([^)]+\)/, // Images
          ];

          return markdownPatterns.some((pattern) => pattern.test(content));
        });

      return {
        parse,
        serialize,
        normalize,
        isMarkdown,
      } satisfies MarkdownServiceShape;
    }),
    dependencies: [MarkdownConfigTag.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const MarkdownServiceLive = MarkdownService.Default;

/**
 * Create a custom MarkdownService layer with specific extensions.
 *
 * @example
 * ```ts
 * import { StarterKit } from '@tiptap/starter-kit'
 * import { TaskList } from '@tiptap/extension-task-list'
 *
 * const CustomMarkdownService = MarkdownServiceCustom({
 *   extensions: [StarterKit, TaskList],
 *   indentation: { style: 'space', size: 4 },
 * })
 * ```
 */
export const MarkdownServiceCustom = (config: MarkdownConfig) =>
  MarkdownService.Default.pipe(Layer.provide(MarkdownConfigTag.Custom(config)));
