/**
 * Block Schema Definitions
 *
 * Effect Schema-backed block types for TMNL's native block editor.
 * Inspired by AFFiNE's BlockSuite but implemented entirely with Effect.
 *
 * @module editor/schemas/block
 */

import { Schema } from "effect";

// =============================================================================
// Base Types
// =============================================================================

/**
 * Block ID - branded string for type safety
 */
export const BlockId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("BlockId")
);
export type BlockId = typeof BlockId.Type;

/**
 * Document ID - branded string for type safety
 */
export const DocumentId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("DocumentId")
);
export type DocumentId = typeof DocumentId.Type;

/**
 * Generate a new block ID
 */
export const generateBlockId = (): BlockId =>
  crypto.randomUUID() as BlockId;

/**
 * Generate a new document ID
 */
export const generateDocumentId = (): DocumentId =>
  crypto.randomUUID() as DocumentId;

/**
 * Text mark types for rich text
 */
export const TextMarkType = Schema.Literal(
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "code",
  "link"
);
export type TextMarkType = typeof TextMarkType.Type;

/**
 * Text mark with optional attributes
 */
export const TextMark = Schema.Struct({
  type: TextMarkType,
  attrs: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});
export type TextMark = typeof TextMark.Type;

/**
 * Text span with marks
 */
export const TextSpan = Schema.Struct({
  text: Schema.String,
  marks: Schema.optional(Schema.Array(TextMark)),
});
export type TextSpan = typeof TextSpan.Type;

/**
 * Rich text content (array of spans)
 */
export const RichText = Schema.Array(TextSpan);
export type RichText = typeof RichText.Type;

// =============================================================================
// Block Roles
// =============================================================================

/**
 * Block role determines rendering context
 * - root: Document container, exactly one per document
 * - container: Groups other blocks (callout, column, quote)
 * - content: Leaf blocks with actual content (paragraph, heading, code)
 */
export const BlockRole = Schema.Literal("root", "container", "content");
export type BlockRole = typeof BlockRole.Type;

/**
 * Display mode determines which editor mode shows this block
 */
export const DisplayMode = Schema.Literal("both", "page", "canvas");
export type DisplayMode = typeof DisplayMode.Type;

// =============================================================================
// Core Block Types
// =============================================================================

/**
 * Paragraph block - basic text content
 */
export const ParagraphBlock = Schema.TaggedStruct("Paragraph", {
  id: BlockId,
  content: RichText,
  children: Schema.suspend((): Schema.Schema<Block[]> => Schema.Array(Block)),
});
export type ParagraphBlock = typeof ParagraphBlock.Type;

/**
 * Heading block - section headers
 */
export const HeadingBlock = Schema.TaggedStruct("Heading", {
  id: BlockId,
  content: RichText,
  level: Schema.Literal(1, 2, 3, 4, 5, 6),
  children: Schema.suspend((): Schema.Schema<Block[]> => Schema.Array(Block)),
});
export type HeadingBlock = typeof HeadingBlock.Type;

/**
 * Code block - syntax highlighted code
 */
export const CodeBlock = Schema.TaggedStruct("Code", {
  id: BlockId,
  code: Schema.String,
  language: Schema.String,
  caption: Schema.optional(Schema.String),
  children: Schema.suspend((): Schema.Schema<Block[]> => Schema.Array(Block)),
});
export type CodeBlock = typeof CodeBlock.Type;

/**
 * List item block
 */
export const ListItemBlock = Schema.TaggedStruct("ListItem", {
  id: BlockId,
  content: RichText,
  checked: Schema.optional(Schema.Boolean), // For todo lists
  children: Schema.suspend((): Schema.Schema<Block[]> => Schema.Array(Block)),
});
export type ListItemBlock = typeof ListItemBlock.Type;

/**
 * List block - ordered or unordered list
 */
export const ListBlock = Schema.TaggedStruct("List", {
  id: BlockId,
  ordered: Schema.Boolean,
  children: Schema.Array(ListItemBlock),
});
export type ListBlock = typeof ListBlock.Type;

/**
 * Quote block - blockquote container
 */
export const QuoteBlock = Schema.TaggedStruct("Quote", {
  id: BlockId,
  children: Schema.suspend((): Schema.Schema<Block[]> => Schema.Array(Block)),
});
export type QuoteBlock = typeof QuoteBlock.Type;

/**
 * Divider block - horizontal rule
 */
export const DividerBlock = Schema.TaggedStruct("Divider", {
  id: BlockId,
  children: Schema.suspend((): Schema.Schema<Block[]> => Schema.Array(Block)),
});
export type DividerBlock = typeof DividerBlock.Type;

/**
 * Image block
 */
export const ImageBlock = Schema.TaggedStruct("Image", {
  id: BlockId,
  src: Schema.String,
  alt: Schema.optional(Schema.String),
  caption: Schema.optional(Schema.String),
  width: Schema.optional(Schema.Number),
  height: Schema.optional(Schema.Number),
  children: Schema.suspend((): Schema.Schema<Block[]> => Schema.Array(Block)),
});
export type ImageBlock = typeof ImageBlock.Type;

/**
 * Callout block - highlighted container
 */
export const CalloutBlock = Schema.TaggedStruct("Callout", {
  id: BlockId,
  icon: Schema.optional(Schema.String),
  variant: Schema.optional(Schema.Literal("info", "warning", "error", "success")),
  children: Schema.suspend((): Schema.Schema<Block[]> => Schema.Array(Block)),
});
export type CalloutBlock = typeof CalloutBlock.Type;

// =============================================================================
// Block Union
// =============================================================================

/**
 * Union of all block types
 * Use _tag for pattern matching
 */
export const Block: Schema.Schema<Block> = Schema.Union(
  ParagraphBlock,
  HeadingBlock,
  CodeBlock,
  ListBlock,
  ListItemBlock,
  QuoteBlock,
  DividerBlock,
  ImageBlock,
  CalloutBlock
);
export type Block =
  | ParagraphBlock
  | HeadingBlock
  | CodeBlock
  | ListBlock
  | ListItemBlock
  | QuoteBlock
  | DividerBlock
  | ImageBlock
  | CalloutBlock;

// =============================================================================
// Document
// =============================================================================

/**
 * Document metadata
 */
export const DocumentMeta = Schema.Struct({
  title: Schema.String,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
  version: Schema.Number,
});
export type DocumentMeta = typeof DocumentMeta.Type;

/**
 * Complete document
 */
export const Document = Schema.Struct({
  id: DocumentId,
  meta: DocumentMeta,
  blocks: Schema.Array(Block),
});
export type Document = typeof Document.Type;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an empty paragraph block
 */
export const createParagraph = (text: string = ""): ParagraphBlock => ({
  _tag: "Paragraph",
  id: generateBlockId(),
  content: text ? [{ text }] : [],
  children: [],
});

/**
 * Create a heading block
 */
export const createHeading = (
  text: string,
  level: 1 | 2 | 3 | 4 | 5 | 6 = 1
): HeadingBlock => ({
  _tag: "Heading",
  id: generateBlockId(),
  content: [{ text }],
  level,
  children: [],
});

/**
 * Create a code block
 */
export const createCodeBlock = (
  code: string = "",
  language: string = "typescript"
): CodeBlock => ({
  _tag: "Code",
  id: generateBlockId(),
  code,
  language,
  children: [],
});

/**
 * Create an empty document
 */
export const createDocument = (title: string = "Untitled"): Document => ({
  id: generateDocumentId(),
  meta: {
    title,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  },
  blocks: [createParagraph()],
});

// =============================================================================
// Block Utilities
// =============================================================================

/**
 * Get block role by type
 */
export const getBlockRole = (block: Block): BlockRole => {
  switch (block._tag) {
    case "List":
    case "Quote":
    case "Callout":
      return "container";
    default:
      return "content";
  }
};

/**
 * Check if block can have children
 */
export const canHaveChildren = (block: Block): boolean => {
  return block._tag !== "Divider";
};

/**
 * Get plain text from rich text content
 */
export const richTextToPlain = (content: RichText): string =>
  content.map((span) => span.text).join("");

/**
 * Create rich text from plain string
 */
export const plainToRichText = (text: string): RichText => [{ text }];
