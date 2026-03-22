/**
 * @file GlobalCommandTerminal.tsx
 * @description A redesigned, sleek command terminal docked at the bottom of the screen.
 * It now resembles the footer for a more integrated look.
 *
 * AI Adaptation Notes:
 * - The component is now positioned within the main layout flow, not fixed to the top.
 * - A `ChevronRight` icon is used as the command prompt for a classic terminal feel.
 * - Styling is minimal and matches the new "sleek" aesthetic.
 */

import type React from "react"
import { useState } from "react"
import { ChevronRight } from "lucide-react"

interface GlobalCommandTerminalProps {
  onExecuteCommand: (command: string) => void
}

export function GlobalCommandTerminal({ onExecuteCommand }: GlobalCommandTerminalProps) {
  const [input, setInput] = useState("")

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      onExecuteCommand(input.trim())
      setInput("")
    }
  }

  return (
    <div className="flex-shrink-0 bg-gray-900/50 backdrop-blur-sm border-t border-green-400/20 z-10">
      <div className="relative flex items-center h-8 px-4">
        <ChevronRight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          className="w-full h-full pl-8 pr-4 bg-transparent text-green-300 text-xs font-mono focus:outline-none"
        />
      </div>
    </div>
  )
}