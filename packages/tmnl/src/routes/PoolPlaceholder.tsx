/**
 * PoolPlaceholder — Minimal Route for Window Pool
 *
 * This route renders ALMOST NOTHING. It exists so that pool windows
 * can be pre-created without loading the full React app.
 *
 * When a pool window is claimed for a testbed, it navigates away
 * from this route to /window?testbed=<id>.
 *
 * Memory footprint: ~minimal (just a div)
 *
 * @module
 */

/**
 * Minimal placeholder for pool windows.
 * Renders an empty dark div to minimize memory usage.
 */
export function PoolPlaceholder() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#09090b', // zinc-950
      }}
    />
  )
}

export default PoolPlaceholder
