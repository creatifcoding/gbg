/**
 * StyleTab Component
 *
 * Universal style settings tab. Available for all chart types.
 * Integrates with the chart styler for theme and palette selection.
 *
 * @module charts/interactive-panel/tabs/StyleTab
 */

import { useContext, useCallback } from 'react';
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react';
import { Palette, Sun, Moon, Monitor, RefreshCw } from 'lucide-react';

import {
  VANTA_COLORS,
  VANTA_SPACING,
  VANTA_TYPOGRAPHY,
  VANTA_BORDERS,
} from '@/components/portal/tokens';
import { getChartStyleAtoms, createChartStyleOps, systemThemeAtom } from '../../styler/atoms';
import { makeChartStyleId } from '../../styler/schemas';
import { type TabProps, isStyleTab } from './types';

/**
 * StyleTab - Chart styling configuration
 *
 * Provides controls for:
 * - Base theme selection (light/dark/system)
 * - Color palette customization
 * - Typography settings
 * - Animation preferences
 */
export function StyleTab(props: TabProps) {
  // Schema.is validation
  if (!isStyleTab(props.tabId)) {
    return null;
  }
  const { chartId } = props;
  const registry = useContext(RegistryContext);
  const styleId = makeChartStyleId(chartId);
  const atoms = getChartStyleAtoms(styleId);
  const ops = createChartStyleOps(styleId);

  const styleState = useAtomValue(atoms.style);
  const systemTheme = useAtomValue(systemThemeAtom);
  const isStreaming = useAtomValue(atoms.isStreaming);

  const handleThemeChange = useCallback(
    (theme: 'light' | 'dark' | 'system') => {
      ops.setBaseTheme(theme, registry);
    },
    [ops, registry]
  );

  const handleReset = useCallback(() => {
    ops.reset(registry);
  }, [ops, registry]);

  const currentTheme = styleState.baseTheme === 'system' ? systemTheme : styleState.baseTheme;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: VANTA_SPACING['4'],
      }}
    >
      {/* Theme Selection */}
      <Section title="Theme" icon={<Palette size={14} />}>
        <div
          style={{
            display: 'flex',
            gap: VANTA_SPACING['2'],
          }}
        >
          <ThemeButton
            active={styleState.baseTheme === 'light'}
            onClick={() => handleThemeChange('light')}
            icon={<Sun size={14} />}
            label="Light"
          />
          <ThemeButton
            active={styleState.baseTheme === 'dark'}
            onClick={() => handleThemeChange('dark')}
            icon={<Moon size={14} />}
            label="Dark"
          />
          <ThemeButton
            active={styleState.baseTheme === 'system'}
            onClick={() => handleThemeChange('system')}
            icon={<Monitor size={14} />}
            label="System"
          />
        </div>
        <div
          style={{
            ...VANTA_TYPOGRAPHY.preset.micro,
            color: VANTA_COLORS.text.muted,
            marginTop: VANTA_SPACING['1'],
          }}
        >
          Current: {currentTheme}
        </div>
      </Section>

      {/* Color Palette */}
      <Section title="Color Palette" icon={<Palette size={14} />}>
        {styleState.colorPalette ? (
          <div
            style={{
              display: 'flex',
              gap: VANTA_SPACING['1'],
              flexWrap: 'wrap',
            }}
          >
            {styleState.colorPalette.slice(0, 10).map((color, i) => (
              <div
                key={i}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: VANTA_BORDERS.radius.sm,
                  backgroundColor: color,
                  border: `1px solid ${VANTA_COLORS.surface.border}`,
                }}
                title={color}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
            }}
          >
            Using default theme palette
          </div>
        )}
      </Section>

      {/* Styling Status */}
      <Section title="Status">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['2'],
          }}
        >
          {isStreaming ? (
            <>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: VANTA_COLORS.accent.amber,
                  animation: 'pulse 1.5s infinite',
                }}
              />
              <span
                style={{
                  ...VANTA_TYPOGRAPHY.preset.micro,
                  color: VANTA_COLORS.accent.amber,
                }}
              >
                Receiving style updates...
              </span>
            </>
          ) : (
            <>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: VANTA_COLORS.accent.emerald,
                }}
              />
              <span
                style={{
                  ...VANTA_TYPOGRAPHY.preset.micro,
                  color: VANTA_COLORS.text.secondary,
                }}
              >
                Styles applied
              </span>
            </>
          )}
        </div>
        {styleState.intent && (
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
              marginTop: VANTA_SPACING['1'],
            }}
          >
            Intent: {styleState.intent}
          </div>
        )}
      </Section>

      {/* Reset Button */}
      <button
        onClick={handleReset}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: VANTA_SPACING['2'],
          padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
          background: VANTA_COLORS.surface.hover,
          border: `1px solid ${VANTA_COLORS.surface.border}`,
          borderRadius: VANTA_BORDERS.radius.md,
          color: VANTA_COLORS.text.secondary,
          cursor: 'pointer',
          ...VANTA_TYPOGRAPHY.preset.label,
        }}
      >
        <RefreshCw size={14} />
        Reset to Defaults
      </button>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['1'],
          marginBottom: VANTA_SPACING['2'],
          color: VANTA_COLORS.text.secondary,
          ...VANTA_TYPOGRAPHY.preset.label,
        }}
      >
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

interface ThemeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function ThemeButton({ active, onClick, icon, label }: ThemeButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: VANTA_SPACING['1'],
        padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
        background: active ? VANTA_COLORS.accent.cyanGlow : VANTA_COLORS.surface.elevated,
        border: `1px solid ${active ? VANTA_COLORS.accent.cyanMuted : VANTA_COLORS.surface.border}`,
        borderRadius: VANTA_BORDERS.radius.md,
        color: active ? VANTA_COLORS.accent.cyan : VANTA_COLORS.text.secondary,
        cursor: 'pointer',
        ...VANTA_TYPOGRAPHY.preset.label,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export default StyleTab;
