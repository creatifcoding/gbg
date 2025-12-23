/**
 * KORI REPL Panel
 *
 * Terminal-like interface for KORI ECS commands.
 * Commands: spawn, destroy, addTrait, query, send (actor events).
 *
 * @module
 */

import { useState, useRef, useEffect, useCallback } from "react"

import { useStxData, useStx } from "@/lib/stx"
import { getKoriTestbedStx, type ReplHistoryEntry } from "../kori-testbed-stx"

export function REPLPanel() {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  const testbed = getKoriTestbedStx()
  const { runEffect } = useStx(testbed)

  const history = useStxData(testbed, (d) => d.replHistory.get())

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [history])

  const executeCommand = useCallback(
    async (cmdLine: string) => {
      const trimmed = cmdLine.trim()
      if (!trimmed) return

      await runEffect("executeCommand", trimmed)
      setInput("")
    },
    [runEffect]
  )

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        await executeCommand(input)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        const cmd = (await runEffect("navigateHistory", "up")) as string
        if (cmd) setInput(cmd)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        const cmd = (await runEffect("navigateHistory", "down")) as string
        setInput(cmd)
      } else if (e.key === "Tab") {
        e.preventDefault()
        // Tab completion
        if (input.startsWith(":") || input.startsWith("!")) {
          const partial = input.slice(1).toLowerCase()
          const commands = [
            "help",
            "spawn",
            "destroy",
            "list",
            "select",
            "deselect",
            "query",
            "count",
            "clear",
            "stats",
            "cls",
          ]
          const matches = commands.filter((c) => c.startsWith(partial))
          if (matches.length === 1) {
            setInput(`:${matches[0]} `)
          }
        }
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault()
        await runEffect("clearRepl")
      }
    },
    [input, executeCommand, runEffect]
  )

  return (
    <div className="flex flex-col h-full bg-neutral-950 border border-neutral-800 rounded overflow-hidden">
      {/* Output Area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-3 font-mono"
        style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
      >
        {/* Welcome message */}
        {history.length === 0 && (
          <div className="text-neutral-500 mb-2">
            <div className="text-cyan-400 mb-1">KORI ECS REPL</div>
            <div>Type :help for commands. Ctrl+L to clear.</div>
            <div className="mt-2 text-neutral-600">
              Try: :spawn, :list, :query Health
            </div>
          </div>
        )}

        {/* History */}
        {history.map((entry: ReplHistoryEntry) => (
          <div key={entry.id} className="mb-2">
            <div className="text-cyan-400">
              <span className="text-neutral-500 mr-2">{">"}</span>
              {entry.input}
            </div>
            {entry.output && (
              <pre
                className={`whitespace-pre-wrap ml-4 ${
                  entry.isError ? "text-red-400" : "text-neutral-300"
                }`}
              >
                {entry.output}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="flex items-center border-t border-neutral-800 bg-neutral-900/50">
        <span
          className="text-cyan-400 px-3 font-mono"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          {">"}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder=":help for commands..."
          className="flex-1 bg-transparent border-none outline-none text-neutral-100 font-mono py-2 pr-3"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
          autoFocus
        />
      </div>
    </div>
  )
}
