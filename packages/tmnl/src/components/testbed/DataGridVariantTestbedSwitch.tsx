/**
 * DataGrid Variant Testbed Switch
 *
 * Wrapper that mounts either V1 (legacy TmnlDataGrid) or V2 (Tmnl.DataGrid).
 * Full page swap - not side-by-side comparison.
 *
 * Route: /testbed/data-grid-variants
 */

import { useState } from 'react'
import { DataGridVariantTestbed } from './DataGridVariantTestbed'
import { DataGridVariantTestbedV2 } from './DataGridVariantTestbedV2'

// =============================================================================
// TYPES
// =============================================================================

type TestbedVersion = 'v1' | 'v2'

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DataGridVariantTestbedSwitch() {
  const [version, setVersion] = useState<TestbedVersion>('v1')

  return (
    <div className="relative">
      {/* Floating version toggle */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-black border border-neutral-700 p-2">
        <span
          className="font-mono text-neutral-500 uppercase px-2"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Version
        </span>
        <button
          onClick={() => setVersion('v1')}
          className={`
            px-3 py-1.5 font-mono uppercase transition-all
            ${
              version === 'v1'
                ? 'bg-neutral-800 text-white border border-white/30'
                : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
            }
          `}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          V1 (Legacy)
        </button>
        <button
          onClick={() => setVersion('v2')}
          className={`
            px-3 py-1.5 font-mono uppercase transition-all
            ${
              version === 'v2'
                ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-500/50'
                : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
            }
          `}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          V2 (Tmnl)
        </button>
      </div>

      {/* Mount one or the other */}
      {version === 'v1' ? <DataGridVariantTestbed /> : <DataGridVariantTestbedV2 />}
    </div>
  )
}
