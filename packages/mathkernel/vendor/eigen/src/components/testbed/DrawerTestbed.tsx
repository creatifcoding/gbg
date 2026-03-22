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

import { useState } from 'react'

import { TMNL, TMNL_FONT_SIZE } from '@/lib/tmnl-ui'
import {
  DrawerStackProvider,
  GlobalSlot,
  useDrawer,
} from '@/lib/drawer'
import { useTableService } from '@/lib/table-service'
import type { PresetId } from '@/lib/table-service'

// =============================================================================
// TEST PANEL COMPONENTS
// =============================================================================

function TestPanel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <TMNL.Card.Root>
      <TMNL.Card.Header>
        <TMNL.Card.Title>{title}</TMNL.Card.Title>
      </TMNL.Card.Header>
      <TMNL.Card.Body>
        {children}
      </TMNL.Card.Body>
    </TMNL.Card.Root>
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
      <TMNL.Heading level={2} className="mb-4">{id}</TMNL.Heading>
      <TMNL.Body className="mb-4">
        Depth: {depth} | Stack count: {drawer.count}
      </TMNL.Body>
      <div className="flex gap-2">
        <TMNL.Button variant="primary" onClick={handlePushAnother}>
          Push Another
        </TMNL.Button>
        <TMNL.Button variant="tmnl" onClick={() => drawer.close(id)}>
          Close
        </TMNL.Button>
        <TMNL.Button variant="danger" onClick={() => drawer.closeAll()}>
          Close All
        </TMNL.Button>
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
      <TMNL.Heading level={2} className="mb-4">Create Preset</TMNL.Heading>
      <div className="space-y-4">
        <div>
          <TMNL.Label className="block mb-2">Preset Name</TMNL.Label>
          <TMNL.Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Preset"
          />
        </div>
        <div className="flex gap-2">
          <TMNL.Button
            variant="primary"
            onClick={handleSave}
            disabled={!name.trim() || saving}
          >
            {saving ? 'Saving...' : 'Save Preset'}
          </TMNL.Button>
          <TMNL.Button
            variant="tmnl"
            onClick={() => drawer.close('preset-form')}
          >
            Cancel
          </TMNL.Button>
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
    <TestPanel title="TC4-7: DRAWER STACK + ANIMATION">
      <div className="space-y-3">
        <div className="flex gap-2">
          <TMNL.Button variant="primary" onClick={handleOpenSingle}>
            Open Single Drawer
          </TMNL.Button>
          <TMNL.Button variant="tmnl" onClick={handleOpenStacked}>
            Open Stacked (3x)
          </TMNL.Button>
        </div>
        <TMNL.Body muted>
          Open drawers: {drawer.count} | IDs: {drawer.openIds.join(', ') || 'none'}
        </TMNL.Body>
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
    <TestPanel title="TC1-3: TABLESERVICE PRESET CRUD">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TMNL.Label>Status:</TMNL.Label>
          <TMNL.Badge variant={isReady ? 'success' : 'warning'}>
            {isReady ? 'READY' : 'INITIALIZING'}
          </TMNL.Badge>
        </div>

        <div className="flex gap-2">
          <TMNL.Button variant="primary" onClick={handleOpenPresetForm}>
            Create Preset (Drawer)
          </TMNL.Button>
          <TMNL.Button
            variant="tmnl"
            onClick={() => setActivePreset(null)}
            disabled={!activePresetId}
          >
            Clear Active
          </TMNL.Button>
        </div>

        <div>
          <TMNL.Label className="block mb-2">
            Presets ({userPresetCount} user-created):
          </TMNL.Label>
          <div className="space-y-1">
            {presets.length === 0 && (
              <TMNL.Body muted className="italic">
                No presets yet. Create one to test persistence.
              </TMNL.Body>
            )}
            {presets.map((preset) => (
              <div
                key={preset.id}
                className={`flex items-center gap-2 px-3 py-2 rounded border ${
                  preset.id === activePresetId
                    ? 'bg-neutral-900 border-neutral-600'
                    : 'bg-neutral-950 border-neutral-800'
                }`}
              >
                <span
                  className="font-mono flex-1 text-neutral-200"
                  style={{ fontSize: TMNL_FONT_SIZE.xs }}
                >
                  {preset.name}
                </span>
                {preset.isBuiltIn && (
                  <TMNL.Badge>BUILT-IN</TMNL.Badge>
                )}
                <TMNL.Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActivePreset(preset.id)}
                >
                  Activate
                </TMNL.Button>
                {!preset.isBuiltIn && (
                  <TMNL.Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeletePreset(preset.id)}
                  >
                    Delete
                  </TMNL.Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <TMNL.Body muted>
          Active: {activePreset?.name ?? 'Default Variant'}
        </TMNL.Body>
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
          <TMNL.Heading level={2} className="mb-4">Global Slot Drawer</TMNL.Heading>
          <TMNL.Body className="mb-4">
            This drawer renders in the GlobalSlot at viewport level.
          </TMNL.Body>
          <TMNL.Button variant="tmnl" onClick={() => drawer.close('global-test')}>
            Close
          </TMNL.Button>
        </div>
      ),
      title: 'Global Slot Test',
    })
  }

  return (
    <TestPanel title="TC8-9: GLOBAL VS PANEL SLOTS">
      <div className="space-y-3">
        <TMNL.Button variant="primary" onClick={handleOpenGlobal}>
          Open Global Drawer
        </TMNL.Button>
        <TMNL.Body muted>
          Panel slot testing requires FloatingPanel context.
          <br />
          See AvaTestbed for panel-scoped drawer examples.
        </TMNL.Body>
      </div>
    </TestPanel>
  )
}

// =============================================================================
// MAIN TESTBED
// =============================================================================

function DrawerTestbedContent() {
  return (
    <div className="min-h-screen p-6 bg-black">
      <header className="mb-8">
        <TMNL.Heading level={1} className="mb-2">
          DRAWER SYSTEM TESTBED
        </TMNL.Heading>
        <TMNL.Body muted>
          Validating drawer stack, rolodex animation, TableService integration.
        </TMNL.Body>
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
