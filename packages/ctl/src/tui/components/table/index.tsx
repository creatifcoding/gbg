/** @jsxImportSource @opentui/react */
/**
 * Table Component
 *
 * Data table with headers and rows.
 */
import { type ReactNode } from "react"
import { Muted } from "../../primitives"

// =============================================================================
// TYPES
// =============================================================================

export interface TableColumn<T = unknown> {
  key: string
  header: string
  width?: number
  align?: "left" | "center" | "right"
  render?: (value: unknown, row: T) => ReactNode
}

export interface TableProps<T = Record<string, unknown>> {
  columns: TableColumn<T>[]
  data: T[]
  emptyMessage?: string
  selectedIndex?: number
  showHeader?: boolean
}

// =============================================================================
// COMPONENT
// =============================================================================

export const Table = <T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage = "No data",
  selectedIndex,
  showHeader = true,
}: TableProps<T>): ReactNode => {
  const getAlignment = (align?: "left" | "center" | "right") => {
    switch (align) {
      case "center":
        return "center"
      case "right":
        return "flex-end"
      default:
        return "flex-start"
    }
  }

  return (
    <box style={{ flexDirection: "column" }}>
      {/* Header Row */}
      {showHeader && (
        <box
          style={{
            flexDirection: "row",
            borderColor: "gray",
            paddingBottom: 1,
          }}
        >
          {columns.map((col) => (
            <box
              key={col.key}
              style={{
                width: col.width,
                flexGrow: col.width ? 0 : 1,
                justifyContent: getAlignment(col.align),
              }}
            >
              <text style={{ fg: "cyan" }}>
                <b>{col.header}</b>
              </text>
            </box>
          ))}
        </box>
      )}

      {/* Separator */}
      {showHeader && (
        <box style={{ marginBottom: 1 }}>
          <text style={{ fg: "gray" }}>{"─".repeat(80)}</text>
        </box>
      )}

      {/* Data Rows */}
      {data.length === 0 ? (
        <Muted>{emptyMessage}</Muted>
      ) : (
        data.map((row, rowIdx) => (
          <box
            key={rowIdx}
            style={{
              flexDirection: "row",
              backgroundColor: rowIdx === selectedIndex ? "#333333" : undefined,
            }}
          >
            {columns.map((col) => {
              const value = row[col.key]
              const content = col.render
                ? col.render(value, row)
                : String(value ?? "")

              return (
                <box
                  key={col.key}
                  style={{
                    width: col.width,
                    flexGrow: col.width ? 0 : 1,
                    justifyContent: getAlignment(col.align),
                  }}
                >
                  {typeof content === "string" ? (
                    <text
                      style={{
                        fg: rowIdx === selectedIndex ? "white" : "gray",
                      }}
                    >
                      {content}
                    </text>
                  ) : (
                    content
                  )}
                </box>
              )
            })}
          </box>
        ))
      )}
    </box>
  )
}
