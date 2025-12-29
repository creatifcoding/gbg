/**
 * CursorPromptInput Component
 *
 * Rich input wrapper for the Cursor chat interface.
 * - AI Elements PromptInput with TMNL styling
 * - Keyboard: Escape → collapse, Enter → send
 * - Attachment support UI (for future Claude Code file API)
 * - effect-atom for attachment state
 */

import { useRef, useCallback, useEffect } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { nanoid } from 'nanoid'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputAttachments,
  PromptInputAttachment,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { PaperclipIcon, SendIcon } from 'lucide-react'
import {
  cursorRegistry,
  attachmentsAtom,
  cursorOps,
  type CursorAttachment,
} from '../../atoms'

interface CursorPromptInputProps {
  /** Called when message is submitted */
  onSend: (content: string, attachments?: CursorAttachment[]) => Promise<void>
  /** Called when user presses Escape */
  onCollapse: () => void
  /** Whether the AI is currently streaming/thinking */
  isStreaming: boolean
  /** Placeholder text */
  placeholder?: string
}

export function CursorPromptInput({
  onSend,
  onCollapse,
  isStreaming,
  placeholder = 'Type a message...',
}: CursorPromptInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachments = useAtomValue(attachmentsAtom)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle keyboard shortcuts
  // Enter → send, Shift+Enter → newline, Escape → collapse
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        onCollapse()
        return
      }

      // Enter to send (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const textarea = e.currentTarget
        const content = textarea.value.trim()
        if (content || attachments.length > 0) {
          if (!isStreaming) {
            const currentAttachments = [...cursorRegistry.get(attachmentsAtom)]
            cursorOps.clearAttachments()
            textarea.value = ''
            onSend(content, currentAttachments)
          }
        }
      }
      // Shift+Enter allows default behavior (newline)
    },
    [onCollapse, isStreaming, onSend, attachments.length]
  )

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newAttachments: CursorAttachment[] = Array.from(files).map((file) => ({
      id: nanoid(),
      type: 'file' as const,
      url: URL.createObjectURL(file),
      mediaType: file.type,
      filename: file.name,
    }))

    cursorOps.addAttachments(newAttachments)

    // Reset input to allow re-selecting same file
    e.target.value = ''
  }, [])

  // Open file dialog
  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Handle form submission
  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (!message.text.trim() && attachments.length === 0) return
      if (isStreaming) return

      const currentAttachments = [...attachments]
      cursorOps.clearAttachments()

      await onSend(message.text, currentAttachments)
    },
    [attachments, isStreaming, onSend]
  )

  return (
    <div
      className="px-4 py-3"
      style={{
        background: 'oklch(0.04 0 0)',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,.pdf,.txt,.md,.json,.csv"
        onChange={handleFileChange}
      />

      <PromptInput
        onSubmit={handleSubmit}
        className="rounded-lg overflow-hidden"
        style={{
          background: 'oklch(0.06 0 0)',
          border: '1px solid oklch(0.15 0 0)',
        }}
      >
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <PromptInputAttachments>
            {(attachment) => (
              <PromptInputAttachment
                key={attachment.id}
                data={attachment}
                className="border-white/5"
                style={{
                  background: 'oklch(0.08 0 0)',
                  color: 'oklch(0.7 0 0)',
                }}
              />
            )}
          </PromptInputAttachments>
        )}

        {/* Textarea */}
        <PromptInputTextarea
          ref={inputRef}
          placeholder={isStreaming ? 'Thinking...' : placeholder}
          disabled={isStreaming}
          onKeyDown={handleKeyDown}
          className="min-h-[44px] resize-none bg-transparent"
          style={{
            color: 'var(--tmnl-text-primary, oklch(0.88 0 0))',
            caretColor: 'oklch(0.75 0.15 160)',
            fontSize: 'var(--tmnl-text-sm, 14px)',
            lineHeight: 'var(--tmnl-leading-relaxed, 1.6)',
          }}
        />

        {/* Footer with tools and submit */}
        <PromptInputFooter
          className="px-2 py-1.5"
          style={{ background: 'oklch(0.04 0 0)' }}
        >
          <PromptInputTools>
            <PromptInputButton
              onClick={openFileDialog}
              disabled={isStreaming}
              className="transition-colors hover:bg-white/5"
              style={{ color: 'oklch(0.5 0 0)' }}
            >
              <PaperclipIcon className="h-4 w-4" />
            </PromptInputButton>
          </PromptInputTools>

          <PromptInputSubmit
            disabled={isStreaming}
            className="transition-colors"
            style={{
              background: !isStreaming
                ? 'oklch(0.7 0.15 160)'
                : 'oklch(0.2 0 0)',
              color: !isStreaming ? 'oklch(0.1 0 0)' : 'oklch(0.4 0 0)',
            }}
          >
            <SendIcon className="h-4 w-4" />
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

export default CursorPromptInput
