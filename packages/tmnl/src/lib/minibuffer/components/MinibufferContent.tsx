/**
 * MinibufferContent
 *
 * The cmdk-based command palette UI that renders inside the bottom drawer.
 * Adapted from Raycast styling for TMNL's brutalist aesthetic.
 *
 * @module
 */

import { useCallback, useEffect, useRef } from "react"
import { Command as CommandPrimitive } from "cmdk"
import { useAtomValue } from "@effect-atom/atom-react"
import { Effect } from "effect"
import { Terminal, Search } from "lucide-react"
import * as atoms from "../atoms"
import { MinibufferService } from "../services/MinibufferService"

// ─────────────────────────────────────────────────────────────
// Styles (TMNL-adapted Raycast)
// ─────────────────────────────────────────────────────────────

const rootStyles: React.CSSProperties = {
  width: "100%",
  height: "100%",
  backgroundColor: "#000",
  fontFamily: "var(--font-geometric)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
}

const inputWrapperStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "8px 16px",
  borderBottom: "1px solid rgb(38 38 38)",
  gap: "8px",
}

const inputStyles: React.CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  backgroundColor: "transparent",
  color: "#fff",
  fontSize: "var(--tmnl-text-sm, 14px)",
  fontFamily: "var(--font-data)",
}

const listStyles: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "8px",
}

const itemStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 12px",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "var(--tmnl-text-sm, 14px)",
  color: "rgb(163 163 163)",
  transition: "all 150ms ease",
}

const itemSelectedStyles: React.CSSProperties = {
  ...itemStyles,
  backgroundColor: "rgb(38 38 38)",
  color: "#fff",
}

const itemLabelStyles: React.CSSProperties = {
  flex: 1,
  fontFamily: "var(--font-geometric)",
}

const itemDescStyles: React.CSSProperties = {
  fontSize: "var(--tmnl-text-xs, 12px)",
  color: "rgb(115 115 115)",
  fontFamily: "var(--font-data)",
}

const itemCategoryStyles: React.CSSProperties = {
  fontSize: "var(--tmnl-text-xs, 12px)",
  color: "rgb(82 82 82)",
  fontFamily: "var(--font-data)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
}

const emptyStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "64px",
  color: "rgb(82 82 82)",
  fontSize: "var(--tmnl-text-sm, 14px)",
  fontFamily: "var(--font-geometric)",
}

const groupHeadingStyles: React.CSSProperties = {
  fontSize: "var(--tmnl-text-xs, 12px)",
  color: "rgb(82 82 82)",
  fontFamily: "var(--font-data)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  padding: "4px 12px",
  marginTop: "8px",
}

const shortcutStyles: React.CSSProperties = {
  display: "flex",
  gap: "2px",
  marginLeft: "auto",
}

const kbdStyles: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  backgroundColor: "rgb(38 38 38)",
  color: "rgb(115 115 115)",
  height: "20px",
  minWidth: "20px",
  borderRadius: "4px",
  padding: "0 4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "var(--tmnl-text-xs, 12px)",
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function MinibufferContent() {
  const mode = useAtomValue(atoms.minibufferModeAtom)
  const input = useAtomValue(atoms.minibufferInputAtom)
  const prompt = useAtomValue(atoms.minibufferPromptAtom)
  const completions = useAtomValue(atoms.filteredCompletionsAtom)
  const selectedIndex = useAtomValue(atoms.minibufferSelectedIndexAtom)

  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle input change
  const handleInputChange = useCallback((value: string) => {
    atoms.Atom.set(atoms.minibufferInputAtom, value)

    // Update completions
    Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MinibufferService
        yield* svc.updateCompletions(value)
      }).pipe(Effect.provide(MinibufferService.Default))
    )
  }, [])

  // Handle selection
  const handleSelect = useCallback((value: string) => {
    const completion = completions.find(c =>
      (typeof c.value === "string" ? c.value : String(c.value)) === value
    )

    if (completion) {
      Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* MinibufferService
          yield* svc.resolveWithCompletion(completion)
        }).pipe(Effect.provide(MinibufferService.Default))
      )
    }
  }, [completions])

  // Handle escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* MinibufferService
          yield* svc.cancel()
        }).pipe(Effect.provide(MinibufferService.Default))
      )
    }
  }, [])

  // Group completions by category
  const groupedCompletions = completions.reduce((acc, c) => {
    const cat = c.category ?? "Commands"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(c)
    return acc
  }, {} as Record<string, typeof completions[number][]>)

  if (mode === "idle") {
    return null
  }

  return (
    <CommandPrimitive
      style={rootStyles}
      value={completions[selectedIndex]?.value as string}
      onValueChange={(v) => {
        const idx = completions.findIndex(c =>
          (typeof c.value === "string" ? c.value : String(c.value)) === v
        )
        if (idx !== -1) {
          atoms.Atom.set(atoms.minibufferSelectedIndexAtom, idx)
        }
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Input */}
      <div style={inputWrapperStyles}>
        <Terminal
          style={{
            width: "var(--tmnl-text-sm, 14px)",
            height: "var(--tmnl-text-sm, 14px)",
            color: "rgb(82 82 82)",
          }}
        />
        <span style={{ color: "rgb(82 82 82)", fontFamily: "var(--font-data)" }}>
          {prompt}
        </span>
        <CommandPrimitive.Input
          ref={inputRef}
          value={input}
          onValueChange={handleInputChange}
          style={inputStyles}
          placeholder="Type to search..."
        />
      </div>

      {/* Completion List */}
      <CommandPrimitive.List style={listStyles}>
        <CommandPrimitive.Empty style={emptyStyles}>
          No commands found
        </CommandPrimitive.Empty>

        {Object.entries(groupedCompletions).map(([category, items]) => (
          <CommandPrimitive.Group key={category} heading={category}>
            <div style={groupHeadingStyles}>{category}</div>
            {items.map((completion) => {
              const value = typeof completion.value === "string"
                ? completion.value
                : String(completion.value)
              const isSelected = completions[selectedIndex]?.value === completion.value

              return (
                <CommandPrimitive.Item
                  key={value}
                  value={value}
                  onSelect={handleSelect}
                  style={isSelected ? itemSelectedStyles : itemStyles}
                >
                  <span style={itemLabelStyles}>{completion.label}</span>
                  {completion.description && (
                    <span style={itemDescStyles}>{completion.description}</span>
                  )}
                  {completion.shortcut && (
                    <div style={shortcutStyles}>
                      {completion.shortcut.split("+").map((k, i) => (
                        <kbd key={i} style={kbdStyles}>{k}</kbd>
                      ))}
                    </div>
                  )}
                </CommandPrimitive.Item>
              )
            })}
          </CommandPrimitive.Group>
        ))}
      </CommandPrimitive.List>
    </CommandPrimitive>
  )
}

export default MinibufferContent
