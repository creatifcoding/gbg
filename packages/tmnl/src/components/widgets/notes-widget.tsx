import { Handle, Position, type NodeProps } from "reactflow"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { NotesData } from "@/lib/types"
import { Maximize } from "lucide-react"
import { cn } from "@/lib/utils"

export function NotesWidget({ data, id, isFullscreen }: NodeProps<NotesData> & { isFullscreen?: boolean }) {
  const { title, content, onDataChange, onToggleFullscreen } = data

  return (
    <div
      className={cn(
        "bg-gray-900 border border-green-400/30 rounded-lg p-2 min-w-[200px] shadow-lg shadow-green-400/10 flex flex-col",
        isFullscreen && "h-full w-full",
      )}
    >
      <div className="flex items-center justify-between mb-1 text-green-400 font-mono text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
          NOTES.exe
        </div>
        {!isFullscreen && (
          <button onClick={onToggleFullscreen} className="p-1">
            <Maximize className="w-3 h-3" />
          </button>
        )}
      </div>

      <Input
        value={title}
        onChange={(e) => onDataChange({ title: e.target.value })}
        className="bg-black border-green-400/30 text-green-400 font-mono text-xs mb-1 h-7 focus:border-green-400"
        placeholder="Note title..."
      />

      <Textarea
        value={content}
        onChange={(e) => onDataChange({ content: e.target.value })}
        className={cn(
          "bg-black border-green-400/30 text-green-400 font-mono text-xs resize-none min-h-[80px] focus:border-green-400",
          isFullscreen && "flex-1",
        )}
        placeholder="Write your notes here..."
      />
      {!isFullscreen && (
        <>
          <Handle type="target" position={Position.Left} className="!bg-green-400" />
          <Handle type="source" position={Position.Right} className="!bg-green-400" />
        </>
      )}
    </div>
  )
}