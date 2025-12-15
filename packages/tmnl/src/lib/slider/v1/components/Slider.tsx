/**
 * Slider Component
 *
 * Typography: Geo (font-stats) - numeric displays
 * The primary slider component with DAW-grade precision.
 * Supports multiple behaviors, debug overlay, and fine control.
 */

import React, { useCallback, useRef, useState, forwardRef } from 'react'
import { useSlider, type UseSliderOptions } from '../hooks/useSlider'
import type { SliderBehaviorShape } from '../types'
import { LinearBehavior } from '../services/SliderBehavior'

// =============================================================================
// SLIDER PROPS
// =============================================================================

export interface SliderProps extends Omit<UseSliderOptions, 'behavior'> {
  /** Behavior shape (injectable) */
  behavior?: SliderBehaviorShape

  /** CSS class for outer container */
  className?: string

  /** CSS class for track */
  trackClassName?: string

  /** CSS class for fill */
  fillClassName?: string

  /** CSS class for thumb */
  thumbClassName?: string

  /** Show value display */
  showValue?: boolean

  /** Value display position */
  valuePosition?: 'left' | 'right' | 'top' | 'bottom' | 'inside'

  /** Show tick marks */
  showTicks?: boolean

  /** Custom tick values (overrides auto-generated) */
  ticks?: number[]

  /** Aria label */
  ariaLabel?: string

  /** Disabled state */
  disabled?: boolean
}

// =============================================================================
// SLIDER COMPONENT
// =============================================================================

export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  {
    behavior = LinearBehavior.shape,
    className = '',
    trackClassName = '',
    fillClassName = '',
    thumbClassName = '',
    showValue = true,
    valuePosition = 'right',
    showTicks = false,
    ticks: customTicks,
    ariaLabel,
    disabled = false,
    ...hookOptions
  },
  ref
) {
  const slider = useSlider({ ...hookOptions, behavior })

  const {
    state,
    value,
    normalizedValue,
    displayValue,
    config,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
    handleWheel,
    handleDoubleClick,
    handleFocus,
    handleBlur,
    handleMouseEnter,
    handleMouseLeave,
    startEdit,
    endEdit,
    containerRef,
  } = slider

  // Local edit state
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Handle edit mode
  const handleValueClick = useCallback(() => {
    if (disabled) return
    setEditValue(value.toFixed(config.precision))
    startEdit()
    setTimeout(() => inputRef.current?.select(), 0)
  }, [disabled, value, config.precision, startEdit])

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const parsed = parseFloat(editValue)
        if (!isNaN(parsed)) {
          endEdit(parsed)
        } else {
          endEdit()
        }
      } else if (e.key === 'Escape') {
        endEdit()
      }
    },
    [editValue, endEdit]
  )

  const handleEditBlur = useCallback(() => {
    const parsed = parseFloat(editValue)
    if (!isNaN(parsed)) {
      endEdit(parsed)
    } else {
      endEdit()
    }
  }, [editValue, endEdit])

  // Compute ticks
  const tickValues = customTicks ?? (showTicks ? behavior.getTicks(config.min, config.max, config.tickCount) : [])

  // Orientation classes
  const isVertical = config.orientation === 'vertical'

  // Combine refs
  const combinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Update internal ref
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      // Forward ref
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    },
    [containerRef, ref]
  )

  return (
    <div
      ref={combinedRef}
      className={`
        relative flex items-center gap-3 select-none
        ${isVertical ? 'flex-col h-40' : 'flex-row w-full'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      onPointerDown={disabled ? undefined : handlePointerDown}
      onPointerMove={disabled ? undefined : handlePointerMove}
      onPointerUp={disabled ? undefined : handlePointerUp}
      onKeyDown={disabled ? undefined : handleKeyDown}
      onWheel={disabled ? undefined : handleWheel}
      onDoubleClick={disabled ? undefined : handleDoubleClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      tabIndex={disabled ? -1 : 0}
      role="slider"
      aria-label={ariaLabel ?? 'Slider'}
      aria-valuemin={config.min}
      aria-valuemax={config.max}
      aria-valuenow={value}
      aria-valuetext={displayValue}
      aria-disabled={disabled}
    >
      {/* Value display (left/top) */}
      {showValue && (valuePosition === 'left' || valuePosition === 'top') && (
        <ValueDisplay
          value={value}
          displayValue={displayValue}
          isEditing={state.isEditing}
          editValue={editValue}
          onEditChange={setEditValue}
          onValueClick={handleValueClick}
          onEditKeyDown={handleEditKeyDown}
          onEditBlur={handleEditBlur}
          inputRef={inputRef}
          config={config}
        />
      )}

      {/* Track */}
      <div
        className={`
          relative flex-1 rounded-full overflow-hidden
          ${isVertical ? 'w-2 h-full' : 'h-2 w-full'}
          bg-neutral-700
          ${state.isDragging ? 'ring-2 ring-cyan-500/50' : ''}
          ${state.isFocused ? 'ring-2 ring-cyan-500/30' : ''}
          ${trackClassName}
        `}
      >
        {/* Tick marks */}
        {showTicks && tickValues.map((tick, i) => {
          const tickNorm = behavior.normalize(tick, config.min, config.max)
          return (
            <div
              key={i}
              className="absolute bg-neutral-500"
              style={
                isVertical
                  ? { left: '50%', bottom: `${tickNorm * 100}%`, width: '100%', height: '1px', transform: 'translateX(-50%)' }
                  : { top: '50%', left: `${tickNorm * 100}%`, height: '100%', width: '1px', transform: 'translateY(-50%)' }
              }
            />
          )
        })}

        {/* Fill */}
        <div
          className={`
            absolute bg-cyan-500 transition-all duration-75
            ${isVertical ? 'w-full bottom-0' : 'h-full left-0'}
            ${fillClassName}
          `}
          style={
            isVertical
              ? { height: `${normalizedValue * 100}%` }
              : { width: `${normalizedValue * 100}%` }
          }
        />

        {/* Thumb */}
        <div
          className={`
            absolute w-4 h-4 rounded-full bg-white shadow-lg
            transform -translate-x-1/2 -translate-y-1/2
            transition-transform duration-75
            ${state.isDragging ? 'scale-125' : state.isHovered ? 'scale-110' : 'scale-100'}
            ${thumbClassName}
          `}
          style={
            isVertical
              ? { left: '50%', bottom: `${normalizedValue * 100}%`, transform: 'translateX(-50%) translateY(50%)' }
              : { top: '50%', left: `${normalizedValue * 100}%` }
          }
        />
      </div>

      {/* Value display (right/bottom/inside) */}
      {showValue && (valuePosition === 'right' || valuePosition === 'bottom') && (
        <ValueDisplay
          value={value}
          displayValue={displayValue}
          isEditing={state.isEditing}
          editValue={editValue}
          onEditChange={setEditValue}
          onValueClick={handleValueClick}
          onEditKeyDown={handleEditKeyDown}
          onEditBlur={handleEditBlur}
          inputRef={inputRef}
          config={config}
        />
      )}

      {/* Modifier indicator */}
      {state.isDragging && state.activeSensitivity !== 1 && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-cyan-900/80 rounded text-xs font-stats text-cyan-300 whitespace-nowrap">
          {state.activeSensitivity < 0.1 ? 'Ultra-Fine' : 'Fine'} ({state.activeSensitivity}x)
        </div>
      )}
    </div>
  )
})

// =============================================================================
// VALUE DISPLAY SUB-COMPONENT
// =============================================================================

interface ValueDisplayProps {
  value: number
  displayValue: string
  isEditing: boolean
  editValue: string
  onEditChange: (value: string) => void
  onValueClick: () => void
  onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onEditBlur: () => void
  inputRef: React.RefObject<HTMLInputElement>
  config: { precision: number; unit: string }
}

function ValueDisplay({
  displayValue,
  isEditing,
  editValue,
  onEditChange,
  onValueClick,
  onEditKeyDown,
  onEditBlur,
  inputRef,
  config,
}: ValueDisplayProps) {
  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => onEditChange(e.target.value)}
        onKeyDown={onEditKeyDown}
        onBlur={onEditBlur}
        className="w-16 px-2 py-1 bg-neutral-900 border border-cyan-600 rounded text-sm font-stats text-cyan-300 text-right focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onValueClick()
      }}
      className="min-w-[4rem] px-2 py-1 text-sm font-stats text-neutral-300 text-right hover:text-cyan-400 hover:bg-neutral-800/50 rounded cursor-text transition-colors"
    >
      {displayValue}
    </div>
  )
}

// =============================================================================
// EXPORTS
// =============================================================================

export default Slider
