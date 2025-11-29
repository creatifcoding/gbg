/**
 * TMNL Card Primitives
 *
 * Extracted from tmnl-ui.tsx for modular encapsulation.
 * Uses CSS custom properties from ScaleProvider.
 */

import type { ReactNode } from 'react';
import { Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardLabel } from './typography';
import { Button } from './button';

// =============================================================================
// CARD
// =============================================================================

export interface CardProps {
  children: ReactNode;
  className?: string;
  label?: string;
}

export const Card = ({ children, className, label }: CardProps) => (
  <div className={cn('relative', className)}>
    {label && (
      <div className="absolute -top-3 left-4">
        <CardLabel>{label}</CardLabel>
      </div>
    )}
    <div className="border border-neutral-800 bg-black p-4">{children}</div>
  </div>
);

// =============================================================================
// MISSION CARD
// =============================================================================

export interface MissionCardProps {
  code: string;
  description: string;
  className?: string;
  onDetails?: () => void;
  onJoin?: () => void;
}

export const MissionCard = ({
  code,
  description,
  className,
  onDetails,
  onJoin,
}: MissionCardProps) => (
  <div
    className={cn(
      'border border-neutral-800 bg-black p-3 space-y-2',
      className
    )}
  >
    <div className="flex items-center justify-between">
      <span
        className="font-mono uppercase tracking-[0.1em] text-neutral-500"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Mission Code: {code}
      </span>
      <Wifi size={12} className="text-neutral-700" />
    </div>
    <p
      className="font-mono text-white tracking-wide"
      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
    >
      {description}
    </p>
    <div className="flex gap-2 pt-1">
      <Button variant="outline" size="xs" onClick={onDetails}>
        Details
      </Button>
      <Button variant="outline" size="xs" onClick={onJoin}>
        Join
      </Button>
    </div>
  </div>
);
