/**
 * DataGridCornerDecorations
 *
 * Decorative corner brackets for the grid container.
 */

export function DataGridCornerDecorations() {
  return (
    <>
      <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-neutral-700" />
      <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-neutral-700" />
      <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-neutral-700" />
      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-neutral-700" />
    </>
  )
}

DataGridCornerDecorations.displayName = 'DataGrid.CornerDecorations'
