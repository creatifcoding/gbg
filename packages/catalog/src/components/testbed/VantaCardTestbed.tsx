/**
 * VantaCard Testbed
 *
 * Design system validation for catalog's vantablack card components.
 * Showcases variants, typography, status mapping, and a catalog card.
 *
 * Route: /testbed/vanta
 *
 * HYPOTHESES:
 * - H1: VANTA tokens render on void/base without a second palette
 * - H2: Compound slots (Header, Title, Indicator, Body, Actions) compose
 * - H3: Catalog statuses map onto existing VANTA accents
 */

import { Link } from '@tanstack/react-router'
import {
  VantaCard,
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  type VantaCardVariant,
} from '~/components/portal'
import { STATUS_VISUAL } from '~/lib/catalog/registry'
import { CARD_STATUSES } from '~/lib/catalog/schema'
import { SectionLabel } from './shared'

function TypographySpecimen() {
  return (
    <VantaCard variant="default" corners>
      <VantaCard.Header>
        <VantaCard.Title>TYPOGRAPHY SPECIMEN</VantaCard.Title>
      </VantaCard.Header>

      <div className="space-y-4">
        <div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              color: VANTA_COLORS.text.muted,
              marginBottom: '8px',
            }}
          >
            preset.cardTitle
          </div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.cardTitle,
              color: VANTA_COLORS.text.primary,
            }}
          >
            TERMINAL AUTHORITY
          </div>
        </div>

        <div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              color: VANTA_COLORS.text.muted,
              marginBottom: '8px',
            }}
          >
            preset.cardBody
          </div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.cardBody,
              color: VANTA_COLORS.text.secondary,
            }}
          >
            Body text uses Geo. Hierarchy comes from family contrast, not from shrinking type.
          </div>
        </div>

        <div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              color: VANTA_COLORS.text.muted,
              marginBottom: '8px',
            }}
          >
            preset.value
          </div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.value,
              color: VANTA_COLORS.accent.cyan,
            }}
          >
            3 tags minimum
          </div>
        </div>
      </div>
    </VantaCard>
  )
}

function VariantShowcase() {
  const variants: VantaCardVariant[] = ['default', 'elevated', 'compact', 'ghost']

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {variants.map((variant) => (
        <VantaCard key={variant} variant={variant} corners={variant !== 'ghost'}>
          <VantaCard.Header>
            <VantaCard.Title>{variant.toUpperCase()}</VantaCard.Title>
            <VantaCard.Indicator status="active" />
          </VantaCard.Header>
          <VantaCard.Subtitle>variant="{variant}"</VantaCard.Subtitle>
          <VantaCard.Body>
            Card variant demonstration. Each variant sits on the same VANTA surface scale.
          </VantaCard.Body>
        </VantaCard>
      ))}
    </div>
  )
}

function CatalogStatusShowcase() {
  return (
    <VantaCard variant="default" corners>
      <VantaCard.Header>
        <VantaCard.Title>CATALOG STATUS</VantaCard.Title>
      </VantaCard.Header>
      <VantaCard.Body>
        raw, filed, working, and dead reuse VANTA amber, cyan, emerald, and rose.
      </VantaCard.Body>
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        {CARD_STATUSES.map((status) => {
          const visual = STATUS_VISUAL[status]
          return (
            <div key={status} className="space-y-2">
              <VantaCard.Indicator status={visual.indicator} label={status.toUpperCase()} />
              <div
                style={{
                  ...VANTA_TYPOGRAPHY.preset.micro,
                  color: VANTA_COLORS.text.muted,
                }}
              >
                {visual.accent}
              </div>
            </div>
          )
        })}
      </div>
    </VantaCard>
  )
}

function CatalogCardExample() {
  return (
    <VantaCard variant="elevated" corners glow glowColor="cyan">
      <VantaCard.Header>
        <VantaCard.Title>NOTE</VantaCard.Title>
        <VantaCard.Indicator status="pending" label="RAW" />
      </VantaCard.Header>
      <VantaCard.Subtitle>unknown organism</VantaCard.Subtitle>
      <VantaCard.Body>
        One-line claim lives here. Tags and open questions can exist at dump. Organism is an optional guess. Body waits.
      </VantaCard.Body>
      <VantaCard.Divider />
      <div className="grid grid-cols-3 gap-4">
        <VantaCard.LabelValue label="TYPE" value="note" accent="cyan" />
        <VantaCard.LabelValue label="TAGS" value="3+" accent="emerald" />
        <VantaCard.LabelValue label="STATUS" value="raw" accent="amber" />
      </div>
      <VantaCard.Actions>
        <VantaCard.Action variant="primary">OPEN CARD</VantaCard.Action>
        <VantaCard.Action variant="ghost">INTAKE</VantaCard.Action>
      </VantaCard.Actions>
    </VantaCard>
  )
}

function GlowVariants() {
  const glowColors = ['cyan', 'emerald', 'amber', 'rose'] as const

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {glowColors.map((color) => (
        <VantaCard key={color} variant="compact" glow glowColor={color}>
          <VantaCard.LabelValue label="GLOW" value={color.toUpperCase()} accent={color} />
        </VantaCard>
      ))}
    </div>
  )
}

function ColorPalette() {
  return (
    <VantaCard variant="default" corners>
      <VantaCard.Header>
        <VantaCard.Title>COLOR PALETTE</VantaCard.Title>
      </VantaCard.Header>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Object.entries(VANTA_COLORS.surface).map(([name, color]) => (
          <div key={name}>
            <div
              style={{
                width: '100%',
                height: '40px',
                backgroundColor: color,
                border: `1px solid ${VANTA_COLORS.surface.border}`,
                marginBottom: '4px',
              }}
            />
            <div
              style={{
                ...VANTA_TYPOGRAPHY.preset.micro,
                color: VANTA_COLORS.text.muted,
              }}
            >
              {name}
            </div>
          </div>
        ))}
      </div>
      <VantaCard.Divider />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {['cyan', 'emerald', 'amber', 'rose', 'violet'].map((name) => (
          <div key={name}>
            <div
              style={{
                width: '100%',
                height: '40px',
                backgroundColor: VANTA_COLORS.accent[name as 'cyan'],
                marginBottom: '4px',
              }}
            />
            <div
              style={{
                ...VANTA_TYPOGRAPHY.preset.micro,
                color: VANTA_COLORS.text.muted,
              }}
            >
              {name}
            </div>
          </div>
        ))}
      </div>
    </VantaCard>
  )
}

export function VantaCardTestbed() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: VANTA_COLORS.surface.void }}>
      <header
        className="sticky top-0 z-10 border-b"
        style={{
          borderColor: VANTA_COLORS.surface.border,
          backgroundColor: VANTA_COLORS.surface.base,
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1
              style={{
                ...VANTA_TYPOGRAPHY.preset.cardTitle,
                color: VANTA_COLORS.text.primary,
              }}
            >
              VantaCard Testbed
            </h1>
            <p
              style={{
                ...VANTA_TYPOGRAPHY.preset.micro,
                color: VANTA_COLORS.text.muted,
                marginTop: '4px',
              }}
            >
              Catalog copy of TMNL Vanta Black. Tokens only, no tmnl shells.
            </p>
          </div>
          <Link to="/" className="vanta-btn">
            Catalog
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-6 py-8">
        <section>
          <SectionLabel>Typography</SectionLabel>
          <TypographySpecimen />
        </section>
        <section>
          <SectionLabel>Card variants</SectionLabel>
          <VariantShowcase />
        </section>
        <section>
          <SectionLabel>Catalog status mapping</SectionLabel>
          <CatalogStatusShowcase />
        </section>
        <section>
          <SectionLabel>Glow accents (hover)</SectionLabel>
          <GlowVariants />
        </section>
        <section>
          <SectionLabel>Catalog card composition</SectionLabel>
          <CatalogCardExample />
        </section>
        <section>
          <SectionLabel>Color palette</SectionLabel>
          <ColorPalette />
        </section>
      </main>
    </div>
  )
}
