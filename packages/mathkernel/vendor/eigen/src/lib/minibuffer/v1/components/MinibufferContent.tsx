/**
 * MinibufferContent
 *
 * The cmdk-based command palette UI that renders inside the bottom drawer.
 * Adapted from Raycast styling for TMNL's brutalist aesthetic.
 *
 * @module
 */

import { useCallback, useEffect, useRef, useContext } from "react"
import { Command as CommandPrimitive } from "cmdk"
import { useAtomValue, useAtomSet, RegistryContext } from "@effect-atom/atom-react"
import { Effect } from "effect"
import { Terminal } from "lucide-react"
import * as atoms from "../atoms"
import { minibufferAtoms } from "../atoms/runtime"
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
  padding: "6px 12px",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "var(--tmnl-text-sm, 14px)",
  color: "rgb(200 200 200)",
  transition: "all 150ms ease",
}

const itemSelectedStyles: React.CSSProperties = {
  ...itemStyles,
  backgroundColor: "rgb(45 45 45)",
  color: "#fff",
  boxShadow: "inset 0 0 0 1px rgb(64 64 64)",
}

const itemLabelStyles: React.CSSProperties = {
  flex: 1,
  fontFamily: "var(--font-geometric)",
  fontWeight: 500,
  letterSpacing: "0.01em",
}

const itemDescStyles: React.CSSProperties = {
  fontSize: "var(--tmnl-text-xs, 12px)",
  color: "rgb(130 130 130)",
  fontFamily: "var(--font-data)",
  fontStyle: "italic",
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
  color: "rgb(64 64 64)",
  fontFamily: "var(--font-data)",
  textTransform: "uppercase",
  letterSpacing: "0.15em",
  padding: "8px 12px 2px 12px",
  marginTop: "2px",
  borderTop: "1px solid rgb(32 32 32)",
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
  const registry = useContext(RegistryContext)
  const mode = useAtomValue(atoms.minibufferModeAtom)
  const input = useAtomValue(atoms.minibufferInputAtom)
  const prompt = useAtomValue(atoms.minibufferPromptAtom)
  const completions = useAtomValue(atoms.filteredCompletionsAtom)
  const selectedIndex = useAtomValue(atoms.minibufferSelectedIndexAtom)

  // Effect-atom operation functions (AtomResultFn → callable via useAtomSet)
  // These share the same MinibufferService instance for proper Deferred handling
  const doCancel = useAtomSet(minibufferAtoms.cancel, { mode: "fire" })
  const doResolveWithCompletion = useAtomSet(minibufferAtoms.resolveWithCompletion, { mode: "fire" })

  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle input change
  const handleInputChange = useCallback((value: string) => {
    // Use registry.set() to trigger React re-renders
    registry.set(atoms.minibufferInputAtom, value)

    // Update completions
    Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MinibufferService
        yield* svc.updateCompletions(value)
      }).pipe(Effect.provide(MinibufferService.Default))
    )
  }, [registry])

  // Handle selection — use shared runtime to resolve Deferred correctly
  const handleSelect = useCallback((value: string) => {
    const completion = completions.find(c =>
      (typeof c.value === "string" ? c.value : String(c.value)) === value
    )

    if (completion) {
      console.log('[MinibufferContent] Selecting completion:', completion.label)
      doResolveWithCompletion(completion)
    }
  }, [completions, doResolveWithCompletion])

  // NOTE: Escape is NOT handled here - it's handled by the global hotkey system
  // via the minibuffer scope. This ensures useMinibuffer.cancel() is called,
  // which both resolves the Deferred AND closes the drawer.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Let escape bubble to global handler (useGlobalHotkeys)
    // Only log for debugging
    if (e.key === "Escape") {
      console.log('[MinibufferContent] Escape pressed, letting it bubble to global handler')
      // Don't preventDefault - let it propagate!
      return
    }
    console.log('[MinibufferContent] keyDown:', e.key)
  }, [])

  // Group completions by category
  const groupedCompletions = completions.reduce((acc, c) => {
    const cat = c.category ?? "Commands"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(c)
    return acc
  }, {} as Record<string, typeof completions[number][]>)

  // Always render - don't guard on mode === "idle"
  // The drawer opening triggers the Effect flow which sets mode
  // If we return null here, we race with atom updates

  return (
    <CommandPrimitive
      style={rootStyles}
      value={completions[selectedIndex]?.value as string}
      onValueChange={(v) => {
        const idx = completions.findIndex(c =>
          (typeof c.value === "string" ? c.value : String(c.value)) === v
        )
        if (idx !== -1) {
          registry.set(atoms.minibufferSelectedIndexAtom, idx)
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
