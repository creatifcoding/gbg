import { useState, useEffect, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { EffectComposer } from "@react-three/postprocessing"
import { OrbitControls } from "@react-three/drei"
import { Vector2 } from "three"
import { AsciiEffect } from "./ascii-effect"

export function AsciiScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState(new Vector2(0, 0))
  const [resolution, setResolution] = useState(new Vector2(1920, 1080))

  // Track mouse position for glow effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        // Flip Y coordinate to match shader UV space (bottom-up instead of top-down)
        const y = rect.height - (e.clientY - rect.top)
        setMousePos(new Vector2(x, y))
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener("mousemove", handleMouseMove)

      // Set initial resolution
      const rect = container.getBoundingClientRect()
      setResolution(new Vector2(rect.width, rect.height))

      // Update resolution on resize
      const handleResize = () => {
        const rect = container.getBoundingClientRect()
        setResolution(new Vector2(rect.width, rect.height))
      }
      window.addEventListener("resize", handleResize)

      return () => {
        container.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("resize", handleResize)
      }
    }
  }, [])

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100vh" }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: "#ffffff" }}
      >
        <color attach="background" args={["#ffffff"]} />


        {/* Lighting */}
        <hemisphereLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={2} />
        <directionalLight position={[-5, 3, -5]} intensity={1.2} />

        {/* 3D Model */}
        <mesh scale={1} rotation={[0, 0, 0]}>
          <torusKnotGeometry args={[0.8, 0.3, 100, 16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.1} />
        </mesh>

        <OrbitControls enableDamping enableZoom={true} />


        {/* ASCII Effect with PostFX */}
        <EffectComposer>
          <AsciiEffect
            style="dense"
            cellSize={4}
            invert={true}
            color={true}
            resolution={resolution}
            mousePos={mousePos}
            postfx={{
              scanlineIntensity: 1,
              scanlineCount: 1000,
              targetFPS: 0,
              jitterIntensity: 0.18,
              jitterSpeed: 0,
              mouseGlowEnabled: false,
              mouseGlowRadius: 200,
              mouseGlowIntensity: 1.5,
              vignetteIntensity: 0,
              vignetteRadius: 0.7,
              colorPalette: 0,
              curvature: 0,
              aberrationStrength: 0.01,
              noiseIntensity: 0.09,
              noiseScale: 1,
              noiseSpeed: 1,
              waveAmplitude: 0,
              waveFrequency: 3,
              waveSpeed: 0,
              glitchIntensity: 0,
              glitchFrequency: 0,
              brightnessAdjust: 0,
              contrastAdjust: 1,
            }}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
