import { useSlider } from "@/hooks/use-slider"
import { cn } from "@/lib/utils"

interface TmnlSliderProps {
  value: number
  onChange: (newValue: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  thumbColor?: string
  ariaLabel?: string
}

export function TmnlSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  thumbColor = "#00ff41",
  ariaLabel,
}: TmnlSliderProps) {
  const { trackRef, hitboxRef, handleMouseDown, percentage } = useSlider({
    value,
    onChange,
    min,
    max,
    step,
    orientation: "horizontal",
  })

  return (
    <div
      ref={hitboxRef}
      onMouseDown={handleMouseDown}
      className={cn("relative w-full h-5 cursor-pointer flex items-center", className)}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div ref={trackRef} className="relative w-full h-0.5">
        <div className="absolute inset-0 rounded-full bg-black/50 border" style={{ borderColor: `${thumbColor}44` }} />
        <div
          className="absolute h-full rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: thumbColor, boxShadow: `0 0 6px ${thumbColor}` }}
        />
        <div
          className="absolute top-1/2 w-2.5 h-2.5 rounded-full border"
          style={{
            left: `${percentage}%`,
            transform: `translateX(-50%) translateY(-50%)`,
            backgroundColor: thumbColor,
            borderColor: `${thumbColor}88`,
            boxShadow: `0 0 8px ${thumbColor}`,
          }}
        />
      </div>
    </div>
  )
}
