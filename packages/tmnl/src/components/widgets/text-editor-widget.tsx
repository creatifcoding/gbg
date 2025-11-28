import { Handle, Position, type NodeProps } from "reactflow"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import type { TextEditorData } from "@/lib/types"

export function TextEditorWidget({ data, id }: NodeProps<TextEditorData>) {
  const [content, setContent] = useState(data.content || "")

  return (
    <div className="bg-gray-900 border border-green-400/30 rounded-lg p-3 min-w-[300px] shadow-lg shadow-green-400/10">
      <Handle type="target" position={Position.Left} className="bg-green-400" />
      <Handle type="source" position={Position.Right} className="bg-green-400" />

      <div className="text-green-400 font-mono text-sm mb-2 flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        TEXT_EDITOR.exe
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="bg-black border-green-400/30 text-green-400 font-mono text-sm resize-none min-h-[120px] focus:border-green-400"
        placeholder="Enter text..."
      />

      <div className="text-green-400/60 font-mono text-xs mt-2">
        Lines: {content.split("\n").length} | Chars: {content.length}
      </div>
    </div>
  )
}