/**
 * Transactional Tool Guide — bounded, ephemeral system prompt injection for tool calls.
 *
 * Mechanism: `before_agent_start` event. The guide is appended to the system prompt
 * for the turn immediately after the tool fires. Clean transaction:
 *   tool_call fires → flag ON → before_agent_start appends guide → TTL expires → stripped
 *
 * The system prompt is the RIGHT place — it's authoritative instruction, not conversation.
 * The `context` event only touches messages[]. System prompt is separate and persistent
 * across the turn via `event.systemPrompt`.
 *
 * Authoring: A background subagent can update the guide at runtime by sending
 * a message with `customType: 'tool-guide-update'`. The extension catches it
 * and calls `guide.setGuide()`. No file I/O, no reload.
 *
 * Bounds: maxLines (30), maxChars (2000), TTL (1 turn). Guide text is truncated
 * at registration and on every setGuide() call.
 *
 * Extractable: This module has ZERO dependency on metaskill internals. Any
 * extension can `import { createToolGuide } from './tool-guide.ts'` and use it.
 *
 * @module
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'

// ─── Types ───────────────────────────────────────────────

export interface ToolGuideOptions {
  /** Tool name to scope the guide to */
  toolName: string
  /** The guide text — compact, focused on eval discipline */
  guide: string
  /** Max lines. Truncated on set. Default: 30 */
  maxLines?: number
  /** Max characters. Truncated on set. Default: 2000 */
  maxChars?: number
  /**
   * Turns to keep guide appended to system prompt after tool call. Default: 1.
   * The guide is present for the turn where the LLM processes the tool result
   * and decides what to do next. After TTL expires, stripped automatically.
   */
  ttl?: number
}

export interface ToolGuideHandle {
  /** Update guide text at runtime. Bounds enforced. */
  setGuide(text: string): void
  /** Current (bounded) guide text */
  getGuide(): string
  /** Whether the guide will be injected on the next before_agent_start */
  isActive(): boolean
  /** Injection stats */
  stats(): ToolGuideStats
  /** Stop all event handlers. Guide stripped on next turn. */
  dispose(): void
}

export interface ToolGuideStats {
  injections: number
  strippings: number
  guideLines: number
  guideChars: number
  lastUpdated: number
}

// ─── Bounds ──────────────────────────────────────────────

const DEFAULT_MAX_LINES = 30
const DEFAULT_MAX_CHARS = 2000
const DEFAULT_TTL = 1
const TRUNCATION_MARKER = '\n…'

/** Enforce line + char bounds. Truncates, never throws. Result always ≤ maxChars. */
export function boundGuide(text: string, maxLines: number, maxChars: number): string {
  let bounded = text
  // Line bound first
  const lines = bounded.split('\n')
  if (lines.length > maxLines) {
    bounded = lines.slice(0, maxLines).join('\n') + TRUNCATION_MARKER
  }
  // Char bound — marker must fit WITHIN budget
  if (bounded.length > maxChars) {
    bounded = bounded.slice(0, maxChars - TRUNCATION_MARKER.length) + TRUNCATION_MARKER
  }
  return bounded
}

// ─── Sentinel ────────────────────────────────────────────

const GUIDE_START = (toolName: string) => `\n\n<!-- TOOL-GUIDE:${toolName} -->`
const GUIDE_END = (toolName: string) => `\n<!-- /TOOL-GUIDE:${toolName} -->`

/** Wrap guide text with sentinel markers for system prompt injection/stripping */
function wrapGuide(toolName: string, guide: string): string {
  return `${GUIDE_START(toolName)}\n[TOOL GUIDE: ${toolName}]\n${guide}\n[/TOOL GUIDE]${GUIDE_END(toolName)}`
}

/** Strip any existing guide from system prompt */
function stripGuide(systemPrompt: string, toolName: string): string {
  const startMarker = GUIDE_START(toolName)
  const endMarker = GUIDE_END(toolName)
  const startIdx = systemPrompt.indexOf(startMarker)
  if (startIdx === -1) return systemPrompt
  const endIdx = systemPrompt.indexOf(endMarker, startIdx)
  if (endIdx === -1) return systemPrompt
  return systemPrompt.slice(0, startIdx) + systemPrompt.slice(endIdx + endMarker.length)
}

// ─── Factory ─────────────────────────────────────────────

/**
 * Create a transactional tool guide.
 *
 * Registers event handlers on the provided ExtensionAPI:
 * - `tool_call`: sets injection flag when matching tool fires
 * - `before_agent_start`: appends/strips guide from system prompt
 * - `message_end`: listens for guide updates from background agents
 *
 * Returns a handle for runtime control.
 */
export function createToolGuide(pi: ExtensionAPI, options: ToolGuideOptions): ToolGuideHandle {
  const toolName = options.toolName
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const ttl = options.ttl ?? DEFAULT_TTL

  let guide = boundGuide(options.guide, maxLines, maxChars)
  let turnsRemaining = 0
  let disposed = false
  let injections = 0
  let strippings = 0
  let lastUpdated = Date.now()

  // ── tool_call: flag that guide should be injected ──────
  pi.on('tool_call', async (event) => {
    if (disposed) return
    if (event.toolName === toolName) {
      // Set TTL. before_agent_start fires at the START of the next turn,
      // which is when the LLM processes the tool result.
      turnsRemaining = ttl
    }
  })

  // ── before_agent_start: append or strip guide from system prompt ──
  pi.on('before_agent_start', async (event) => {
    if (disposed) {
      // Always strip if disposed
      return { systemPrompt: stripGuide(event.systemPrompt, toolName) }
    }

    // Always strip first (clean slate)
    const cleaned = stripGuide(event.systemPrompt, toolName)

    if (turnsRemaining > 0) {
      turnsRemaining--
      injections++
      return { systemPrompt: cleaned + wrapGuide(toolName, guide) }
    }

    // If we stripped something, return cleaned
    if (cleaned !== event.systemPrompt) {
      strippings++
      return { systemPrompt: cleaned }
    }

    // No change
    return undefined
  })

  // ── message_end: listen for guide updates from background agents ──
  pi.on('message_end' as any, async (event: any) => {
    if (disposed) return
    const msg = event?.message
    if (!msg || msg.customType !== 'tool-guide-update') return
    if (msg.details?.toolName !== toolName) return

    const newText = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
        : ''

    if (newText) {
      guide = boundGuide(newText, maxLines, maxChars)
      lastUpdated = Date.now()
    }
  })

  return {
    setGuide(text: string) {
      guide = boundGuide(text, maxLines, maxChars)
      lastUpdated = Date.now()
    },
    getGuide() { return guide },
    isActive() { return turnsRemaining > 0 },
    stats() {
      return {
        injections,
        strippings,
        guideLines: guide.split('\n').length,
        guideChars: guide.length,
        lastUpdated,
      }
    },
    dispose() {
      disposed = true
      turnsRemaining = 0
    },
  }
}
