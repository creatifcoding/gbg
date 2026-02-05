'use client'

/**
 * @fileoverview RVN Domain Catalog for CatalogComponents Service
 *
 * RVN brutalist component library mapped to json-render catalog format.
 * Each component has schema + renderer + defaultEntrance.
 *
 * Components organized by category:
 * - Primitives: Button, Input, Checkbox, Dropdown
 * - Display: Badge, StatusDot, TelemetryBar, ThreatMeter, Indicator
 * - Layout: Panel (compound), Card
 * - Feedback: ProgressBar, Alert
 *
 * @module json-render/catalog/rvn-domain-catalog
 */

import { Schema } from 'effect'
import type {
  DomainCatalog,
  ComponentRenderProps,
} from '@/lib/json-render/core/CatalogService'
import type { EntranceAnimation } from '@/lib/json-render/core/animation-schema'

// RVN Components
import {
  RvnButton,
  RvnIconButton,
  RvnInput,
  RvnTextarea,
  RvnCheckbox,
  RvnDropdown,
  RvnBadge,
  RvnStatusDot,
  RvnTelemetryBar,
  RvnThreatMeter,
  RvnIndicator,
  RvnParameterTag,
  RvnPanel,
  RvnCard,
} from '@/lib/rvn'

// =============================================================================
// Prop Schemas - Primitives
// =============================================================================

const RvnButtonPropsSchema = Schema.Struct({
  children: Schema.String,
  variant: Schema.optional(Schema.Literal('default', 'ghost')),
  disabled: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const RvnIconButtonPropsSchema = Schema.Struct({
  children: Schema.String, // Icon character or emoji
  title: Schema.optional(Schema.String),
  variant: Schema.optional(Schema.Literal('default', 'ghost')),
  size: Schema.optional(Schema.Literal('sm', 'md', 'lg')),
  disabled: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const RvnInputPropsSchema = Schema.Struct({
  placeholder: Schema.optional(Schema.String),
  value: Schema.optional(Schema.String),
  disabled: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const RvnTextareaPropsSchema = Schema.Struct({
  placeholder: Schema.optional(Schema.String),
  value: Schema.optional(Schema.String),
  rows: Schema.optional(Schema.Number),
  disabled: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const RvnCheckboxPropsSchema = Schema.Struct({
  label: Schema.String,
  checked: Schema.optional(Schema.Boolean),
  disabled: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const RvnDropdownOptionSchema = Schema.Struct({
  value: Schema.String,
  label: Schema.String,
})

const RvnDropdownPropsSchema = Schema.Struct({
  options: Schema.Array(RvnDropdownOptionSchema),
  value: Schema.optional(Schema.String),
  placeholder: Schema.optional(Schema.String),
  disabled: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

// =============================================================================
// Prop Schemas - Display
// =============================================================================

const RvnBadgePropsSchema = Schema.Struct({
  children: Schema.String,
  variant: Schema.optional(Schema.Literal('default', 'filled')),
  className: Schema.optional(Schema.String),
})

const RvnStatusDotPropsSchema = Schema.Struct({
  status: Schema.Literal('active', 'alert', 'offline'),
  className: Schema.optional(Schema.String),
})

const RvnTelemetryBarPropsSchema = Schema.Struct({
  percentage: Schema.Number,
  showLabel: Schema.optional(Schema.Boolean),
  criticalThreshold: Schema.optional(Schema.Number),
  width: Schema.optional(Schema.Number),
  gradient: Schema.optional(
    Schema.Union(
      Schema.Literal(
        'traffic',
        'trafficInverse',
        'heat',
        'system',
        'alert',
        'cyber',
        'terminal',
        'cool',
        'warm'
      ),
      Schema.Array(
        Schema.Struct({
          stop: Schema.Number,
          color: Schema.String,
        })
      )
    )
  ),
  animation: Schema.optional(
    Schema.Union(
      Schema.Literal(
        'default',
        'fast',
        'slow',
        'spring',
        'springSnappy',
        'springBouncy',
        'elastic',
        'bounce',
        'back',
        'steppedCoarse',
        'steppedFine',
        'cinematic'
      ),
      Schema.Struct({
        spring: Schema.Tuple(
          Schema.Number,
          Schema.Number,
          Schema.Number,
          Schema.Number
        ),
      })
    )
  ),
  className: Schema.optional(Schema.String),
})

const RvnThreatMeterPropsSchema = Schema.Struct({
  level: Schema.Literal('low', 'moderate', 'high', 'critical'),
  showLabel: Schema.optional(Schema.Boolean),
  animation: Schema.optional(
    Schema.Literal(
      'none',
      'fast',
      'smooth',
      'slow',
      'spring',
      'springSnappy',
      'springBouncy',
      'elastic',
      'back',
      'bounce',
      'steppedCoarse',
      'steppedMedium',
      'steppedFine',
      'steppedUltraFine',
      'steppedBinary',
      'tactical',
      'cinematic'
    )
  ),
  className: Schema.optional(Schema.String),
})

const RvnIndicatorPropsSchema = Schema.Struct({
  status: Schema.Literal('active', 'offline'),
  label: Schema.optional(Schema.String),
  className: Schema.optional(Schema.String),
})

const RvnParameterTagPropsSchema = Schema.Struct({
  children: Schema.String,
  className: Schema.optional(Schema.String),
})

// =============================================================================
// Prop Schemas - Layout
// =============================================================================

const RvnPanelPropsSchema = Schema.Struct({
  className: Schema.optional(Schema.String),
})

const RvnPanelHeaderPropsSchema = Schema.Struct({
  className: Schema.optional(Schema.String),
})

const RvnPanelTitlePropsSchema = Schema.Struct({
  children: Schema.String,
  className: Schema.optional(Schema.String),
})

const RvnPanelSubtitlePropsSchema = Schema.Struct({
  children: Schema.String,
  className: Schema.optional(Schema.String),
})

const RvnPanelContentPropsSchema = Schema.Struct({
  noPadding: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const RvnPanelFooterPropsSchema = Schema.Struct({
  className: Schema.optional(Schema.String),
})

const RvnCardPropsSchema = Schema.Struct({
  variant: Schema.optional(Schema.Literal('default', 'equipment', 'unit', 'intel', 'threat')),
  shadow: Schema.optional(Schema.Literal('default', 'lg', 'none')),
  className: Schema.optional(Schema.String),
})

// =============================================================================
// Renderers - Primitives
// =============================================================================

function RvnButtonRenderer({ element, onAction }: ComponentRenderProps) {
  return (
    <RvnButton
      variant={
        (element.props['variant'] as 'default' | 'ghost') ?? 'default'
      }
      disabled={element.props['disabled'] as boolean}
      className={element.props['className'] as string}
      onClick={() => {
        if (element.props['action'] && onAction) {
          onAction(element.props['action'] as never)
        }
      }}
    >
      {element.props['children'] as string}
    </RvnButton>
  )
}

function RvnIconButtonRenderer({ element, onAction }: ComponentRenderProps) {
  return (
    <RvnIconButton
      title={element.props['title'] as string}
      variant={element.props['variant'] as 'default' | 'ghost'}
      size={element.props['size'] as 'sm' | 'md' | 'lg'}
      disabled={element.props['disabled'] as boolean}
      className={element.props['className'] as string}
      onClick={() => {
        if (element.props['action'] && onAction) {
          onAction(element.props['action'] as never)
        }
      }}
    >
      {element.props['children'] as string}
    </RvnIconButton>
  )
}

function RvnInputRenderer({ element }: ComponentRenderProps) {
  return (
    <RvnInput
      placeholder={element.props['placeholder'] as string}
      defaultValue={element.props['value'] as string}
      disabled={element.props['disabled'] as boolean}
      className={element.props['className'] as string}
    />
  )
}

function RvnTextareaRenderer({ element }: ComponentRenderProps) {
  return (
    <RvnTextarea
      placeholder={element.props['placeholder'] as string}
      defaultValue={element.props['value'] as string}
      rows={element.props['rows'] as number}
      disabled={element.props['disabled'] as boolean}
      className={element.props['className'] as string}
    />
  )
}

function RvnCheckboxRenderer({ element }: ComponentRenderProps) {
  return (
    <RvnCheckbox
      label={element.props['label'] as string}
      defaultChecked={element.props['checked'] as boolean}
      disabled={element.props['disabled'] as boolean}
      className={element.props['className'] as string}
    />
  )
}

function RvnDropdownRenderer({ element }: ComponentRenderProps) {
  const options = element.props['options'] as Array<{
    value: string
    label: string
  }>
  return (
    <RvnDropdown
      options={options ?? []}
      defaultValue={element.props['value'] as string}
      disabled={element.props['disabled'] as boolean}
      className={element.props['className'] as string}
    />
  )
}

// =============================================================================
// Renderers - Display
// =============================================================================

function RvnBadgeRenderer({ element }: ComponentRenderProps) {
  return (
    <RvnBadge
      variant={element.props['variant'] as 'default' | 'filled'}
      className={element.props['className'] as string}
    >
      {element.props['children'] as string}
    </RvnBadge>
  )
}

function RvnStatusDotRenderer({ element }: ComponentRenderProps) {
  return (
    <RvnStatusDot
      status={element.props['status'] as 'active' | 'alert' | 'offline'}
      className={element.props['className'] as string}
    />
  )
}

function RvnTelemetryBarRenderer({ element }: ComponentRenderProps) {
  // Type-safe gradient and animation casting
  type GradientPreset = 'traffic' | 'trafficInverse' | 'heat' | 'system' | 'alert' | 'cyber' | 'terminal' | 'cool' | 'warm'
  type AnimationPreset = 'fast' | 'slow' | 'spring' | 'springSnappy' | 'springBouncy' | 'elastic' | 'bounce' | 'back' | 'steppedCoarse' | 'steppedFine' | 'cinematic'

  return (
    <RvnTelemetryBar
      percentage={element.props['percentage'] as number}
      showLabel={element.props['showLabel'] as boolean}
      criticalThreshold={element.props['criticalThreshold'] as number}
      width={element.props['width'] as number}
      gradient={element.props['gradient'] as GradientPreset | undefined}
      animation={element.props['animation'] as AnimationPreset | undefined}
      className={element.props['className'] as string}
    />
  )
}

function RvnThreatMeterRenderer({ element }: ComponentRenderProps) {
  // BarAnimationPreset type from useAnimatedValue (all valid presets)
  type ThreatAnimationPreset = 'none' | 'fast' | 'smooth' | 'slow' | 'spring' | 'springSnappy' | 'springBouncy' | 'elastic' | 'back' | 'bounce' | 'steppedCoarse' | 'steppedMedium' | 'steppedFine' | 'steppedUltraFine' | 'steppedBinary' | 'tactical' | 'cinematic'

  return (
    <RvnThreatMeter
      level={
        element.props['level'] as 'low' | 'moderate' | 'high' | 'critical'
      }
      showLabel={element.props['showLabel'] as boolean}
      animation={element.props['animation'] as ThreatAnimationPreset | undefined}
      className={element.props['className'] as string}
    />
  )
}

function RvnIndicatorRenderer({ element }: ComponentRenderProps) {
  return (
    <RvnIndicator
      status={element.props['status'] as 'active' | 'offline'}
      label={element.props['label'] as string}
      className={element.props['className'] as string}
    />
  )
}

function RvnParameterTagRenderer({ element }: ComponentRenderProps) {
  return (
    <RvnParameterTag className={element.props['className'] as string}>
      {element.props['children'] as string}
    </RvnParameterTag>
  )
}

// =============================================================================
// Renderers - Layout
// =============================================================================

function RvnPanelRenderer({ element, children }: ComponentRenderProps) {
  return (
    <RvnPanel.Root
      className={element.props['className'] as string}
      style={element.props['style'] as React.CSSProperties}
    >
      {children}
    </RvnPanel.Root>
  )
}

function RvnPanelHeaderRenderer({ element, children }: ComponentRenderProps) {
  return (
    <RvnPanel.Header className={element.props['className'] as string}>
      {children}
    </RvnPanel.Header>
  )
}

function RvnPanelTitleRenderer({ element }: ComponentRenderProps) {
  return (
    <RvnPanel.Title className={element.props['className'] as string}>
      {element.props['children'] as string}
    </RvnPanel.Title>
  )
}

function RvnPanelSubtitleRenderer({ element }: ComponentRenderProps) {
  return (
    <RvnPanel.Subtitle className={element.props['className'] as string}>
      {element.props['children'] as string}
    </RvnPanel.Subtitle>
  )
}

function RvnPanelContentRenderer({ element, children }: ComponentRenderProps) {
  return (
    <RvnPanel.Content
      noPadding={element.props['noPadding'] as boolean}
      className={element.props['className'] as string}
    >
      {children}
    </RvnPanel.Content>
  )
}

function RvnPanelFooterRenderer({ element, children }: ComponentRenderProps) {
  return (
    <RvnPanel.Footer className={element.props['className'] as string}>
      {children}
    </RvnPanel.Footer>
  )
}

function RvnCardRenderer({ element, children }: ComponentRenderProps) {
  return (
    <RvnCard
      variant={
        element.props['variant'] as
          | 'default'
          | 'equipment'
          | 'unit'
          | 'intel'
          | 'threat'
      }
      shadow={element.props['shadow'] as 'default' | 'lg' | 'none'}
      className={element.props['className'] as string}
      style={element.props['style'] as React.CSSProperties}
    >
      {children}
    </RvnCard>
  )
}

// =============================================================================
// Default Entrance Animations
// =============================================================================

const defaultAnimations = {
  /** Interactive elements - snappy */
  interactive: {
    property: 'opacity+scale',
    easing: 'out-quart',
    duration: 'fast',
  } satisfies EntranceAnimation,

  /** Display elements - fade in */
  display: {
    property: 'opacity',
    easing: 'out-quad',
    duration: 'fast',
  } satisfies EntranceAnimation,

  /** Bars/meters - slide from left */
  meter: {
    property: 'opacity+translateX',
    easing: 'out-cubic',
    duration: 'normal',
  } satisfies EntranceAnimation,

  /** Cards/panels - lift from below */
  container: {
    property: 'opacity+translateY',
    easing: 'out-cubic',
    duration: 'normal',
  } satisfies EntranceAnimation,

  /** Layout parts - subtle fade */
  layoutPart: {
    property: 'opacity',
    easing: 'out-quad',
    duration: 'fast',
  } satisfies EntranceAnimation,
}

// =============================================================================
// Domain Catalog Export
// =============================================================================

/**
 * RVN Domain Catalog
 *
 * Brutalist component library for tactical/industrial interfaces.
 * All components follow RVN design language:
 * - 3px solid black borders
 * - 4px 4px box-shadow (removed on press)
 * - Sharp corners
 * - Uppercase labels
 * - 12px minimum font size
 */
export const rvnDomainCatalog: DomainCatalog = {
  name: 'RVN Brutalist',
  components: {
    // ═══════════════════════════════════════════════════════════════════════════
    // PRIMITIVES
    // ═══════════════════════════════════════════════════════════════════════════
    'RvnButton': {
      schema: RvnButtonPropsSchema,
      renderer: RvnButtonRenderer,
      description:
        'Brutalist button with 3px black border. Variants: default (filled), ghost (outlined). Press state removes box-shadow.',
      hasChildren: false,
      defaultEntrance: defaultAnimations.interactive,
    },
    'RvnIconButton': {
      schema: RvnIconButtonPropsSchema,
      renderer: RvnIconButtonRenderer,
      description:
        'Square icon button. Use for actions like close (✕), expand (⤢), etc. Sizes: sm (28px), md (36px), lg (44px).',
      hasChildren: false,
      defaultEntrance: defaultAnimations.interactive,
    },
    'RvnInput': {
      schema: RvnInputPropsSchema,
      renderer: RvnInputRenderer,
      description:
        'Text input with brutalist styling. Monospace font, 3px black border.',
      hasChildren: false,
      defaultEntrance: defaultAnimations.interactive,
    },
    'RvnTextarea': {
      schema: RvnTextareaPropsSchema,
      renderer: RvnTextareaRenderer,
      description: 'Multi-line text input. Resizable by default.',
      hasChildren: false,
      defaultEntrance: defaultAnimations.interactive,
    },
    'RvnCheckbox': {
      schema: RvnCheckboxPropsSchema,
      renderer: RvnCheckboxRenderer,
      description:
        'Checkbox with label. When checked, shows filled square or checkmark.',
      hasChildren: false,
      defaultEntrance: defaultAnimations.interactive,
    },
    'RvnDropdown': {
      schema: RvnDropdownPropsSchema,
      renderer: RvnDropdownRenderer,
      description:
        'Select dropdown with options. Native select element with RVN styling.',
      hasChildren: false,
      defaultEntrance: defaultAnimations.interactive,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // DISPLAY
    // ═══════════════════════════════════════════════════════════════════════════
    'RvnBadge': {
      schema: RvnBadgePropsSchema,
      renderer: RvnBadgeRenderer,
      description:
        'Inline label badge. Variants: default (outlined), filled (solid background).',
      hasChildren: false,
      defaultEntrance: defaultAnimations.display,
    },
    'RvnStatusDot': {
      schema: RvnStatusDotPropsSchema,
      renderer: RvnStatusDotRenderer,
      description:
        'Binary status indicator dot. Status: active (green), alert (amber), offline (gray).',
      hasChildren: false,
      defaultEntrance: defaultAnimations.display,
    },
    'RvnTelemetryBar': {
      schema: RvnTelemetryBarPropsSchema,
      renderer: RvnTelemetryBarRenderer,
      description:
        'Animated progress/percentage bar with optional gradient. Supports multiple animation easings including spring physics. Use criticalThreshold for danger state (diagonal stripes).',
      hasChildren: false,
      defaultEntrance: defaultAnimations.meter,
    },
    'RvnThreatMeter': {
      schema: RvnThreatMeterPropsSchema,
      renderer: RvnThreatMeterRenderer,
      description:
        'Four-segment threat level meter. Levels: low (1 green), moderate (2 yellow), high (3 orange), critical (4 red). Animated segment highlighting.',
      hasChildren: false,
      defaultEntrance: defaultAnimations.meter,
    },
    'RvnIndicator': {
      schema: RvnIndicatorPropsSchema,
      renderer: RvnIndicatorRenderer,
      description:
        'Status dot combined with optional label. Use for connection/online status.',
      hasChildren: false,
      defaultEntrance: defaultAnimations.display,
    },
    'RvnParameterTag': {
      schema: RvnParameterTagPropsSchema,
      renderer: RvnParameterTagRenderer,
      description:
        'Monospace parameter tag for mission/system identifiers. Example: TX-99-ALPHA.',
      hasChildren: false,
      defaultEntrance: defaultAnimations.display,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // LAYOUT - Panel (Compound Component)
    // ═══════════════════════════════════════════════════════════════════════════
    'RvnPanel': {
      schema: RvnPanelPropsSchema,
      renderer: RvnPanelRenderer,
      description:
        'Compound panel container. Use with RvnPanelHeader, RvnPanelTitle, RvnPanelSubtitle, RvnPanelContent, RvnPanelFooter as children.',
      hasChildren: true,
      defaultEntrance: defaultAnimations.container,
    },
    'RvnPanelHeader': {
      schema: RvnPanelHeaderPropsSchema,
      renderer: RvnPanelHeaderRenderer,
      description: 'Panel header section with black background. Contains Title and Subtitle.',
      hasChildren: true,
      defaultEntrance: defaultAnimations.layoutPart,
    },
    'RvnPanelTitle': {
      schema: RvnPanelTitlePropsSchema,
      renderer: RvnPanelTitleRenderer,
      description: 'Panel title text. Bold, uppercase.',
      hasChildren: false,
      defaultEntrance: defaultAnimations.layoutPart,
    },
    'RvnPanelSubtitle': {
      schema: RvnPanelSubtitlePropsSchema,
      renderer: RvnPanelSubtitleRenderer,
      description: 'Panel subtitle text. Lighter weight, smaller.',
      hasChildren: false,
      defaultEntrance: defaultAnimations.layoutPart,
    },
    'RvnPanelContent': {
      schema: RvnPanelContentPropsSchema,
      renderer: RvnPanelContentRenderer,
      description: 'Panel body content area. Has padding by default (use noPadding to remove).',
      hasChildren: true,
      defaultEntrance: defaultAnimations.layoutPart,
    },
    'RvnPanelFooter': {
      schema: RvnPanelFooterPropsSchema,
      renderer: RvnPanelFooterRenderer,
      description: 'Panel footer section. Typically contains coordinates, timestamps, or actions.',
      hasChildren: true,
      defaultEntrance: defaultAnimations.layoutPart,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // LAYOUT - Card
    // ═══════════════════════════════════════════════════════════════════════════
    'RvnCard': {
      schema: RvnCardPropsSchema,
      renderer: RvnCardRenderer,
      description:
        'Versatile card container. Variants: default, equipment, unit, intel, threat. Shadow sizes: sm (2px), md (4px), lg (6px), none.',
      hasChildren: true,
      defaultEntrance: defaultAnimations.container,
    },
  },
}
