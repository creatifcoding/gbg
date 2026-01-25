/**
 * WhichKeyPopup
 *
 * Displays available key continuations after a prefix is entered.
 * Emacs which-key inspired, positioned at bottom center.
 *
 * @module
 */

import type { KeySequence, WhichKeyEntry } from "../types"

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const popupStyles: React.CSSProperties = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  backgroundColor: "rgb(23 23 23)",
  border: "1px solid rgb(38 38 38)",
  borderRadius: 8,
  padding: 16,
  minWidth: 280,
  maxWidth: 400,
  zIndex: 9999,
  fontFamily: "var(--font-data)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
}

const titleStyles: React.CSSProperties = {
  fontSize: "var(--tmnl-text-xs, 12px)",
  color: "rgb(82 82 82)",
  marginBottom: 12,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  display: "flex",
  alignItems: "center",
  gap: 8,
}

const prefixBadgeStyles: React.CSSProperties = {
  backgroundColor: "rgb(38 38 38)",
  padding: "2px 6px",
  borderRadius: 4,
  color: "rgb(163 163 163)",
}

const entryStyles: React.CSSProperties = {
  display: "flex",
  gap: 12,
  padding: "6px 0",
  fontSize: "var(--tmnl-text-sm, 14px)",
}

const keyStyles: React.CSSProperties = {
  color: "rgb(103 232 249)", // cyan-300
  fontWeight: 600,
  minWidth: 64,
  fontFamily: "var(--font-data)",
}

const labelStyles: React.CSSProperties = {
  color: "rgb(163 163 163)",
}

const prefixLabelStyles: React.CSSProperties = {
  color: "rgb(82 82 82)",
  fontStyle: "italic",
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function serializeChord(chord: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean; key: string }): string {
  const parts: string[] = []
  if (chord.ctrl) parts.push("C")
  if (chord.alt) parts.push("M")
  if (chord.shift) parts.push("S")
  if (chord.meta) parts.push("s")
  parts.push(chord.key)
  return parts.join("-")
}

function serializeSequence(sequence: KeySequence): string {
  if (sequence.length === 0) return ""
  return sequence.map(serializeChord).join(" ")
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export interface WhichKeyPopupProps {
  /** Available key entries */
  entries: readonly WhichKeyEntry[]
  /** Current prefix sequence */
  prefix: KeySequence
}

export function WhichKeyPopup({ entries, prefix }: WhichKeyPopupProps) {
  if (entries.length === 0) return null

  const prefixStr = serializeSequence(prefix)

  return (
    <div style={popupStyles} role="tooltip" aria-label="Available key bindings">
      <div style={titleStyles}>
        <span>which-key</span>
        {prefixStr && <span style={prefixBadgeStyles}>{prefixStr}</span>}
      </div>
      <div>
        {entries.slice(0, 10).map((entry, i) => (
          <div key={i} style={entryStyles}>
            <span style={keyStyles}>{entry.key}</span>
            <span style={entry.isPrefix ? prefixLabelStyles : labelStyles}>
              {entry.label}
            </span>
          </div>
        ))}
        {entries.length > 10 && (
          <div style={{ ...entryStyles, color: "rgb(82 82 82)" }}>
            +{entries.length - 10} more...
          </div>
        )}
      </div>
    </div>
  )
}

export default WhichKeyPopup
