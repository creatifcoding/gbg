/**
 * @file FullscreenWidgetWrapper.tsx
 * @description This component now includes a "Minimize" button in the header
 * for a more intuitive user experience.
 *
 * AI Adaptation Notes:
 * - A `Minus` icon button has been added. Both "Minimize" and "Exit" perform
 *   the same action: calling `onExit` to leave the fullscreen state.
 */

import type { CustomNode } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { X, Minus } from "lucide-react"

import { ChartWidgetNode } from "@/components/nodes/chart-widget-node"
import { NotesWidget } from "@/components/widgets/notes-widget"
import { TerminalWidget } from "@/components/widgets/terminal-widget"
import { TextEditorWidget } from "@/components/widgets/text-editor-widget"

interface FullscreenWidgetWrapperProps {
  node: CustomNode
  onExit: () => void
}

export function FullscreenWidgetWrapper({ node, onExit }: FullscreenWidgetWrapperProps) {
  const renderWidget = () => {
    const props = {
      ...node,
      id: node.id,
      data: node.data,
      selected: false,
      dragging: false,
      isConnectable: false,
      type: node.type,
      xPos: 0,
      yPos: 0,
      zIndex: 0,
    }

    switch (node.type) {
      case "chartWidget":
        return <ChartWidgetNode {...props} isFullscreen={true} />
      case "notes":
        return <NotesWidget {...props} isFullscreen={true} />
      case "terminal":
        return <TerminalWidget {...props} isFullscreen={true} />
      case "textEditor":
        return <TextEditorWidget {...props} isFullscreen={true} />
      default:
        return <div className="text-red-500">Error: This widget does not support fullscreen mode.</div>
    }
  }

  return (
    <div className="absolute inset-0 bg-black z-[100] flex flex-col p-2 md:p-4">
      <div className="flex-shrink-0 flex items-center justify-between mb-2 md:mb-4">
        <h2 className="text-base md:text-lg font-bold text-green-400">
          Focused View: <span className="text-purple-400">{node.id}</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button onClick={onExit} variant="ghost" size="icon" className="text-green-400 hover:bg-green-400/10">
            <Minus className="h-5 w-5" />
            <span className="sr-only">Minimize</span>
          </Button>
          <Button onClick={onExit} variant="ghost" size="icon" className="text-red-400 hover:bg-red-400/10">
            <X className="h-5 w-5" />
            <span className="sr-only">Exit Fullscreen</span>
          </Button>
        </div>
      </div>
      <div className="flex-1 w-full h-full overflow-auto">{renderWidget()}</div>
    </div>
  )
}