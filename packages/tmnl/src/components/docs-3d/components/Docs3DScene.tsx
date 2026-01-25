/**
 * Docs3DScene - Dark Side Document Grid
 *
 * Pure black void. White light. Chromatic aberration disperses
 * on hover/click like light through a prism.
 *
 * @module docs-3d/components
 */

import { useRef, useState, useEffect, useMemo, forwardRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Text, Line } from "@react-three/drei"
import { EffectComposer } from "@react-three/postprocessing"
import { Effect, BlendFunction } from "postprocessing"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import * as THREE from "three"
import { Uniform } from "three"
import type { DocCard } from "../machines/docNavigationMachine"
import {
  cardsAtom,
  searchQueryAtom,
  categoryFilterAtom,
  selectedCardAtom,
  filteredCardsAtom,
} from "../atoms"

// =============================================================================
// Dark Side Palette
// =============================================================================

const C = {
  bg: "#000000",
  line: "#1a1a1a",
  lineHover: "#2a2a2a",
  text: "#666666",
  textHover: "#ffffff",
  accent: "#ffffff",
}

// =============================================================================
// Chromatic Aberration Shader
// =============================================================================

const chromaticAberrationShader = `
uniform float offset;
uniform float intensity;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Simple horizontal RGB split - fast and clean
  float aberration = offset * intensity;

  float r = texture(inputBuffer, uv + vec2(aberration, 0.0)).r;
  float g = texture(inputBuffer, uv).g;
  float b = texture(inputBuffer, uv - vec2(aberration, 0.0)).b;

  outputColor = vec4(r, g, b, inputColor.a);
}
`

// Module state for aberration animation
let _aberrationIntensity = 1.0
let _targetIntensity = 0.3

class ChromaticAberrationImpl extends Effect {
  constructor() {
    super("ChromaticAberration", chromaticAberrationShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ["offset", new Uniform(0.004)],
        ["intensity", new Uniform(1.0)],
      ])
    })
  }

  update(_renderer: unknown, _inputBuffer: unknown, deltaTime: number) {
    // Smooth intensity transition (fast decay)
    _aberrationIntensity += (_targetIntensity - _aberrationIntensity) * deltaTime * 4

    const intensityUniform = this.uniforms.get("intensity") as Uniform<number>
    if (intensityUniform) intensityUniform.value = _aberrationIntensity
  }
}

interface ChromaticAberrationProps {
  /** Initial intensity burst (0-1), decays to resting */
  burstIntensity?: number
  /** Resting intensity after decay (0-1) */
  restingIntensity?: number
}

const ChromaticAberration = forwardRef<ChromaticAberrationImpl, ChromaticAberrationProps>(
  ({ burstIntensity = 1.0, restingIntensity = 0.3 }, ref) => {
    // Set target intensity on mount - starts high, decays to resting
    useEffect(() => {
      _aberrationIntensity = burstIntensity
      _targetIntensity = restingIntensity
    }, [burstIntensity, restingIntensity])

    const effect = useMemo(() => new ChromaticAberrationImpl(), [])

    return <primitive ref={ref} object={effect} dispose={null} />
  }
)

ChromaticAberration.displayName = "ChromaticAberration"

// Hook to trigger aberration burst (e.g., on hover)
function useAberrationBurst() {
  return {
    burst: (intensity = 0.8) => {
      _aberrationIntensity = intensity
    }
  }
}

// =============================================================================
// Grid Config
// =============================================================================

const GRID = {
  cols: 3,
  cellW: 3.2,
  cellH: 1.2,
  gap: 0.15,
}

// =============================================================================
// Document Card - Minimal
// =============================================================================

interface CardProps {
  card: DocCard
  position: [number, number, number]
  index: number
  onSelect: (card: DocCard) => void
}

function Card({ card, position, index, onSelect }: CardProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(false)
  const { burst } = useAberrationBurst()

  // Staggered entrance with aberration burst
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(true)
      // Small burst when card appears
      burst(0.5 + (index * 0.05))
    }, index * 60)
    return () => clearTimeout(t)
  }, [index, burst])

  // Animate
  useFrame((_, delta) => {
    if (!groupRef.current) return
    const targetOpacity = visible ? 1 : 0
    const targetX = visible ? position[0] : position[0] - 0.5

    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      targetX,
      delta * 4
    )
  })

  const lineColor = hovered ? C.lineHover : C.line
  const textColor = hovered ? C.textHover : C.text

  // Card outline points
  const w = GRID.cellW
  const h = GRID.cellH
  const outline: [number, number, number][] = [
    [-w/2, -h/2, 0],
    [w/2, -h/2, 0],
    [w/2, h/2, 0],
    [-w/2, h/2, 0],
    [-w/2, -h/2, 0],
  ]

  return (
    <group
      ref={groupRef}
      position={[position[0] - 0.5, position[1], position[2]]}
      onClick={() => {
        burst(0.9)
        onSelect(card)
      }}
      onPointerOver={() => {
        setHovered(true)
        burst(0.6)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Invisible hitbox for pointer events */}
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Outline */}
      <Line
        points={outline}
        color={lineColor}
        lineWidth={hovered ? 1.5 : 1}
        transparent
        opacity={visible ? (hovered ? 1 : 0.5) : 0}
      />

      {/* Left accent line on hover */}
      {hovered && (
        <Line
          points={[[-w/2, -h/2 + 0.1, 0], [-w/2, h/2 - 0.1, 0]]}
          color={C.accent}
          lineWidth={2}
        />
      )}

      {/* Title */}
      <Text
        position={[-w/2 + 0.15, 0.25, 0]}
        fontSize={0.14}
        anchorX="left"
        anchorY="middle"
        color={textColor}
        font="/fonts/inter-medium.woff"
        visible={visible}
      >
        {card.title}
      </Text>

      {/* Category */}
      <Text
        position={[-w/2 + 0.15, -0.15, 0]}
        fontSize={0.08}
        anchorX="left"
        anchorY="middle"
        color={hovered ? C.accent : C.text}
        font="/fonts/inter-regular.woff"
        visible={visible}
      >
        {card.category}
      </Text>

      {/* Arrow on hover */}
      <Text
        position={[w/2 - 0.15, 0, 0]}
        fontSize={0.12}
        anchorX="right"
        anchorY="middle"
        color={C.accent}
        visible={hovered}
      >
        →
      </Text>
    </group>
  )
}

// =============================================================================
// Scene
// =============================================================================

function Scene() {
  const cards = useAtomValue(filteredCardsAtom)
  const setSelectedCard = useAtomSet(selectedCardAtom)

  const handleSelect = (card: DocCard) => {
    setSelectedCard(card)
    if (card.route) window.location.href = card.route
  }

  const getPosition = (i: number): [number, number, number] => {
    const col = i % GRID.cols
    const row = Math.floor(i / GRID.cols)

    const totalW = GRID.cols * (GRID.cellW + GRID.gap) - GRID.gap
    const x = col * (GRID.cellW + GRID.gap) - totalW / 2 + GRID.cellW / 2
    const y = -row * (GRID.cellH + GRID.gap)

    return [x, y, 0]
  }

  return (
    <>
      <ambientLight intensity={1} />

      {cards.map((card, i) => (
        <Card
          key={card.id}
          card={card}
          position={getPosition(i)}
          index={i}
          onSelect={handleSelect}
        />
      ))}

      {cards.length === 0 && (
        <Text
          position={[0, 0, 0]}
          fontSize={0.15}
          color={C.text}
          anchorX="center"
        >
          No results
        </Text>
      )}
    </>
  )
}

// =============================================================================
// Search
// =============================================================================

function Search() {
  const query = useAtomValue(searchQueryAtom)
  const setQuery = useAtomSet(searchQueryAtom)
  const cards = useAtomValue(filteredCardsAtom)

  return (
    <div className="absolute top-6 left-6 z-10">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search"
        className="
          w-48 px-0 py-1
          bg-transparent
          border-b border-neutral-900
          text-neutral-500 placeholder-neutral-800
          text-sm font-light tracking-widest
          focus:outline-none focus:border-neutral-700
          transition-colors
        "
      />
      <div className="mt-2 text-xs text-neutral-800 tracking-widest font-mono">
        {cards.length} DOCS
      </div>
    </div>
  )
}

// =============================================================================
// Export
// =============================================================================

export interface Docs3DSceneProps {
  cards?: readonly DocCard[]
  searchQuery?: string
  categoryFilter?: string | null
  onSelectCard?: (card: DocCard) => void
}

export function Docs3DScene({ cards, searchQuery, categoryFilter }: Docs3DSceneProps) {
  const setCards = useAtomSet(cardsAtom)
  const setQuery = useAtomSet(searchQueryAtom)
  const setFilter = useAtomSet(categoryFilterAtom)

  if (cards) setCards(cards)
  if (searchQuery !== undefined) setQuery(searchQuery)
  if (categoryFilter !== undefined) setFilter(categoryFilter)

  return (
    <div className="relative w-full h-full bg-black">
      <Search />
      <Canvas
        orthographic
        camera={{ zoom: 100, position: [0, 0, 10] }}
        style={{ background: "#000000" }}
        gl={{ antialias: true, alpha: false }}
      >
        <Scene />
        <EffectComposer>
          <ChromaticAberration
            burstIntensity={1.0}
            restingIntensity={0.25}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}

export default Docs3DScene
