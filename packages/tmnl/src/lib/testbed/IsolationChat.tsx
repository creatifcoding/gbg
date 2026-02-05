/**
 * IsolationChat
 *
 * AI SDK-powered chat component for the isolation modal.
 * Provides AI-driven design assistance for the isolated component.
 *
 * Uses useChatWithTools hook with full dependency injection.
 * RVN Brutalist styling - high contrast, bold borders, monospace.
 * Full TipTap input with history, keyboard shortcuts, and design actions.
 */

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Placeholder from '@tiptap/extension-placeholder'
import History from '@tiptap/extension-history'
import type { UIMessage } from 'ai'

import {
  useChatWithTools,
  ThinkingSection,
  ToolCallBlock,
  CopyButton,
  type ToolCallBlockProps,
} from '@/lib/ai-core'
import { uiMessageToChatMessage } from '@/lib/ai-core/types'
import { ScanlineDeclassify } from './ScanlineDeclassify'
import type { PropDoc, DesignAction } from './types'
import {
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_LETTER_SPACING,
  RVN_BORDERS,
  RVN_SHADOWS,
  RVN_PRESS_TRANSFORM,
  RVN_SPACING,
} from '@/lib/rvn/tokens'
import { Send, Loader2 } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface IsolationChatProps {
  /** Component label */
  label: string
  /** Component ID */
  componentId: string
  /** Component description */
  description?: string
  /** Prop documentation */
  propDocs?: PropDoc[]
  /** Source code */
  source?: string
  /** Callback when design action is requested */
  onDesignAction?: (action: DesignAction) => void
  /**
   * External messages for controlled mode.
   * When provided, component uses these instead of localStorage.
   * For session integration with SessionAwareChat.
   */
  externalMessages?: UIMessage[]
  /**
   * Callback when messages change (controlled mode).
   * Called after message updates for parent synchronization.
   */
  onMessagesChange?: (messages: UIMessage[]) => void
  /**
   * Callback when streaming state changes (controlled mode).
   * Allows parent to track streaming state.
   */
  onStreamingChange?: (isStreaming: boolean) => void
}

export interface ChatInputRef {
  focus: () => void
  blur: () => void
  clear: () => void
  setValue: (text: string) => void
  getValue: () => string
}

// =============================================================================
// RVN Styles (Inverted Theme: Light bg, Dark contrast islands)
// =============================================================================

const rvnStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    background: RVN_COLORS.bg,
    color: RVN_COLORS.textMain,
    fontFamily: RVN_FONTS.sans,
  },
  header: {
    padding: `${RVN_SPACING.s} ${RVN_SPACING.cardPadding}`,
    borderBottom: RVN_BORDERS.primary,
    background: RVN_COLORS.white,
  },
  headerTitle: {
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.black,
    textTransform: 'uppercase' as const,
    letterSpacing: RVN_LETTER_SPACING.wide,
    color: RVN_COLORS.black,
  },
  headerSubtitle: {
    fontSize: RVN_FONT_SIZES.label,
    color: RVN_COLORS.textMuted,
    marginTop: '2px',
    fontFamily: RVN_FONTS.mono,
  },
  messagesArea: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: RVN_SPACING.cardPadding,
    background: RVN_COLORS.bg,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: RVN_COLORS.textMuted,
    fontSize: RVN_FONT_SIZES.label,
    textAlign: 'center' as const,
    gap: RVN_SPACING.s,
  },
  emptyIcon: {
    fontSize: '24px',
    filter: 'grayscale(100%)',
  },
  emptyHint: {
    fontSize: RVN_FONT_SIZES.label,
    color: RVN_COLORS.textSubtle,
    fontFamily: RVN_FONTS.mono,
  },
  userPrompt: {
    padding: `${RVN_SPACING.s} ${RVN_SPACING.s}`,
    background: RVN_COLORS.white,
    borderLeft: `${RVN_BORDERS.widthCard} solid ${RVN_COLORS.black}`,
    marginBottom: RVN_SPACING.s,
    fontSize: RVN_FONT_SIZES.body,
    color: RVN_COLORS.textMuted,
    fontFamily: RVN_FONTS.mono,
    textTransform: 'uppercase' as const,
  },
  responseArea: {
    padding: `0 ${RVN_SPACING.s} ${RVN_SPACING.cardPadding}`,
  },
  // Container for streaming text - isolates layout to prevent reflow jitter
  textBlock: {
    marginBottom: '8px',
    color: RVN_COLORS.textMain,
    background: RVN_COLORS.bg,
    contain: 'layout paint',  // Isolate reflows to this container
    overflowWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
  },
  inputArea: {
    borderTop: RVN_BORDERS.primary,
    padding: RVN_SPACING.s,
    background: RVN_COLORS.white,
  },
  inputContainer: {
    display: 'flex',
    gap: RVN_SPACING.xs,
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    background: RVN_COLORS.white,
    border: RVN_BORDERS.card,
    borderColor: RVN_COLORS.borderMuted,
    padding: `${RVN_SPACING.s} 14px`,
    fontSize: RVN_FONT_SIZES.body,
    color: RVN_COLORS.textMain,
    fontFamily: RVN_FONTS.mono,
    minHeight: '44px',
    maxHeight: '150px',
    overflow: 'auto',
    transition: 'border-color 0.15s',
    borderRadius: RVN_BORDERS.radius,
  },
  inputWrapperFocused: {
    borderColor: RVN_COLORS.black,
  },
  inputWrapperDisabled: {
    background: RVN_COLORS.surfaceMuted,
    color: RVN_COLORS.textSubtle,
    borderColor: RVN_COLORS.borderMuted,
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: RVN_COLORS.black,
    color: RVN_COLORS.white,
    border: 'none',
    width: '44px',
    height: '44px',
    minHeight: '44px',
    cursor: 'pointer',
    boxShadow: RVN_SHADOWS.default,
    transition: 'transform 0.1s, box-shadow 0.1s',
    borderRadius: RVN_BORDERS.radius,
  },
  submitButtonPressed: RVN_PRESS_TRANSFORM,
  submitButtonDisabled: {
    background: RVN_COLORS.borderMuted,
    color: RVN_COLORS.textSubtle,
    boxShadow: 'none',
    cursor: 'not-allowed',
  },
  processingIndicator: {
    color: '#888',
    fontSize: RVN_FONT_SIZES.label,
    fontFamily: RVN_FONTS.mono,
    textTransform: 'uppercase' as const,
  },
  streamingCursor: {
    display: 'inline-block',
    width: '8px',
    height: '16px',
    background: RVN_COLORS.black,
    marginLeft: '4px',
    animation: 'blink 1s step-end infinite',
    verticalAlign: 'text-bottom',
  },
  streamingCursorBlock: {
    padding: '4px 0',
    marginTop: '8px',
  },
  error: {
    color: '#ff3333',
    fontSize: RVN_FONT_SIZES.label,
    fontFamily: RVN_FONTS.mono,
    padding: '8px',
    border: '2px solid #ff3333',
    background: '#1a0000',
  },
}

// =============================================================================
// Inject TipTap Styles
// =============================================================================

const isolationChatStyles = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .isolation-chat-input .ProseMirror {
    outline: none;
    min-height: 24px;
    max-height: 100px;
    overflow-y: auto;
    line-height: 1.5;
  }

  .isolation-chat-input .ProseMirror p {
    margin: 0;
  }

  .isolation-chat-input .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: #999;
    pointer-events: none;
    height: 0;
    font-style: normal;
    text-transform: uppercase;
    font-size: 12px;
    letter-spacing: 0.05em;
  }

  .isolation-chat-input .ProseMirror:focus {
    outline: none;
  }

  .isolation-chat-input .ProseMirror::-webkit-scrollbar {
    width: 4px;
  }

  .isolation-chat-input .ProseMirror::-webkit-scrollbar-track {
    background: transparent;
  }

  .isolation-chat-input .ProseMirror::-webkit-scrollbar-thumb {
    background: #ccc;
  }
`

let stylesInjected = false

function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return
  const styleEl = document.createElement('style')
  styleEl.id = 'isolation-chat-styles'
  styleEl.textContent = isolationChatStyles
  document.head.appendChild(styleEl)
  stylesInjected = true
}

// =============================================================================
// History Management
// =============================================================================

const MAX_HISTORY = 100
const STORAGE_KEY_PREFIX = 'isolation-chat-history:'
const MESSAGES_STORAGE_KEY_PREFIX = 'isolation-chat-messages:'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// =============================================================================
// Interleaved Parts Reconstruction
// =============================================================================

/**
 * Tool part extracted from message.parts
 */
interface ExtractedToolPart {
  type: 'dynamic-tool' | string
  toolName: string
  toolCallId: string
  state: string
  input?: unknown
  output?: unknown
  errorText?: string
}

/**
 * Reconstructed segment for rendering
 */
type ReconstructedSegment =
  | { type: 'text'; text: string; key: string }
  | { type: 'tool'; tool: ExtractedToolPart; key: string }

/**
 * Patterns that typically indicate where a tool call occurred in the text.
 * We look for these phrases to find split points.
 */
const TOOL_INTRO_PATTERNS = [
  // "Let me [verb] the/that/this file/code/content"
  /let me [\w\s]{1,30}(file|directory|code|content|output|result)/i,
  // "I'll [verb] the/that/this file/code"
  /i['']?ll [\w\s]{1,30}(file|directory|code|content|output|result)/i,
  // Direct action phrases
  /let me (read|check|search|look|examine|run|execute|find|grep|list)/i,
  /i['']?ll (read|check|search|look|examine|run|execute|find|grep|list)/i,
  // Checking/Looking patterns
  /(checking|looking at|reading|examining|searching|running|executing)/i,
]

/**
 * Reconstructs interleaved parts when the provider sends all text in one part.
 * Strategy:
 * 1. Split text into paragraphs
 * 2. Find paragraphs that introduce tools (patterns) OR distribute evenly
 * 3. Place tools after their intro paragraphs, or distribute if no patterns match
 */
function reconstructInterleavedParts(
  fullText: string,
  toolParts: ExtractedToolPart[]
): ReconstructedSegment[] {
  if (toolParts.length === 0) {
    return [{ type: 'text', text: fullText, key: 'text-0' }]
  }

  // Split text into paragraphs (double newline separated)
  const paragraphs = fullText.split(/\n\n+/).filter(p => p.trim())

  // If only one paragraph or fewer paragraphs than tools, use sentence splitting
  if (paragraphs.length <= toolParts.length) {
    return reconstructBySentences(fullText, toolParts)
  }

  // Score each paragraph for likelihood of introducing a tool
  const paragraphScores = paragraphs.map((p, i) => {
    let score = 0
    // Pattern match gives high score
    if (TOOL_INTRO_PATTERNS.some(pattern => pattern.test(p))) {
      score += 10
    }
    // Short paragraphs that end with action words
    if (p.length < 200 && /[.:]$/.test(p.trim())) {
      score += 2
    }
    // Contains file paths or code references
    if (/`[^`]+`|\/[\w/.-]+\.\w+/.test(p)) {
      score += 3
    }
    // Not the last paragraph (tools usually have text after)
    if (i < paragraphs.length - 1) {
      score += 1
    }
    return { index: i, paragraph: p, score }
  })

  // Find the N highest-scoring paragraphs for N tools
  const sortedByScore = [...paragraphScores]
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, toolParts.length)
    .sort((a, b) => a.index - b.index) // Re-sort by position

  // If we didn't find enough high-scoring paragraphs, distribute evenly
  const toolPlacements: number[] = []
  if (sortedByScore.length < toolParts.length) {
    // Distribute tools evenly across paragraphs
    const step = Math.floor(paragraphs.length / (toolParts.length + 1))
    for (let i = 0; i < toolParts.length; i++) {
      toolPlacements.push(Math.min(step * (i + 1) - 1, paragraphs.length - 2))
    }
  } else {
    // Use scored placements
    sortedByScore.forEach(p => toolPlacements.push(p.index))
  }

  // Build result by iterating paragraphs and inserting tools at placement points
  const result: ReconstructedSegment[] = []
  let toolIndex = 0
  let accumulatedText = ''

  for (let i = 0; i < paragraphs.length; i++) {
    accumulatedText += (accumulatedText ? '\n\n' : '') + paragraphs[i]

    // Check if we should place a tool after this paragraph
    if (toolIndex < toolParts.length && toolPlacements.includes(i)) {
      // Output text, then tool
      if (accumulatedText.trim()) {
        result.push({ type: 'text', text: accumulatedText, key: `text-${result.length}` })
      }
      result.push({ type: 'tool', tool: toolParts[toolIndex], key: toolParts[toolIndex].toolCallId })
      toolIndex++
      accumulatedText = ''
    }
  }

  // Output any remaining text
  if (accumulatedText.trim()) {
    result.push({ type: 'text', text: accumulatedText, key: `text-${result.length}` })
  }

  // Add any remaining tools (shouldn't happen but safety net)
  while (toolIndex < toolParts.length) {
    result.push({ type: 'tool', tool: toolParts[toolIndex], key: toolParts[toolIndex].toolCallId })
    toolIndex++
  }

  return result
}

/**
 * Fallback: Split by sentences when paragraphs don't work.
 * Distributes tools evenly across the sentence stream.
 */
function reconstructBySentences(
  fullText: string,
  toolParts: ExtractedToolPart[]
): ReconstructedSegment[] {
  const sentences = fullText.split(/(?<=[.!?])\s+/).filter(s => s.trim())

  if (sentences.length <= 1) {
    // Can't split - put text first, then all tools
    const result: ReconstructedSegment[] = [
      { type: 'text', text: fullText, key: 'text-0' }
    ]
    toolParts.forEach(tool => {
      result.push({ type: 'tool', tool, key: tool.toolCallId })
    })
    return result
  }

  // Find sentences that match intro patterns
  const introIndices: number[] = []
  sentences.forEach((s, i) => {
    if (TOOL_INTRO_PATTERNS.some(pattern => pattern.test(s))) {
      introIndices.push(i)
    }
  })

  // Determine where to place each tool
  const placements: number[] = []
  if (introIndices.length >= toolParts.length) {
    // Use first N intro sentences
    placements.push(...introIndices.slice(0, toolParts.length))
  } else {
    // Mix intro sentences with evenly distributed fallbacks
    const step = Math.floor(sentences.length / (toolParts.length + 1))
    for (let i = 0; i < toolParts.length; i++) {
      if (i < introIndices.length) {
        placements.push(introIndices[i])
      } else {
        // Distribute remaining evenly, avoiding already-used positions
        let pos = step * (i + 1) - 1
        while (placements.includes(pos) && pos < sentences.length - 1) pos++
        placements.push(Math.min(pos, sentences.length - 2))
      }
    }
    // Sort placements so tools appear in order
    placements.sort((a, b) => a - b)
  }

  // Build result
  const result: ReconstructedSegment[] = []
  let toolIndex = 0
  let accumulatedSentences: string[] = []

  for (let i = 0; i < sentences.length; i++) {
    accumulatedSentences.push(sentences[i])

    if (toolIndex < toolParts.length && placements[toolIndex] === i) {
      // Output accumulated text, then tool
      const text = accumulatedSentences.join(' ')
      if (text.trim()) {
        result.push({ type: 'text', text, key: `text-${result.length}` })
      }
      result.push({ type: 'tool', tool: toolParts[toolIndex], key: toolParts[toolIndex].toolCallId })
      toolIndex++
      accumulatedSentences = []
    }
  }

  // Output remaining text
  if (accumulatedSentences.length > 0) {
    const text = accumulatedSentences.join(' ')
    if (text.trim()) {
      result.push({ type: 'text', text, key: `text-${result.length}` })
    }
  }

  // Safety net for remaining tools
  while (toolIndex < toolParts.length) {
    result.push({ type: 'tool', tool: toolParts[toolIndex], key: toolParts[toolIndex].toolCallId })
    toolIndex++
  }

  return result
}

// =============================================================================
// Message Renderer
// =============================================================================

interface MessageRendererProps {
  message: UIMessage
  isStreaming: boolean
  componentId: string
  onDesignAction?: (action: DesignAction) => void
}

/**
 * Committed segment for incremental rendering.
 * Once a segment is committed, its content doesn't change (prevents layout jumps).
 */
interface CommittedSegment {
  type: 'text' | 'tool'
  key: string
  // For text segments
  text?: string
  // For tool segments
  tool?: ExtractedToolPart
}

/**
 * Memoized message renderer to prevent unnecessary re-renders.
 * Uses incremental segment commitment to prevent layout jumps during streaming.
 */
const MessageRenderer = React.memo<MessageRendererProps>(function MessageRenderer({
  message,
  isStreaming,
  componentId,
  onDesignAction,
}) {
  // Convert to our ChatMessage for easier access (memoized)
  const chatMessage = React.useMemo(
    () => uiMessageToChatMessage(message, isStreaming),
    [message, isStreaming]
  )

  // Memoize parts analysis to avoid recalculation on every render
  const partsAnalysis = React.useMemo(() => {
    const parts = message.parts ?? []
    const textParts = parts.filter(p => p.type === 'text')
    const toolParts = parts.filter(p => p.type === 'dynamic-tool' || p.type.startsWith('tool-'))
    const needsReconstruction = textParts.length === 1 && toolParts.length > 0
    return { parts, textParts, toolParts, needsReconstruction }
  }, [message.parts])

  // Track commit points: when each tool first appeared, what was the text length?
  // This lets us split text correctly: text[0:commitPoint1] is before tool1, etc.
  const toolCommitPointsRef = React.useRef<Map<string, number>>(new Map())

  // Build incremental segments during streaming
  // Key insight: when a tool FIRST appears, the CURRENT text is everything before that tool
  const incrementalSegments = React.useMemo(() => {
    if (!partsAnalysis.needsReconstruction) return null
    if (!isStreaming) return null // Use full reconstruction when not streaming

    const fullText = (partsAnalysis.textParts[0] as { text: string }).text
    const tools = partsAnalysis.toolParts.map(p => {
      if (p.type === 'dynamic-tool') {
        const dp = p as { type: 'dynamic-tool'; toolName: string; toolCallId: string; state: string; input?: unknown; output?: unknown; errorText?: string }
        return { type: 'dynamic-tool' as const, toolName: dp.toolName, toolCallId: dp.toolCallId, state: dp.state, input: dp.input, output: dp.output, errorText: dp.errorText }
      } else {
        const tp = p as { type: string; toolCallId: string; state: string; input?: unknown; output?: unknown; errorText?: string }
        return { type: tp.type, toolName: tp.type.replace(/^tool-/, ''), toolCallId: tp.toolCallId, state: tp.state, input: tp.input, output: tp.output, errorText: tp.errorText }
      }
    })

    // Record commit points for new tools (BEFORE building segments)
    for (const tool of tools) {
      if (!toolCommitPointsRef.current.has(tool.toolCallId)) {
        // New tool! Record current text length as its commit point
        // Everything up to this point is "before" this tool
        toolCommitPointsRef.current.set(tool.toolCallId, fullText.length)
      }
    }

    // Build segments using commit points
    const segments: CommittedSegment[] = []
    let textCursor = 0

    for (const tool of tools) {
      const commitPoint = toolCommitPointsRef.current.get(tool.toolCallId) ?? fullText.length

      // Text before this tool (from cursor to commit point)
      if (commitPoint > textCursor) {
        const textSegment = fullText.slice(textCursor, commitPoint)
        if (textSegment.trim()) {
          segments.push({
            type: 'text',
            key: `text-before-${tool.toolCallId}`,
            text: textSegment,
          })
        }
        textCursor = commitPoint
      }

      // The tool itself
      segments.push({
        type: 'tool',
        key: tool.toolCallId,
        tool,
      })
    }

    // Trailing text (after all tools)
    if (textCursor < fullText.length) {
      const trailingText = fullText.slice(textCursor)
      if (trailingText.trim()) {
        segments.push({
          type: 'text',
          key: 'trailing-text',
          text: trailingText,
        })
      }
    }

    return segments
  }, [partsAnalysis, isStreaming])

  // Reset refs when message changes (new message)
  const messageIdRef = React.useRef(message.id)
  if (message.id !== messageIdRef.current) {
    messageIdRef.current = message.id
    toolCommitPointsRef.current = new Map()
  }

  // Memoize reconstructed parts for completed messages
  const reconstructedSegments = React.useMemo(() => {
    if (!partsAnalysis.needsReconstruction) return null
    if (isStreaming) return null // Use incremental during streaming

    const fullText = (partsAnalysis.textParts[0] as { text: string }).text
    const extractedTools: ExtractedToolPart[] = partsAnalysis.toolParts.map(p => {
      if (p.type === 'dynamic-tool') {
        const dp = p as { type: 'dynamic-tool'; toolName: string; toolCallId: string; state: string; input?: unknown; output?: unknown; errorText?: string }
        return { type: 'dynamic-tool', toolName: dp.toolName, toolCallId: dp.toolCallId, state: dp.state, input: dp.input, output: dp.output, errorText: dp.errorText }
      } else {
        const tp = p as { type: string; toolCallId: string; state: string; input?: unknown; output?: unknown; errorText?: string }
        return { type: tp.type, toolName: tp.type.replace(/^tool-/, ''), toolCallId: tp.toolCallId, state: tp.state, input: tp.input, output: tp.output, errorText: tp.errorText }
      }
    })

    return reconstructInterleavedParts(fullText, extractedTools)
  }, [partsAnalysis, isStreaming])

  if (message.role === 'user') {
    // Get text from user message - may be in parts or content
    const parts = message.parts ?? []
    let text: string
    if (parts.length > 0) {
      text = parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as { text: string }).text)
        .join('')
    } else if ('content' in message && typeof message.content === 'string') {
      text = message.content
    } else {
      text = ''
    }
    return <div style={rvnStyles.userPrompt}>&gt; {text}</div>
  }

  // Assistant message
  return (
    <div style={rvnStyles.responseArea}>
      {/* Thinking section */}
      {chatMessage.hasThinking && (
        <ThinkingSection thinking={chatMessage.thinking!} />
      )}

      {/* Processing indicator when streaming with no content yet */}
      {isStreaming && !chatMessage.hasText && !chatMessage.hasThinking && chatMessage.toolCalls.length === 0 && (
        <div style={rvnStyles.processingIndicator}>PROCESSING...</div>
      )}

      {/* Render parts in order (text and tools interleaved) */}
      {(() => {
        const { parts, needsReconstruction } = partsAnalysis

        // Fallback: if no parts but has text content (older message format)
        if (parts.length === 0 && chatMessage.hasText) {
          return (
            <div style={rvnStyles.textBlock}>
              <ScanlineDeclassify
                text={chatMessage.text!}
                isStreaming={isStreaming}
              />
            </div>
          )
        }

        // During streaming: use incremental segments (committed + trailing)
        // This prevents layout jumps by locking segments once tools arrive
        if (isStreaming && incrementalSegments && incrementalSegments.length > 0) {
          const lastIdx = incrementalSegments.length - 1
          const lastSeg = incrementalSegments[lastIdx]
          const lastIsText = lastSeg?.type === 'text'

          return incrementalSegments.map((seg, idx) => {
            if (seg.type === 'text' && seg.text) {
              const isLast = idx === lastIdx && lastIsText
              return (
                <div key={seg.key} style={rvnStyles.textBlock}>
                  <ScanlineDeclassify
                    text={seg.text}
                    isStreaming={isStreaming && isLast}
                  />
                </div>
              )
            } else if (seg.type === 'tool' && seg.tool) {
              const tool = seg.tool
              const status = tool.state === 'output-available' ? 'complete'
                : tool.state === 'output-error' ? 'error'
                : tool.state === 'input-streaming' ? 'pending'
                : 'running'

              return (
                <div key={seg.key} style={{ margin: '8px 0' }}>
                  <ToolCallBlock
                    call={{
                      toolCallId: tool.toolCallId,
                      toolName: tool.toolName,
                      args: tool.input,
                    }}
                    result={
                      status === 'complete' || status === 'error'
                        ? {
                            isError: status === 'error',
                            errorMessage: tool.errorText,
                            result: tool.output,
                          }
                        : undefined
                    }
                    status={status as 'pending' | 'running' | 'complete' | 'error'}
                    componentId={componentId}
                    onDesignAction={onDesignAction ? (action: Parameters<NonNullable<ToolCallBlockProps['onDesignAction']>>[0]) => {
                      onDesignAction({
                        type: action.type,
                        componentId: action.componentId,
                        payload: action.payload,
                      })
                    } : undefined}
                  />
                </div>
              )
            }
            return null
          })
        }

        // After streaming: use full reconstruction for clean interleaved display
        if (needsReconstruction && reconstructedSegments && !isStreaming) {
          const lastOverallIndex = reconstructedSegments.length - 1
          const lastSegment = reconstructedSegments[lastOverallIndex]
          const lastOverallIsText = lastSegment?.type === 'text'

          return reconstructedSegments.map((segment, segmentIdx) => {
            if (segment.type === 'text') {
              // Only show cursor if this text is the LAST OVERALL segment (not just last text)
              // If a tool follows, the block cursor will show instead
              const isLastOverall = segmentIdx === lastOverallIndex && lastOverallIsText
              return (
                <div key={segment.key} style={rvnStyles.textBlock}>
                  <ScanlineDeclassify
                    text={segment.text}
                    isStreaming={isStreaming && isLastOverall}
                  />
                </div>
              )
            } else {
              const tool = segment.tool
              const status = tool.state === 'output-available' ? 'complete'
                : tool.state === 'output-error' ? 'error'
                : tool.state === 'input-streaming' ? 'pending'
                : 'running'

              return (
                <div key={segment.key} style={{ margin: '8px 0' }}>
                  <ToolCallBlock
                    call={{
                      toolCallId: tool.toolCallId,
                      toolName: tool.toolName,
                      args: tool.input,
                    }}
                    result={
                      status === 'complete' || status === 'error'
                        ? {
                            isError: status === 'error',
                            errorMessage: tool.errorText,
                            result: tool.output,
                          }
                        : undefined
                    }
                    status={status as 'pending' | 'running' | 'complete' | 'error'}
                    componentId={componentId}
                    onDesignAction={onDesignAction ? (action: Parameters<NonNullable<ToolCallBlockProps['onDesignAction']>>[0]) => {
                      onDesignAction({
                        type: action.type,
                        componentId: action.componentId,
                        payload: action.payload,
                      })
                    } : undefined}
                  />
                </div>
              )
            }
          })
        }

        // Normal rendering - parts are already interleaved or streaming
        return parts.map((part, idx) => {
          if (part.type === 'text') {
            const textPart = part as { type: 'text'; text: string }
            // Skip empty text parts
            if (!textPart.text.trim()) return null
            return (
              <div key={`text-${idx}`} style={rvnStyles.textBlock}>
                <ScanlineDeclassify
                  text={textPart.text}
                  isStreaming={isStreaming && idx === parts.length - 1}
                />
              </div>
            )
          } else if (part.type === 'step-start') {
            // Step boundary - renders as subtle separator between tool call and subsequent text
            // AI SDK uses step-start to indicate a new step (e.g., after tool result)
            return (
              <div
                key={`step-${idx}`}
                style={{
                  height: '1px',
                  background: RVN_COLORS.borderMuted,
                  margin: '12px 0',
                  opacity: 0.5,
                }}
              />
            )
          } else if (part.type === 'reasoning') {
            // Reasoning/thinking part - handled by ThinkingSection above
            // Skip here to avoid duplicate rendering
            return null
          } else if (part.type === 'dynamic-tool') {
            // Dynamic tool part - extract data directly from part
            const toolPart = part as {
              type: 'dynamic-tool'
              toolName: string
              toolCallId: string
              state: string
              input?: unknown
              output?: unknown
              errorText?: string
            }
            const status = toolPart.state === 'output-available' ? 'complete'
              : toolPart.state === 'output-error' ? 'error'
              : toolPart.state === 'input-streaming' ? 'pending'
              : 'running'

            return (
              <div key={toolPart.toolCallId} style={{ margin: '8px 0' }}>
                <ToolCallBlock
                  call={{
                    toolCallId: toolPart.toolCallId,
                    toolName: toolPart.toolName,
                    args: toolPart.input,
                  }}
                  result={
                    status === 'complete' || status === 'error'
                      ? {
                          isError: status === 'error',
                          errorMessage: toolPart.errorText,
                          result: toolPart.output,
                        }
                      : undefined
                  }
                  status={status}
                  componentId={componentId}
                  onDesignAction={onDesignAction ? (action: Parameters<NonNullable<ToolCallBlockProps['onDesignAction']>>[0]) => {
                    onDesignAction({
                      type: action.type,
                      componentId: action.componentId,
                      payload: action.payload,
                    })
                  } : undefined}
                />
              </div>
            )
          } else if (part.type.startsWith('tool-')) {
            // Static typed tool part (tool-{name} format)
            const toolPart = part as {
              type: string
              toolCallId: string
              state: string
              input?: unknown
              output?: unknown
              errorText?: string
            }
            const toolName = part.type.replace(/^tool-/, '')
            const status = toolPart.state === 'output-available' ? 'complete'
              : toolPart.state === 'output-error' ? 'error'
              : toolPart.state === 'input-streaming' ? 'pending'
              : 'running'

            return (
              <div key={toolPart.toolCallId} style={{ margin: '8px 0' }}>
                <ToolCallBlock
                  call={{
                    toolCallId: toolPart.toolCallId,
                    toolName: toolName,
                    args: toolPart.input,
                  }}
                  result={
                    status === 'complete' || status === 'error'
                      ? {
                          isError: status === 'error',
                          errorMessage: toolPart.errorText,
                          result: toolPart.output,
                        }
                      : undefined
                  }
                  status={status}
                  componentId={componentId}
                  onDesignAction={onDesignAction ? (action: Parameters<NonNullable<ToolCallBlockProps['onDesignAction']>>[0]) => {
                    onDesignAction({
                      type: action.type,
                      componentId: action.componentId,
                      payload: action.payload,
                    })
                  } : undefined}
                />
              </div>
            )
          }
          return null
        })
      })()}

      {/* Streaming cursor after tool blocks - shows when AI is continuing after a tool call */}
      {isStreaming && (() => {
        // Determine if we need to show cursor (when last rendered element is a tool, not text)
        const { parts } = partsAnalysis
        const lastPart = parts[parts.length - 1]
        const lastIsToolOrEmpty = !lastPart || lastPart.type === 'dynamic-tool' || lastPart.type.startsWith('tool-')

        // Also show if we just have tools and no text yet
        const hasToolsNoTrailingText = parts.some(p =>
          p.type === 'dynamic-tool' || p.type.startsWith('tool-')
        ) && (lastIsToolOrEmpty || lastPart?.type === 'step-start')

        if (lastIsToolOrEmpty || hasToolsNoTrailingText) {
          return (
            <div style={rvnStyles.streamingCursorBlock}>
              <span style={rvnStyles.streamingCursor} />
            </div>
          )
        }
        return null
      })()}

      {/* Copy button for completed text */}
      {!isStreaming && chatMessage.hasText && (
        <div style={{ marginTop: '8px' }}>
          <CopyButton text={chatMessage.text!} />
        </div>
      )}
    </div>
  )
})

// =============================================================================
// Chat Input Component
// =============================================================================

interface ChatInputProps {
  componentId: string
  onSubmit: (text: string) => void
  placeholder?: string
  disabled?: boolean
  isStreaming?: boolean
  onAbort?: () => void
}

const ChatInput = React.forwardRef<ChatInputRef, ChatInputProps>(
  ({ componentId, onSubmit, placeholder, disabled, isStreaming, onAbort }, ref) => {
    const [focused, setFocused] = React.useState(false)
    const [submitPressed, setSubmitPressed] = React.useState(false)
    const isSubmittingRef = React.useRef(false)

    // History state
    const [history, setHistory] = React.useState<string[]>([])
    const [historyIndex, setHistoryIndex] = React.useState(-1)
    const historyRef = React.useRef(history)
    const historyIndexRef = React.useRef(historyIndex)
    historyRef.current = history
    historyIndexRef.current = historyIndex

    const storageKey = `${STORAGE_KEY_PREFIX}${componentId}`

    // Load history from localStorage
    React.useEffect(() => {
      try {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            setHistory(parsed.slice(-MAX_HISTORY))
          }
        }
      } catch {
        // Ignore parse errors
      }
    }, [storageKey])

    // Save history to localStorage
    React.useEffect(() => {
      if (history.length > 0) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(history))
        } catch {
          // Ignore storage errors
        }
      }
    }, [history, storageKey])

    // Inject styles
    React.useEffect(() => {
      injectStyles()
    }, [])

    // Create TipTap editor
    const editor = useEditor({
      extensions: [
        Document,
        Paragraph,
        Text,
        History,
        Placeholder.configure({
          placeholder: placeholder ?? 'ENTER COMMAND...',
          showOnlyWhenEditable: true,
        }),
      ],
      content: '',
      editable: !disabled,
      autofocus: true,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    })

    // Handle submit
    const handleSubmit = React.useCallback(() => {
      if (!editor || isSubmittingRef.current || disabled) return

      const text = editor.getText().trim()
      if (!text) return

      isSubmittingRef.current = true

      // Add to history
      setHistory((prev) => {
        const filtered = prev.filter((h) => h !== text)
        return [...filtered, text].slice(-MAX_HISTORY)
      })
      setHistoryIndex(-1)

      // Clear and submit
      editor.commands.clearContent()
      onSubmit(text)

      setTimeout(() => {
        isSubmittingRef.current = false
      }, 100)
    }, [editor, disabled, onSubmit])

    // Handle key down for history navigation
    React.useEffect(() => {
      if (!editor) return

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp' && !event.shiftKey) {
          const hist = historyRef.current
          if (hist.length === 0) return
          event.preventDefault()

          const currentIdx = historyIndexRef.current
          const nextIndex = currentIdx === -1 ? hist.length - 1 : Math.max(0, currentIdx - 1)

          setHistoryIndex(nextIndex)
          const value = hist[nextIndex]
          if (value) {
            editor.commands.setContent(
              `<p>${escapeHtml(value).replace(/\n/g, '</p><p>')}</p>`
            )
            editor.commands.focus('end')
          }
        }

        if (event.key === 'ArrowDown' && !event.shiftKey) {
          const currentIdx = historyIndexRef.current
          if (currentIdx === -1) return
          event.preventDefault()

          const hist = historyRef.current
          const nextIndex = currentIdx + 1
          if (nextIndex >= hist.length) {
            setHistoryIndex(-1)
            editor.commands.clearContent()
          } else {
            setHistoryIndex(nextIndex)
            const value = hist[nextIndex]
            if (value) {
              editor.commands.setContent(
                `<p>${escapeHtml(value).replace(/\n/g, '</p><p>')}</p>`
              )
              editor.commands.focus('end')
            }
          }
        }

        if (event.key === 'Escape') {
          if (isStreaming && onAbort) {
            event.preventDefault()
            onAbort()
          }
        }

        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          handleSubmit()
        }

        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          setHistoryIndex(-1)
        }
      }

      const editorEl = editor.view.dom
      editorEl.addEventListener('keydown', handleKeyDown)
      return () => editorEl.removeEventListener('keydown', handleKeyDown)
    }, [editor, isStreaming, onAbort, handleSubmit])

    // Update editable state
    React.useEffect(() => {
      if (editor) {
        editor.setEditable(!disabled)
      }
    }, [editor, disabled])

    // Expose imperative handle
    React.useImperativeHandle(
      ref,
      () => ({
        focus: () => editor?.commands.focus('end'),
        blur: () => editor?.commands.blur(),
        clear: () => editor?.commands.clearContent(),
        setValue: (text: string) => {
          editor?.commands.setContent(
            text ? `<p>${escapeHtml(text).replace(/\n/g, '</p><p>')}</p>` : ''
          )
        },
        getValue: () => editor?.getText() ?? '',
      }),
      [editor]
    )

    const wrapperStyle = {
      ...rvnStyles.inputWrapper,
      ...(focused ? rvnStyles.inputWrapperFocused : {}),
      ...(disabled ? rvnStyles.inputWrapperDisabled : {}),
    }

    const buttonStyle = {
      ...rvnStyles.submitButton,
      ...(submitPressed ? rvnStyles.submitButtonPressed : {}),
      ...(disabled ? rvnStyles.submitButtonDisabled : {}),
    }

    return (
      <div style={rvnStyles.inputContainer}>
        <div className="isolation-chat-input" style={wrapperStyle}>
          <EditorContent editor={editor} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={disabled}
          onMouseDown={() => setSubmitPressed(true)}
          onMouseUp={() => setSubmitPressed(false)}
          onMouseLeave={() => setSubmitPressed(false)}
          style={buttonStyle}
        >
          {isStreaming ? (
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    )
  }
)

ChatInput.displayName = 'ChatInput'

// =============================================================================
// Main Component
// =============================================================================

export function IsolationChat({
  label,
  componentId,
  description,
  propDocs,
  source,
  onDesignAction,
  externalMessages,
  onMessagesChange,
  onStreamingChange,
}: IsolationChatProps) {
  // Controlled mode: when externalMessages is provided, use it instead of localStorage
  const isControlled = externalMessages !== undefined
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<ChatInputRef>(null)

  // Build system prompt with component context
  const systemPrompt = React.useMemo(() => {
    const parts: string[] = [
      `You are helping design the "${label}" component (ID: ${componentId}).`,
      '',
      '## Component Context',
    ]

    if (description) {
      parts.push(`**Description:** ${description}`)
    }

    if (propDocs && propDocs.length > 0) {
      parts.push(
        '',
        '## Available Props',
        '| Name | Type | Default | Description |',
        '|------|------|---------|-------------|',
        ...propDocs.map(
          (p) =>
            `| ${p.name} | ${p.type} | ${p.default ?? '-'} | ${p.description ?? '-'} |`
        )
      )
    }

    if (source) {
      parts.push(
        '',
        '## Current Source',
        '```tsx',
        source.slice(0, 1000),
        source.length > 1000 ? '// ... (truncated)' : '',
        '```'
      )
    }

    parts.push(
      '',
      '## Available Design Tokens (RVN)',
      '- **Colors:** black (#000), white (#fff), bg (#e6e6e6), textMuted (#666)',
      '- **Font sizes:** label (12px), body (13px), heading (14px), titleSm (24px)',
      '- **Borders:** 3px solid black (primary), 2px (cards), no border-radius',
      '- **Spacing:** xs (4px), s (10px), m (20px), l (30px), xl (60px)',
      '- **Shadows:** 4px 4px 0px black, removed on press with 4px translate',
      '',
      '## Instructions',
      'Help the user modify this component. When suggesting changes:',
      '1. Use RVN design tokens for consistency',
      '2. Emit structured tool calls when possible (apply_style, suggest_prop)',
      '3. Be concise and actionable',
      '4. Use UPPERCASE for emphasis in labels',
      '5. Minimum font size is 12px (THE FLOOR)',
      ''
    )

    return parts.join('\n')
  }, [label, componentId, description, propDocs, source])

  // Storage key for persisting messages
  const messagesStorageKey = `${MESSAGES_STORAGE_KEY_PREFIX}${componentId}`

  // Load messages - controlled mode uses externalMessages, uncontrolled uses localStorage
  const initialMessages = React.useMemo(() => {
    // Controlled mode: use externalMessages directly
    if (isControlled) {
      console.log('[IsolationChat] Controlled mode - using', externalMessages?.length ?? 0, 'external messages')
      return externalMessages?.length ? externalMessages : undefined
    }

    // Uncontrolled mode: load from localStorage
    try {
      const stored = localStorage.getItem(messagesStorageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('[IsolationChat] Loaded', parsed.length, 'messages from localStorage (sync)')
          return parsed
        }
      }
    } catch (err) {
      console.warn('[IsolationChat] Failed to load messages from localStorage:', err)
    }
    return undefined
  }, [isControlled, externalMessages, messagesStorageKey])

  // Use AI SDK chat hook (SDK 5.0+ uses sendMessage instead of append)
  const {
    messages,
    sendMessage,
    stop,
    isStreaming,
    error,
  } = useChatWithTools({
    systemPrompt,
    messages: initialMessages,
    onToolExecute: (toolName, args) => {
      console.log('[IsolationChat] Tool execute:', toolName, args)
    },
    onToolResult: (toolCallId, result, isError) => {
      console.log('[IsolationChat] Tool result:', toolCallId, result, isError)
    },
  })

  // Sync messages - controlled mode notifies parent, uncontrolled saves to localStorage
  React.useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      if (isControlled) {
        // Controlled mode: notify parent of message changes
        onMessagesChange?.(messages)
        console.log('[IsolationChat] Controlled mode - notified parent of', messages.length, 'messages')
      } else {
        // Uncontrolled mode: save to localStorage
        try {
          localStorage.setItem(messagesStorageKey, JSON.stringify(messages))
          console.log('[IsolationChat] Saved', messages.length, 'messages to localStorage')
        } catch (err) {
          console.warn('[IsolationChat] Failed to save messages to localStorage:', err)
        }
      }
    }
  }, [messages, isStreaming, isControlled, onMessagesChange, messagesStorageKey])

  // Handle send (AI SDK 5.0+ uses sendMessage({ text }) instead of append)
  const handleSend = React.useCallback(
    async (text: string) => {
      console.log('[IsolationChat] handleSend called:', { text, isStreaming })
      if (!text.trim() || isStreaming) {
        console.log('[IsolationChat] handleSend blocked:', { empty: !text.trim(), isStreaming })
        return
      }
      try {
        console.log('[IsolationChat] Calling sendMessage...')
        await sendMessage({ text })
        console.log('[IsolationChat] sendMessage completed')
      } catch (err) {
        console.error('[IsolationChat] sendMessage error:', err)
      }
    },
    [sendMessage, isStreaming]
  )

  // Debug: log messages changes
  React.useEffect(() => {
    console.log('[IsolationChat] messages updated:', messages.length, messages)
  }, [messages])

  // Debug: log errors
  React.useEffect(() => {
    if (error) {
      console.error('[IsolationChat] Chat error:', error)
    }
  }, [error])

  // Notify parent of streaming state changes (controlled mode)
  React.useEffect(() => {
    if (isControlled) {
      onStreamingChange?.(isStreaming)
    }
  }, [isStreaming, isControlled, onStreamingChange])

  // Handle abort
  const handleAbort = React.useCallback(() => {
    stop()
  }, [stop])

  // Auto-scroll on new messages
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Get streaming message ID for highlighting
  const streamingMessageId = isStreaming && messages.length > 0
    ? messages[messages.length - 1].id
    : undefined

  return (
    <div style={rvnStyles.container}>
      {/* Header */}
      <div style={rvnStyles.header}>
        <div style={rvnStyles.headerTitle}>AI DESIGN ASSISTANT</div>
        <div style={rvnStyles.headerSubtitle}>TARGET: {label.toUpperCase()}</div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={rvnStyles.messagesArea}>
        {messages.length === 0 ? (
          <div style={rvnStyles.emptyState}>
            <div style={rvnStyles.emptyIcon}></div>
            <div>READY FOR INPUT</div>
            <div style={rvnStyles.emptyHint}>
              "MAKE IT DARKER" / "ADD BORDER" / "INCREASE PADDING"
            </div>
            <div style={{ ...rvnStyles.emptyHint, marginTop: '8px', color: '#444' }}>
              HISTORY / SHIFT+ENTER NEWLINE / ESC ABORT
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} style={{ marginBottom: '20px' }}>
              <MessageRenderer
                message={message}
                isStreaming={message.id === streamingMessageId}
                componentId={componentId}
                onDesignAction={onDesignAction}
              />
            </div>
          ))
        )}
      </div>

      {/* Error display */}
      {error && (
        <div style={{ padding: RVN_SPACING.s }}>
          <div style={rvnStyles.error}>ERROR: {error.message}</div>
        </div>
      )}

      {/* Input */}
      <div style={rvnStyles.inputArea}>
        <ChatInput
          ref={inputRef}
          componentId={componentId}
          onSubmit={handleSend}
          placeholder={isStreaming ? 'PROCESSING...' : 'ENTER COMMAND...'}
          disabled={isStreaming}
          isStreaming={isStreaming}
          onAbort={handleAbort}
        />
      </div>
    </div>
  )
}

export default IsolationChat
