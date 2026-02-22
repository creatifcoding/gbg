/**
 * Catalog Overhaul Tests
 *
 * Tests:
 *   1. Tier system — core, domain, discovery filtering
 *   2. Domain scoping — filter by domain tags
 *   3. Compound components — parent/slot relationships
 *   4. New core domain catalog registration
 *   5. generateScopedPrompt — filtered output
 *   6. listComponents / listDomains
 *   7. className universality — every component schema has className
 *
 * @module genifer/__tests__/catalog-overhaul.test
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  makeCatalogComponents,
  createCatalogLayer,
  CatalogComponents,
  type DomainCatalog,
  type CatalogTier,
} from '../core/CatalogService'
import { uiDomainCatalog } from '../catalog/ui-domain-catalog'
import { coreDomainCatalog } from '../catalog/core-domain-catalog'

describe('Catalog Overhaul', () => {
  // ===========================================================================
  // Setup
  // ===========================================================================

  const catalog = makeCatalogComponents([uiDomainCatalog, coreDomainCatalog])

  // ===========================================================================
  // 1. Tier System
  // ===========================================================================

  describe('Tier System', () => {
    it('core tier includes only core components', () => {
      const coreComponents = catalog.listComponents({ tier: 'core' })
      expect(coreComponents.length).toBeGreaterThan(0)

      // FoldablePanel and SemanticRegion are 'domain' tier
      expect(coreComponents).not.toContain('FoldablePanel')
      expect(coreComponents).not.toContain('SemanticRegion')

      // Card, Text, Button should be core
      expect(coreComponents).toContain('Card')
      expect(coreComponents).toContain('Text')
      expect(coreComponents).toContain('Button')
    })

    it('domain tier includes core + domain components', () => {
      const domainComponents = catalog.listComponents({ tier: 'domain' })
      // Should include everything that core has, plus domain-tier components
      expect(domainComponents).toContain('Card')
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
      expect(formsComponents).toContain('Input')
      expect(formsComponents).toContain('Switch')
      expect(formsComponents).toContain('Textarea')
      expect(formsComponents).toContain('Checkbox')
      expect(formsComponents).toContain('Select')

      // Card is not a forms component
      expect(formsComponents).not.toContain('Card')
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
      expect(combined).toContain('Input')
      expect(combined).toContain('Image')
    })
  })

  // ===========================================================================
  // 3. Compound Components
  // ===========================================================================

  describe('Compound Components', () => {
    it('Card has compound relationship with CardHeader, CardContent, CardFooter', () => {
      const compound = catalog.getCompound('Card')
      expect(compound).toBeDefined()
      expect(compound!.parent).toBe('Card')
      expect(compound!.slots).toContain('CardHeader')
      expect(compound!.slots).toContain('CardContent')
      expect(compound!.slots).toContain('CardFooter')
    })

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

    it('non-compound components return undefined', () => {
      expect(catalog.getCompound('Text')).toBeUndefined()
      expect(catalog.getCompound('Button')).toBeUndefined()
    })
  })

  // ===========================================================================
  // 4. New Core Domain
  // ===========================================================================

  describe('New Core Domain Components', () => {
    it('Box is registered', () => {
      expect(catalog.schemas.has('Box')).toBe(true)
      expect(catalog.renderers.has('Box')).toBe(true)
    })

    it('DataTable is registered', () => {
      expect(catalog.schemas.has('DataTable')).toBe(true)
    })

    it('Tabs family is registered', () => {
      expect(catalog.schemas.has('Tabs')).toBe(true)
      expect(catalog.schemas.has('TabsList')).toBe(true)
      expect(catalog.schemas.has('TabsTrigger')).toBe(true)
      expect(catalog.schemas.has('TabsContent')).toBe(true)
    })

    it('Accordion family is registered', () => {
      expect(catalog.schemas.has('Accordion')).toBe(true)
      expect(catalog.schemas.has('AccordionItem')).toBe(true)
    })

    it('Image and Avatar are registered', () => {
      expect(catalog.schemas.has('Image')).toBe(true)
      expect(catalog.schemas.has('Avatar')).toBe(true)
    })

    it('Skeleton is registered', () => {
      expect(catalog.schemas.has('Skeleton')).toBe(true)
    })

    it('Tooltip is registered', () => {
      expect(catalog.schemas.has('Tooltip')).toBe(true)
    })
  })

  // ===========================================================================
  // 5. generateScopedPrompt
  // ===========================================================================

  describe('generateScopedPrompt', () => {
    it('generates prompt with only core components', () => {
      const prompt = catalog.generateScopedPrompt({ tier: 'core' })
      expect(prompt).toContain('Card')
      expect(prompt).toContain('Button')
      expect(prompt).not.toContain('FoldablePanel')
    })

    it('domain-scoped prompt includes domain badge', () => {
      const prompt = catalog.generateScopedPrompt({ domains: ['forms'] })
      expect(prompt).toContain('Input')
      expect(prompt).toContain('Textarea')
    })

    it('generates prompt with compound info', () => {
      const prompt = catalog.generateScopedPrompt()
      // Card compound info
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
    })
  })

  // ===========================================================================
  // 7. className Universality
  // ===========================================================================

  describe('className universality', () => {
    it('every core domain component schema includes className', () => {
      const coreComponents = Object.entries(coreDomainCatalog.components)
      for (const [name, def] of coreComponents) {
        // Check that the schema AST has a className property key
        const ast = JSON.stringify((def.schema as any).ast ?? def.schema)
        const hasClassName = ast?.includes('className') ?? false
        expect(
          hasClassName,
          `${name} should have className in schema`,
        ).toBe(true)
      }
    })
  })

  // ===========================================================================
  // 8. Full Domain Coverage
  // ===========================================================================

  describe('Full Domain Coverage', () => {
    it('has 60+ components in core domain catalog', () => {
      const count = Object.keys(coreDomainCatalog.components).length
      expect(count).toBeGreaterThanOrEqual(60)
    })

    it('forms domain has input controls', () => {
      const forms = catalog.listComponents({ domains: ['forms'] })
      for (const name of ['Textarea', 'Checkbox', 'Select', 'RadioGroup', 'Slider', 'FileInput', 'DateInput']) {
        expect(forms, `${name} should be in forms domain`).toContain(name)
      }
    })

    it('feedback domain has alerts and dialogs', () => {
      const feedback = catalog.listComponents({ domains: ['feedback'] })
      for (const name of ['Callout', 'Banner', 'Dialog', 'Sheet', 'Skeleton']) {
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
  // 9. Wiring Compounds (ActionGroup-ready)
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
  // 10. Compound Components — New Groups
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
      expect(compound!.slots).toEqual(['RadioItem'])
    })

    it('Timeline compound is strict (only TimelineItem)', () => {
      const compound = catalog.getCompound('Timeline')
      expect(compound).toBeDefined()
      expect(compound!.strict).toBe(true)
      expect(compound!.slots).toEqual(['TimelineItem'])
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
  // 11. Every component has description and defaultEntrance
  // ===========================================================================

  describe('Component completeness', () => {
    it('every core domain component has description', () => {
      for (const [name, def] of Object.entries(coreDomainCatalog.components)) {
        expect(def.description, `${name} should have description`).toBeDefined()
        expect(def.description!.length, `${name} description should be non-empty`).toBeGreaterThan(0)
      }
    })

    it('every core domain component has defaultEntrance', () => {
      for (const [name, def] of Object.entries(coreDomainCatalog.components)) {
        expect(def.defaultEntrance, `${name} should have defaultEntrance`).toBeDefined()
        expect(def.defaultEntrance.property, `${name} should have animation property`).toBeDefined()
        expect(def.defaultEntrance.easing, `${name} should have animation easing`).toBeDefined()
        expect(def.defaultEntrance.duration, `${name} should have animation duration`).toBeDefined()
      }
    })

    it('every core domain component has renderer function', () => {
      for (const [name, def] of Object.entries(coreDomainCatalog.components)) {
        expect(typeof def.renderer, `${name} should have renderer function`).toBe('function')
      }
    })
  })
})
