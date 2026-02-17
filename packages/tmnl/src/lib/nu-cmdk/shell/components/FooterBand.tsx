import { createContext, useContext, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { NU_CMDK_TOKENS } from '../tokens'

export interface FooterBandProps {
  readonly hint?: string
  readonly version?: string
  readonly online?: boolean
}

export interface FooterBandRootProps {
  readonly hint?: string
  readonly version?: string
  readonly online?: boolean
  readonly children: ReactNode
}

export interface FooterBandHintProps {
  readonly text?: string
}

export interface FooterBandMetaProps {
  readonly children: ReactNode
}

export interface FooterBandConnectivityProps {
  readonly online?: boolean
  readonly text?: string
}

export interface FooterBandDotProps {
  readonly online?: boolean
}

export interface FooterBandVersionProps {
  readonly version?: string
}

interface FooterBandContextValue {
  readonly hint: string
  readonly version: string
  readonly online: boolean
}

const FooterBandContext = createContext<FooterBandContextValue | null>(null)

const rootStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '6px',
  padding: '6px 10px',
  borderTop: `1px solid ${NU_CMDK_TOKENS.border.subtle}`,
  color: NU_CMDK_TOKENS.text.tertiary,
  fontFamily: NU_CMDK_TOKENS.typography.family.ui,
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
  backgroundColor: NU_CMDK_TOKENS.surface.band,
}

const rightPillStyle = (online: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '3px 8px',
  borderRadius: NU_CMDK_TOKENS.misc.chipRadius,
  border: `1px solid ${NU_CMDK_TOKENS.border.subtle}`,
  backgroundColor: NU_CMDK_TOKENS.surface.pill,
  color: NU_CMDK_TOKENS.text.secondary,
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
  textTransform: 'none',
  letterSpacing: '0.03em',
})

const dotStyle = (online: boolean): CSSProperties => ({
  width: '6px',
  height: '6px',
  borderRadius: NU_CMDK_TOKENS.misc.dotRadius,
  backgroundColor: online ? NU_CMDK_TOKENS.accent.success : NU_CMDK_TOKENS.accent.offline,
  boxShadow: online ? NU_CMDK_TOKENS.shadow.onlineDot : 'none',
})

function useFooterBandContext(): FooterBandContextValue {
  const ctx = useContext(FooterBandContext)
  if (!ctx) {
    throw new Error('FooterBand compound components must be used inside FooterBand.Root')
  }
  return ctx
}

function FooterBandRoot({
  hint = '↑↓ Navigate   |   ↵ Select',
  version = 'v2.4.0',
  online = true,
  children,
}: FooterBandRootProps) {
  const value = useMemo<FooterBandContextValue>(() => ({ hint, version, online }), [hint, version, online])

  return (
    <FooterBandContext.Provider value={value}>
      <div style={rootStyle} data-band='footer' data-slot='footer-root'>
        {children}
      </div>
    </FooterBandContext.Provider>
  )
}

function FooterBandHint({ text }: FooterBandHintProps) {
  const ctx = useFooterBandContext()
  return (
    <span data-slot='footer-hint'>
      {text ?? ctx.hint}
    </span>
  )
}

function FooterBandMeta({ children }: FooterBandMetaProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} data-slot='footer-meta'>
      {children}
    </div>
  )
}

function FooterBandDot({ online }: FooterBandDotProps) {
  const ctx = useFooterBandContext()
  const resolved = online ?? ctx.online
  return <span style={dotStyle(resolved)} data-slot='footer-dot' data-state={resolved ? 'online' : 'offline'} />
}

function FooterBandConnectivity({ online, text }: FooterBandConnectivityProps) {
  const ctx = useFooterBandContext()
  const resolved = online ?? ctx.online
  const label = text ?? (resolved ? 'Online' : 'Offline')

  return (
    <span
      style={rightPillStyle(resolved)}
      data-slot='footer-connectivity'
      data-state={resolved ? 'online' : 'offline'}
    >
      <FooterBandDot online={resolved} />
      {label}
    </span>
  )
}

function FooterBandVersion({ version }: FooterBandVersionProps) {
  const ctx = useFooterBandContext()
  return <span data-slot='footer-version'>{version ?? ctx.version}</span>
}

function FooterBandBase({
  hint = '↑↓ Navigate   |   ↵ Select',
  version = 'v2.4.0',
  online = true,
}: FooterBandProps) {
  return (
    <FooterBandRoot hint={hint} version={version} online={online}>
      <FooterBandHint />
      <FooterBandMeta>
        <FooterBandConnectivity />
        <FooterBandVersion />
      </FooterBandMeta>
    </FooterBandRoot>
  )
}

type FooterBandCompound = ((props: FooterBandProps) => JSX.Element) & {
  Root: typeof FooterBandRoot
  Hint: typeof FooterBandHint
  Meta: typeof FooterBandMeta
  Connectivity: typeof FooterBandConnectivity
  Dot: typeof FooterBandDot
  Version: typeof FooterBandVersion
}

export const FooterBand = Object.assign(FooterBandBase, {
  Root: FooterBandRoot,
  Hint: FooterBandHint,
  Meta: FooterBandMeta,
  Connectivity: FooterBandConnectivity,
  Dot: FooterBandDot,
  Version: FooterBandVersion,
}) as FooterBandCompound
