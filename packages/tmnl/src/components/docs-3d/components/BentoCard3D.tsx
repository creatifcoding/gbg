/**
 * BentoCard3D
 *
 * 3D documentation card using @react-three/uikit with GlassMaterial.
 * Proper flexbox layout, borderBend depth, and hover states.
 *
 * @module docs-3d/components
 */

import { useState } from "react"
import { Container, Text } from "@react-three/uikit"
import { MeshPhysicalMaterial } from "three"
import type { DocCard } from "../machines/docNavigationMachine"

// =============================================================================
// Glass Material (from pmndrs/uikit apfel kit pattern)
// =============================================================================

class GlassMaterial extends MeshPhysicalMaterial {
  constructor() {
    super({
      transmission: 0.4,
      roughness: 0.15,
      reflectivity: 0.4,
      iridescence: 0.3,
      thickness: 0.05,
      specularIntensity: 0.8,
      metalness: 0.2,
      ior: 1.5,
      envMapIntensity: 0.8,
    })
  }
}

// =============================================================================
// Category Colors (hex values for UIKit)
// =============================================================================

const CATEGORY_COLORS: Record<string, {
  bg: string
  bgHover: string
  accent: string
  text: string
  badge: string
}> = {
  architecture: {
    bg: "#1e293b",
    bgHover: "#334155",
    accent: "#3b82f6",
    text: "#93c5fd",
    badge: "#1d4ed8"
  },
  flow: {
    bg: "#14352b",
    bgHover: "#1a4d3e",
    accent: "#22c55e",
    text: "#86efac",
    badge: "#15803d"
  },
  sequence: {
    bg: "#134252",
    bgHover: "#1a5568",
    accent: "#06b6d4",
    text: "#67e8f9",
    badge: "#0e7490"
  },
  state: {
    bg: "#2e1a47",
    bgHover: "#3b2359",
    accent: "#a855f7",
    text: "#d8b4fe",
    badge: "#7e22ce"
  },
  class: {
    bg: "#3d2314",
    bgHover: "#4d2d1a",
    accent: "#f97316",
    text: "#fdba74",
    badge: "#c2410c"
  },
  er: {
    bg: "#3d3214",
    bgHover: "#4d401a",
    accent: "#f59e0b",
    text: "#fcd34d",
    badge: "#b45309"
  },
  guide: {
    bg: "#153d3d",
    bgHover: "#1a4d4d",
    accent: "#14b8a6",
    text: "#5eead4",
    badge: "#0f766e"
  },
}

function getCategoryColors(category: string) {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.guide
}

// =============================================================================
// BentoCard3D Component
// =============================================================================

export interface BentoCard3DProps {
  card: DocCard
  /** Width in UIKit units (pixels when inside Fullscreen) */
  width?: number
  /** Height in UIKit units */
  height?: number
  onSelect: (card: DocCard) => void
}

export function BentoCard3D({
  card,
  width = 280,
  height = 160,
  onSelect,
}: BentoCard3DProps) {
  const [isHovered, setIsHovered] = useState(false)
  const colors = getCategoryColors(card.category)

  return (
    <Container
      width={width}
      height={height}
      backgroundColor={isHovered ? colors.bgHover : colors.bg}
      backgroundOpacity={0.85}
      borderRadius={16}
      borderWidth={1}
      borderColor={isHovered ? colors.accent : colors.bg}
      borderOpacity={isHovered ? 0.6 : 0.3}
      borderBend={-0.2}
      padding={20}
      flexDirection="column"
      justifyContent="space-between"
      cursor="pointer"
      panelMaterialClass={GlassMaterial}
      onHoverChange={setIsHovered}
      onClick={() => onSelect(card)}
    >
      {/* Content Area */}
      <Container flexDirection="column" gap={10}>
        {/* Title */}
        <Text
          fontSize={17}
          fontWeight="bold"
          color={isHovered ? "#ffffff" : "#f1f5f9"}
          letterSpacing={-0.3}
        >
          {card.title}
        </Text>

        {/* Description */}
        <Text
          fontSize={13}
          color={isHovered ? "#cbd5e1" : "#94a3b8"}
          lineHeight={1.4}
          wordBreak="break-word"
        >
          {card.description.length > 90
            ? `${card.description.slice(0, 90)}...`
            : card.description}
        </Text>
      </Container>

      {/* Footer: Category Badge + Arrow */}
      <Container
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        {/* Category Badge */}
        <Container
          backgroundColor={colors.badge}
          backgroundOpacity={0.9}
          borderRadius={6}
          paddingX={10}
          paddingY={5}
        >
          <Text
            fontSize={11}
            fontWeight="bold"
            color={colors.text}
            letterSpacing={0.5}
          >
            {card.category.toUpperCase()}
          </Text>
        </Container>

        {/* Arrow indicator on hover */}
        <Container
          opacity={isHovered ? 1 : 0}
        >
          <Text
            fontSize={14}
            color={colors.accent}
          >
            →
          </Text>
        </Container>
      </Container>
    </Container>
  )
}

export default BentoCard3D
