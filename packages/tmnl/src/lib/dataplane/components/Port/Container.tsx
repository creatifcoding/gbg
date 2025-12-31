import type { ReactNode } from 'react';
import { PortProvider } from './context';
import type { PortSize } from './types';

/**
 * Port Container
 *
 * Root wrapper for Port compound component.
 * - Provides PortProvider context to descendants
 * - Applies base container styles (relative, inline-flex)
 * - Data attributes for debugging
 *
 * **Size dimensions:**
 * - compact: 24×24px
 * - default: 32×32px
 * - large: 48×48px
 *
 * Pattern: Follows DynamicIsland.tsx architecture
 */

interface PortContainerProps {
  readonly portId: string;
  readonly size?: PortSize;
  readonly children: ReactNode;
  readonly className?: string;
}

const SIZE_CLASSES: Record<PortSize, string> = {
  compact: 'w-6 h-6', // 24×24px
  default: 'w-8 h-8', // 32×32px
  large: 'w-12 h-12', // 48×48px
};

export function PortContainer({
  portId,
  size = 'default',
  children,
  className = '',
}: PortContainerProps) {
  const sizeClass = SIZE_CLASSES[size];

  return (
    <PortProvider portId={portId} size={size}>
      <div
        className={`relative inline-flex ${sizeClass} ${className}`}
        data-port-id={portId}
        data-port-size={size}
      >
        {children}
      </div>
    </PortProvider>
  );
}
