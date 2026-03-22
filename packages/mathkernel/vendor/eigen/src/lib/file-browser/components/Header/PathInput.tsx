/**
 * PathInput Component
 *
 * Level 3: Direct path input with keyboard navigation.
 *
 * @module file-browser/components/Header
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Terminal } from 'lucide-react'

import { useFileBrowserContext } from '../FileBrowser/context'
import { DARK_SIDE } from '../../tokens'

// =============================================================================
// Types
// =============================================================================

export interface PathInputProps {
  /** Placeholder text */
  placeholder?: string
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const PathInput = memo(function PathInput({
  placeholder = 'Enter path...',
  className = '',
}: PathInputProps) {
  const { currentPath, navigate } = useFileBrowserContext()
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(currentPath)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync with currentPath when not editing
  useEffect(() => {
    if (!isEditing) {
      setInputValue(currentPath)
    }
  }, [currentPath, isEditing])

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (trimmed && trimmed !== currentPath) {
      navigate(trimmed.startsWith('/') ? trimmed : '/' + trimmed)
    }
    setIsEditing(false)
  }, [inputValue, currentPath, navigate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit()
      } else if (e.key === 'Escape') {
        setInputValue(currentPath)
        setIsEditing(false)
      }
    },
    [handleSubmit, currentPath]
  )

  const handleClick = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleBlur = useCallback(() => {
    handleSubmit()
  }, [handleSubmit])

  return (
    <div
      className={`path-input ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: DARK_SIDE.spacing['2'],
        flex: 1,
        minWidth: 0,
        height: '32px',
        padding: `0 ${DARK_SIDE.spacing['3']}`,
        background: DARK_SIDE.colors.surface,
        border: `1px solid ${isEditing ? DARK_SIDE.colors.border.focus : DARK_SIDE.colors.border.subtle}`,
        borderRadius: DARK_SIDE.borders.radius.none,
        transition: `border-color ${DARK_SIDE.animation.duration.fast}`,
      }}
    >
      {/* Terminal icon */}
      <Terminal
        size={14}
        style={{
          color: isEditing
            ? DARK_SIDE.colors.accent.green
            : DARK_SIDE.colors.text.tertiary,
          flexShrink: 0,
        }}
      />

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        style={{
          flex: 1,
          minWidth: 0,
          padding: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: DARK_SIDE.colors.text.primary,
          fontFamily: DARK_SIDE.typography.family.mono,
          fontSize: DARK_SIDE.typography.size.sm,
          letterSpacing: DARK_SIDE.typography.letterSpacing.wide,
        }}
        aria-label="Path input"
      />

      {/* Focus indicator */}
      {isEditing && (
        <span
          style={{
            fontSize: DARK_SIDE.typography.size.xs,
            color: DARK_SIDE.colors.text.muted,
            flexShrink: 0,
          }}
        >
          ↵
        </span>
      )}

      {/* Hover/focus styles */}
      <style>{`
        .path-input:hover {
          border-color: ${DARK_SIDE.colors.border.default} !important;
        }
        .path-input input::placeholder {
          color: ${DARK_SIDE.colors.text.muted};
        }
        .path-input input::selection {
          background: ${DARK_SIDE.colors.accent.greenGlow};
        }
      `}</style>
    </div>
  )
})
