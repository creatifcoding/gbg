/**
 * KORI R3F Entity Canvas
 *
 * 3D visualization of entities using react-three-fiber.
 * Entities rendered as instanced meshes with color coding by trait.
 *
 * @module
 */

import { useRef, useMemo, useEffect } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Grid, Text, Billboard } from "@react-three/drei"
import * as THREE from "three"

import { useStxData, useStx } from "@/lib/stx"
import { getKoriTestbedStx, type EntityDisplay } from "../kori-testbed-stx"

// =============================================================================
// Constants
// =============================================================================

const TRAIT_COLORS: Record<string, string> = {
  Position2D: "#06b6d4", // cyan
  Position3D: "#8b5cf6", // violet
  Health: "#22c55e", // green
  Name: "#f59e0b", // amber
  IsPlayer: "#3b82f6", // blue
  IsEnemy: "#ef4444", // red
  IsActive: "#84cc16", // lime
  default: "#6b7280", // gray
}

// =============================================================================
// Entity Mesh
// =============================================================================

interface EntityMeshProps {
  entity: EntityDisplay
  isSelected: boolean
  onClick: () => void
}

function EntityMesh({ entity, isSelected, onClick }: EntityMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Get position from entity
  const x = entity.position?.x ?? 0
  const y = entity.position?.y ?? 0
  const z = entity.position?.z ?? 0

  // Scale position to reasonable canvas size
  const scaledX = x * 0.1
  const scaledY = y * 0.1
  const scaledZ = z * 0.1

  // Determine color based on primary trait
  const primaryTrait = entity.traits[0] ?? "default"
  const color = TRAIT_COLORS[primaryTrait] ?? TRAIT_COLORS.default

  // Health affects scale
  const healthScale = entity.health
    ? 0.3 + (entity.health.current / entity.health.max) * 0.7
    : 1

  // Animate selected entity
  useFrame((_, delta) => {
    if (meshRef.current && isSelected) {
      meshRef.current.rotation.y += delta * 2
    }
  })

  return (
    <group position={[scaledX, scaledZ, scaledY]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        scale={[healthScale * 0.3, healthScale * 0.3, healthScale * 0.3]}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={isSelected ? color : "#000000"}
          emissiveIntensity={isSelected ? 0.5 : 0}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.5, 32]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Entity label */}
      <Billboard follow position={[0, 0.6, 0]}>
        <Text
          fontSize={0.15}
          color={isSelected ? "#06b6d4" : "#9ca3af"}
          anchorX="center"
          anchorY="bottom"
        >
          {entity.name || entity.id.slice(0, 6)}
        </Text>
      </Billboard>
    </group>
  )
}

// =============================================================================
// Scene Content
// =============================================================================

function SceneContent() {
  const testbed = getKoriTestbedStx()
  const { runEffect } = useStx(testbed)

  const entities = useStxData(testbed, (d) => d.entities.get())
  const selectedId = useStxData(testbed, (d) => d.selectedEntityId.get())

  const handleSelect = (id: string) => {
    runEffect("selectEntity", id)
  }

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[-10, -10, -5]} intensity={0.3} color="#06b6d4" />

      {/* Ground grid */}
      <Grid
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#374151"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#4b5563"
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid
        position={[0, -0.01, 0]}
      />

      {/* Entities */}
      {entities.map((entity) => (
        <EntityMesh
          key={entity.id}
          entity={entity as EntityDisplay}
          isSelected={entity.id === selectedId}
          onClick={() => handleSelect(entity.id)}
        />
      ))}

      {/* Empty state indicator */}
      {entities.length === 0 && (
        <Billboard follow position={[0, 1, 0]}>
          <Text fontSize={0.3} color="#6b7280" anchorX="center" anchorY="center">
            No entities
          </Text>
          <Text
            fontSize={0.15}
            color="#4b5563"
            anchorX="center"
            anchorY="top"
            position={[0, -0.2, 0]}
          >
            Use REPL: :spawn
          </Text>
        </Billboard>
      )}

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={2}
        maxDistance={50}
      />
    </>
  )
}

// =============================================================================
// Legend
// =============================================================================

function Legend() {
  const traits = Object.entries(TRAIT_COLORS).filter(([k]) => k !== "default")

  return (
    <div
      className="absolute bottom-2 left-2 bg-neutral-900/80 border border-neutral-800 rounded p-2"
      style={{ fontSize: "10px" }}
    >
      <div className="text-neutral-500 mb-1 font-mono">TRAIT COLORS</div>
      <div className="space-y-0.5">
        {traits.map(([trait, color]) => (
          <div key={trait} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-neutral-400 font-mono">{trait}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Stats Overlay
// =============================================================================

function StatsOverlay() {
  const testbed = getKoriTestbedStx()
  const entities = useStxData(testbed, (d) => d.entities.get())
  const selectedId = useStxData(testbed, (d) => d.selectedEntityId.get())

  return (
    <div
      className="absolute top-2 left-2 bg-neutral-900/80 border border-neutral-800 rounded p-2"
      style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
    >
      <div className="font-mono text-neutral-400">
        Entities: <span className="text-cyan-400">{entities.length}</span>
      </div>
      {selectedId && (
        <div className="font-mono text-neutral-400">
          Selected: <span className="text-cyan-400">{selectedId.slice(0, 8)}...</span>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function EntityCanvas() {
  return (
    <div className="relative w-full h-full bg-neutral-950">
      <Canvas
        camera={{ position: [5, 5, 5], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#0a0a0a" }}
      >
        <color attach="background" args={["#0a0a0a"]} />
        <fog attach="fog" args={["#0a0a0a", 15, 40]} />
        <SceneContent />
      </Canvas>

      {/* Overlays */}
      <StatsOverlay />
      <Legend />

      {/* Instructions */}
      <div
        className="absolute bottom-2 right-2 text-neutral-600 font-mono"
        style={{ fontSize: "10px" }}
      >
        Drag to rotate • Scroll to zoom • Click entity to select
      </div>
    </div>
  )
}
