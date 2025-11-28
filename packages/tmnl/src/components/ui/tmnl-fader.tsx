"use client"

import { useSlider } from "@/hooks/use-slider"
import { cn } from "@/lib/utils"

interface TmnlFaderProps {
  value: number
  onChange: (newValue: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  thumbColor?: string
  ariaLabel?: string
}

export function TmnlFader({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  thumbColor = "#00ff41",
  ariaLabel,
}: TmnlFaderProps) {
  const { trackRef, hitboxRef, handleMouseDown, percentage } = useSlider({
    value,
    onChange,
    min,
    max,
    step,
    orientation: "vertical",
  })

  return (
    <div
      ref={hitboxRef}
      onMouseDown={handleMouseDown}
      className={cn("relative w-5 h-16 cursor-pointer flex justify-center", className)}
      role="slider"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div ref={trackRef} className="relative w-0.5 h-full">
        <div className="absolute inset-0 rounded-full bg-black/50 border" style={{ borderColor: `${thumbColor}44` }} />
        <div
          className="absolute bottom-0 w-full rounded-full"
          style={{ height: `${percentage}%`, backgroundColor: thumbColor, boxShadow: `0 0 6px ${thumbColor}` }}
        />
        <div
          className="absolute left-1/2 w-2.5 h-2.5 rounded-full border"
          style={{
            bottom: `${percentage}%`,
            transform: `translateY(50%) translateX(-50%)`,
            backgroundColor: thumbColor,
            borderColor: `${thumbColor}88`,
            boxShadow: `0 0 8px ${thumbColor}`,
          }}
        />
      </div>
    </div>
  )
}
