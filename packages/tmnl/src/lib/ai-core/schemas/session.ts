/**
 * AI Core Session Schemas
 *
 * Session persistence types for chat session management.
 * Uses Effect Schema for runtime validation and type inference.
 *
 * Sessions store:
 * - messages: AI SDK format messages
 * - config: model, temperature, tools, system prompt
 * - metadata: id, title, timestamps
 */

import { Schema } from 'effect'

// =============================================================================
// Branded Identifiers
// =============================================================================

/**
 * Branded session ID for type safety
 */
export const SessionId = Schema.String.pipe(Schema.brand('SessionId'))
export type SessionId = typeof SessionId.Type

// =============================================================================
// Session Metadata
// =============================================================================

/**
 * Lightweight session metadata (for listing without loading full messages)
 */
export class SessionMetadata extends Schema.Class<SessionMetadata>('SessionMetadata')({
  /** Unique session identifier */
  id: SessionId,
  /** Session title (auto-generated or user-defined) */
  title: Schema.String,
  /** Creation timestamp */
  createdAt: Schema.DateFromSelf,
  /** Last update timestamp */
  updatedAt: Schema.DateFromSelf,
}) {}

// =============================================================================
// Session Configuration
// =============================================================================

/**
 * Session configuration options
 */
export class SessionConfig extends Schema.Class<SessionConfig>('SessionConfig')({
  /** System prompt for this session */
  systemPrompt: Schema.optional(Schema.String),
  /** Model identifier (e.g., claude-3-opus) */
  model: Schema.optional(Schema.String),
  /** Temperature (0-1) */
  temperature: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  /** List of enabled tool names */
  toolsEnabled: Schema.optional(Schema.Array(Schema.String)),
}) {}

// =============================================================================
// Full Session
// =============================================================================

/**
 * Full chat session (metadata + config + messages)
 *
 * Messages are stored as Schema.Unknown to allow AI SDK format flexibility.
 * Runtime validation happens at the message level via Message schema.
 */
export class Session extends Schema.Class<Session>('Session')({
  /** Unique session identifier */
  id: SessionId,
  /** Session title */
  title: Schema.String,
  /** Creation timestamp */
  createdAt: Schema.DateFromSelf,
  /** Last update timestamp */
  updatedAt: Schema.DateFromSelf,
  /** System prompt for this session */
  systemPrompt: Schema.optional(Schema.String),
  /** Model identifier */
  model: Schema.optional(Schema.String),
  /** Temperature */
  temperature: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  /** Enabled tools */
  toolsEnabled: Schema.optional(Schema.Array(Schema.String)),
  /** Conversation messages (AI SDK format) */
  messages: Schema.Array(Schema.Unknown),
}) {}

// =============================================================================
// Type Exports
// =============================================================================

export type SessionMetadataType = typeof SessionMetadata.Type
export type SessionConfigType = typeof SessionConfig.Type
export type SessionType = typeof Session.Type

// =============================================================================
// JSON Serialization Schemas
// =============================================================================

/**
 * Session metadata for JSON storage (dates as ISO strings)
 */
export const SessionMetadataFromJson = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  createdAt: Schema.String.pipe(Schema.transform(Schema.DateFromSelf, {
    decode: (s) => new Date(s),
    encode: (d) => d.toISOString(),
  })),
  updatedAt: Schema.String.pipe(Schema.transform(Schema.DateFromSelf, {
    decode: (s) => new Date(s),
    encode: (d) => d.toISOString(),
  })),
})

/**
 * Full session for JSON storage
 */
export const SessionFromJson = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  createdAt: Schema.String.pipe(Schema.transform(Schema.DateFromSelf, {
    decode: (s) => new Date(s),
    encode: (d) => d.toISOString(),
  })),
  updatedAt: Schema.String.pipe(Schema.transform(Schema.DateFromSelf, {
    decode: (s) => new Date(s),
    encode: (d) => d.toISOString(),
  })),
  systemPrompt: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  temperature: Schema.optional(Schema.Number),
  toolsEnabled: Schema.optional(Schema.Array(Schema.String)),
  messages: Schema.Array(Schema.Unknown),
})

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new session with default values
 */
export const createSession = (config?: Partial<SessionConfigType>): Session =>
  new Session({
    id: crypto.randomUUID() as SessionId,
    title: 'New Chat',
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
    ...config,
  })

/**
 * Extract metadata from a full session
 */
export const toMetadata = (session: Session): SessionMetadata =>
  new SessionMetadata({
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  })

/**
 * Generate title from first user message
 */
export const generateTitleFromMessages = (messages: unknown[]): string | null => {
  // Find first user message
  const firstUserMsg = messages.find(
    (m): m is { role: string; content?: string; parts?: Array<{ type: string; text?: string }> } =>
      typeof m === 'object' &&
      m !== null &&
      'role' in m &&
      (m as { role: unknown }).role === 'user'
  )

  if (!firstUserMsg) return null

  // Extract text from content or parts
  let text: string | null = null

  if (typeof firstUserMsg.content === 'string') {
    text = firstUserMsg.content
  } else if (Array.isArray(firstUserMsg.parts)) {
    const textPart = firstUserMsg.parts.find((p) => p.type === 'text')
    if (textPart?.text) {
      text = textPart.text
    }
  }

  if (!text) return null

  // Truncate to 50 chars
  return text.length > 50 ? `${text.slice(0, 50)}...` : text
}
