/** @jsxImportSource @opentui/react */
/**
 * Dialog Component
 *
 * Modal dialog for confirmations, forms, and information display.
 */
import { type ReactNode } from "react"
import { Box, Heading, Text } from "../../primitives"

// =============================================================================
// TYPES
// =============================================================================

export interface DialogProps {
  open: boolean
  title?: string
  description?: string
  children?: ReactNode
  onClose?: () => void
}

export interface DialogContentProps {
  children?: ReactNode
}

export interface DialogFooterProps {
  children?: ReactNode
}

// =============================================================================
// COMPONENTS
// =============================================================================

export const Dialog = ({
  open,
  title,
  description,
  children,
}: DialogProps): ReactNode => {
  if (!open) return null

  return (
    <box
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Backdrop */}
      <box
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
      />

      {/* Dialog Box */}
      <Box
        variant="card"
        width={60}
        padding={2}
      >
        {title && (
          <box style={{ marginBottom: 1 }}>
            <Heading>{title}</Heading>
          </box>
        )}

        {description && (
          <box style={{ marginBottom: 1 }}>
            <Text variant="muted">{description}</Text>
          </box>
        )}

        {children}
      </Box>
    </box>
  )
}

export const DialogContent = ({ children }: DialogContentProps): ReactNode => {
  return (
    <box style={{ marginBottom: 1 }}>
      {children}
    </box>
  )
}

export const DialogFooter = ({ children }: DialogFooterProps): ReactNode => {
  return (
    <box style={{ flexDirection: "row", justifyContent: "flex-end", gap: 1 }}>
      {children}
    </box>
  )
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const DialogCompound = Object.assign(Dialog, {
  Content: DialogContent,
  Footer: DialogFooter,
})
