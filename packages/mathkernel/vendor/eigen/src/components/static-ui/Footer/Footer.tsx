/**
 * TMNL Footer / Status Bar
 *
 * Extracted from tmnl-ui.tsx for modular encapsulation.
 * Uses CSS custom properties from ScaleProvider.
 */

import { cn } from '@/lib/utils';
import { LabelSmall, Separator } from '@/components/primitives';

// =============================================================================
// STATUS FOOTER
// =============================================================================

export interface StatusFooterProps {
  status?: 'connected' | 'disconnected' | 'warning';
  message?: string;
  value?: number | string;
  unit?: string;
}

export const StatusFooter = ({
  status = 'connected',
  message,
  value,
  unit,
}: StatusFooterProps) => {
  const statusColors = {
    connected: 'bg-emerald-500',
    disconnected: 'bg-neutral-600',
    warning: 'bg-amber-500',
  };

  return (
    <footer
      className="border-t border-neutral-800 flex items-center justify-between px-4 bg-black shrink-0"
      style={{ height: 'var(--tmnl-size-footer, 36px)' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div
            className={cn('w-1.5 h-1.5 animate-pulse', statusColors[status])}
          />
          <LabelSmall>{status}</LabelSmall>
        </div>
        {message && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <LabelSmall>{message}</LabelSmall>
          </>
        )}
      </div>
      {value !== undefined && (
        <div className="flex items-baseline gap-1">
          <span
            className="font-mono text-white font-light"
            style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
          >
            {value}
          </span>
          {unit && <LabelSmall>{unit}</LabelSmall>}
        </div>
      )}
    </footer>
  );
};
