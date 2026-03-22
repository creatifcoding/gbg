/**
 * @fileoverview Reactive Icon Wrapper
 *
 * Wraps lucide-react icons with TMNL color system integration.
 * Supports atom-based reactive styling.
 *
 * @example
 * ```tsx
 * <Icon icon={Link2} color="cyan" size={14} />
 * <Icon icon={Trash2} color="red" size={12} pulse />
 * ```
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export type IconColor =
  | 'cyan'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'violet'
  | 'amber'
  | 'muted'
  | 'primary';

export interface IconProps {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Icon size in pixels */
  size?: number;
  /** TMNL color token */
  color?: IconColor;
  /** Custom className */
  className?: string;
  /** Pulsing animation */
  pulse?: boolean;
  /** Spinning animation */
  spin?: boolean;
  /** Custom inline styles */
  style?: React.CSSProperties;
}

// =============================================================================
// Color Mapping
// =============================================================================

const COLOR_CLASSES: Record<IconColor, string> = {
  cyan: 'text-accent-cyan',
  red: 'text-accent-red',
  green: 'text-accent-green',
  yellow: 'text-accent-yellow',
  blue: 'text-accent-blue',
  violet: 'text-accent-violet',
  amber: 'text-accent-amber',
  muted: 'text-text-muted',
  primary: 'text-text-primary',
};

// =============================================================================
// Component
// =============================================================================

export function Icon({
  icon: IconComponent,
  size = 14,
  color = 'muted',
  className = '',
  pulse = false,
  spin = false,
  style,
}: IconProps): React.ReactElement {
  const colorClass = COLOR_CLASSES[color];
  const animationClass = pulse ? 'animate-pulse' : spin ? 'animate-spin' : '';

  return (
    <IconComponent
      size={size}
      className={`${colorClass} ${animationClass} ${className}`.trim()}
      style={style}
    />
  );
}

export default Icon;
