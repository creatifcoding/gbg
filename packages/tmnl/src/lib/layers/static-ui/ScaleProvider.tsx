import * as React from 'react';
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  DEFAULT_SCALE_CONFIG,
  TYPOGRAPHY_BASE_SIZES,
  SPACING_BASE_SIZES,
  COMPONENT_BASE_SIZES,
  type ScaleConfig,
} from './types';

/**
 * Scale context value
 */
interface ScaleContextValue {
  /** Current scale factor */
  scale: number;
  /** Scale configuration */
  config: ScaleConfig;
  /** Set scale to specific value */
  setScale: (scale: number) => void;
  /** Increment scale by step */
  scaleUp: () => void;
  /** Decrement scale by step */
  scaleDown: () => void;
  /** Reset scale to base */
  resetScale: () => void;
  /** Get scaled value in px */
  scaled: (basePx: number) => number;
  /** Get scaled value as CSS string */
  scaledPx: (basePx: number) => string;
}

const ScaleContext = createContext<ScaleContextValue | null>(null);

/**
 * Hook to access scale context
 */
export function useScale(): ScaleContextValue {
  const ctx = useContext(ScaleContext);
  if (!ctx) {
    throw new Error('useScale must be used within a ScaleProvider');
  }
  return ctx;
}

/**
 * Hook to get scaled CSS value (convenience)
 */
export function useScaledValue(basePx: number): string {
  const { scaledPx } = useScale();
  return scaledPx(basePx);
}

/**
 * Generate CSS custom properties for the scale system
 */
function generateScaleCSS(scale: number): string {
  const lines: string[] = [];

  // Scale factor
  lines.push(`--tmnl-scale: ${scale};`);

  // Typography sizes
  for (const [key, base] of Object.entries(TYPOGRAPHY_BASE_SIZES)) {
    const scaled = Math.round(base * scale);
    lines.push(`--tmnl-text-${key}: ${scaled}px;`);
  }

  // Spacing sizes
  for (const [key, base] of Object.entries(SPACING_BASE_SIZES)) {
    const scaled = Math.round(base * scale);
    lines.push(`--tmnl-space-${key.replace('.', '_')}: ${scaled}px;`);
  }

  // Component sizes
  for (const [key, base] of Object.entries(COMPONENT_BASE_SIZES)) {
    const scaled = Math.round(base * scale);
    lines.push(`--tmnl-size-${key}: ${scaled}px;`);
  }

  return lines.join('\n  ');
}

interface ScaleProviderProps {
  children: ReactNode;
  /** Initial scale factor */
  initialScale?: number;
  /** Scale configuration */
  config?: Partial<ScaleConfig>;
  /** Persist scale to localStorage */
  persist?: boolean;
  /** localStorage key for persistence */
  storageKey?: string;
}

const STORAGE_KEY_DEFAULT = 'tmnl-ui-scale';

/**
 * ScaleProvider
 *
 * Provides a scaling context for static UI elements.
 * Injects CSS custom properties at :root level for all scaled values.
 *
 * Usage:
 * ```tsx
 * <ScaleProvider initialScale={1.25}>
 *   <App />
 * </ScaleProvider>
 * ```
 *
 * CSS custom properties:
 * - `--tmnl-scale` - Current scale factor
 * - `--tmnl-text-{size}` - Scaled typography (xs, sm, base, lg, xl, 2xl, 3xl)
 * - `--tmnl-space-{size}` - Scaled spacing (0, 0_5, 1, 2, 3, 4, 5, 6, 8, 10, 12)
 * - `--tmnl-size-{component}` - Scaled component sizes
 */
export function ScaleProvider({
  children,
  initialScale,
  config: configOverride,
  persist = true,
  storageKey = STORAGE_KEY_DEFAULT,
}: ScaleProviderProps) {
  const config: ScaleConfig = useMemo(
    () => ({ ...DEFAULT_SCALE_CONFIG, ...configOverride }),
    [configOverride]
  );

  // Load initial scale from storage or prop
  const [scale, setScaleRaw] = useState<number>(() => {
    if (typeof window === 'undefined') return initialScale ?? config.base;

    if (persist) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= config.min && parsed <= config.max) {
          return parsed;
        }
      }
    }
    return initialScale ?? config.base;
  });

  // Clamp and set scale
  const setScale = useCallback(
    (newScale: number) => {
      const clamped = Math.max(config.min, Math.min(config.max, newScale));
      setScaleRaw(clamped);
      if (persist && typeof window !== 'undefined') {
        localStorage.setItem(storageKey, clamped.toString());
      }
    },
    [config.min, config.max, persist, storageKey]
  );

  const scaleUp = useCallback(() => {
    setScale(scale + config.step);
  }, [scale, config.step, setScale]);

  const scaleDown = useCallback(() => {
    setScale(scale - config.step);
  }, [scale, config.step, setScale]);

  const resetScale = useCallback(() => {
    setScale(config.base);
  }, [config.base, setScale]);

  const scaled = useCallback(
    (basePx: number): number => Math.round(basePx * scale),
    [scale]
  );

  const scaledPx = useCallback(
    (basePx: number): string => `${Math.round(basePx * scale)}px`,
    [scale]
  );

  // Inject CSS custom properties into :root
  useEffect(() => {
    const styleId = 'tmnl-scale-vars';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `:root {\n  ${generateScaleCSS(scale)}\n}`;

    return () => {
      // Don't remove on cleanup — other components may still use it
    };
  }, [scale]);

  const value: ScaleContextValue = useMemo(
    () => ({
      scale,
      config,
      setScale,
      scaleUp,
      scaleDown,
      resetScale,
      scaled,
      scaledPx,
    }),
    [scale, config, setScale, scaleUp, scaleDown, resetScale, scaled, scaledPx]
  );

  return (
    <ScaleContext.Provider value={value}>{children}</ScaleContext.Provider>
  );
}

/**
 * Keyboard shortcut handler for scale controls
 *
 * Default shortcuts:
 * - Ctrl/Cmd + Plus: Scale up
 * - Ctrl/Cmd + Minus: Scale down
 * - Ctrl/Cmd + 0: Reset scale
 */
export function useScaleKeyboardShortcuts() {
  const { scaleUp, scaleDown, resetScale } = useScale();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      switch (e.key) {
        case '=':
        case '+':
          e.preventDefault();
          scaleUp();
          break;
        case '-':
          e.preventDefault();
          scaleDown();
          break;
        case '0':
          e.preventDefault();
          resetScale();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [scaleUp, scaleDown, resetScale]);
}
