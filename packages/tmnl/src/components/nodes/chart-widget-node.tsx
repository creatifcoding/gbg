import type React from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { Maximize } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChartWidgetNodeData } from "@/lib/types"

/**
 * The Chart Widget is now a fully controlled component. It has no internal state
 * for its data, receiving everything via props. This ensures it's always in sync
 * with the central state managed by the useTmnlState hook.
 */
export function ChartWidgetNode({
  data,
  selected,
  isFullscreen,
}: NodeProps<ChartWidgetNodeData> & { isFullscreen?: boolean }) {
  // State is received from props, not managed internally
  const { chartData = [], parameters, metadata, onToggleFullscreen } = data
  const { lineColor, lineWidth, showPoints, glowColor, barSpacing } = parameters
  const maxValue = 100

  const glowStyle = {
    "--glow-color": glowColor,
    borderColor: glowColor,
  } as React.CSSProperties

  return (
    <div
      className={cn(
        "bg-gray-900/50 backdrop-blur-md border rounded-lg transition-all duration-300 ease-in-out contain-[layout_style_paint] animate-pulsing-glow w-[250px]",
        isFullscreen && "h-full w-full flex flex-col",
      )}
      style={glowStyle}
    >
      {!isFullscreen && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-gray-900 !border"
          style={{ borderColor: glowColor }}
        />
      )}

      <div className="relative h-10 flex-shrink-0 flex items-center justify-between px-2 text-white font-mono text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: glowColor }}></div>
          {metadata.name}
        </div>
        {!isFullscreen && (
          <button onClick={onToggleFullscreen} className="p-1" title="Enter Fullscreen">
            <Maximize className="w-3 h-3" style={{ color: glowColor }} />
          </button>
        )}
      </div>

      <div className={cn("px-2 pb-2", isFullscreen && "flex-1 flex flex-col")}>
        <div
          className={cn("bg-black/50 border rounded p-2 shadow-inner shadow-black/50", isFullscreen && "flex-1 flex")}
          style={{ borderColor: `${glowColor}40` }}
        >
          <div className={cn("flex items-end justify-start", isFullscreen ? "w-full h-full" : "h-16")}>
            {chartData.map((value, i) => (
              <div
                key={i}
                className="relative transition-all duration-300"
                style={{
                  height: `${(value / maxValue) * 100}%`,
                  backgroundColor: lineColor,
                  flex: 1,
                  minWidth: "2px",
                  marginRight: `${barSpacing || 1}px`,
                  borderWidth: `${lineWidth / 5}px`,
                  borderColor: `${lineColor}80`,
                }}
              >
                {showPoints && isFullscreen && (
                  <div
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: lineColor, border: `1px solid ${glowColor}` }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}