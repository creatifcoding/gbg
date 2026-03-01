import { describe, it, expect } from 'vitest'

// Import barrel to trigger auto-registration
import '../index'

import {
  hasToolRenderer,
  getToolRendererEntry,
  getToolHeaderMeta,
  getRegisteredToolNames,
} from '../registry'

describe('Panel tool renderer registration', () => {
  it('panel_eval is registered', () => {
    expect(hasToolRenderer('panel_eval')).toBe(true)
  })

  it('arrange_panels is registered', () => {
    expect(hasToolRenderer('arrange_panels')).toBe(true)
  })

  it('spawn_panel is registered', () => {
    expect(hasToolRenderer('spawn_panel')).toBe(true)
  })

  it('panel_eval has header meta', () => {
    expect(getToolHeaderMeta('panel_eval')).not.toBeNull()
  })

  it('arrange_panels has header meta', () => {
    expect(getToolHeaderMeta('arrange_panels')).not.toBeNull()
  })

  it('spawn_panel has header meta', () => {
    expect(getToolHeaderMeta('spawn_panel')).not.toBeNull()
  })

  it('all 3 have full entries', () => {
    for (const name of ['panel_eval', 'arrange_panels', 'spawn_panel']) {
      const entry = getToolRendererEntry(name)
      expect(entry).not.toBeNull()
      expect(entry!.renderer).toBeDefined()
      expect(entry!.headerMeta).not.toBeNull()
    }
  })

  it('registered tool names include all 3', () => {
    const names = getRegisteredToolNames()
    expect(names).toContain('panel_eval')
    expect(names).toContain('arrange_panels')
    expect(names).toContain('spawn_panel')
  })
})
