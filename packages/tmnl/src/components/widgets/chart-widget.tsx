import { Handle, Position, type NodeProps } from "reactflow"
import { useEffect, useState, useRef } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function ChartWidget({ data, id, selected }: NodeProps) {
  const [chartData, setChartData] = useState<number[]>(data.data || [])
  const [connectionStatus, setConnectionStatus] = useState("Connecting...")
  const [isExpanded, setIsExpanded] = useState(true)
  const dataFeedInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setConnectionStatus("Connected")
    dataFeedInterval.current = setInterval(() => {
      const newValue = Math.floor(Math.random() * 50) + 5
      setChartData((prevData) => {
        const newData = [...prevData, newValue]
        return newData.length > 20 ? newData.slice(newData.length - 20) : newData
      })
    }, 1500)
    return () => {
      if (dataFeedInterval.current) clearInterval(dataFeedInterval.current)
      setConnectionStatus("Disconnected")
    }
  }, [])

  const maxValue = Math.max(...chartData, 50)
  const barHeight = 80

  const toggleExpand = () => {
    // By wrapping the state update in a timeout, we push it to the next event loop cycle.
    // This breaks the synchronous ResizeObserver loop that can occur when a component's
    // size changes in direct response to an observer's notification, resolving the error.
    setTimeout(() => {
      setIsExpanded((prev) => !prev)
    }, 0)
  }

  return (
    <div
      className={cn(
        "bg-[rgba(0,0,0,0.02)] backdrop-blur-[10px] border rounded-xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-[height,box-shadow] contain-[layout_style_paint]",
        "border-[rgba(147,51,234,0.3)] animate-pulsing-glow",
        selected && "shadow-[0_0_40px_10px_rgba(147,51,234,0.5)]",
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-purple-400" />
      <Handle type="source" position={Position.Right} className="!bg-purple-400" />

      <div className="relative h-[60px] flex items-center justify-between px-4 text-purple-300 font-mono text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
          REALTIME_CHART.exe
        </div>
        <div className="text-xs text-purple-400/70 flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              connectionStatus === "Connected" ? "bg-green-500 animate-pulse" : "bg-yellow-500"
            }`}
          ></div>
          {connectionStatus}
        </div>
        <button
          onClick={toggleExpand}
          aria-expanded={isExpanded}
          className="absolute top-[18px] right-4 w-6 h-6 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 animate-flash"
        >
          <ChevronDown
            className={cn(
              "w-5 h-5 text-purple-400 transition-transform duration-500 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)] will-change-transform",
              isExpanded && "rotate-180",
            )}
          />
        </button>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "px-4 pb-4 transition-all duration-500",
              isExpanded ? "opacity-100 translate-y-0 scale-100 blur-0" : "opacity-0 -translate-y-2 scale-95 blur-sm",
            )}
          >
            <div className="bg-black/50 border border-purple-400/20 rounded-lg p-3 shadow-inner shadow-black/50">
              <div className="flex items-end justify-start h-20 gap-1">
                {chartData.map((value, i) => (
                  <div
                    key={i}
                    className="bg-purple-400 min-w-[8px] transition-all duration-300 hover:bg-purple-300"
                    style={{
                      height: `${(value / maxValue) * barHeight}px`,
                      flex: 1,
                    }}
                    title={`Value: ${value}`}
                  />
                ))}
              </div>
              <div className="text-purple-400/60 font-mono text-xs mt-2 text-center">
                Last value: {chartData.length > 0 ? chartData[chartData.length - 1] : "N/A"} | Data points:{" "}
                {chartData.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}