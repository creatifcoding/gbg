/**
 * UI Domain Catalog — Unique interactive components (post-cleanup)
 *
 * After deduplication with core-domain-catalog, this catalog retains only
 * components that have no equivalent elsewhere:
 *   - Switch (boolean toggle — distinct from ToggleButton)
 *   - Progress (value bar — not in core)
 *   - FoldablePanel (domain-specific interactive wrapper)
 *   - SemanticRegion (agent infrastructure — data-semantic-* targeting)
 *
 * See: docs/genifer/architecture/CATALOG-CLEANUP.md
 *
 * @module genifer/catalog/ui-domain-catalog
 */

import { Schema } from 'effect'
import type { DomainCatalog, ComponentRenderProps } from '@/lib/genifer/core/CatalogService'
import type { EntranceAnimation } from '@/lib/genifer/core/animation-schema'
import { Switch } from '@/components/ui/switch'
import { FoldablePanel, type PanelTag } from '@/lib/foldable-panel'
import { SemanticRegion, type SemanticRegionType } from '@/lib/genifer/core/components'

// ─── Harness tokens ─────────────────────────────────────────────────────────

const H = {
  bgSurface: 'rgba(14, 14, 14, 0.95)',
  bgHeader:  'rgba(20, 20, 20, 0.95)',
  border:    'rgba(50, 50, 50, 0.6)',
  cyan:      'rgb(34, 211, 238)',
  text:      'rgb(212, 212, 212)',
  textMid:   'rgb(163, 163, 163)',
  textDim:   'rgb(115, 115, 115)',
  textGhost: 'rgb(82, 82, 82)',
  xs: 'var(--tmnl-text-xs, 12px)',
  sm: 'var(--tmnl-text-sm, 14px)',
} as const

const CN = Schema.optional(Schema.String)

// ─── Animations ─────────────────────────────────────────────────────────────

const A = {
  quick: { property: 'opacity+scale', easing: 'out-quart', duration: 'fast' } satisfies EntranceAnimation,
  slide: { property: 'opacity+translateY', easing: 'out-cubic', duration: 'normal' } satisfies EntranceAnimation,
  fade:  { property: 'opacity', easing: 'out-quad', duration: 'fast' } satisfies EntranceAnimation,
}

// =============================================================================
// COMPONENTS
// =============================================================================

export const uiDomainCatalog: DomainCatalog = {
  name: 'TMNL UI',
  defaultTier: 'domain',
  defaultDomains: ['ui'],
  components: {
    // ─── Switch ─────────────────────────────────────────────────────────
    Switch: {
      schema: Schema.Struct({
        id: CN,
        label: CN,
        checked: Schema.optional(Schema.Boolean),
        disabled: Schema.optional(Schema.Boolean),
        className: CN,
      }),
      renderer: ({ element }: ComponentRenderProps) => {
        const id = (element.props['id'] as string) ?? element.key
        return (
          <div className={element.props['className'] as string ?? 'flex items-center gap-2.5'}>
            <Switch
              id={id}
              defaultChecked={element.props['checked'] as boolean}
              disabled={element.props['disabled'] as boolean}
              className="data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-neutral-800 border-neutral-700"
            />
            {element.props['label'] && (
              <label htmlFor={id} className="font-mono cursor-pointer" style={{ fontSize: H.sm, color: H.textMid }}>
                {element.props['label'] as string}
              </label>
            )}
          </div>
        )
      },
      description: 'Boolean toggle switch. Cyan track when checked, dark track when unchecked. Distinct from ToggleButton (which is a pressable button, not a slide toggle).',
      hasChildren: false,
      defaultEntrance: A.quick,
      tier: 'domain' as const,
      domains: ['ui', 'forms'],
    },

    // ─── Progress ───────────────────────────────────────────────────────
    Progress: {
      schema: Schema.Struct({
        value: Schema.optional(Schema.Number),
        label: CN,
        showValue: Schema.optional(Schema.Boolean),
        className: CN,
      }),
      renderer: ({ element }: ComponentRenderProps) => {
        const value = Math.min(100, Math.max(0, (element.props['value'] as number) ?? 0))
        return (
          <div className={element.props['className'] as string ?? 'space-y-1.5'}>
            {(element.props['label'] || element.props['showValue']) && (
              <div className="flex items-center justify-between">
                {element.props['label'] && (
                  <span className="font-mono uppercase tracking-wider" style={{ fontSize: H.xs, color: H.textDim }}>
                    {element.props['label'] as string}
                  </span>
                )}
                {element.props['showValue'] && (
                  <span className="font-mono tabular-nums" style={{ fontSize: H.xs, color: H.cyan }}>
                    {value}%
                  </span>
                )}
              </div>
            )}
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: H.bgHeader,
                border: `1px solid ${H.border}`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${value}%`,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, rgba(34,211,238,0.6), ${H.cyan})`,
                  transition: 'width 300ms ease',
                }}
              />
            </div>
          </div>
        )
      },
      description: 'Progress bar. value: 0-100. Cyan gradient fill on dark track. Optional label (uppercase mono) and showValue (cyan percentage readout).',
      hasChildren: false,
      defaultEntrance: A.fade,
      tier: 'domain' as const,
      domains: ['ui', 'feedback'],
    },

    // ─── FoldablePanel ──────────────────────────────────────────────────
    FoldablePanel: {
      schema: Schema.Struct({
        panelId: Schema.String,
        tag: Schema.optional(Schema.Literal('map', '3d', 'data-grid', 'chart', 'embed', 'media', 'custom')),
        label: CN,
        expandedHeight: Schema.optional(Schema.Number),
        collapsedHeight: Schema.optional(Schema.Number),
        initialFoldState: Schema.optional(Schema.Literal('expanded', 'collapsed')),
        showDragHandle: Schema.optional(Schema.Boolean),
        className: CN,
      }),
      renderer: ({ element, children }: ComponentRenderProps) => {
        const tag = (element.props['tag'] as PanelTag) ?? 'custom'
        const label = (element.props['label'] as string) ?? tag
        return (
          <FoldablePanel
            panelId={element.props['panelId'] as string ?? element.key}
            badge={{ tag, label }}
            expandedHeight={(element.props['expandedHeight'] as number) ?? 320}
            collapsedHeight={(element.props['collapsedHeight'] as number) ?? 48}
            initialFoldState={(element.props['initialFoldState'] as 'expanded' | 'collapsed') ?? 'expanded'}
            showDragHandle={(element.props['showDragHandle'] as boolean) ?? false}
            isEditable={false}
          >
            {children}
          </FoldablePanel>
        )
      },
      description: "Collapsible panel wrapper for interactive content. Tags: 'map' (cyan), '3d' (purple), 'data-grid' (orange), 'chart' (emerald), 'embed' (blue), 'media' (rose), 'custom' (slate). Use to wrap charts, maps, 3D views, data grids.",
      hasChildren: true,
      defaultEntrance: A.slide,
      tier: 'domain' as const,
      domains: ['ui', 'charts', 'geoint'],
    },

    // ─── SemanticRegion ─────────────────────────────────────────────────
    SemanticRegion: {
      schema: Schema.Struct({
        'data-semantic-id': Schema.String,
        'data-semantic-label': Schema.String,
        'data-semantic-type': Schema.optional(Schema.Literal(
          'chart', 'form', 'list', 'card', 'navigation', 'content',
          'interactive', 'header', 'footer', 'sidebar', 'main'
        )),
        role: CN,
        'aria-label': CN,
        className: CN,
      }),
      renderer: ({ element, children }: ComponentRenderProps) => (
        <SemanticRegion
          data-semantic-id={element.props['data-semantic-id'] as string}
          data-semantic-label={element.props['data-semantic-label'] as string}
          data-semantic-type={element.props['data-semantic-type'] as SemanticRegionType | undefined}
          role={element.props['role'] as string | undefined}
          aria-label={element.props['aria-label'] as string | undefined}
          className={element.props['className'] as string | undefined}
        >
          {children}
        </SemanticRegion>
      ),
      description: 'Agent-addressable region wrapper. data-semantic-id + data-semantic-label + data-semantic-type enable Evolution agent targeting via get_semantic_map. Types: chart, form, list, card, navigation, content, interactive, header, footer, sidebar, main.',
      hasChildren: true,
      defaultEntrance: A.slide,
      tier: 'domain' as const,
      domains: ['ui'],
    },
  },
}
