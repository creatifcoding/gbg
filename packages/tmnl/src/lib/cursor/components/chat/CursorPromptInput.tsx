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
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCollapse()
      }
    },
    [onCollapse]
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
      style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
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
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <PromptInputAttachments>
            {(attachment) => (
              <PromptInputAttachment
                key={attachment.id}
                data={attachment}
                className="bg-white/5 border-white/10"
                style={{
                  color: 'rgba(255, 255, 255, 0.7)',
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
          className="min-h-[40px] resize-none bg-transparent text-sm"
          style={{
            color: 'rgba(255, 255, 255, 0.9)',
            caretColor: '#60f0a0',
          }}
        />

        {/* Footer with tools and submit */}
        <PromptInputFooter
          className="px-2 py-1.5"
          style={{ background: 'rgba(0, 0, 0, 0.2)' }}
        >
          <PromptInputTools>
            <PromptInputButton
              onClick={openFileDialog}
              disabled={isStreaming}
              className="transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255, 255, 255, 0.5)' }}
            >
              <PaperclipIcon className="h-4 w-4" />
            </PromptInputButton>
          </PromptInputTools>

          <PromptInputSubmit
            disabled={isStreaming}
            className="transition-colors"
            style={{
              background: !isStreaming
                ? 'linear-gradient(135deg, #60f0a0, #30d080)'
                : 'rgba(100, 100, 100, 0.3)',
              color: !isStreaming ? '#000' : 'rgba(255, 255, 255, 0.3)',
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
