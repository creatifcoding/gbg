/**
 * DrawerTestbed
 *
 * Validation route for drawer system + TableService integration.
 *
 * Test Cases:
 * - TC1-3: TableService preset CRUD + persistence + inheritance
 * - TC4-7: Drawer push/pop/stack + rolodex + parallax animations
 * - TC8-9: Global vs panel slots
 * - TC10: VariantBuilder integration (simplified)
 *
 * @route /testbed/drawer
 */

import { useState, useCallback } from 'react'

import { COLORS } from '@/lib/capabilities/tokens'
import {
  DrawerStackProvider,
  GlobalSlot,
  useDrawer,
} from '@/lib/drawer'
import { useTableService } from '@/lib/table-service'
import { DEFAULT_VARIANT } from '@/lib/data-grid/variants'
import type { PresetId } from '@/lib/table-service'

// =============================================================================
// TEST PANEL COMPONENTS
// =============================================================================

function TestPanel({
  title,
  children,
  color = COLORS.neutral[800],
}: {
  title: string
  children: React.ReactNode
  color?: string
}) {
  return (
    <div
      className="p-4 rounded"
      style={{
        backgroundColor: color,
        border: `1px solid ${COLORS.neutral[700]}`,
      }}
    >
      <h3
        className="font-mono mb-3"
        style={{ fontSize: 14, color: COLORS.neutral[300] }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

// =============================================================================
// DRAWER CONTENT COMPONENTS
// =============================================================================

function SampleDrawerContent({
  id,
  depth,
}: {
  id: string
  depth: number
}) {
  const drawer = useDrawer()

  const handlePushAnother = () => {
    drawer.open({
      id: `drawer-${depth + 1}`,
      slot: 'global',
      content: <SampleDrawerContent id={`drawer-${depth + 1}`} depth={depth + 1} />,
      title: `Drawer ${depth + 1}`,
    })
  }

  return (
    <div className="p-6">
      <h2
        className="font-mono mb-4"
        style={{ fontSize: 18, color: COLORS.neutral[200] }}
      >
        {id}
      </h2>
      <p
        className="mb-4"
        style={{ fontSize: 14, color: COLORS.neutral[400] }}
      >
        Depth: {depth} | Stack count: {drawer.count}
      </p>
      <div className="flex gap-2">
        <button
          onClick={handlePushAnother}
          className="px-3 py-2 rounded font-mono"
          style={{
            fontSize: 12,
            backgroundColor: COLORS.accent.cyan.base,
            color: COLORS.neutral[950],
          }}
        >
          Push Another
        </button>
        <button
          onClick={() => drawer.close(id)}
          className="px-3 py-2 rounded font-mono"
          style={{
            fontSize: 12,
            backgroundColor: COLORS.neutral[700],
            color: COLORS.neutral[300],
          }}
        >
          Close
        </button>
        <button
          onClick={() => drawer.closeAll()}
          className="px-3 py-2 rounded font-mono"
          style={{
            fontSize: 12,
            backgroundColor: COLORS.accent.red.base,
            color: COLORS.neutral[100],
          }}
        >
          Close All
        </button>
      </div>
    </div>
  )
}

function PresetFormDrawer() {
  const drawer = useDrawer()
  const { createPreset, activeVariant } = useTableService()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await createPreset(name, activeVariant)
      drawer.close('preset-form')
    } catch (error) {
      console.error('Failed to save preset:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <h2
        className="font-mono mb-4"
        style={{ fontSize: 18, color: COLORS.neutral[200] }}
      >
        Create Preset
      </h2>
      <div className="space-y-4">
        <div>
          <label
            className="block mb-1 font-mono"
            style={{ fontSize: 12, color: COLORS.neutral[400] }}
          >
            Preset Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded font-mono"
            style={{
              fontSize: 14,
              backgroundColor: COLORS.neutral[800],
              color: COLORS.neutral[200],
              border: `1px solid ${COLORS.neutral[600]}`,
            }}
            placeholder="My Preset"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 rounded font-mono"
            style={{
              fontSize: 12,
              backgroundColor: saving ? COLORS.neutral[600] : COLORS.accent.cyan.base,
              color: COLORS.neutral[950],
              opacity: !name.trim() || saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Preset'}
          </button>
          <button
            onClick={() => drawer.close('preset-form')}
            className="px-4 py-2 rounded font-mono"
            style={{
              fontSize: 12,
              backgroundColor: COLORS.neutral[700],
              color: COLORS.neutral[300],
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// TEST SECTIONS
// =============================================================================

function DrawerStackTest() {
  const drawer = useDrawer()

  const handleOpenSingle = () => {
    drawer.open({
      id: 'drawer-1',
      slot: 'global',
      content: <SampleDrawerContent id="drawer-1" depth={1} />,
      title: 'Single Drawer',
    })
  }

  const handleOpenStacked = () => {
    drawer.open({
      id: 'stack-1',
      slot: 'global',
      content: <SampleDrawerContent id="stack-1" depth={1} />,
      title: 'Stack 1',
    })
    setTimeout(() => {
      drawer.open({
        id: 'stack-2',
        slot: 'global',
        content: <SampleDrawerContent id="stack-2" depth={2} />,
        title: 'Stack 2',
      })
    }, 200)
    setTimeout(() => {
      drawer.open({
        id: 'stack-3',
        slot: 'global',
        content: <SampleDrawerContent id="stack-3" depth={3} />,
        title: 'Stack 3',
      })
    }, 400)
  }

  return (
    <TestPanel title="TC4-7: Drawer Stack + Animation">
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            onClick={handleOpenSingle}
            className="px-3 py-2 rounded font-mono"
            style={{
              fontSize: 12,
              backgroundColor: COLORS.accent.cyan.base,
              color: COLORS.neutral[950],
            }}
          >
            Open Single Drawer
          </button>
          <button
            onClick={handleOpenStacked}
            className="px-3 py-2 rounded font-mono"
            style={{
              fontSize: 12,
              backgroundColor: COLORS.accent.violet.base,
              color: COLORS.neutral[100],
            }}
          >
            Open Stacked (3x)
          </button>
        </div>
        <div
          className="font-mono"
          style={{ fontSize: 12, color: COLORS.neutral[500] }}
        >
          Open drawers: {drawer.count} | IDs: {drawer.openIds.join(', ') || 'none'}
        </div>
      </div>
    </TestPanel>
  )
}

function TableServiceTest() {
  const {
    presets,
    activePreset,
    activePresetId,
    isReady,
    createPreset,
    deletePreset,
    setActivePreset,
    userPresetCount,
  } = useTableService()
  const drawer = useDrawer()

  const handleOpenPresetForm = () => {
    drawer.open({
      id: 'preset-form',
      slot: 'global',
      content: <PresetFormDrawer />,
      title: 'Create Preset',
    })
  }

  const handleDeletePreset = async (id: PresetId) => {
    await deletePreset(id)
  }

  return (
    <TestPanel title="TC1-3: TableService Preset CRUD + Persistence">
      <div className="space-y-3">
        <div
          className="flex items-center gap-2 font-mono"
          style={{ fontSize: 12, color: COLORS.neutral[400] }}
        >
          <span>Status:</span>
          <span
            className="px-2 py-0.5 rounded"
            style={{
              backgroundColor: isReady ? COLORS.accent.green.base : COLORS.accent.amber.base,
              color: COLORS.neutral[950],
            }}
          >
            {isReady ? 'Ready' : 'Initializing...'}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleOpenPresetForm}
            className="px-3 py-2 rounded font-mono"
            style={{
              fontSize: 12,
              backgroundColor: COLORS.accent.cyan.base,
              color: COLORS.neutral[950],
            }}
          >
            Create Preset (Drawer)
          </button>
          <button
            onClick={() => setActivePreset(null)}
            disabled={!activePresetId}
            className="px-3 py-2 rounded font-mono"
            style={{
              fontSize: 12,
              backgroundColor: COLORS.neutral[700],
              color: COLORS.neutral[300],
              opacity: !activePresetId ? 0.5 : 1,
            }}
          >
            Clear Active
          </button>
        </div>

        <div>
          <div
            className="font-mono mb-2"
            style={{ fontSize: 12, color: COLORS.neutral[400] }}
          >
            Presets ({userPresetCount} user-created):
          </div>
          <div className="space-y-1">
            {presets.length === 0 && (
              <div
                className="font-mono italic"
                style={{ fontSize: 12, color: COLORS.neutral[600] }}
              >
                No presets yet. Create one to test persistence.
              </div>
            )}
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-2 px-2 py-1 rounded"
                style={{
                  backgroundColor:
                    preset.id === activePresetId
                      ? COLORS.accent.cyan.muted
                      : COLORS.neutral[900],
                  border: `1px solid ${
                    preset.id === activePresetId
                      ? COLORS.accent.cyan.border
                      : COLORS.neutral[700]
                  }`,
                }}
              >
                <span
                  className="font-mono flex-1"
                  style={{ fontSize: 12, color: COLORS.neutral[200] }}
                >
                  {preset.name}
                </span>
                {preset.isBuiltIn && (
                  <span
                    className="px-1.5 py-0.5 rounded font-mono"
                    style={{
                      fontSize: 10,
                      backgroundColor: COLORS.neutral[700],
                      color: COLORS.neutral[400],
                    }}
                  >
                    built-in
                  </span>
                )}
                <button
                  onClick={() => setActivePreset(preset.id)}
                  className="px-2 py-0.5 rounded font-mono"
                  style={{
                    fontSize: 10,
                    backgroundColor: COLORS.accent.cyan.border,
                    color: COLORS.neutral[100],
                  }}
                >
                  Activate
                </button>
                {!preset.isBuiltIn && (
                  <button
                    onClick={() => handleDeletePreset(preset.id)}
                    className="px-2 py-0.5 rounded font-mono"
                    style={{
                      fontSize: 10,
                      backgroundColor: COLORS.accent.red.border,
                      color: COLORS.neutral[100],
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div
          className="font-mono"
          style={{ fontSize: 12, color: COLORS.neutral[500] }}
        >
          Active: {activePreset?.name ?? 'Default Variant'}
        </div>
      </div>
    </TestPanel>
  )
}

function SlotTest() {
  const drawer = useDrawer()

  const handleOpenGlobal = () => {
    drawer.open({
      id: 'global-test',
      slot: 'global',
      content: (
        <div className="p-6">
          <h2
            className="font-mono mb-4"
            style={{ fontSize: 18, color: COLORS.neutral[200] }}
          >
            Global Slot Drawer
          </h2>
          <p
            className="mb-4"
            style={{ fontSize: 14, color: COLORS.neutral[400] }}
          >
            This drawer renders in the GlobalSlot at viewport level.
          </p>
          <button
            onClick={() => drawer.close('global-test')}
            className="px-3 py-2 rounded font-mono"
            style={{
              fontSize: 12,
              backgroundColor: COLORS.neutral[700],
              color: COLORS.neutral[300],
            }}
          >
            Close
          </button>
        </div>
      ),
      title: 'Global Slot Test',
    })
  }

  return (
    <TestPanel title="TC8-9: Global vs Panel Slots">
      <div className="space-y-3">
        <button
          onClick={handleOpenGlobal}
          className="px-3 py-2 rounded font-mono"
          style={{
            fontSize: 12,
            backgroundColor: COLORS.accent.cyan.base,
            color: COLORS.neutral[950],
          }}
        >
          Open Global Drawer
        </button>
        <div
          className="font-mono"
          style={{ fontSize: 12, color: COLORS.neutral[500] }}
        >
          Panel slot testing requires FloatingPanel context.
          <br />
          See AvaTestbed for panel-scoped drawer examples.
        </div>
      </div>
    </TestPanel>
  )
}

// =============================================================================
// MAIN TESTBED
// =============================================================================

function DrawerTestbedContent() {
  return (
    <div
      className="min-h-screen p-6"
      style={{ backgroundColor: COLORS.neutral[950] }}
    >
      <header className="mb-8">
        <h1
          className="font-mono mb-2"
          style={{ fontSize: 24, color: COLORS.neutral[100] }}
        >
          Drawer System Testbed
        </h1>
        <p
          className="font-mono"
          style={{ fontSize: 14, color: COLORS.neutral[500] }}
        >
          Validating drawer stack, rolodex animation, TableService integration.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DrawerStackTest />
        <TableServiceTest />
        <SlotTest />
      </div>

      {/* Global slot for drawers */}
      <GlobalSlot />
    </div>
  )
}

export function DrawerTestbed() {
  return (
    <DrawerStackProvider>
      <DrawerTestbedContent />
    </DrawerStackProvider>
  )
}

export default DrawerTestbed
