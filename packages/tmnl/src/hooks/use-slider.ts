
import type React from "react"
import { useRef, useCallback } from "react"

interface UseSliderProps {
  value: number
  onChange: (newValue: number) => void
  min?: number
  max?: number
  step?: number
  orientation?: "horizontal" | "vertical"
}

/**
 * A reusable hook for building custom slider controls.
 * It handles the core logic of converting mouse movements into values,
 * separating the visual track from the interactive hitbox for mobile usability.
 */
export function useSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  orientation = "horizontal",
}: UseSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const hitboxRef = useRef<HTMLDivElement>(null)

  const getValueFromMouseEvent = useCallback(
    (e: MouseEvent) => {
      if (!trackRef.current) return value

      const rect = trackRef.current.getBoundingClientRect()
      let percentage: number

      if (orientation === "horizontal") {
        const x = e.clientX - rect.left
        percentage = Math.max(0, Math.min(1, x / rect.width))
      } else {
        const y = e.clientY - rect.top
        percentage = 1 - Math.max(0, Math.min(1, y / rect.height))
      }

      const range = max - min
      const rawValue = min + percentage * range
      const steppedValue = Math.round(rawValue / step) * step

      return Math.max(min, Math.min(max, steppedValue))
    },
    [trackRef, min, max, step, orientation, value],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()

      const initialValue = getValueFromMouseEvent(e.nativeEvent)
      onChange(initialValue)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newValue = getValueFromMouseEvent(moveEvent)
        onChange(newValue)
      }

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [getValueFromMouseEvent, onChange],
  )

  const getPercentage = (v: number) => {
    const range = max - min
    if (range === 0) return 0
    return ((v - min) / range) * 100
  }

  return {
    trackRef,
    hitboxRef,
    handleMouseDown,
    percentage: getPercentage(value),
  }
}
