# Perceptual Motion Blur: Theory & Implementation

> Technical deep-dive into direction-aware motion blur with perceptually-tuned parameters.
> Implementation: `src/lib/drag/hooks/useDragOrchestrator.ts`

---

## 1. The Problem with Linear Mapping

Traditional motion blur implementations use linear velocity-to-blur mapping:

```typescript
// Naive linear approach
blurAmount = velocity * intensity
```

This fails perceptually because:

1. **Human vision is non-linear** - We perceive intensity changes logarithmically (Weber-Fechner Law)
2. **Hard thresholds feel unnatural** - Instant blur onset/offset creates jarring transitions
3. **Over-blur at high velocities** - Linear scaling produces excessive blur at fast speeds
4. **Uniform stretch feels mechanical** - Real motion blur has directional "smear" characteristics

---

## 2. Perceptual Foundations

### 2.1 Weber-Fechner Law

Human perception of stimulus intensity follows a logarithmic relationship:

```
Perceived Intensity ∝ log(Physical Intensity)
```

For motion blur, this means:
- Small velocity changes at low speeds should produce noticeable blur changes
- Large velocity changes at high speeds should produce diminishing blur increases

**Implementation**: Use `sqrt(magnitude)` as a power-law approximation:

```typescript
function perceptualBlur(magnitude: number, intensity: number, maxBlur: number): number {
  const perceptualMagnitude = Math.sqrt(magnitude)
  return Math.min(perceptualMagnitude * intensity, maxBlur)
}
```

**Source**: Weber-Fechner Law - https://en.wikipedia.org/wiki/Weber%E2%80%93Fechner_law

### 2.2 Motion Sharpening vs Motion Blur

Counterintuitively, the human visual system actively **sharpens** moving edges while our finite temporal integration window **smears** them.

> "The results indicate that the deterioration of blur discrimination performance with speed may be due to motion sharpening and not motion blur as has previously been suggested."
> — Hammett ST, "Motion blur and motion sharpening in the human visual system" (1997)

**Implication**: We need to slightly over-blur to counteract the visual system's sharpening response.

**Source**: https://pubmed.ncbi.nlm.nih.gov/9373682/

### 2.3 Temporal Integration Window

Human vision integrates motion signals over approximately 3-6ms under optimal conditions, but practical UI motion occurs over ~16ms frames (60fps).

> "Under optimal conditions, just 3–6 ms of visual stimulation suffices for humans to see motion."
> — Borghuis et al., "Temporal Limits of Visual Motion Processing" (2019)

**Implication**: Our velocity calculation normalizes to 60fps frame units (`dt / 16.67`) for consistent behavior across frame rates.

**Source**: https://mdpi-res.com/d_attachment/vision/vision-03-00005/article_deploy/vision-03-00005.pdf

---

## 3. Implementation Techniques

### 3.1 Smooth Step Function (Hermite Interpolation)

Hard threshold cutoffs create perceptible "popping" artifacts. Smooth step provides an S-curve transition:

```typescript
/**
 * Hermite interpolation for soft thresholds.
 * Returns 0 below edge0, 1 above edge1, smooth S-curve between.
 *
 * The polynomial t²(3-2t) has these properties:
 * - f(0) = 0, f(1) = 1
 * - f'(0) = 0, f'(1) = 0 (zero derivatives at endpoints)
 */
function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
```

**Usage**: Blur factor ramps from 0→1 across threshold range:

```typescript
const blurThreshold = 2  // px/frame
const blurFactor = smoothStep(
  blurThreshold * 0.5,  // Start ramping at 1 px/frame
  blurThreshold * 1.5,  // Full blur at 3 px/frame
  magnitude
)
```

**Source**: https://en.wikipedia.org/wiki/Smoothstep

### 3.2 Velocity Normalization

Raw velocity in px/ms or px/s produces values that don't map well to blur parameters designed for frame-based animation.

**Problem**: At 60fps with 500px/s movement:
- px/s: magnitude ≈ 500 (way too high for intensity * 0.08)
- px/frame: magnitude ≈ 8.3 (reasonable range)

**Solution**: Normalize to ~60fps frame units:

```typescript
const now = performance.now()
const dt = now - lastTimestamp

// Skip noise (< 1ms updates)
if (dt < 1) return

// Normalize: divide by (dt / 16.67) = multiply by (16.67 / dt)
// At exactly 60fps (16.67ms), this is 1:1
// At 120fps (8.33ms), this doubles the velocity (same visual speed)
const frameNormalizer = dt / 16.67
const velocityX = deltaX / frameNormalizer
const velocityY = deltaY / frameNormalizer
```

**Source**: Original motion-tracker.ts implementation, line 171-173

### 3.3 EMA Smoothing (Exponential Moving Average)

Raw velocity is noisy due to pointer event timing jitter. EMA provides smooth tracking:

```typescript
const EMA_ALPHA = 0.3  // Smoothing factor (0-1, higher = more responsive)

// New smoothed value = α * new + (1-α) * old
const smoothedVx = EMA_ALPHA * rawVx + (1 - EMA_ALPHA) * previousSmoothedVx
const smoothedVy = EMA_ALPHA * rawVy + (1 - EMA_ALPHA) * previousSmoothedVy
```

**Trade-off**:
- Higher α (0.5-0.8): More responsive, more noise
- Lower α (0.1-0.3): Smoother, more latency

**Source**: https://en.wikipedia.org/wiki/Exponential_smoothing

### 3.4 Directional Stretch Transform

Motion blur in the direction of movement requires rotating, stretching, then rotating back:

```typescript
// 1. Rotate to align X-axis with motion direction
// 2. Scale X (stretch along motion)
// 3. Rotate back to original orientation
const angleDeg = (angle * 180) / Math.PI
transform = `rotate(${angleDeg}deg) scaleX(${stretchFactor}) rotate(${-angleDeg}deg)`
```

**Visual effect**: Element appears to "smear" along its motion vector.

**Eased stretch factor** using quadratic ease-out:

```typescript
function easedStretch(magnitude: number, threshold: number, maxStretch: number): number {
  const fullStretchVelocity = 30  // px/frame for max stretch
  const normalized = Math.min((magnitude - threshold) / fullStretchVelocity, 1)

  // Quadratic ease-out: 1 - (1-t)²
  // Fast onset, gradual settle - feels "springy"
  const eased = 1 - (1 - normalized) * (1 - normalized)

  return 1 + eased * (maxStretch - 1)
}
```

**Source**: GPU Gems 3, Chapter 27 - https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-27-motion-blur-post-processing-effect

---

## 4. Threshold Strategy

Different effects require different velocity thresholds:

| Effect | Threshold | Rationale |
|--------|-----------|-----------|
| Blur onset | 2 px/frame | Subtle blur at slow drags |
| Stretch onset | 4 px/frame | Directional effect only at faster speeds |
| Minimum filter | 0.3px | Below this, CSS blur has no visible effect |

**Soft threshold range**: threshold × 0.5 → threshold × 1.5

This creates a gradual ramp rather than instant activation.

---

## 5. CSS Filter Performance Notes

### 5.1 GPU Acceleration

CSS `filter: blur()` uses Gaussian blur which is GPU-accelerated in modern browsers. However:

- **Layer promotion**: Elements with filters get their own compositing layer
- **Memory cost**: Each layer consumes GPU memory
- **Repaint scope**: Filter changes trigger layer repaint, not full layout

### 5.2 Transform Compositing

The directional stretch uses `transform` which is highly optimized:

- Transforms are composited on the GPU
- No layout recalculation
- Can animate at 60fps with minimal CPU

**Best practice**: Combine filter and transform in single style update to batch GPU operations.

---

## 6. Configuration Parameters

Default blur configuration:

```typescript
const defaultBlurConfig = {
  maxBlur: 8,           // Maximum blur radius (px)
  intensity: 0.15,      // Blur scaling factor (after sqrt)
  threshold: 2,         // Velocity threshold (px/frame)
  enableStretch: true,  // Enable directional stretch
  maxStretch: 1.05,     // Maximum stretch factor (5% elongation)
  wrapperThreshold: 5,  // Elements before switching to wrapper blur
}
```

### Tuning Guidelines

| Parameter | Lower Value | Higher Value |
|-----------|-------------|--------------|
| `intensity` | Subtle blur, fast drags needed | Aggressive blur, visible at slow speeds |
| `maxBlur` | Crisp at high speed | Very blurry at high speed |
| `threshold` | Blur activates easily | Only fast drags trigger blur |
| `maxStretch` | Minimal elongation | Pronounced "smear" effect |

---

## 7. References

### Academic Sources

1. **Weber-Fechner Law**
   - Wikipedia: https://en.wikipedia.org/wiki/Weber%E2%80%93Fechner_law
   - Relates physical stimulus intensity to perceived intensity

2. **Motion Blur and Motion Sharpening**
   - Hammett ST (1997): https://pubmed.ncbi.nlm.nih.gov/9373682/
   - Human visual system actively sharpens moving edges

3. **Temporal Limits of Visual Motion Processing**
   - Borghuis et al. (2019): https://mdpi-res.com/d_attachment/vision/vision-03-00005/article_deploy/vision-03-00005.pdf
   - 3-6ms minimum for motion perception

4. **Signal Integration in Human Visual Speed Perception**
   - Jogan & Stocker (2015): https://www.jneurosci.org/content/35/25/9381
   - How the brain integrates velocity signals

### Technical Sources

5. **GPU Gems 3, Chapter 27: Motion Blur as Post-Processing**
   - NVIDIA: https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-27-motion-blur-post-processing-effect
   - Velocity buffer and per-pixel blur algorithms

6. **Motion Blur Sample - MJP's Blog**
   - https://mynameismjp.wordpress.com/the-museum/samples-tutorials-tools/motion-blur-sample/
   - Practical implementation techniques

7. **W3C CSS Motion Blur Proposal**
   - Issue #3837: https://github.com/w3c/csswg-drafts/issues/3837
   - Issue #11134: https://github.com/w3c/csswg-drafts/issues/11134
   - Native CSS motion blur proposals

8. **Smooth Step Function**
   - Wikipedia: https://en.wikipedia.org/wiki/Smoothstep
   - Hermite interpolation for S-curve transitions

9. **Easing Functions**
   - Easings.net: https://easings.net/
   - Visual reference for animation curves

---

## 8. File Locations

| File | Purpose |
|------|---------|
| `src/lib/drag/drag-stx.ts` | Velocity calculation, EMA smoothing |
| `src/lib/drag/hooks/useDragOrchestrator.ts` | Perceptual blur math, RAF loop |
| `src/lib/drag/types.ts` | Schema-based types for drag state |
| `src/components/testbed/SelectionTestbed.tsx` | Debug panel for real-time values |

---

## 9. Debug Panel Usage

The `SelectionTestbed` includes a **DRAG DEBUG** panel showing real-time values:

```
DRAG DEBUG
───────────────────────
isDragging: YES/no
elements: N

Velocity:
  magnitude: XX.X
  angle: XX.X°
  smoothed: (X.X, Y.Y)

BlurStyle:
  isActive: YES/no
  blurAmount: X.XXpx
  strategy: individual/wrapper/none
  filter: blur(X.XXpx)
  transform: rotate(...)scaleX(...)rotate(...)
```

**Route**: `/testbed/selection`

Use this to verify:
1. Velocity is being tracked (magnitude > 0 when dragging)
2. Angle changes with drag direction
3. Blur amount responds to velocity (perceptual curve)
4. Transform appears at higher velocities (stretch threshold)
