import { useEffect, useMemo, useState, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import {
  RvnChatConnectionBadge,
  type RvnChatConnectionBadgeProps,
  type RvnChatConnectionState,
} from '../../status'
import { useRvnChatHeaderBandContext } from './header-band-context'

export interface RvnChatHeaderConnectionBadgeDetails {
  readonly latencyMs?: number | null
  readonly onProbe?: () => void | Promise<void>
  readonly probeLabel?: string
}

export interface RvnChatHeaderConnectionBadgeProps
  extends Omit<
      RvnChatConnectionBadgeProps,
      'state' | 'latencyMs' | 'onProbe' | 'probeLabel' | 'onExpandedChange'
    >,
    ComponentPropsWithoutRef<'span'> {
  state: RvnChatConnectionState
  latencyMs?: number | null
  onProbe?: () => void | Promise<void>
  probeLabel?: string
  resolveExpandedDetails?:
    | (() => RvnChatHeaderConnectionBadgeDetails | null)
    | (() => Promise<RvnChatHeaderConnectionBadgeDetails | null>)
  onExpandedChange?: (expanded: boolean) => void
}

export function RvnChatHeaderConnectionBadge({
  state,
  latencyMs = null,
  onProbe,
  probeLabel,
  resolveExpandedDetails,
  onExpandedChange,
  className,
  ...props
}: RvnChatHeaderConnectionBadgeProps) {
  useRvnChatHeaderBandContext('RvnChatShell.Header.ConnectionBadge')

  const [expanded, setExpanded] = useState(false)
  const [resolvedDetails, setResolvedDetails] = useState<RvnChatHeaderConnectionBadgeDetails | null>(null)

  useEffect(() => {
    if (!expanded || !resolveExpandedDetails) {
      setResolvedDetails(null)
      return
    }

    let active = true

    const run = async () => {
      const details = await resolveExpandedDetails()
      if (!active) return
      setResolvedDetails(details)
    }

    void run()

    return () => {
      active = false
    }
  }, [expanded, resolveExpandedDetails])

  const computedLatencyMs = useMemo(() => {
    if (!expanded) {
      return latencyMs
    }

    return resolvedDetails?.latencyMs ?? latencyMs
  }, [expanded, latencyMs, resolvedDetails])

  const computedProbe = useMemo(() => {
    if (!expanded) {
      return onProbe
    }

    return resolvedDetails?.onProbe ?? onProbe
  }, [expanded, onProbe, resolvedDetails])

  const computedProbeLabel = useMemo(() => {
    if (!expanded) {
      return probeLabel
    }

    return resolvedDetails?.probeLabel ?? probeLabel
  }, [expanded, probeLabel, resolvedDetails])

  return (
    <RvnChatConnectionBadge
      data-slot="rvn-chat-shell-header-connection-badge"
      data-semantic-compound="connection-badge"
      state={state}
      latencyMs={computedLatencyMs}
      onProbe={computedProbe}
      probeLabel={computedProbeLabel}
      onExpandedChange={(nextExpanded) => {
        setExpanded(nextExpanded)
        onExpandedChange?.(nextExpanded)
      }}
      className={cn('rvn-chat-shell__header-connection-badge', className)}
      {...props}
    />
  )
}

RvnChatHeaderConnectionBadge.displayName = 'RvnChatShell.Header.ConnectionBadge'
