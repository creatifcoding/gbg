/**
 * LLM-powered context summarization for compaction.
 * Serializes messages to text, sends to a (potentially cheaper) model for summary.
 */
import { completeSimple, type Message, type Model } from '@mariozechner/pi-ai'
import { Effect } from 'effect'

const COMPACTION_SYSTEM_PROMPT = `You are a context summarizer. Your job is to produce a concise summary of a conversation between a user and an AI coding assistant.

Preserve:
- Key decisions made and their rationale
- Files that were created, modified, or deleted
- Important context about the codebase (patterns, conventions, gotchas)
- Task state: what was completed, what's in progress, what's blocked
- Any user preferences or constraints mentioned

Omit:
- Verbose tool output (file contents, grep results, build logs)
- Step-by-step details of routine operations
- Redundant information already captured in kept messages

Format: Write a structured summary using markdown headings. Be thorough but concise.`

/**
 * Serialize messages to readable text for the summarizer.
 */
function serializeMessages(messages: readonly Message[]): string {
  const lines: string[] = []

  for (const message of messages) {
    if (message.role === 'user') {
      const text =
        typeof message.content === 'string'
          ? message.content
          : message.content
            .flatMap((part) => (part.type === 'text' ? [part.text] : []))
            .join('\n')

      lines.push(`## User\n${text}`)
      continue
    }

    if (message.role === 'assistant') {
      const text = message.content
        .flatMap((part) => (part.type === 'text' ? [part.text] : []))
        .join('\n')

      const toolCalls = message.content
        .flatMap((part) => (part.type === 'toolCall' ? [`[tool: ${part.name}]`] : []))
        .join(', ')

      lines.push(`## Assistant${toolCalls ? ` (${toolCalls})` : ''}\n${text || '(tool calls only)'}`)
      continue
    }

    const text = message.content
      .flatMap((part) => (part.type === 'text' ? [part.text] : []))
      .join('\n')

    // Truncate long tool output
    const truncated = text.length > 2000 ? `${text.slice(0, 2000)}\n...(truncated)` : text
    lines.push(`## Tool Result (${message.toolName})\n${truncated}`)
  }

  return lines.join('\n\n')
}

/**
 * Generate a summary of messages using an LLM.
 *
 * @param messages Messages to summarize
 * @param model Model to use (session model or dedicated summary model)
 * @returns Summary text
 */
export function generateSummary(
  messages: readonly Message[],
  model: Model<any>,
): Effect.Effect<string, Error> {
  return Effect.tryPromise({
    try: async () => {
      const serialized = serializeMessages(messages)
      const result = await completeSimple(model, {
        systemPrompt: COMPACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user' as const,
            content: `Summarize the following conversation (${messages.length} messages):\n\n${serialized}`,
            timestamp: Date.now(),
          },
        ],
      })

      const text = result.content
        .flatMap((part) => (part.type === 'text' ? [part.text] : []))
        .join('\n')

      return text || '(empty summary)'
    },
    catch: (error) =>
      new Error(
        `Compaction summary generation failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
  }).pipe(Effect.withSpan('tmnl.harness.compaction.generateSummary'))
}
