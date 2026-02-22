/**
 * TMNL Block Editor
 *
 * Native block-based document editor with Effect.Service architecture.
 * Inspired by AFFiNE's BlockSuite but implemented entirely with Effect + React.
 *
 * @module editor
 *
 * @example
 * ```tsx
 * import { Editor, useEditor } from "@/lib/editor";
 *
 * function MyEditor() {
 *   return <Editor className="h-full" />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Using the hook directly
 * import { useEditor } from "@/lib/editor";
 *
 * function MyComponent() {
 *   const editor = useEditor();
 *
 *   const handleAdd = async () => {
 *     await editor.addParagraph("Hello world!");
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleAdd}>Add Paragraph</button>
 *       <div>Blocks: {editor.blocks.length}</div>
 *     </div>
 *   );
 * }
 * ```
 */

// Schemas
export * from "./schemas";

// Services
export * from "./services";

// Events (EventLog integration)
export * from "./events";

// Atoms (base)
export * from "./atoms";

// Atoms (EventLog-aware) - use these for full event sourcing
export * as EventLogAtoms from "./atoms/eventlog";

// Hooks
export * from "./hooks";

// Components
export * from "./components";
