/**
 * MarkdownService Tests
 *
 * Tests for markdown ↔ Tiptap JSON conversion.
 */

import { describe, it, expect } from '@effect/vitest';
import { Effect } from 'effect';
import { MarkdownService } from '../MarkdownService';

describe('MarkdownService', () => {
  const testLayer = MarkdownService.Default;

  describe('parse', () => {
    it.effect('parses simple markdown to JSONContent', () =>
      Effect.gen(function* () {
        const service = yield* MarkdownService;

        const result = yield* service.parse('# Hello World');

        expect(result).toBeDefined();
        expect(result.type).toBe('doc');
        expect(result.content).toBeDefined();
        expect(result.content?.length).toBeGreaterThan(0);

        // Should contain a heading
        const heading = result.content?.find((n) => n.type === 'heading');
        expect(heading).toBeDefined();
        expect(heading?.attrs?.['level']).toBe(1);
      }).pipe(Effect.provide(testLayer))
    );

    it.effect('parses empty string to empty document', () =>
      Effect.gen(function* () {
        const service = yield* MarkdownService;

        const result = yield* service.parse('');

        expect(result.type).toBe('doc');
        expect(result.content).toBeDefined();
        expect(result.content?.length).toBe(1);
        expect(result.content?.[0].type).toBe('paragraph');
      }).pipe(Effect.provide(testLayer))
    );

    it.effect('parses complex markdown with multiple elements', () =>
      Effect.gen(function* () {
        const service = yield* MarkdownService;

        const markdown = `# Title

This is a paragraph with **bold** and *italic* text.

- Item 1
- Item 2
- Item 3

\`\`\`typescript
const x = 1;
\`\`\`
`;

        const result = yield* service.parse(markdown);

        expect(result.type).toBe('doc');
        expect(result.content).toBeDefined();

        // Should have heading, paragraph, list, and code block
        const types = result.content?.map((n) => n.type) ?? [];
        expect(types).toContain('heading');
        expect(types).toContain('paragraph');
        expect(types).toContain('bulletList');
        expect(types).toContain('codeBlock');
      }).pipe(Effect.provide(testLayer))
    );
  });

  describe('serialize', () => {
    it.effect('serializes JSONContent to markdown', () =>
      Effect.gen(function* () {
        const service = yield* MarkdownService;

        const json = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Hello World' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'This is a test.' }],
            },
          ],
        };

        const result = yield* service.serialize(json);

        expect(result).toContain('Hello World');
        expect(result).toContain('This is a test.');
        // Heading should have markdown syntax
        expect(result).toMatch(/^#\s+Hello World/m);
      }).pipe(Effect.provide(testLayer))
    );

    it.effect('serializes empty document to empty string', () =>
      Effect.gen(function* () {
        const service = yield* MarkdownService;

        const result = yield* service.serialize({ type: 'doc', content: [] });

        expect(result).toBe('');
      }).pipe(Effect.provide(testLayer))
    );
  });

  describe('normalize', () => {
    it.effect('round-trips markdown through parse/serialize', () =>
      Effect.gen(function* () {
        const service = yield* MarkdownService;

        const original = `# Test

This is a paragraph.

- Item 1
- Item 2
`;

        const normalized = yield* service.normalize(original);

        // Should still contain the same content
        expect(normalized).toContain('Test');
        expect(normalized).toContain('This is a paragraph');
        expect(normalized).toContain('Item 1');
        expect(normalized).toContain('Item 2');
      }).pipe(Effect.provide(testLayer))
    );
  });

  describe('isMarkdown', () => {
    it.effect('detects markdown with headers', () =>
      Effect.gen(function* () {
        const service = yield* MarkdownService;

        const result = yield* service.isMarkdown('# This is a header');

        expect(result).toBe(true);
      }).pipe(Effect.provide(testLayer))
    );

    it.effect('detects markdown with bold text', () =>
      Effect.gen(function* () {
        const service = yield* MarkdownService;

        const result = yield* service.isMarkdown('This is **bold** text');

        expect(result).toBe(true);
      }).pipe(Effect.provide(testLayer))
    );

    it.effect('detects markdown with links', () =>
      Effect.gen(function* () {
        const service = yield* MarkdownService;

        const result = yield* service.isMarkdown(
          'Check out [this link](https://example.com)'
        );

        expect(result).toBe(true);
      }).pipe(Effect.provide(testLayer))
    );

    it.effect('detects markdown with code blocks', () =>
      Effect.gen(function* () {
        const service = yield* MarkdownService;

        const result = yield* service.isMarkdown('```\ncode here\n```');

        expect(result).toBe(true);
      }).pipe(Effect.provide(testLayer))
    );

    it.effect('returns false for plain text', () =>
      Effect.gen(function* () {
        const service = yield* MarkdownService;

        const result = yield* service.isMarkdown(
          'Just some plain text without any formatting.'
        );

        expect(result).toBe(false);
      }).pipe(Effect.provide(testLayer))
    );

    it.effect('returns false for empty string', () =>
      Effect.gen(function* () {
        const service = yield* MarkdownService;

        const result = yield* service.isMarkdown('');

        expect(result).toBe(false);
      }).pipe(Effect.provide(testLayer))
    );
  });
});
