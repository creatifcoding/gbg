/**
 * Port Tooltip Component
 *
 * Hover info panel showing port metadata.
 * Uses Radix Tooltip for positioning.
 */

import type { ReactNode } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePort } from './context';
import { portMachineContextAtom } from './port-stx';
import type { PortDirection } from './types';

interface PortTooltipProps {
  /** Content that triggers the tooltip (e.g., Port.Item) */
  readonly children: ReactNode;
  /** Override auto-detected port metadata */
  readonly metadata?: {
    readonly label?: string;
    readonly direction?: PortDirection;
    readonly dataType?: string;
    readonly connectionCount?: number;
  };
  /** Tooltip side preference */
  readonly side?: 'top' | 'bottom' | 'left' | 'right';
  /** Custom className */
  readonly className?: string;
}

/**
 * Direction display labels
 */
const DIRECTION_LABELS: Record<PortDirection, string> = {
  in: 'Input',
  out: 'Output',
  inout: 'Bidirectional',
};

/**
 * PortTooltip
 *
 * Wraps Port.Item to show metadata on hover.
 * - 300ms delay before showing
 * - Shows: id, direction, type, connections
 * - Auto-positions based on viewport
 */
export function PortTooltip({
  children,
  metadata,
  side = 'top',
  className,
}: PortTooltipProps) {
  const { portId } = usePort();
  const context = useAtomValue(portMachineContextAtom(portId));

  // Merge auto-detected with overrides
  const label = metadata?.label ?? context?.label ?? portId;
  const direction = metadata?.direction ?? context?.direction;
  const dataType = metadata?.dataType ?? context?.dataType ?? 'any';
  const connectionCount = metadata?.connectionCount ?? 0;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={8}
          className={cn(
            'max-w-[200px] p-2 space-y-1',
            'bg-surface-1 border border-surface-2',
            className
          )}
        >
          {/* Port label - TAC typography with TMNL fallback */}
          <p
            className="font-mono font-medium text-foreground truncate"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {label}
          </p>

          {/* Metadata grid - 12px floor enforced */}
          <div
            className="grid grid-cols-2 gap-x-3 gap-y-0.5"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {direction && (
              <>
                <span className="text-muted-foreground">Direction</span>
                <span className="text-foreground">{DIRECTION_LABELS[direction]}</span>
              </>
            )}
            <span className="text-muted-foreground">Type</span>
            <span className="text-foreground font-mono">{dataType}</span>
            <span className="text-muted-foreground">Links</span>
            <span className="text-foreground tabular-nums">{connectionCount}</span>
          </div>

          {/* Port ID (subtle but still 12px floor) */}
          <p
            className="text-muted-foreground/60 font-mono truncate pt-1 border-t border-surface-2"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {portId}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
