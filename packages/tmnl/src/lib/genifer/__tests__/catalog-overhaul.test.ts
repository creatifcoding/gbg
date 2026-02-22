/**
 * Catalog Overhaul Tests
 *
 * Tests:
 *   1. Tier system — core, domain, discovery filtering
 *   2. Domain scoping — filter by domain tags
 *   3. Compound components — parent/slot relationships
 *   4. Core domain catalog registration
 *   5. generateScopedPrompt — filtered output
 *   6. listComponents / listDomains
 *   7. className universality — every component schema has className
 *   8. Full domain coverage
 *   9. Wiring compounds
 *  10. New compound groups
 *  11. Component completeness (description, defaultEntrance, renderer)
 *  12. Button system — 16 components, variants, compounds, tiers
 *  13. Catalog deduplication — ui-domain-catalog gutted to 4
 *
 * @module genifer/__tests__/catalog-overhaul.test
 */

import { describe, it, expect } from 'vitest'
import {
  makeCatalogComponents,
  type DomainCatalog,
} from '../core/CatalogService'
import { uiDomainCatalog } from '../catalog/ui-domain-catalog'
import { coreDomainCatalog } from '../catalog/core-domain-catalog'
import { buttonDomainCatalog } from '../catalog/button-domain-catalog'

describe('Catalog Overhaul', () => {
  // ===========================================================================
  // Setup — all three catalogs
  // ===========================================================================

  const catalog = makeCatalogComponents([uiDomainCatalog, coreDomainCatalog, buttonDomainCatalog])

  // ===========================================================================
  // 1. Tier System
  // ===========================================================================

  describe('Tier System', () => {
    it('core tier includes ButtonRoot, ActionButton, GhostButton', () => {
      const coreComponents = catalog.listComponents({ tier: 'core' })
      expect(coreComponents).toContain('ButtonRoot')
      expect(coreComponents).toContain('ActionButton')
      expect(coreComponents).toContain('GhostButton')
      expect(coreComponents).toContain('LinkButton')
      expect(coreComponents).toContain('ButtonGroup')
    })

    it('core tier excludes domain-only button components', () => {
      const coreComponents = catalog.listComponents({ tier: 'core' })
      expect(coreComponents).not.toContain('FoldablePanel')
      expect(coreComponents).not.toContain('SemanticRegion')
    })

    it('domain tier includes core + domain components', () => {
      const domainComponents = catalog.listComponents({ tier: 'domain' })
      expect(domainComponents).toContain('ButtonRoot')
      expect(domainComponents).toContain('ConfirmButton')
      expect(domainComponents).toContain('CooldownButton')
      expect(domainComponents).toContain('FoldablePanel')
      expect(domainComponents).toContain('SemanticRegion')
    })

    it('discovery tier includes everything', () => {
      const all = catalog.listComponents({ tier: 'discovery' })
      expect(all.length).toBeGreaterThanOrEqual(catalog.listComponents({ tier: 'domain' }).length)
    })
  })

  // ===========================================================================
  // 2. Domain Scoping
  // ===========================================================================

  describe('Domain Scoping', () => {
    it('filters by forms domain', () => {
      const formsComponents = catalog.listComponents({ domains: ['forms'] })
      expect(formsComponents).toContain('Switch')
      expect(formsComponents).toContain('Textarea')
      expect(formsComponents).toContain('Checkbox')
      expect(formsComponents).toContain('Select')
      expect(formsComponents).toContain('ConfirmButton')
      expect(formsComponents).toContain('CooldownButton')
    })

    it('filters by navigation domain', () => {
      const navComponents = catalog.listComponents({ domains: ['navigation'] })
      expect(navComponents).toContain('Tabs')
      expect(navComponents).toContain('TabsList')
      expect(navComponents).toContain('TabsTrigger')
      expect(navComponents).toContain('TabsContent')
      expect(navComponents).toContain('Accordion')
    })

    it('filters by data domain', () => {
      const dataComponents = catalog.listComponents({ domains: ['data'] })
      expect(dataComponents).toContain('DataTable')
    })

    it('filters by media domain', () => {
      const mediaComponents = catalog.listComponents({ domains: ['media'] })
      expect(mediaComponents).toContain('Image')
      expect(mediaComponents).toContain('Avatar')
    })

    it('multiple domains return union', () => {
      const combined = catalog.listComponents({ domains: ['forms', 'media'] })
      expect(combined).toContain('Switch')
      expect(combined).toContain('Image')
    })
  })

  // ===========================================================================
  // 3. Compound Components
  // ===========================================================================

  describe('Compound Components', () => {
    it('Tabs has compound relationship with TabsList, TabsContent', () => {
      const compound = catalog.getCompound('Tabs')
      expect(compound).toBeDefined()
      expect(compound!.parent).toBe('Tabs')
      expect(compound!.slots).toContain('TabsList')
      expect(compound!.slots).toContain('TabsContent')
    })

    it('Accordion has strict compound (only AccordionItem)', () => {
      const compound = catalog.getCompound('Accordion')
      expect(compound).toBeDefined()
      expect(compound!.strict).toBe(true)
      expect(compound!.slots).toEqual(['AccordionItem'])
    })
  })

  // ===========================================================================
  // 4. Core Domain Registration
  // ===========================================================================

  describe('Core Domain Components', () => {
    it('Box is registered', () => {
      expect(catalog.schemas.has('Box')).toBe(true)
      expect(catalog.renderers.has('Box')).toBe(true)
    })

    it('DataTable is registered', () => {
      expect(catalog.schemas.has('DataTable')).toBe(true)
    })

    it('Tabs family is registered', () => {
      for (const n of ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent']) {
        expect(catalog.schemas.has(n), `${n} should be registered`).toBe(true)
      }
    })

    it('Accordion family is registered', () => {
      expect(catalog.schemas.has('Accordion')).toBe(true)
      expect(catalog.schemas.has('AccordionItem')).toBe(true)
    })

    it('Image and Avatar are registered', () => {
      expect(catalog.schemas.has('Image')).toBe(true)
      expect(catalog.schemas.has('Avatar')).toBe(true)
    })

    it('Skeleton and Tooltip are registered', () => {
      expect(catalog.schemas.has('Skeleton')).toBe(true)
      expect(catalog.schemas.has('Tooltip')).toBe(true)
    })
  })

  // ===========================================================================
  // 5. generateScopedPrompt
  // ===========================================================================

  describe('generateScopedPrompt', () => {
    it('generates prompt with core components', () => {
      const prompt = catalog.generateScopedPrompt({ tier: 'core' })
      expect(prompt).toContain('ButtonRoot')
      expect(prompt).toContain('ActionButton')
      expect(prompt).not.toContain('FoldablePanel')
    })

    it('domain-scoped prompt includes domain components', () => {
      const prompt = catalog.generateScopedPrompt({ domains: ['forms'] })
      expect(prompt).toContain('Textarea')
      expect(prompt).toContain('Switch')
    })

    it('generates prompt with compound info', () => {
      const prompt = catalog.generateScopedPrompt()
      expect(prompt).toContain('compound parent')
      expect(prompt).toContain('slots')
    })
  })

  // ===========================================================================
  // 6. listDomains
  // ===========================================================================

  describe('listDomains', () => {
    it('returns all registered domain names', () => {
      const domains = catalog.listDomains()
      expect(domains).toContain('TMNL UI')
      expect(domains).toContain('TMNL Core')
      expect(domains).toContain('TMNL Buttons')
    })
  })

  // ===========================================================================
  // 7. className Universality
  // ===========================================================================

  describe('className universality', () => {
    it('every core domain component schema includes className', () => {
      for (const [name, def] of Object.entries(coreDomainCatalog.components)) {
        const ast = JSON.stringify((def.schema as any).ast ?? def.schema)
        expect(ast?.includes('className'), `${name} should have className`).toBe(true)
      }
    })

    it('every button domain component schema includes className', () => {
      for (const [name, def] of Object.entries(buttonDomainCatalog.components)) {
        const ast = JSON.stringify((def.schema as any).ast ?? def.schema)
        expect(ast?.includes('className'), `${name} should have className`).toBe(true)
      }
    })
  })

  // ===========================================================================
  // 8. Full Domain Coverage
  // ===========================================================================

  describe('Full Domain Coverage', () => {
    it('has 60+ components in core domain catalog', () => {
      expect(Object.keys(coreDomainCatalog.components).length).toBeGreaterThanOrEqual(60)
    })

    it('forms domain has input controls', () => {
      const forms = catalog.listComponents({ domains: ['forms'] })
      for (const name of ['Textarea', 'Checkbox', 'Select', 'RadioGroup', 'Slider', 'FileInput', 'DateInput']) {
        expect(forms, `${name} should be in forms domain`).toContain(name)
      }
    })

    it('feedback domain has alerts and dialogs', () => {
      const feedback = catalog.listComponents({ domains: ['feedback'] })
      for (const name of ['Callout', 'Banner', 'Dialog', 'Sheet', 'Skeleton', 'Progress']) {
        expect(feedback, `${name} should be in feedback domain`).toContain(name)
      }
    })

    it('interactive domain has menus and overlays', () => {
      const interactive = catalog.listComponents({ domains: ['interactive'] })
      for (const name of ['InlineTerminal', 'CodeBlock', 'DropdownMenu', 'Popover', 'HoverCard']) {
        expect(interactive, `${name} should be in interactive domain`).toContain(name)
      }
    })

    it('navigation domain has tabs, accordion, breadcrumb, collapsible', () => {
      const nav = catalog.listComponents({ domains: ['navigation'] })
      for (const name of ['Tabs', 'Accordion', 'Breadcrumb', 'Collapsible']) {
        expect(nav, `${name} should be in navigation domain`).toContain(name)
      }
    })

    it('media domain has video, audio, embed', () => {
      const media = catalog.listComponents({ domains: ['media'] })
      for (const name of ['Video', 'Audio', 'Embed', 'Image', 'Avatar']) {
        expect(media, `${name} should be in media domain`).toContain(name)
      }
    })

    it('data domain has tables, stats, timeline', () => {
      const data = catalog.listComponents({ domains: ['data'] })
      for (const name of ['DataTable', 'KeyValue', 'Stat', 'StatGroup', 'Timeline', 'TimelineItem', 'EmptyState']) {
        expect(data, `${name} should be in data domain`).toContain(name)
      }
    })
  })

  // ===========================================================================
  // 9. Wiring Compounds
  // ===========================================================================

  describe('Wiring Compounds', () => {
    it('SearchBar is registered in forms + data domains', () => {
      expect(catalog.schemas.has('SearchBar')).toBe(true)
      const formsComponents = catalog.listComponents({ domains: ['forms'] })
      const dataComponents = catalog.listComponents({ domains: ['data'] })
      expect(formsComponents).toContain('SearchBar')
      expect(dataComponents).toContain('SearchBar')
    })

    it('FilterBar is registered', () => {
      expect(catalog.schemas.has('FilterBar')).toBe(true)
    })

    it('RefreshControl is registered', () => {
      expect(catalog.schemas.has('RefreshControl')).toBe(true)
    })
  })

  // ===========================================================================
  // 10. New Compound Groups
  // ===========================================================================

  describe('New Compound Components', () => {
    it('Dialog compound has header, title, description, footer slots', () => {
      const compound = catalog.getCompound('Dialog')
      expect(compound).toBeDefined()
      expect(compound!.parent).toBe('Dialog')
      expect(compound!.slots).toContain('DialogHeader')
      expect(compound!.slots).toContain('DialogTitle')
      expect(compound!.slots).toContain('DialogFooter')
    })

    it('List compound is strict (only ListItem)', () => {
      const compound = catalog.getCompound('List')
      expect(compound).toBeDefined()
      expect(compound!.strict).toBe(true)
      expect(compound!.slots).toEqual(['ListItem'])
    })

    it('RadioGroup compound is strict (only RadioItem)', () => {
      const compound = catalog.getCompound('RadioGroup')
      expect(compound).toBeDefined()
      expect(compound!.strict).toBe(true)
    })

    it('Timeline compound is strict (only TimelineItem)', () => {
      const compound = catalog.getCompound('Timeline')
      expect(compound).toBeDefined()
      expect(compound!.strict).toBe(true)
    })

    it('Collapsible compound is non-strict', () => {
      const compound = catalog.getCompound('Collapsible')
      expect(compound).toBeDefined()
      expect(compound!.strict).toBeFalsy()
      expect(compound!.slots).toContain('CollapsibleTrigger')
      expect(compound!.slots).toContain('CollapsibleContent')
    })

    it('DropdownMenu compound has item and separator slots', () => {
      const compound = catalog.getCompound('DropdownMenu')
      expect(compound).toBeDefined()
      expect(compound!.slots).toContain('DropdownItem')
      expect(compound!.slots).toContain('DropdownSeparator')
    })
  })

  // ===========================================================================
  // 11. Component Completeness
  // ===========================================================================

  describe('Component completeness', () => {
    it('every core domain component has description + defaultEntrance + renderer', () => {
      for (const [name, def] of Object.entries(coreDomainCatalog.components)) {
        expect(def.description, `${name} should have description`).toBeDefined()
        expect(def.description!.length, `${name} description should be non-empty`).toBeGreaterThan(0)
        expect(def.defaultEntrance, `${name} should have defaultEntrance`).toBeDefined()
        expect(def.defaultEntrance.property, `${name} should have animation property`).toBeDefined()
        expect(typeof def.renderer, `${name} should have renderer function`).toBe('function')
      }
    })

    it('every button domain component has description + defaultEntrance + renderer', () => {
      for (const [name, def] of Object.entries(buttonDomainCatalog.components)) {
        expect(def.description, `${name} should have description`).toBeDefined()
        expect(def.description!.length, `${name} description should be non-empty`).toBeGreaterThan(0)
        expect(def.defaultEntrance, `${name} should have defaultEntrance`).toBeDefined()
        expect(typeof def.renderer, `${name} should have renderer function`).toBe('function')
      }
    })
  })

  // ===========================================================================
  // 12. Button System
  // ===========================================================================

  describe('Button System', () => {
    it('has exactly 16 button components', () => {
      expect(Object.keys(buttonDomainCatalog.components).length).toBe(16)
    })

    it('primitive slots are registered', () => {
      for (const name of ['ButtonRoot', 'ButtonIcon', 'ButtonLabel', 'ButtonBadge', 'ButtonSpinner', 'ButtonProgress']) {
        expect(catalog.schemas.has(name), `${name} should be registered`).toBe(true)
        expect(catalog.renderers.has(name), `${name} renderer should be registered`).toBe(true)
      }
    })

    it('named assemblies are registered', () => {
      for (const name of ['ActionButton', 'ConfirmButton', 'CooldownButton', 'PulseButton', 'SplitButton', 'FloatingActionButton', 'LinkButton', 'GhostButton']) {
        expect(catalog.schemas.has(name), `${name} should be registered`).toBe(true)
      }
    })

    it('group components are registered', () => {
      expect(catalog.schemas.has('ButtonGroup')).toBe(true)
      expect(catalog.schemas.has('ButtonGroupSeparator')).toBe(true)
    })

    it('ButtonRoot compound has all 5 primitive slots', () => {
      const compound = catalog.getCompound('ButtonRoot')
      expect(compound).toBeDefined()
      expect(compound!.parent).toBe('ButtonRoot')
      expect(compound!.slots).toContain('ButtonIcon')
      expect(compound!.slots).toContain('ButtonLabel')
      expect(compound!.slots).toContain('ButtonBadge')
      expect(compound!.slots).toContain('ButtonSpinner')
      expect(compound!.slots).toContain('ButtonProgress')
      expect(compound!.strict).toBe(false)
    })

    it('ActionButton compound has icon, label, spinner slots', () => {
      const compound = catalog.getCompound('ActionButton')
      expect(compound).toBeDefined()
      expect(compound!.slots).toContain('ButtonIcon')
      expect(compound!.slots).toContain('ButtonLabel')
      expect(compound!.slots).toContain('ButtonSpinner')
    })

    it('ButtonGroup compound accepts multiple button types', () => {
      const compound = catalog.getCompound('ButtonGroup')
      expect(compound).toBeDefined()
      expect(compound!.slots).toContain('ButtonRoot')
      expect(compound!.slots).toContain('ActionButton')
      expect(compound!.slots).toContain('GhostButton')
      expect(compound!.slots).toContain('ButtonGroupSeparator')
    })

    it('core tier buttons: ButtonRoot, ButtonIcon, ButtonLabel, ActionButton, GhostButton, LinkButton, ButtonGroup', () => {
      const coreBtns = ['ButtonRoot', 'ButtonIcon', 'ButtonLabel', 'ButtonBadge', 'ButtonSpinner', 'ButtonProgress', 'ActionButton', 'GhostButton', 'LinkButton', 'ButtonGroup', 'ButtonGroupSeparator']
      for (const name of coreBtns) {
        const entry = catalog.schemas.get(name)
        expect(entry, `${name} should be in schemas`).toBeDefined()
        expect(entry!.tier, `${name} should be core tier`).toBe('core')
      }
    })

    it('domain tier buttons: ConfirmButton, CooldownButton, PulseButton, SplitButton, FAB', () => {
      const domainBtns = ['ConfirmButton', 'CooldownButton', 'PulseButton', 'SplitButton', 'FloatingActionButton']
      for (const name of domainBtns) {
        const entry = catalog.schemas.get(name)
        expect(entry, `${name} should be in schemas`).toBeDefined()
        expect(entry!.tier, `${name} should be domain tier`).toBe('domain')
      }
    })

    it('ButtonRoot schema has all variant literals', () => {
      const schema = buttonDomainCatalog.components['ButtonRoot'].schema
      const ast = JSON.stringify((schema as any).ast ?? schema)
      for (const v of ['solid', 'outline', 'ghost', 'link', 'subtle', 'gradient', 'glow', 'glass', 'destructive', 'success', 'warning']) {
        expect(ast, `should contain variant '${v}'`).toContain(v)
      }
    })

    it('ButtonRoot schema has all size literals', () => {
      const schema = buttonDomainCatalog.components['ButtonRoot'].schema
      const ast = JSON.stringify((schema as any).ast ?? schema)
      for (const s of ['xs', 'sm', 'md', 'lg', 'xl']) {
        expect(ast, `should contain size '${s}'`).toContain(s)
      }
    })

    it('ButtonRoot schema has all shape literals', () => {
      const schema = buttonDomainCatalog.components['ButtonRoot'].schema
      const ast = JSON.stringify((schema as any).ast ?? schema)
      for (const s of ['default', 'pill', 'square', 'circle']) {
        expect(ast, `should contain shape '${s}'`).toContain(s)
      }
    })

    it('ButtonRoot has gradientFrom/gradientTo props (D1)', () => {
      const ast = JSON.stringify((buttonDomainCatalog.components['ButtonRoot'].schema as any).ast ?? buttonDomainCatalog.components['ButtonRoot'].schema)
      expect(ast).toContain('gradientFrom')
      expect(ast).toContain('gradientTo')
    })

    it('ConfirmButton has confirmText prop (D3)', () => {
      const ast = JSON.stringify((buttonDomainCatalog.components['ConfirmButton'].schema as any).ast ?? buttonDomainCatalog.components['ConfirmButton'].schema)
      expect(ast).toContain('confirmText')
    })

    it('CooldownButton has cooldownMs prop (D2)', () => {
      const ast = JSON.stringify((buttonDomainCatalog.components['CooldownButton'].schema as any).ast ?? buttonDomainCatalog.components['CooldownButton'].schema)
      expect(ast).toContain('cooldownMs')
    })

    it('FloatingActionButton has position prop (D4)', () => {
      const ast = JSON.stringify((buttonDomainCatalog.components['FloatingActionButton'].schema as any).ast ?? buttonDomainCatalog.components['FloatingActionButton'].schema)
      expect(ast).toContain('bottom-right')
      expect(ast).toContain('top-left')
    })
  })

  // ===========================================================================
  // 13. Catalog Deduplication
  // ===========================================================================

  describe('Catalog Deduplication', () => {
    it('ui-domain-catalog has exactly 4 components post-cleanup', () => {
      expect(Object.keys(uiDomainCatalog.components).length).toBe(4)
    })

    it('ui-domain-catalog retains Switch', () => {
      expect(uiDomainCatalog.components['Switch']).toBeDefined()
    })

    it('ui-domain-catalog retains Progress', () => {
      expect(uiDomainCatalog.components['Progress']).toBeDefined()
    })

    it('ui-domain-catalog retains FoldablePanel', () => {
      expect(uiDomainCatalog.components['FoldablePanel']).toBeDefined()
    })

    it('ui-domain-catalog retains SemanticRegion', () => {
      expect(uiDomainCatalog.components['SemanticRegion']).toBeDefined()
    })

    it('ui-domain-catalog NO LONGER has Text, Heading, Button, Card, Input, Badge, Alert, Separator', () => {
      for (const removed of ['Text', 'Heading', 'Button', 'Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter', 'Input', 'Badge', 'Alert', 'Separator']) {
        expect(uiDomainCatalog.components[removed], `${removed} should be removed`).toBeUndefined()
      }
    })

    it('ui-domain-catalog defaultTier is domain', () => {
      expect(uiDomainCatalog.defaultTier).toBe('domain')
    })

    it('Progress has vantablack styling (showValue prop)', () => {
      const ast = JSON.stringify((uiDomainCatalog.components['Progress'].schema as any).ast ?? uiDomainCatalog.components['Progress'].schema)
      expect(ast).toContain('showValue')
      expect(ast).toContain('label')
    })

    it('total components across core + button + ui = 89', () => {
      const total =
        Object.keys(coreDomainCatalog.components).length +
        Object.keys(buttonDomainCatalog.components).length +
        Object.keys(uiDomainCatalog.components).length
      expect(total).toBe(89)
    })
  })
})
