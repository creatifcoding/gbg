/**
 * BlockRenderer
 *
 * Renders a block based on its type (_tag).
 * Uses a registry pattern for extensibility.
 *
 * @module editor/components/BlockRenderer
 */

import { type ReactNode, type ComponentType, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import type { Block, BlockId, RichText } from "../schemas/block";
import { richTextToPlain, plainToRichText } from "../schemas/block";
import { useEditor } from "../hooks/useEditor";

// =============================================================================
// Block Component Props
// =============================================================================

export interface BlockComponentProps<T extends Block = Block> {
  block: T;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updater: (block: T) => T) => void;
  onDelete: () => void;
  onAddAfter: (type: "paragraph" | "heading" | "code") => void;
}

// =============================================================================
// Block Components
// =============================================================================

/**
 * Paragraph Block Component
 */
function ParagraphBlockComponent({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onAddAfter,
}: BlockComponentProps) {
  if (block._tag !== "Paragraph") return null;

  const [text, setText] = useState(richTextToPlain(block.content));
  const inputRef = useRef<HTMLDivElement>(null);

  const handleBlur = () => {
    if (text !== richTextToPlain(block.content)) {
      onUpdate((b) => ({
        ...b,
        content: plainToRichText(text),
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onAddAfter("paragraph");
    }
    if (e.key === "Backspace" && text === "") {
      e.preventDefault();
      onDelete();
    }
  };

  return (
    <div
      className={`tmnl-block tmnl-paragraph group relative px-4 py-2 rounded transition-colors ${
        isSelected ? "bg-teal-500/10 ring-1 ring-teal-500/30" : "hover:bg-neutral-800/30"
      }`}
      onClick={onSelect}
      data-block-id={block.id}
    >
      <div
        ref={inputRef}
        contentEditable
        suppressContentEditableWarning
        className="outline-none text-neutral-200 leading-relaxed min-h-[1.5em]"
        onInput={(e) => setText(e.currentTarget.textContent || "")}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        data-placeholder="Type something..."
      >
        {text}
      </div>
      {text === "" && (
        <span className="absolute left-4 top-2 text-neutral-500 pointer-events-none">
          Type something...
        </span>
      )}
    </div>
  );
}

/**
 * Heading Block Component
 */
function HeadingBlockComponent({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onAddAfter,
}: BlockComponentProps) {
  if (block._tag !== "Heading") return null;

  const [text, setText] = useState(richTextToPlain(block.content));

  const handleBlur = () => {
    if (text !== richTextToPlain(block.content)) {
      onUpdate((b) => ({
        ...b,
        content: plainToRichText(text),
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onAddAfter("paragraph");
    }
    if (e.key === "Backspace" && text === "") {
      e.preventDefault();
      onDelete();
    }
  };

  const HeadingTag = `h${block.level}` as keyof JSX.IntrinsicElements;
  const fontSize = {
    1: "text-3xl",
    2: "text-2xl",
    3: "text-xl",
    4: "text-lg",
    5: "text-base",
    6: "text-sm",
  }[block.level];

  return (
    <div
      className={`tmnl-block tmnl-heading group relative px-4 py-2 rounded transition-colors ${
        isSelected ? "bg-teal-500/10 ring-1 ring-teal-500/30" : "hover:bg-neutral-800/30"
      }`}
      onClick={onSelect}
      data-block-id={block.id}
    >
      <div
        contentEditable
        suppressContentEditableWarning
        className={`outline-none text-neutral-100 font-semibold ${fontSize} min-h-[1.5em]`}
        onInput={(e) => setText(e.currentTarget.textContent || "")}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        {text}
      </div>
      {text === "" && (
        <span className={`absolute left-4 top-2 text-neutral-500 pointer-events-none ${fontSize}`}>
          Heading {block.level}
        </span>
      )}
    </div>
  );
}

/**
 * Code Block Component
 */
function CodeBlockComponent({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onAddAfter,
}: BlockComponentProps) {
  if (block._tag !== "Code") return null;

  const [code, setCode] = useState(block.code);

  const handleBlur = () => {
    if (code !== block.code) {
      onUpdate((b) => ({
        ...b,
        code,
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.slice(0, start) + "  " + code.slice(end);
      setCode(newCode);
    }
  };

  return (
    <div
      className={`tmnl-block tmnl-code group relative rounded overflow-hidden transition-colors ${
        isSelected ? "ring-1 ring-teal-500/30" : ""
      }`}
      onClick={onSelect}
      data-block-id={block.id}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800">
        <span className="text-xs font-mono text-teal-400">{block.language}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(code);
          }}
          className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          Copy
        </button>
      </div>
      {/* Code */}
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full p-4 bg-neutral-950 font-mono text-sm text-neutral-200 outline-none resize-none min-h-[100px]"
        placeholder="// Enter code..."
        spellCheck={false}
      />
    </div>
  );
}

/**
 * List Block Component
 */
function ListBlockComponent({
  block,
  isSelected,
  onSelect,
}: BlockComponentProps) {
  if (block._tag !== "List") return null;

  const ListTag = block.ordered ? "ol" : "ul";

  return (
    <div
      className={`tmnl-block tmnl-list px-4 py-2 rounded transition-colors ${
        isSelected ? "bg-teal-500/10 ring-1 ring-teal-500/30" : "hover:bg-neutral-800/30"
      }`}
      onClick={onSelect}
      data-block-id={block.id}
    >
      <ListTag className={`${block.ordered ? "list-decimal" : "list-disc"} list-inside space-y-1 text-neutral-200`}>
        {block.children.map((item) => (
          <li key={item.id} className="text-sm">
            {richTextToPlain(item.content)}
            {item.checked !== undefined && (
              <input
                type="checkbox"
                checked={item.checked}
                className="mr-2"
                readOnly
              />
            )}
          </li>
        ))}
      </ListTag>
    </div>
  );
}

/**
 * Quote Block Component
 */
function QuoteBlockComponent({
  block,
  isSelected,
  onSelect,
}: BlockComponentProps) {
  if (block._tag !== "Quote") return null;

  return (
    <div
      className={`tmnl-block tmnl-quote px-4 py-2 rounded transition-colors ${
        isSelected ? "bg-teal-500/10 ring-1 ring-teal-500/30" : "hover:bg-neutral-800/30"
      }`}
      onClick={onSelect}
      data-block-id={block.id}
    >
      <blockquote className="border-l-2 border-teal-500 pl-4 text-neutral-400 italic">
        {block.children.map((child) => (
          <BlockRenderer key={child.id} block={child} />
        ))}
      </blockquote>
    </div>
  );
}

/**
 * Divider Block Component
 */
function DividerBlockComponent({
  block,
  isSelected,
  onSelect,
}: BlockComponentProps) {
  if (block._tag !== "Divider") return null;

  return (
    <div
      className={`tmnl-block tmnl-divider py-4 ${
        isSelected ? "bg-teal-500/10" : ""
      }`}
      onClick={onSelect}
      data-block-id={block.id}
    >
      <hr className="border-neutral-700" />
    </div>
  );
}

/**
 * Image Block Component
 */
function ImageBlockComponent({
  block,
  isSelected,
  onSelect,
}: BlockComponentProps) {
  if (block._tag !== "Image") return null;

  return (
    <div
      className={`tmnl-block tmnl-image px-4 py-2 rounded transition-colors ${
        isSelected ? "bg-teal-500/10 ring-1 ring-teal-500/30" : "hover:bg-neutral-800/30"
      }`}
      onClick={onSelect}
      data-block-id={block.id}
    >
      <figure>
        <img
          src={block.src}
          alt={block.alt || ""}
          className="max-w-full rounded"
          style={{
            width: block.width,
            height: block.height,
          }}
        />
        {block.caption && (
          <figcaption className="text-xs text-neutral-500 mt-2 text-center">
            {block.caption}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

/**
 * Callout Block Component
 */
function CalloutBlockComponent({
  block,
  isSelected,
  onSelect,
}: BlockComponentProps) {
  if (block._tag !== "Callout") return null;

  const variantColors = {
    info: "border-blue-500 bg-blue-500/10",
    warning: "border-amber-500 bg-amber-500/10",
    error: "border-red-500 bg-red-500/10",
    success: "border-emerald-500 bg-emerald-500/10",
  };

  const variant = block.variant || "info";

  return (
    <div
      className={`tmnl-block tmnl-callout px-4 py-3 rounded border-l-2 ${variantColors[variant]} ${
        isSelected ? "ring-1 ring-teal-500/30" : ""
      }`}
      onClick={onSelect}
      data-block-id={block.id}
    >
      <div className="flex items-start gap-3">
        {block.icon && <span className="text-lg">{block.icon}</span>}
        <div className="flex-1">
          {block.children.map((child) => (
            <BlockRenderer key={child.id} block={child} />
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Block Component Registry
// =============================================================================

const BLOCK_COMPONENTS: Record<string, ComponentType<BlockComponentProps>> = {
  Paragraph: ParagraphBlockComponent,
  Heading: HeadingBlockComponent,
  Code: CodeBlockComponent,
  List: ListBlockComponent,
  Quote: QuoteBlockComponent,
  Divider: DividerBlockComponent,
  Image: ImageBlockComponent,
  Callout: CalloutBlockComponent,
};

// =============================================================================
// BlockRenderer
// =============================================================================

export interface BlockRendererProps {
  block: Block;
  selectedBlockId?: BlockId | null;
  onSelectBlock?: (id: BlockId) => void;
}

/**
 * BlockRenderer - renders a single block by type
 */
export function BlockRenderer({
  block,
  selectedBlockId,
  onSelectBlock,
}: BlockRendererProps) {
  const editor = useEditor();
  const Component = BLOCK_COMPONENTS[block._tag];

  if (!Component) {
    return (
      <div className="px-4 py-2 text-neutral-500 text-sm">
        Unknown block type: {block._tag}
      </div>
    );
  }

  const isSelected = selectedBlockId === block.id;

  const handleSelect = () => {
    onSelectBlock?.(block.id);
  };

  const handleUpdate = (updater: (b: Block) => Block) => {
    editor.updateBlock(block.id, updater);
  };

  const handleDelete = () => {
    editor.deleteBlock(block.id);
  };

  const handleAddAfter = async (type: "paragraph" | "heading" | "code") => {
    switch (type) {
      case "paragraph":
        await editor.addParagraph("", block.id);
        break;
      case "heading":
        await editor.addHeading("", 2, block.id);
        break;
      case "code":
        await editor.addCodeBlock("", "typescript", block.id);
        break;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
    >
      <Component
        block={block}
        isSelected={isSelected}
        onSelect={handleSelect}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onAddAfter={handleAddAfter}
      />
    </motion.div>
  );
}

export default BlockRenderer;
