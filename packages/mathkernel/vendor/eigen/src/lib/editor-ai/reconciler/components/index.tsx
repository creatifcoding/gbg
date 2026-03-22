/**
 * Block Components for Document Reconciler
 *
 * These are React components that represent ProseMirror nodes.
 * They don't render DOM directly - the reconciler uses them to
 * build the PM node tree via PMHostConfig.
 *
 * Usage:
 * ```tsx
 * import { Doc, Paragraph, Heading, Text } from './components'
 *
 * reconciler.render(
 *   <Doc>
 *     <Heading level={1}>
 *       <Text>Hello World</Text>
 *     </Heading>
 *     <Paragraph>
 *       <Text>Some content here</Text>
 *     </Paragraph>
 *   </Doc>
 * )
 * ```
 *
 * @module editor-ai/reconciler/components
 */

import { createElement, type ReactNode, type FC } from 'react'

// =============================================================================
// Component Props Types
// =============================================================================

interface DocProps {
  children?: ReactNode
}

interface ParagraphProps {
  children?: ReactNode
}

interface HeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6
  children?: ReactNode
}

interface TextProps {
  children: string
  marks?: readonly MarkProps[]
}

interface MarkProps {
  type: string
  attrs?: Record<string, unknown>
}

interface CodeBlockProps {
  language?: string
  children?: ReactNode
}

interface BlockquoteProps {
  children?: ReactNode
}

interface BulletListProps {
  children?: ReactNode
}

interface OrderedListProps {
  start?: number
  children?: ReactNode
}

interface ListItemProps {
  children?: ReactNode
}

interface HorizontalRuleProps {}

// Custom TMNL Blocks

interface MapBlockProps {
  viewState?: {
    center?: [number, number]
    zoom?: number
    pitch?: number
    bearing?: number
  }
  markers?: readonly {
    id: string
    lngLat: [number, number]
    label?: string
  }[]
}

interface Scene3DBlockProps {
  sceneConfig?: {
    cameraPosition?: [number, number, number]
    cameraTarget?: [number, number, number]
  }
  objects?: readonly {
    id: string
    type: 'box' | 'sphere' | 'cylinder' | 'plane'
    position?: [number, number, number]
    color?: string
  }[]
}

interface DataGridBlockProps {
  columnDefs?: readonly {
    field: string
    headerName?: string
    width?: number
  }[]
  rowData?: readonly Record<string, unknown>[]
}

// =============================================================================
// Standard Block Components
// =============================================================================

/**
 * Document root node.
 * Always the outermost element in a reconciled document.
 */
export const Doc: FC<DocProps> = ({ children }) => {
  return createElement('doc', {}, children)
}

/**
 * Paragraph block.
 */
export const Paragraph: FC<ParagraphProps> = ({ children }) => {
  return createElement('paragraph', {}, children)
}

/**
 * Heading block with level 1-6.
 */
export const Heading: FC<HeadingProps> = ({ level, children }) => {
  return createElement('heading', { attrs: { level } }, children)
}

/**
 * Text node with optional marks.
 */
export const Text: FC<TextProps> = ({ children, marks }) => {
  return createElement('text', { text: children, marks })
}

/**
 * Code block with optional language.
 */
export const CodeBlock: FC<CodeBlockProps> = ({ language, children }) => {
  return createElement(
    'codeBlock',
    { attrs: language ? { language } : {} },
    children
  )
}

/**
 * Blockquote container.
 */
export const Blockquote: FC<BlockquoteProps> = ({ children }) => {
  return createElement('blockquote', {}, children)
}

/**
 * Bullet (unordered) list.
 */
export const BulletList: FC<BulletListProps> = ({ children }) => {
  return createElement('bulletList', {}, children)
}

/**
 * Ordered (numbered) list.
 */
export const OrderedList: FC<OrderedListProps> = ({ start, children }) => {
  return createElement(
    'orderedList',
    { attrs: start ? { start } : {} },
    children
  )
}

/**
 * List item (used inside BulletList or OrderedList).
 */
export const ListItem: FC<ListItemProps> = ({ children }) => {
  return createElement('listItem', {}, children)
}

/**
 * Horizontal rule (divider).
 */
export const HorizontalRule: FC<HorizontalRuleProps> = () => {
  return createElement('horizontalRule', {})
}

// =============================================================================
// Custom TMNL Block Components
// =============================================================================

/**
 * MapBlock - Embedded MapLibre visualization.
 */
export const MapBlock: FC<MapBlockProps> = ({ viewState, markers }) => {
  return createElement('mapBlock', {
    attrs: {
      viewState,
      markers,
    },
  })
}

/**
 * Scene3DBlock - Three.js 3D visualization.
 */
export const Scene3DBlock: FC<Scene3DBlockProps> = ({ sceneConfig, objects }) => {
  return createElement('scene3dBlock', {
    attrs: {
      sceneConfig,
      objects,
    },
  })
}

/**
 * DataGridBlock - AG-Grid data table.
 */
export const DataGridBlock: FC<DataGridBlockProps> = ({ columnDefs, rowData }) => {
  return createElement('dataGridBlock', {
    attrs: {
      columnDefs,
      rowData,
    },
  })
}

// =============================================================================
// Mark Components (for text formatting)
// =============================================================================

interface BoldProps {
  children: ReactNode
}

interface ItalicProps {
  children: ReactNode
}

interface CodeProps {
  children: ReactNode
}

interface LinkProps {
  href: string
  title?: string
  children: ReactNode
}

interface StrikeProps {
  children: ReactNode
}

/**
 * Bold text mark.
 * Wraps text nodes with bold formatting.
 */
export const Bold: FC<BoldProps> = ({ children }) => {
  // Marks are applied to text nodes, not as wrapper elements
  // This component is a convenience for building marked text
  return createElement('mark', { type: 'bold' }, children)
}

/**
 * Italic text mark.
 */
export const Italic: FC<ItalicProps> = ({ children }) => {
  return createElement('mark', { type: 'italic' }, children)
}

/**
 * Inline code mark.
 */
export const Code: FC<CodeProps> = ({ children }) => {
  return createElement('mark', { type: 'code' }, children)
}

/**
 * Link mark.
 */
export const Link: FC<LinkProps> = ({ href, title, children }) => {
  return createElement('mark', { type: 'link', attrs: { href, title } }, children)
}

/**
 * Strikethrough mark.
 */
export const Strike: FC<StrikeProps> = ({ children }) => {
  return createElement('mark', { type: 'strike' }, children)
}

// =============================================================================
// Helper: Build Text with Marks
// =============================================================================

/**
 * Create a text node with multiple marks applied.
 * Convenience function for complex text formatting.
 *
 * @example
 * ```tsx
 * const node = createMarkedText('Click here', [
 *   { type: 'bold' },
 *   { type: 'link', attrs: { href: 'https://example.com' } }
 * ])
 * ```
 */
export function createMarkedText(
  text: string,
  marks: readonly MarkProps[]
): ReactNode {
  return createElement('text', { text, marks })
}

// =============================================================================
// Component Registry
// =============================================================================

/**
 * Registry of all block components by type name.
 * Useful for dynamic component rendering.
 */
export const BlockComponents = {
  // Document structure
  doc: Doc,
  paragraph: Paragraph,
  heading: Heading,
  text: Text,

  // Standard blocks
  codeBlock: CodeBlock,
  blockquote: Blockquote,
  bulletList: BulletList,
  orderedList: OrderedList,
  listItem: ListItem,
  horizontalRule: HorizontalRule,

  // Custom TMNL blocks
  mapBlock: MapBlock,
  scene3dBlock: Scene3DBlock,
  dataGridBlock: DataGridBlock,
} as const

/**
 * Get a component by type name.
 */
export function getBlockComponent(type: string): FC<unknown> | undefined {
  return BlockComponents[type as keyof typeof BlockComponents] as FC<unknown> | undefined
}

// =============================================================================
// JSON to Components Converter
// =============================================================================

import type { JSONNode, JSONDocument } from '../types'

/**
 * Convert a JSONNode to React elements using block components.
 * This is an alternative to DocumentReconciler.jsonToElements that
 * uses the typed component API.
 */
export function jsonNodeToComponent(node: JSONNode, key?: string | number): ReactNode {
  const Component = getBlockComponent(node.type)

  if (!Component) {
    console.warn(`[BlockComponents] Unknown node type: ${node.type}`)
    return null
  }

  // Text node
  if (node.type === 'text' && node.text) {
    return createElement(Text, { key, children: node.text, marks: node.marks })
  }

  // Container node
  const children = node.content?.map((child, i) => jsonNodeToComponent(child, i))

  return createElement(Component, { key, ...node.attrs }, children)
}

/**
 * Convert a JSONDocument to React elements.
 */
export function jsonDocumentToComponents(doc: JSONDocument): ReactNode {
  const children = doc.content?.map((child, i) => jsonNodeToComponent(child, i))
  return createElement(Doc, {}, children)
}
