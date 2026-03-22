/**
 * @file Footer.tsx
 * @description A more compact, contextual footer.
 *
 * AI Adaptation Notes:
 * - The height and font sizes have been reduced to match the new sleek design.
 * - The logic remains the same, expanding based on the `selectedNode` prop.
 */
import { cn } from "@/lib/utils"
import type { CustomNode } from "@/lib/types"
import { ChevronUp, Info } from "lucide-react"

interface FooterProps {
  selectedNode: CustomNode | null
}

function NodeDetailViewer({ node }: { node: CustomNode }) {
  switch (node.type) {
    case "chartWidget":
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
          {Object.entries(node.data.parameters).map(([key, value]) => (
            <div key={key} className="flex items-baseline gap-1.5">
              <span className="font-semibold text-green-300 capitalize">{key.replace(/([A-Z])/g, " $1")}:</span>
              <span className="truncate" style={key.includes("Color") ? { color: value } : {}}>
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      )
    case "notes":
      return <p className="text-xs italic">"{node.data.content}"</p>
    default:
      return <p className="text-xs">No detailed view for this node type.</p>
  }
}

export function Footer({ selectedNode }: FooterProps) {
  const isExpanded = selectedNode !== null

  return (
    <footer
      className={cn(
        "flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-t border-green-400/20 transition-all duration-300 ease-in-out z-10",
        isExpanded ? "max-h-32" : "max-h-7",
      )}
    >
      <div className="flex items-center justify-between h-7 px-4 text-xs">
        <div className="flex items-center gap-2">
          <Info className="h-3 w-3" />
          <span>{isExpanded ? `Selected: ${selectedNode?.id}` : "No node selected."}</span>
        </div>
        <ChevronUp className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
      </div>
      {isExpanded && (
        <div className="p-2 md:p-4 border-t border-green-400/10 overflow-y-auto">
          <NodeDetailViewer node={selectedNode} />
        </div>
      )}
    </footer>
  )
}
