import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import type { ComponentNodeData } from "@/lib/types"
import { SlidersHorizontal } from "lucide-react"

function ComponentNode({ data }: NodeProps<ComponentNodeData>) {
  return (
    <div className="bg-gray-800 border-2 border-gray-700 rounded-xl shadow-lg w-72">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-bold text-white">{data.metadata.name}</h3>
        <p className="text-sm text-gray-400">{data.type}</p>
      </div>
      <div className="p-4 space-y-2">
        <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" />
          Live Parameters
        </h4>
        <div className="bg-gray-900 rounded-md p-3 space-y-1 max-h-40 overflow-y-auto">
          {Object.entries(data.parameters).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center text-xs font-mono">
              <span className="text-gray-400">{key}:</span>
              <span
                className="text-purple-400 font-semibold truncate"
                style={key.toLowerCase().includes("color") ? { color: value } : {}}
              >
                {typeof value === "boolean" ? (value ? "true" : "false") : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!w-4 !h-4 !bg-gray-700 !border-2 !border-purple-500" />
    </div>
  )
}

export default memo(ComponentNode)