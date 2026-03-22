/**
 * Port Icon Component
 *
 * Direction indicator icon for data ports with context-aware sizing.
 *
 * Features:
 * - Direction icons: in (ArrowDownLeft), out (ArrowUpRight), inout (ArrowLeftRight)
 * - Context-aware sizing via PortSize (compact: 12px, default: 16px, large: 20px)
 * - Falls back to neutral Circle icon if direction not provided
 * - Idle state uses text-muted-foreground, linking state handled by Port.Item
 */

import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Circle,
} from 'lucide-react';
import { usePort } from './context';
import type { PortDirection } from './types';
import { cn } from '@/lib/utils';

interface IconProps {
  readonly direction?: PortDirection;
  readonly className?: string;
}

/**
 * Size map: PortSize → icon className
 */
const SIZE_MAP = {
  compact: 'w-3 h-3', // 12px
  default: 'w-4 h-4', // 16px
  large: 'w-5 h-5', // 20px
} as const;

/**
 * Direction → Lucide Icon Component
 *
 * - 'in': ArrowDownLeft (data flowing into block)
 * - 'out': ArrowUpRight (data flowing out of block)
 * - 'inout': ArrowLeftRight (bidirectional)
 * - undefined: Circle (neutral indicator)
 */
const ICON_MAP = {
  in: ArrowDownLeft,
  out: ArrowUpRight,
  inout: ArrowLeftRight,
} as const;

export function Icon({ direction, className }: IconProps) {
  const { size } = usePort();

  // Select icon component
  const IconComponent = direction ? ICON_MAP[direction] : Circle;

  // Combine size-based class with custom className
  const iconClassName = cn(
    SIZE_MAP[size],
    'text-muted-foreground',
    className
  );

  return <IconComponent className={iconClassName} />;
}
