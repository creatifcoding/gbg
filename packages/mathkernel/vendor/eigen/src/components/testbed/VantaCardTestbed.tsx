/**
 * VantaCard Testbed
 *
 * Design system validation for the vantablack card components.
 * Showcases all variants, typography, and composition patterns.
 *
 * Route: /testbed/vanta
 */

import { Link } from '@tanstack/react-router'
import { ArrowLeft, Clock, AlertCircle, CheckCircle } from 'lucide-react'
import {
  VantaCard,
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  type VantaCardVariant,
} from '@/components/portal'
import { SectionLabel } from '@/components/testbed/shared'

// ─────────────────────────────────────────────────────────────────────────────
// Typography Specimen
// ─────────────────────────────────────────────────────────────────────────────

function TypographySpecimen() {
  return (
    <VantaCard variant="default" corners>
      <VantaCard.Header>
        <VantaCard.Title>TYPOGRAPHY SPECIMEN</VantaCard.Title>
      </VantaCard.Header>

      <div className="space-y-4">
        {/* Mono header preset */}
        <div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              color: VANTA_COLORS.text.muted,
              marginBottom: '8px',
            }}
          >
            preset.cardTitle (mono)
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

        {/* Sans body preset */}
        <div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              color: VANTA_COLORS.text.muted,
              marginBottom: '8px',
            }}
          >
            preset.cardBody (sans)
          </div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.cardBody,
              color: VANTA_COLORS.text.secondary,
            }}
          >
            Body text uses Inter for readability. This creates visual hierarchy through font family contrast rather than size alone.
          </div>
        </div>

        {/* Value preset */}
        <div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              color: VANTA_COLORS.text.muted,
              marginBottom: '8px',
            }}
          >
            preset.value (mono emphasized)
          </div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.value,
              color: VANTA_COLORS.accent.cyan,
            }}
          >
            36,273
          </div>
        </div>

        {/* Micro preset */}
        <div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              color: VANTA_COLORS.text.muted,
              marginBottom: '8px',
            }}
          >
            preset.micro (timestamps)
          </div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.tertiary,
            }}
          >
            2025-12-01T14:32:00Z
          </div>
        </div>
      </div>
    </VantaCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant Showcase
// ─────────────────────────────────────────────────────────────────────────────

function VariantShowcase() {
  const variants: VantaCardVariant[] = ['default', 'elevated', 'compact', 'ghost']

  return (
    <div className="grid grid-cols-2 gap-6">
      {variants.map((variant) => (
        <VantaCard key={variant} variant={variant} corners={variant !== 'ghost'}>
          <VantaCard.Header>
            <VantaCard.Title>{variant.toUpperCase()}</VantaCard.Title>
            <VantaCard.Indicator status="active" />
          </VantaCard.Header>
          <VantaCard.Subtitle>variant=&quot;{variant}&quot;</VantaCard.Subtitle>
          <VantaCard.Body>
            Card variant demonstration. Each variant serves a different context in the hierarchy.
          </VantaCard.Body>
        </VantaCard>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Indicators
// ─────────────────────────────────────────────────────────────────────────────

function StatusIndicatorShowcase() {
  return (
    <VantaCard variant="default" corners>
      <VantaCard.Header>
        <VantaCard.Title>STATUS INDICATORS</VantaCard.Title>
      </VantaCard.Header>

      <div className="grid grid-cols-4 gap-4 mt-4">
        <div className="space-y-2">
          <VantaCard.Indicator status="active" label="ACTIVE" />
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
            }}
          >
            Operational
          </div>
        </div>

        <div className="space-y-2">
          <VantaCard.Indicator status="pending" label="PENDING" />
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
            }}
          >
            Processing
          </div>
        </div>

        <div className="space-y-2">
          <VantaCard.Indicator status="inactive" label="INACTIVE" pulse={false} />
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
            }}
          >
            Offline
          </div>
        </div>

        <div className="space-y-2">
          <VantaCard.Indicator status="error" label="ERROR" />
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
            }}
          >
            Failed
          </div>
        </div>
      </div>
    </VantaCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Metrics Card Example
// ─────────────────────────────────────────────────────────────────────────────

function MetricsCardExample() {
  return (
    <VantaCard variant="elevated" corners glow glowColor="cyan">
      <VantaCard.Header>
        <VantaCard.Title>SYSTEM METRICS</VantaCard.Title>
        <VantaCard.Indicator status="active" label="LIVE" />
      </VantaCard.Header>

      <VantaCard.Subtitle>Real-time performance overview</VantaCard.Subtitle>

      <div className="grid grid-cols-4 gap-6">
        <VantaCard.LabelValue label="THROUGHPUT" value="12.4k/s" accent="cyan" />
        <VantaCard.LabelValue label="LATENCY" value="2.3ms" accent="emerald" />
        <VantaCard.LabelValue label="ERROR RATE" value="0.02%" accent="neutral" />
        <VantaCard.LabelValue label="UPTIME" value="99.99%" accent="emerald" />
      </div>

      <VantaCard.Divider />

      <VantaCard.Actions>
        <VantaCard.Action variant="primary">VIEW DETAILS</VantaCard.Action>
        <VantaCard.Action>EXPORT</VantaCard.Action>
        <VantaCard.Action variant="ghost">DISMISS</VantaCard.Action>
      </VantaCard.Actions>
    </VantaCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich Content Card
// ─────────────────────────────────────────────────────────────────────────────

function RichContentCard() {
  return (
    <VantaCard variant="elevated" corners glow glowColor="emerald">
      <VantaCard.Header>
        <VantaCard.Title>DEPLOYMENT STATUS</VantaCard.Title>
        <VantaCard.Indicator status="pending" label="IN PROGRESS" />
      </VantaCard.Header>

      <VantaCard.Subtitle>Production environment • v2.4.1</VantaCard.Subtitle>

      <VantaCard.Body>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} style={{ color: VANTA_COLORS.accent.emerald }} />
            <span>Build completed successfully</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle size={14} style={{ color: VANTA_COLORS.accent.emerald }} />
            <span>Tests passed (142/142)</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} style={{ color: VANTA_COLORS.accent.amber }} />
            <span>Deploying to 3 regions...</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle size={14} style={{ color: VANTA_COLORS.text.muted }} />
            <span style={{ color: VANTA_COLORS.text.muted }}>Health checks pending</span>
          </div>
        </div>
      </VantaCard.Body>

      <VantaCard.Actions>
        <VantaCard.Action variant="ghost">CANCEL</VantaCard.Action>
        <VantaCard.Action>VIEW LOGS</VantaCard.Action>
      </VantaCard.Actions>
    </VantaCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Glow Color Variants
// ─────────────────────────────────────────────────────────────────────────────

function GlowVariants() {
  const glowColors = ['cyan', 'emerald', 'amber', 'rose'] as const

  return (
    <div className="grid grid-cols-4 gap-4">
      {glowColors.map((color) => (
        <VantaCard key={color} variant="compact" glow glowColor={color}>
          <VantaCard.LabelValue
            label="GLOW"
            value={color.toUpperCase()}
            accent={color}
          />
        </VantaCard>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Color Palette Reference
// ─────────────────────────────────────────────────────────────────────────────

function ColorPalette() {
  return (
    <VantaCard variant="default" corners>
      <VantaCard.Header>
        <VantaCard.Title>COLOR PALETTE</VantaCard.Title>
      </VantaCard.Header>

      <div className="grid grid-cols-5 gap-3 mt-4">
        {/* Surfaces */}
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

      <div className="grid grid-cols-5 gap-3">
        {/* Accents */}
        {['cyan', 'emerald', 'amber', 'rose', 'neutral'].map((name) => (
          <div key={name}>
            <div
              style={{
                width: '100%',
                height: '40px',
                backgroundColor: (VANTA_COLORS.accent as Record<string, string>)[name],
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Testbed Component
// ─────────────────────────────────────────────────────────────────────────────

export function VantaCardTestbed() {
  return (
    <div
      className="min-h-screen w-screen"
      style={{ backgroundColor: VANTA_COLORS.surface.void }}
    >
      {/* Header */}
      <header
        className="border-b sticky top-0 z-10"
        style={{
          borderColor: VANTA_COLORS.surface.border,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              style={{ color: VANTA_COLORS.text.muted }}
              className="hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1
                style={{
                  ...VANTA_TYPOGRAPHY.preset.cardTitle,
                  color: VANTA_COLORS.text.primary,
                  fontSize: VANTA_TYPOGRAPHY.size.sm,
                }}
              >
                VantaCard Testbed
              </h1>
              <p
                style={{
                  ...VANTA_TYPOGRAPHY.preset.micro,
                  color: VANTA_COLORS.text.muted,
                  marginTop: '2px',
                }}
              >
                Vantablack Design System Components
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: VANTA_COLORS.accent.emerald }}
            />
            <span
              style={{
                ...VANTA_TYPOGRAPHY.preset.label,
                color: VANTA_COLORS.text.muted,
              }}
            >
              DESIGN SYSTEM ACTIVE
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-12">
        {/* Typography */}
        <section>
          <SectionLabel variant="gradient">Typography</SectionLabel>
          <TypographySpecimen />
        </section>

        {/* Card Variants */}
        <section>
          <SectionLabel variant="gradient">Card Variants</SectionLabel>
          <VariantShowcase />
        </section>

        {/* Status Indicators */}
        <section>
          <SectionLabel variant="gradient">Status Indicators</SectionLabel>
          <StatusIndicatorShowcase />
        </section>

        {/* Glow Variants */}
        <section>
          <SectionLabel variant="gradient">Glow Accents (Hover)</SectionLabel>
          <GlowVariants />
        </section>

        {/* Rich Content Examples */}
        <section>
          <SectionLabel variant="gradient">Rich Content Examples</SectionLabel>
          <div className="grid grid-cols-2 gap-6">
            <MetricsCardExample />
            <RichContentCard />
          </div>
        </section>

        {/* Color Palette */}
        <section>
          <SectionLabel variant="gradient">Color Palette Reference</SectionLabel>
          <ColorPalette />
        </section>
      </main>
    </div>
  )
}
