import { memo, useEffect, useState } from "react"
import type { NodeProps } from "reactflow"
import { cn } from "@/lib/utils"

function LogTextNode({ data }: NodeProps<{ text: string; duration: number }>) {
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFading(true)
    }, data.duration * 1000) // Convert duration from seconds to ms

    return () => clearTimeout(timer)
  }, [data.duration])

  return (
    <div
      className={cn(
        "bg-transparent",
        isFading ? "log-text-node-animation-out pointer-events-none" : "log-text-node-animation-in",
      )}
    >
      <p className="text-2xl font-mono font-bold text-green-400" style={{ textShadow: "0 0 10px #00ff41" }}>
        {data.text}
      </p>
    </div>
  )
}

export default memo(LogTextNode)