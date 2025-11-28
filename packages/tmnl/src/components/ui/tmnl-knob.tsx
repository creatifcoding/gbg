import type React from "react"
import { useRef } from "react"

interface TmnlKnobProps {
  value: number
  onChange: (newValue: number) => void
  min?: number
  max?: number
  step?: number
  size?: number
  ariaLabel: string
  thumbColor?: string
}

export function TmnlKnob({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  size = 36,
  ariaLabel,
  thumbColor = "#00ff41",
}: TmnlKnobProps) {
  const startDragValue = useRef(0)
  const startDragY = useRef(0)

  const valueToAngle = (v: number) => {
    const range = max - min
    if (range === 0) return -135
    const percentage = (v - min) / range
    return percentage * 270 - 135
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startDragValue.current = value
    startDragY.current = e.clientY

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dy = startDragY.current - moveEvent.clientY
      const range = max - min
      const valueChange = (dy / 100) * range
      let newValue = startDragValue.current + valueChange
      newValue = Math.max(min, Math.min(max, newValue))
      newValue = Math.round(newValue / step) * step
      onChange(newValue)
    }

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  const angle = valueToAngle(value)

  return (
    <div
      className="relative cursor-ns-resize select-none"
      style={{ width: size, height: size }}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {/* Outer ring */}
      <div
        className="absolute inset-0 rounded-full border animate-subtle-pulse"
        style={{ borderColor: `${thumbColor}33` }}
      />
      {/* Inner ring */}
      <div
        className="absolute inset-1 rounded-full border"
        style={{ borderColor: `${thumbColor}66`, boxShadow: `0 0 6px ${thumbColor}33` }}
      />
      {/* Center */}
      <div className="absolute inset-2 rounded-full bg-black/60 border border-black/80" />

      {/* Indicator */}
      <div className="absolute w-full h-full" style={{ transform: `rotate(${angle}deg)` }}>
        <div
          className="absolute rounded-full"
          style={{
            width: 3,
            height: 3,
            top: 4,
            left: `calc(50% - 1.5px)`,
            background: thumbColor,
            boxShadow: `0 0 4px ${thumbColor}`,
          }}
        />
      </div>

      {/* Hitbox */}
      <div className="absolute -inset-2 rounded-full" onMouseDown={handleMouseDown} />
    </div>
  )
}
