/**
 * MinibufferContent v2
 *
 * XState + effect-atom powered command palette.
 * Raycast meets Emacs minibuffer: crisp, monospace, brutalist but polished.
 *
 * Key differences from v1:
 * - Uses v2 atoms (XState-backed) instead of effect-atom services
 * - Uses ops for event dispatch (no MinibufferService)
 * - shouldFilter={false} — we do our own filtering via FlexSearch providers
 * - Mode-aware rendering: command, prompt, yOrN, whichKey
 *
 * @module
 */

import { useCallback, useEffect, useRef, useMemo } from "react"
import { Command as CommandPrimitive } from "cmdk"
import { useAtomValue } from "@effect-atom/atom-react"
import { Effect } from "effect"
import { Terminal, Check, X } from "lucide-react"

import {
  modeAtom,
  inputAtom,
  promptAtom,
  completionsAtom,
  selectedIndexAtom,
  providerIdAtom,
  whichKeyEntriesAtom,
  whichKeyPrefixAtom,
  ops,
} from "../atoms"
import { getCompletions, executeSelection } from "../providers"
import type { Completion, ProviderId } from "../machine"

// ─────────────────────────────────────────────────────────────
// Design Tokens (TMNL Brutalist × Raycast Polish)
// ─────────────────────────────────────────────────────────────

const TOKENS = {
  // Palette — warm grays with subtle warmth
  bg: {
    root: "#0a0a0a",
    input: "transparent",
    item: "transparent",
    itemHover: "rgba(255, 255, 255, 0.03)",
    itemSelected: "rgba(255, 255, 255, 0.06)",
    kbd: "rgba(255, 255, 255, 0.06)",
    separator: "rgba(255, 255, 255, 0.06)",
  },
  fg: {
    primary: "#e5e5e5",
    secondary: "#a3a3a3",
    muted: "#525252",
    accent: "#22d3ee", // cyan-400
    prompt: "#737373",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.06)",
    selected: "rgba(255, 255, 255, 0.1)",
  },
  // Typography
  font: {
    mono: "var(--font-data, 'JetBrains Mono', monospace)",
    sans: "var(--font-geometric, 'Inter', system-ui, sans-serif)",
  },
  size: {
    xs: "var(--tmnl-text-xs, 12px)",
    sm: "var(--tmnl-text-sm, 14px)",
    base: "var(--tmnl-text-base, 16px)",
  },
  // Spacing
  space: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
  },
  // Radii
  radius: {
    sm: "4px",
    md: "6px",
  },
} as const

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = {
  root: {
    width: "100%",
    height: "100%",
    backgroundColor: TOKENS.bg.root,
    fontFamily: TOKENS.font.mono,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },

  // Input row — the Emacs minibuffer line
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    padding: `${TOKENS.space.sm} ${TOKENS.space.lg}`,
    borderBottom: `1px solid ${TOKENS.border.subtle}`,
    gap: TOKENS.space.sm,
    minHeight: "44px",
  },

  promptIcon: {
    width: TOKENS.size.sm,
    height: TOKENS.size.sm,
    color: TOKENS.fg.muted,
    flexShrink: 0,
  },

  promptText: {
    color: TOKENS.fg.prompt,
    fontFamily: TOKENS.font.mono,
    fontSize: TOKENS.size.sm,
    fontWeight: 500,
    letterSpacing: "0.02em",
    flexShrink: 0,
  },

  input: {
    flex: 1,
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: TOKENS.fg.primary,
    fontSize: TOKENS.size.sm,
    fontFamily: TOKENS.font.mono,
    caretColor: TOKENS.fg.accent,
  },

  // Completion list
  list: {
    flex: 1,
    overflow: "auto",
    padding: TOKENS.space.xs,
    // Smooth scrolling
    scrollBehavior: "smooth" as const,
  },

  // Empty state
  empty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "64px",
    color: TOKENS.fg.muted,
    fontSize: TOKENS.size.sm,
    fontFamily: TOKENS.font.mono,
    fontStyle: "italic",
  },

  // Group heading
  groupHeading: {
    fontSize: TOKENS.size.xs,
    color: TOKENS.fg.muted,
    fontFamily: TOKENS.font.mono,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    padding: `${TOKENS.space.md} ${TOKENS.space.md} ${TOKENS.space.xs}`,
    marginTop: TOKENS.space.xs,
    borderTop: `1px solid ${TOKENS.border.subtle}`,
  },

  groupHeadingFirst: {
    borderTop: "none",
    marginTop: 0,
  },

  // Item — the Raycast-inspired row
  item: {
    display: "flex",
    alignItems: "center",
    gap: TOKENS.space.sm,
    padding: `${TOKENS.space.sm} ${TOKENS.space.md}`,
    borderRadius: TOKENS.radius.sm,
    cursor: "pointer",
    fontSize: TOKENS.size.sm,
    color: TOKENS.fg.secondary,
    transition: "all 100ms ease",
    // Will be styled via [data-selected] in CSS
  },

  itemLabel: {
    flex: 1,
    fontFamily: TOKENS.font.mono,
    fontWeight: 500,
    color: "inherit",
  },

  itemDescription: {
    fontSize: TOKENS.size.xs,
    color: TOKENS.fg.muted,
    fontFamily: TOKENS.font.mono,
    maxWidth: "50%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },

  itemCategory: {
    fontSize: TOKENS.size.xs,
    color: TOKENS.fg.muted,
    fontFamily: TOKENS.font.mono,
    opacity: 0.6,
  },

  // Keyboard shortcuts
  shortcut: {
    display: "flex",
    gap: "2px",
    marginLeft: "auto",
  },

  kbd: {
    fontFamily: TOKENS.font.mono,
    backgroundColor: TOKENS.bg.kbd,
    color: TOKENS.fg.muted,
    height: "20px",
    minWidth: "20px",
    borderRadius: TOKENS.radius.sm,
    padding: "0 4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: TOKENS.size.xs,
    border: `1px solid ${TOKENS.border.subtle}`,
  },

  // y-or-n mode
  yOrNWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: TOKENS.space.lg,
    padding: TOKENS.space.lg,
  },

  yOrNButton: {
    display: "flex",
    alignItems: "center",
    gap: TOKENS.space.xs,
    padding: `${TOKENS.space.sm} ${TOKENS.space.md}`,
    borderRadius: TOKENS.radius.md,
    border: `1px solid ${TOKENS.border.subtle}`,
    backgroundColor: "transparent",
    color: TOKENS.fg.secondary,
    fontFamily: TOKENS.font.mono,
    fontSize: TOKENS.size.sm,
    cursor: "pointer",
    transition: "all 100ms ease",
  },

  // Which-key mode
  whichKeyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: TOKENS.space.sm,
    padding: TOKENS.space.md,
  },

  whichKeyEntry: {
    display: "flex",
    alignItems: "center",
    gap: TOKENS.space.sm,
    padding: TOKENS.space.sm,
    borderRadius: TOKENS.radius.sm,
    cursor: "pointer",
    transition: "all 100ms ease",
  },

  whichKeyKey: {
    fontFamily: TOKENS.font.mono,
    backgroundColor: TOKENS.bg.kbd,
    color: TOKENS.fg.accent,
    padding: `2px ${TOKENS.space.xs}`,
    borderRadius: TOKENS.radius.sm,
    fontSize: TOKENS.size.sm,
    fontWeight: 600,
    minWidth: "24px",
    textAlign: "center" as const,
  },

  whichKeyLabel: {
    fontFamily: TOKENS.font.mono,
    fontSize: TOKENS.size.sm,
    color: TOKENS.fg.secondary,
  },

  whichKeyPrefix: {
    fontFamily: TOKENS.font.mono,
    color: TOKENS.fg.muted,
    fontSize: TOKENS.size.xs,
    marginLeft: "auto",
  },
} as const

// ─────────────────────────────────────────────────────────────
// CSS for data-selected (injected once)
// ─────────────────────────────────────────────────────────────

const STYLE_ID = "minibuffer-v2-styles"

function injectStyles() {
  if (typeof document === "undefined") return
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    [cmdk-item][data-selected="true"] {
      background-color: ${TOKENS.bg.itemSelected};
      color: ${TOKENS.fg.primary};
      box-shadow: inset 0 0 0 1px ${TOKENS.border.selected};
    }
    [cmdk-item]:hover:not([data-selected="true"]) {
      background-color: ${TOKENS.bg.itemHover};
    }
    [cmdk-input]::placeholder {
      color: ${TOKENS.fg.muted};
    }
    [cmdk-list]::-webkit-scrollbar {
      width: 6px;
    }
    [cmdk-list]::-webkit-scrollbar-track {
      background: transparent;
    }
    [cmdk-list]::-webkit-scrollbar-thumb {
      background: ${TOKENS.border.subtle};
      border-radius: 3px;
    }
  `
  document.head.appendChild(style)
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function MinibufferContent() {
  const mode = useAtomValue(modeAtom)
  const input = useAtomValue(inputAtom)
  const prompt = useAtomValue(promptAtom)
  const completions = useAtomValue(completionsAtom)
  const selectedIndex = useAtomValue(selectedIndexAtom)
  const providerId = useAtomValue(providerIdAtom)
  const whichKeyEntries = useAtomValue(whichKeyEntriesAtom)
  const whichKeyPrefix = useAtomValue(whichKeyPrefixAtom)

  const inputRef = useRef<HTMLInputElement>(null)

  // Inject CSS on mount
  useEffect(() => {
    injectStyles()
  }, [])

  // Focus input on mount and when mode changes to active
  useEffect(() => {
    if (mode !== "idle") {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [mode])

  // Fetch completions when input changes (command mode only)
  useEffect(() => {
    if (mode !== "command" || !providerId) return

    // Debounce would be nice, but keep it simple for now
    const fetchCompletions = async () => {
      const effect = getCompletions(providerId, input)
      const results = await Effect.runPromise(effect)
      ops.loadCompletions(results)
    }

    fetchCompletions()
  }, [mode, providerId, input])

  // Handle input change
  const handleInputChange = useCallback((value: string) => {
    ops.updateInput(value)
  }, [])

  // Handle item selection (click or Enter)
  const handleSelect = useCallback((value: string) => {
    const completion = completions.find(c => c.value === value)
    if (completion && providerId) {
      ops.selectCompletion(completion)
      // Execute the provider's onSelect handler (this is what was missing!)
      Effect.runPromise(executeSelection(providerId, completion))
    }
  }, [completions, providerId])

  // Handle selection change from cmdk (keyboard navigation)
  const handleValueChange = useCallback((value: string) => {
    const idx = completions.findIndex(c => c.value === value)
    if (idx !== -1 && idx !== selectedIndex) {
      ops.selectIndex(idx)
    }
  }, [completions, selectedIndex])

  // Keyboard handler — let Escape bubble to global handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Escape: let it bubble to close the drawer
    if (e.key === "Escape") {
      return
    }

    // y-or-n mode: handle y/n keys
    if (mode === "yOrN") {
      if (e.key === "y" || e.key === "Y") {
        e.preventDefault()
        ops.confirm()
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault()
        ops.deny()
      }
      return
    }

    // which-key mode: handle key selection
    if (mode === "whichKey") {
      const entry = whichKeyEntries.find(e => e.key === e.key.toLowerCase())
      if (entry) {
        e.preventDefault()
        ops.whichKeySelect(e.key)
      }
      return
    }
  }, [mode, whichKeyEntries])

  // Group completions by category
  const groupedCompletions = useMemo(() => {
    return completions.reduce((acc, c) => {
      const cat = c.category ?? "Commands"
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(c)
      return acc
    }, {} as Record<string, Completion[]>)
  }, [completions])

  // Get selected value for cmdk controlled state
  const selectedValue = completions[selectedIndex]?.value ?? ""

  // ─────────────────────────────────────────────────────────────
  // Render by mode
  // ─────────────────────────────────────────────────────────────

  // y-or-n mode
  if (mode === "yOrN") {
    return (
      <div style={styles.root}>
        <div style={styles.inputWrapper}>
          <Terminal style={styles.promptIcon} />
          <span style={styles.promptText}>{prompt}</span>
        </div>
        <div style={styles.yOrNWrapper}>
          <button
            style={styles.yOrNButton}
            onClick={() => ops.confirm()}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = TOKENS.bg.itemSelected
              e.currentTarget.style.color = TOKENS.fg.primary
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
              e.currentTarget.style.color = TOKENS.fg.secondary
            }}
          >
            <Check size={14} />
            <span>Yes</span>
            <kbd style={styles.kbd}>y</kbd>
          </button>
          <button
            style={styles.yOrNButton}
            onClick={() => ops.deny()}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = TOKENS.bg.itemSelected
              e.currentTarget.style.color = TOKENS.fg.primary
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
              e.currentTarget.style.color = TOKENS.fg.secondary
            }}
          >
            <X size={14} />
            <span>No</span>
            <kbd style={styles.kbd}>n</kbd>
          </button>
        </div>
      </div>
    )
  }

  // which-key mode
  if (mode === "whichKey") {
    return (
      <div style={styles.root}>
        <div style={styles.inputWrapper}>
          <Terminal style={styles.promptIcon} />
          <span style={styles.promptText}>{whichKeyPrefix}</span>
        </div>
        <div style={styles.whichKeyGrid}>
          {whichKeyEntries.map((entry) => (
            <div
              key={entry.key}
              style={styles.whichKeyEntry}
              onClick={() => ops.whichKeySelect(entry.key)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = TOKENS.bg.itemSelected
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
            >
              <span style={styles.whichKeyKey}>{entry.key}</span>
              <span style={styles.whichKeyLabel}>{entry.label}</span>
              {entry.isPrefix && (
                <span style={styles.whichKeyPrefix}>+</span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // prompt mode (simple text input, no completions)
  if (mode === "prompt") {
    return (
      <div style={styles.root} onKeyDown={handleKeyDown}>
        <div style={styles.inputWrapper}>
          <Terminal style={styles.promptIcon} />
          <span style={styles.promptText}>{prompt}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                ops.submit()
              }
            }}
            style={styles.input}
            placeholder="Type here..."
            autoFocus
          />
        </div>
      </div>
    )
  }

  // command mode (M-x style with completions)
  return (
    <CommandPrimitive
      style={styles.root}
      value={selectedValue}
      onValueChange={handleValueChange}
      onKeyDown={handleKeyDown}
      shouldFilter={false} // We do our own filtering via FlexSearch
      loop
    >
      {/* Input */}
      <div style={styles.inputWrapper}>
        <Terminal style={styles.promptIcon} />
        <span style={styles.promptText}>{prompt}</span>
        <CommandPrimitive.Input
          ref={inputRef}
          value={input}
          onValueChange={handleInputChange}
          style={styles.input}
          placeholder="Type to search..."
        />
      </div>

      {/* Completion List */}
      <CommandPrimitive.List style={styles.list}>
        <CommandPrimitive.Empty style={styles.empty}>
          No commands found
        </CommandPrimitive.Empty>

        {Object.entries(groupedCompletions).map(([category, items], groupIdx) => (
          <CommandPrimitive.Group key={category} value={category}>
            <div
              style={{
                ...styles.groupHeading,
                ...(groupIdx === 0 ? styles.groupHeadingFirst : {}),
              }}
            >
              {category}
            </div>
            {items.map((completion) => (
              <CommandPrimitive.Item
                key={completion.value}
                value={completion.value}
                onSelect={handleSelect}
                style={styles.item}
              >
                <span style={styles.itemLabel}>{completion.label}</span>
                {completion.description && (
                  <span style={styles.itemDescription} title={completion.description}>
                    {completion.description}
                  </span>
                )}
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.Group>
        ))}
      </CommandPrimitive.List>
    </CommandPrimitive>
  )
}

export default MinibufferContent
