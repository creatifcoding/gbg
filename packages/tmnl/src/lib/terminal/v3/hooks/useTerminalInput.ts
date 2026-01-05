/**
 * useTerminalInput Hook
 *
 * Wires TerminalInput component to terminal v3 state machine.
 * Manages input value, submit handling, and history navigation.
 *
 * @example
 * ```tsx
 * function Terminal() {
 *   const inputRef = useRef<TerminalInputRef>(null)
 *   const inputProps = useTerminalInput({ inputRef })
 *
 *   return (
 *     <TerminalInput ref={inputRef} {...inputProps} />
 *   )
 * }
 * ```
 */

import { useCallback, useRef, type RefObject, type KeyboardEvent } from 'react'
import { Atom, type AtomState } from '@effect-atom/atom'
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react'
import {
  inputModeAtom,
  canSubmitAtom,
  isActiveAtom,
  terminalActorOps,
} from '../terminal-stx'
import {
  historyUp,
  historyDown,
  resetHistoryIndex,
  executeCommandOp,
  executeAIQueryOp,
} from '../atoms'
import { terminalRegistry } from '../terminal-stx'
import type { TerminalInputRef, TerminalInputProps } from '../components/TerminalInput'

// =============================================================================
// Input Value Atom
// =============================================================================

/**
 * Terminal input value atom.
 * Separate from machine state for performance (keystroke updates).
 */
export const terminalInputValueAtom = Atom.make('')

// =============================================================================
// Types
// =============================================================================

export interface UseTerminalInputOptions {
  /** Ref to TerminalInput for imperative control */
  inputRef: RefObject<TerminalInputRef | null>
  /** Custom placeholder (default based on inputMode) */
  placeholder?: string
  /** Minimum height for input */
  minHeight?: number
  /** Maximum height for input */
  maxHeight?: number
  /** Additional className */
  className?: string
  /** Auto focus on mount */
  autoFocus?: boolean
  /** Called after successful submit */
  onSubmitSuccess?: () => void
  /** Called on submit error */
  onSubmitError?: (error: Error) => void
}

export interface UseTerminalInputResult extends Omit<TerminalInputProps, 'ref'> {
  /** Current input value */
  inputValue: string
  /** Set input value programmatically */
  setInputValue: (value: string) => void
  /** Clear input */
  clearInput: () => void
  /** Focus input */
  focusInput: () => void
  /** Whether submit is allowed */
  canSubmit: boolean
  /** Whether terminal is busy */
  isBusy: boolean
  /** Current input mode */
  inputMode: 'shell' | 'ai' | 'hybrid'
}

// =============================================================================
// Hook
// =============================================================================

export function useTerminalInput(
  options: UseTerminalInputOptions
): UseTerminalInputResult {
  const {
    inputRef,
    placeholder: customPlaceholder,
    minHeight = 48,
    maxHeight = 200,
    className = '',
    autoFocus = false,
    onSubmitSuccess,
    onSubmitError,
  } = options

  // Track if currently submitting
  const isSubmittingRef = useRef(false)

  // ---------------------------------------------------------------------------
  // State from atoms
  // ---------------------------------------------------------------------------
  const inputValue = useAtomValue(terminalInputValueAtom)
  const inputMode = useAtomValue(inputModeAtom)
  const canSubmitState = useAtomValue(canSubmitAtom)
  const isActive = useAtomValue(isActiveAtom)

  // ---------------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------------
  const doExecuteCommand = useAtomSet(executeCommandOp, { mode: 'promise' })
  const doExecuteAIQuery = useAtomSet(executeAIQueryOp, { mode: 'promise' })

  // ---------------------------------------------------------------------------
  // Input value management
  // ---------------------------------------------------------------------------
  const setInputValue = useCallback((value: string) => {
    terminalRegistry.set(terminalInputValueAtom, value)
  }, [])

  const clearInput = useCallback(() => {
    terminalRegistry.set(terminalInputValueAtom, '')
    inputRef.current?.clear()
  }, [inputRef])

  const focusInput = useCallback(() => {
    inputRef.current?.focus()
  }, [inputRef])

  // ---------------------------------------------------------------------------
  // Change handler
  // ---------------------------------------------------------------------------
  const handleChange = useCallback((value: string) => {
    terminalRegistry.set(terminalInputValueAtom, value)
    // Reset history index on any input change
    resetHistoryIndex()
  }, [])

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    const value = terminalRegistry.get(terminalInputValueAtom).trim()
    if (!value || isSubmittingRef.current || !canSubmitState) return

    isSubmittingRef.current = true

    try {
      // Determine how to handle based on input mode
      if (inputMode === 'shell') {
        await doExecuteCommand({ command: value })
      } else if (inputMode === 'ai') {
        await doExecuteAIQuery({ prompt: value })
      } else {
        // Hybrid mode: detect based on content
        // Commands starting with / or common shell commands go to shell
        const isShellCommand =
          value.startsWith('/') ||
          value.startsWith('cd ') ||
          value.startsWith('ls') ||
          value.startsWith('cat ') ||
          value.startsWith('git ') ||
          value.startsWith('npm ') ||
          value.startsWith('bun ') ||
          value.startsWith('pnpm ')

        if (isShellCommand) {
          await doExecuteCommand({ command: value })
        } else {
          await doExecuteAIQuery({ prompt: value })
        }
      }

      // Clear input on success
      clearInput()
      onSubmitSuccess?.()
    } catch (error) {
      console.error('[useTerminalInput] Submit error:', error)
      onSubmitError?.(error instanceof Error ? error : new Error(String(error)))
    } finally {
      isSubmittingRef.current = false
    }
  }, [
    inputMode,
    canSubmitState,
    doExecuteCommand,
    doExecuteAIQuery,
    clearInput,
    onSubmitSuccess,
    onSubmitError,
  ])

  // ---------------------------------------------------------------------------
  // Key handler (history navigation)
  // ---------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // History navigation: Arrow Up/Down
      if (event.key === 'ArrowUp' && !event.shiftKey) {
        const historyValue = historyUp()
        if (historyValue !== null) {
          event.preventDefault()
          setInputValue(historyValue)
          inputRef.current?.setValue(historyValue)
        }
      } else if (event.key === 'ArrowDown' && !event.shiftKey) {
        const historyValue = historyDown()
        if (historyValue !== null) {
          event.preventDefault()
          setInputValue(historyValue)
          inputRef.current?.setValue(historyValue)
        } else {
          // At bottom of history, clear input
          clearInput()
        }
      }

      // Abort: Ctrl+C or Escape when active
      if ((event.key === 'c' && event.ctrlKey) || event.key === 'Escape') {
        if (isActive) {
          event.preventDefault()
          terminalActorOps.abort()
        }
      }

      // Toggle mode: Ctrl+/
      if (event.key === '/' && event.ctrlKey) {
        event.preventDefault()
        terminalActorOps.toggleMode()
      }
    },
    [inputRef, setInputValue, clearInput, isActive]
  )

  // ---------------------------------------------------------------------------
  // Placeholder based on mode
  // ---------------------------------------------------------------------------
  const placeholder =
    customPlaceholder ??
    (inputMode === 'shell'
      ? 'Enter command...'
      : inputMode === 'ai'
        ? 'Ask a question...'
        : 'Command or question...')

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    // TerminalInput props
    value: inputValue,
    onChange: handleChange,
    onSubmit: handleSubmit,
    onKeyDown: handleKeyDown,
    placeholder,
    disabled: !canSubmitState,
    isSubmitting: isActive,
    minHeight,
    maxHeight,
    className,
    autoFocus,

    // Additional utilities
    inputValue,
    setInputValue,
    clearInput,
    focusInput,
    canSubmit: canSubmitState && !isActive,
    isBusy: isActive,
    inputMode,
  }
}
