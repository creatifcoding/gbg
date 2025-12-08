/**
 * DataGridHeader
 *
 * Container bar for the grid header area.
 * Compose with DataGrid.Title, DataGrid.StatusBar, or custom children.
 */

import { useDataGrid } from '../DataGridContext';
import { TMNL_TOKENS } from '../theme';

export interface DataGridHeaderProps {
  className?: string;
  children?: React.ReactNode;
}

export function DataGridHeader({
  className = '',
  children,
}: DataGridHeaderProps) {
  const { scaledPx } = useDataGrid();

  // 60% of original header height (28 - 8 = 20 → 12)
  const headerHeight = Math.round((TMNL_TOKENS.spacing.headerHeight - 8) * 0.6);

  return (
    <div
      className={`flex-shrink-0 flex items-center px-2 border-b border-neutral-800 bg-neutral-900/30 ${className}`}
      style={{ height: scaledPx(headerHeight) }}
    >
      {children}
    </div>
  );
}

DataGridHeader.displayName = 'DataGrid.Header';
