/**
 * @fileoverview JSON-Render Provider for React
 *
 * Provides:
 * - JSONRenderProvider: Wraps the app with Registry context
 * - ConfirmationDialog: Default confirmation dialog component
 *
 * Pattern: RegistryProvider from effect-atom + hook-based API
 */

"use client"

import { type ReactNode } from "react"
import { RegistryContext, Registry, RegistryProvider } from "@effect-atom/atom-react"
import { Option } from "effect"

import { useConfirmation } from "./hooks"
import type { ActionHandler } from "../core/actions"

// =============================================================================
// Provider Props
// =============================================================================

export interface JSONRenderProviderProps {
  /** Child components */
  children: ReactNode
  /** Optional custom registry (for testing) */
  registry?: ReturnType<typeof Registry.make>
  /** Initial action handlers to register */
  handlers?: Record<string, ActionHandler>
  /** Custom confirmation dialog component */
  ConfirmationDialog?: typeof DefaultConfirmationDialog
}

// =============================================================================
// Default Confirmation Dialog
// =============================================================================

export interface ConfirmationDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Dialog title */
  title: string
  /** Dialog message */
  message: string
  /** Confirm button label */
  confirmLabel?: string
  /** Cancel button label */
  cancelLabel?: string
  /** Confirm callback */
  onConfirm: () => void
  /** Cancel callback */
  onCancel: () => void
}

/**
 * Default confirmation dialog component
 *
 * Can be overridden via ConfirmationDialog prop on JSONRenderProvider
 */
export function DefaultConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel
}: ConfirmationDialogProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 9999
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "400px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 600 }}>
          {title}
        </h2>
        <p style={{ margin: "0 0 24px", color: "#666" }}>{message}</p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              backgroundColor: "white",
              cursor: "pointer"
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: "#0066cc",
              color: "white",
              cursor: "pointer"
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Confirmation Handler Component
// =============================================================================

interface ConfirmationHandlerProps {
  Dialog: typeof DefaultConfirmationDialog
}

/**
 * Internal component to handle confirmation dialogs
 */
function ConfirmationHandler({ Dialog }: ConfirmationHandlerProps) {
  const { isPending, pendingAction, confirm, cancel } = useConfirmation()

  const action = Option.isSome(pendingAction) ? pendingAction.value : null
  const confirmConfig = action?.confirm

  return (
    <Dialog
      isOpen={isPending}
      title={confirmConfig?.title ?? "Confirm Action"}
      message={confirmConfig?.message ?? "Are you sure?"}
      confirmLabel={confirmConfig?.confirmLabel}
      cancelLabel={confirmConfig?.cancelLabel}
      onConfirm={confirm}
      onCancel={cancel}
    />
  )
}

// =============================================================================
// JSONRenderProvider
// =============================================================================

/**
 * Provider for JSON-Render React integration
 *
 * Wraps the app with:
 * - effect-atom Registry for reactive state
 * - Confirmation dialog handler
 *
 * @example
 * ```tsx
 * <JSONRenderProvider handlers={{ delete: deleteHandler }}>
 *   <App />
 * </JSONRenderProvider>
 * ```
 */
export function JSONRenderProvider({
  children,
  registry,
  ConfirmationDialog = DefaultConfirmationDialog
}: JSONRenderProviderProps) {
  // If custom registry provided, use RegistryContext.Provider directly
  if (registry) {
    return (
      <RegistryContext.Provider value={registry}>
        {children}
        <ConfirmationHandler Dialog={ConfirmationDialog} />
      </RegistryContext.Provider>
    )
  }

  // Otherwise use RegistryProvider (manages registry lifecycle)
  return (
    <RegistryProvider>
      {children}
      <ConfirmationHandler Dialog={ConfirmationDialog} />
    </RegistryProvider>
  )
}

// =============================================================================
// Exports
// =============================================================================

export type { ActionHandler }
