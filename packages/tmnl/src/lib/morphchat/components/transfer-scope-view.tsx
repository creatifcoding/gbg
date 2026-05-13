/**
 * Transfer Scope Wrapper
 *
 * When spec.enableTransferDrag or spec.enableTransferDrop are true AND
 * the adapter provides transferConfig, wraps children in the TMNL
 * transfer system's scope provider.
 *
 * If transfer is not enabled, passes children through unchanged.
 *
 * @module morphchat/components/transfer-scope-view
 */

import * as React from 'react'
import { useMorphChatContext } from './surface-context'

/**
 * Conditionally wraps children in a TransferScope when spec enables it.
 *
 * Currently: stub that checks the flags and renders a data-attribute
 * for debugging. Will be wired to useTransferScope from @/lib/transfer/v2
 * when the harness adapter provides real task state.
 */
export function TransferScopeView({ children }: { children: React.ReactNode }) {
  const { spec, adapter } = useMorphChatContext()

  const transferEnabled =
    (spec.enableTransferDrag || spec.enableTransferDrop) &&
    !!adapter.transferConfig

  if (!transferEnabled) return <>{children}</>

  return (
    <div
      data-morphchat-transfer="active"
      data-transfer-drag={spec.enableTransferDrag || undefined}
      data-transfer-drop={spec.enableTransferDrop || undefined}
      data-transfer-cluster={adapter.transferConfig?.clusterLabel}
    >
      {children}
    </div>
  )
}

TransferScopeView.displayName = 'MorphChat.TransferScopeView'
