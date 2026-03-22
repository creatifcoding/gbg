/**
 * RVN Provider
 *
 * Root context provider for the RVN design system.
 * Injects CSS custom properties and provides theme context.
 *
 * Following components.build principles:
 * - Single element wrapping (div with CSS vars)
 * - Design tokens via CSS variables
 * - Composition-first architecture
 */

import * as React from 'react'
import { RVN_CSS_VARS, type RvnCssVars } from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnThemeConfig {
  /** Override default CSS variables */
  overrides?: Partial<RvnCssVars>
  /** Enable reduced motion for accessibility */
  reducedMotion?: boolean
}

interface RvnContextValue {
  /** Current theme configuration */
  config: RvnThemeConfig
  /** Update theme configuration */
  setConfig: (config: Partial<RvnThemeConfig>) => void
  /** Whether reduced motion is active */
  reducedMotion: boolean
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const RvnContext = React.createContext<RvnContextValue | null>(null)

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Access RVN theme context
 * @throws if used outside RvnProvider
 */
export function useRvn(): RvnContextValue {
  const context = React.use(RvnContext)
  if (!context) {
    throw new Error('useRvn must be used within an RvnProvider')
  }
  return context
}

/**
 * Safe version that returns null outside provider
 */
export function useRvnSafe(): RvnContextValue | null {
  return React.use(RvnContext)
}

// -----------------------------------------------------------------------------
// Provider Props
// -----------------------------------------------------------------------------

interface RvnProviderProps {
  children: React.ReactNode
  /** Initial theme configuration */
  config?: RvnThemeConfig
  /** Apply to root element instead of creating wrapper */
  asChild?: boolean
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Provider Component
// -----------------------------------------------------------------------------

/**
 * RVN Design System Provider
 *
 * Wraps your application to provide:
 * - CSS custom properties for all RVN tokens
 * - Theme context for runtime configuration
 * - Reduced motion detection
 *
 * @example
 * ```tsx
 * <RvnProvider>
 *   <App />
 * </RvnProvider>
 * ```
 *
 * @example With overrides
 * ```tsx
 * <RvnProvider config={{ overrides: { '--rvn-bg': '#f0f0f0' } }}>
 *   <App />
 * </RvnProvider>
 * ```
 */
export function RvnProvider({
  children,
  config: initialConfig = {},
  className,
  style,
}: RvnProviderProps) {
  const [config, setConfigState] = React.useState<RvnThemeConfig>(initialConfig)

  // Detect system reduced motion preference
  const prefersReducedMotion = React.useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
      mql.addEventListener('change', callback)
      return () => mql.removeEventListener('change', callback)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false // SSR default
  )

  const reducedMotion = config.reducedMotion ?? prefersReducedMotion

  const setConfig = React.useCallback((partial: Partial<RvnThemeConfig>) => {
    setConfigState((prev) => ({ ...prev, ...partial }))
  }, [])

  const contextValue = React.useMemo<RvnContextValue>(
    () => ({
      config,
      setConfig,
      reducedMotion,
    }),
    [config, setConfig, reducedMotion]
  )

  // Merge CSS variables: defaults + overrides
  const cssVars = React.useMemo(() => {
    return {
      ...RVN_CSS_VARS,
      ...config.overrides,
    } as React.CSSProperties
  }, [config.overrides])

  return (
    <RvnContext value={contextValue}>
      <div
        className={className}
        style={{
          ...cssVars,
          ...style,
        }}
        data-rvn-provider=""
        data-reduced-motion={reducedMotion ? '' : undefined}
      >
        {children}
      </div>
    </RvnContext>
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

RvnProvider.displayName = 'RvnProvider'
