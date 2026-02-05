/**
 * Error XML Parser
 *
 * Parses XML tags from tool error messages (Claude API format) and extracts
 * structured content for styled display.
 */

import { Schema } from 'effect'

// =============================================================================
// Types
// =============================================================================

/**
 * A parsed XML tag with its content
 */
export const ParsedErrorTag = Schema.Struct({
  tag: Schema.String,
  content: Schema.String,
})

export type ParsedErrorTag = Schema.Schema.Type<typeof ParsedErrorTag>

/**
 * Result of parsing an error message
 */
export interface ParsedError {
  /** Extracted XML tags in order of appearance */
  tags: ParsedErrorTag[]
  /** Remaining plain text after tag extraction */
  plainText: string
  /** Whether any XML tags were found */
  hasXmlTags: boolean
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Regex pattern for Claude API XML tags
 * Matches: <tag_name>content</tag_name>
 */
const XML_TAG_PATTERN = /<(\w+)>([\s\S]*?)<\/\1>/g

/**
 * Priority order for display - higher priority tags shown first
 */
export const TAG_PRIORITY: Record<string, number> = {
  error_type: 1,
  error: 2,
  file_not_found: 3,
  permission_denied: 3,
  invalid_argument: 3,
  timeout: 3,
  cause: 10, // Show last (may be lengthy)
}

/**
 * Tags that should be displayed as badges/categories
 */
export const BADGE_TAGS = new Set(['error_type'])

/**
 * Tags that contain file paths
 */
export const PATH_TAGS = new Set(['file_not_found', 'permission_denied'])

/**
 * Tags that contain stack traces or causes
 */
export const TRACE_TAGS = new Set(['cause', 'stack', 'stacktrace'])

// =============================================================================
// Functions
// =============================================================================

/**
 * Extracts all XML tags from error text
 */
export function extractXmlTags(text: string): ParsedErrorTag[] {
  const tags: ParsedErrorTag[] = []
  let match: RegExpExecArray | null

  // Reset regex state
  XML_TAG_PATTERN.lastIndex = 0

  while ((match = XML_TAG_PATTERN.exec(text)) !== null) {
    const [, tag, content] = match
    tags.push({
      tag: tag.toLowerCase(),
      content: content.trim(),
    })
  }

  return tags
}

/**
 * Strips all XML tags from text, leaving only plain content
 */
export function stripXmlTags(text: string): string {
  return text
    .replace(XML_TAG_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parses an error message, extracting XML tags and plain text
 */
export function parseErrorXml(errorText: string): ParsedError {
  const tags = extractXmlTags(errorText)
  const plainText = stripXmlTags(errorText)

  return {
    tags,
    plainText,
    hasXmlTags: tags.length > 0,
  }
}

/**
 * Sorts tags by priority (lower number = higher priority)
 */
export function sortTagsByPriority(tags: ParsedErrorTag[]): ParsedErrorTag[] {
  return [...tags].sort((a, b) => {
    const priorityA = TAG_PRIORITY[a.tag] ?? 5
    const priorityB = TAG_PRIORITY[b.tag] ?? 5
    return priorityA - priorityB
  })
}

/**
 * Gets the error type badge text if present
 */
export function getErrorTypeBadge(parsed: ParsedError): string | null {
  const typeTag = parsed.tags.find((t) => BADGE_TAGS.has(t.tag))
  return typeTag?.content ?? null
}

/**
 * Gets the main error message (from <error> tag or first non-badge tag)
 */
export function getMainErrorMessage(parsed: ParsedError): string | null {
  // First try <error> tag
  const errorTag = parsed.tags.find((t) => t.tag === 'error')
  if (errorTag) return errorTag.content

  // Fallback to first non-badge, non-trace tag
  const mainTag = parsed.tags.find(
    (t) => !BADGE_TAGS.has(t.tag) && !TRACE_TAGS.has(t.tag)
  )
  return mainTag?.content ?? null
}

/**
 * Gets file paths from path-related tags
 */
export function getErrorPaths(parsed: ParsedError): string[] {
  return parsed.tags
    .filter((t) => PATH_TAGS.has(t.tag))
    .map((t) => t.content)
}

/**
 * Gets cause/stack trace if present
 */
export function getErrorCause(parsed: ParsedError): string | null {
  const causeTag = parsed.tags.find((t) => TRACE_TAGS.has(t.tag))
  return causeTag?.content ?? null
}
