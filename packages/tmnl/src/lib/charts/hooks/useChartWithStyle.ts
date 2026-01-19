/**
 * useChartWithStyle Hook
 *
 * Resolves chart styling from atoms for use in ChartRenderer.
 * Combines per-chart style state with system theme to produce final G2 theme.
 *
 * PATTERN: Uses RegistryContext for atom subscriptions. Must be wrapped
 * in a <ChartStyleRegistryProvider> or generic <RegistryContext.Provider>.
 *
 * @module charts/hooks/useChartWithStyle
 */

import * as React from 'react';
import { useMemo, useContext } from 'react';
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react';
import { Registry } from '@effect-atom/atom';
import {
  getChartStyleAtoms,
  makeChartStyleId,
  createChartStyleOps,
  systemThemeAtom,
  type ChartStyleId,
} from '../styler';
import {
  VANTA_G2_THEME_DARK,
  VANTA_G2_THEME_LIGHT,
  type G2ThemeConfig,
} from '../themes';

// =============================================================================
// Registry
// =============================================================================

/**
 * Chart style registry singleton.
 * Use for synchronous mutations outside React components.
 *
 * @example
 * ```ts
 * const ops = createChartStyleOps(chartId)
 * ops.setIntent('cyberpunk', chartStyleRegistry)
 * ```
 */
export const chartStyleRegistry = Registry.make();

// =============================================================================
// Types
// =============================================================================

export interface UseChartWithStyleOptions {
  /** Chart identifier for per-chart style isolation */
  chartId?: string | ChartStyleId;
  /** Enable auto-creation of style atoms if chartId provided */
  createIfMissing?: boolean;
}

export interface UseChartWithStyleResult {
  /** Resolved G2 theme configuration */
  theme: G2ThemeConfig;
  /** Whether chart is receiving streaming style updates */
  isStreaming: boolean;
  /** Current style confidence score (0-1) */
  confidence: number;
  /** Current styling intent */
  intent: string | null;
  /** The normalized chart ID (branded) */
  normalizedId: ChartStyleId | null;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for chart styling with atom-based state.
 *
 * When chartId is provided, reads from per-chart style atoms.
 * Without chartId, returns default VANTA dark theme.
 *
 * REQUIRES: Component wrapped in RegistryContext.Provider with chartStyleRegistry.
 *
 * @example
 * ```tsx
 * // Wrap your app/component tree
 * <ChartStyleRegistryProvider>
 *   <MyChartComponent />
 * </ChartStyleRegistryProvider>
 *
 * // In your component
 * const { theme, isStreaming } = useChartWithStyle({ chartId: 'my-chart' })
 * <Line theme={theme} {...config} />
 *
 * // Mutations via registry (outside React)
 * const ops = createChartStyleOps(chartId)
 * ops.setIntent('cyberpunk', chartStyleRegistry)
 * ```
 */
export function useChartWithStyle(
  options: UseChartWithStyleOptions = {}
): UseChartWithStyleResult {
  const { chartId, createIfMissing = true } = options;

  // Normalize chartId to branded type
  const normalizedId = useMemo(
    () => (chartId ? makeChartStyleId(chartId as string) : null),
    [chartId]
  );

  // Get atoms if chartId provided
  const atoms = useMemo(
    () => (normalizedId && createIfMissing ? getChartStyleAtoms(normalizedId) : null),
    [normalizedId, createIfMissing]
  );

  // Read system theme (always available)
  const systemTheme = useAtomValue(systemThemeAtom);

  // Read per-chart values via derived atoms
  // Note: These will auto-update when underlying state changes
  const resolvedTheme = atoms ? useAtomValue(atoms.resolvedTheme) : null;
  const styleState = atoms ? useAtomValue(atoms.style) : null;
  const isStreaming = atoms ? useAtomValue(atoms.isStreaming) : false;
  const confidence = atoms ? useAtomValue(atoms.confidence) : 0;

  // Compute final theme
  const theme = useMemo((): G2ThemeConfig => {
    // If we have a resolved theme from atoms, use it
    if (resolvedTheme) {
      return resolvedTheme;
    }

    // Fallback to system default
    return systemTheme === 'light' ? VANTA_G2_THEME_LIGHT : VANTA_G2_THEME_DARK;
  }, [resolvedTheme, systemTheme]);

  return {
    theme,
    isStreaming,
    confidence,
    intent: styleState?.intent ?? null,
    normalizedId,
  };
}

// =============================================================================
// Utility Hook: System Theme
// =============================================================================

/**
 * Hook to read system theme preference.
 *
 * For mutations, use chartStyleRegistry.set(systemThemeAtom, value) directly.
 *
 * @example
 * ```tsx
 * const systemTheme = useSystemTheme()
 * // Mutation (outside hook):
 * chartStyleRegistry.set(systemThemeAtom, 'light')
 * ```
 */
export function useSystemTheme(): 'dark' | 'light' {
  return useAtomValue(systemThemeAtom);
}

// =============================================================================
// Utility Hook: Default Theme
// =============================================================================

/**
 * Hook to get default VANTA theme based on system preference.
 * Simpler than useChartWithStyle when per-chart state not needed.
 *
 * @example
 * ```tsx
 * const theme = useDefaultChartTheme()
 * <Line theme={theme} {...config} />
 * ```
 */
export function useDefaultChartTheme(): G2ThemeConfig {
  const systemTheme = useAtomValue(systemThemeAtom);
  return useMemo(
    () => (systemTheme === 'light' ? VANTA_G2_THEME_LIGHT : VANTA_G2_THEME_DARK),
    [systemTheme]
  );
}

// =============================================================================
// Provider Component
// =============================================================================

/**
 * Registry provider for chart style atoms.
 * Wrap your component tree to enable useChartWithStyle hook.
 *
 * @example
 * ```tsx
 * <ChartStyleRegistryProvider>
 *   <App />
 * </ChartStyleRegistryProvider>
 * ```
 */
export function ChartStyleRegistryProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  // Type assertion needed due to version mismatch between packages
  // Using createElement instead of JSX for .ts file compatibility
  return React.createElement(
    RegistryContext.Provider,
    { value: chartStyleRegistry as any },
    children
  );
}
