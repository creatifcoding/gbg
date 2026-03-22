import type React from "react"

import { Handle, Position, type NodeProps } from "reactflow"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import type { TerminalData } from "@/lib/types"

export function TerminalWidget({ data, id }: NodeProps<TerminalData>) {
  const [history, setHistory] = useState(data.history || ["$ Welcome to terminal"])
  const [input, setInput] = useState("")

  const handleCommand = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const command = input.trim()
      if (command) {
        const response = processCommand(command)
        setHistory((prev) => [...prev, `$ ${command}`, response])
        setInput("")
      }
    }
  }

  const processCommand = (cmd: string) => {
    switch (cmd.toLowerCase()) {
      case "help":
        return "Available commands: help, clear, date, echo [text]"
      case "clear":
        setHistory(["$ Terminal cleared"])
        return ""
      case "date":
        return new Date().toLocaleString()
      default:
        if (cmd.startsWith("echo ")) {
          return cmd.substring(5)
        }
        return `Command not found: ${cmd}`
    }
  }

  return (
    <div className="bg-gray-900 border border-green-400/30 rounded-lg p-3 min-w-[350px] shadow-lg shadow-green-400/10">
      <Handle type="target" position={Position.Left} className="bg-green-400" />
      <Handle type="source" position={Position.Right} className="bg-green-400" />

      <div className="text-green-400 font-mono text-sm mb-2 flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        TERMINAL.exe
      </div>

      <div className="bg-black border border-green-400/30 rounded p-2 h-32 overflow-y-auto font-mono text-sm">
        {history.map((line, i) => (
          <div key={i} className="text-green-400">
            {line}
          </div>
        ))}
      </div>

      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleCommand}
        className="mt-2 bg-black border-green-400/30 text-green-400 font-mono text-sm focus:border-green-400"
        placeholder="Type command..."
      />
    </div>
  )
}