/**
 * D3 Gauge
 *
 * Buffer fill percentage / progress indicator.
 *
 * @module
 */

import { useRef, useEffect } from 'react'
import * as d3 from 'd3'

// =============================================================================
// TYPES
// =============================================================================

export interface D3GaugeProps {
  /** Current value (0-100) */
  value: number
  /** Max value (default: 100) */
  max?: number
  /** Gauge size */
  size?: number
  /** Label text */
  label?: string
  /** Color based on value thresholds */
  colorScale?: {
    low: string
    medium: string
    high: string
  }
  /** Threshold percentages */
  thresholds?: {
    medium: number
    high: number
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_COLORS = {
  low: '#22c55e', // green-500
  medium: '#f59e0b', // amber-500
  high: '#ef4444', // red-500
}

const DEFAULT_THRESHOLDS = {
  medium: 50,
  high: 80,
}

// =============================================================================
// D3 GAUGE
// =============================================================================

/**
 * Semi-circular gauge using D3.
 *
 * Features:
 * - Color changes based on thresholds
 * - Smooth arc transitions
 * - Center value display
 */
export function D3Gauge({
  value,
  max = 100,
  size = 120,
  label = 'Buffer',
  colorScale = DEFAULT_COLORS,
  thresholds = DEFAULT_THRESHOLDS,
}: D3GaugeProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const initialized = useRef(false)

  // Clamp value
  const clampedValue = Math.max(0, Math.min(value, max))
  const percentage = (clampedValue / max) * 100

  // Get color based on value
  const getColor = () => {
    if (percentage >= thresholds.high) return colorScale.high
    if (percentage >= thresholds.medium) return colorScale.medium
    return colorScale.low
  }

  // Initialize structure
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    const radius = size / 2 - 10

    // Clear and setup
    svg.selectAll('*').remove()

    // Center group
    const g = svg
      .append('g')
      .attr('transform', `translate(${size / 2},${size / 2 + 10})`)

    // Background arc
    const backgroundArc = d3
      .arc<unknown>()
      .innerRadius(radius - 15)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(Math.PI / 2)

    g.append('path')
      .attr('class', 'background-arc')
      .attr('d', backgroundArc)
      .attr('fill', '#262626')

    // Value arc
    g.append('path')
      .attr('class', 'value-arc')
      .attr('fill', getColor())

    // Value text
    g.append('text')
      .attr('class', 'value-text')
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .style('fill', '#e5e5e5')
      .style('font-size', '24px')
      .style('font-weight', 'bold')
      .style('font-family', 'monospace')

    // Label
    g.append('text')
      .attr('class', 'label-text')
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('fill', '#737373')
      .style('font-size', '10px')
      .style('font-family', 'monospace')
      .style('text-transform', 'uppercase')
      .text(label)

    initialized.current = true
  }, [size, label])

  // Update value
  useEffect(() => {
    if (!svgRef.current || !initialized.current) return

    const svg = d3.select(svgRef.current)
    const g = svg.select('g')
    const radius = size / 2 - 10

    // Arc generator
    const arcGenerator = d3
      .arc<{ endAngle: number }>()
      .innerRadius(radius - 15)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)

    // Interpolate arc
    const angle = -Math.PI / 2 + (percentage / 100) * Math.PI

    g.select<SVGPathElement>('.value-arc')
      .transition()
      .duration(300)
      .attrTween('d', function () {
        const currentAngle = this.getAttribute('data-angle')
          ? parseFloat(this.getAttribute('data-angle')!)
          : -Math.PI / 2

        const interpolate = d3.interpolate(currentAngle, angle)

        return (t) => {
          const newAngle = interpolate(t)
          return arcGenerator({ endAngle: newAngle }) || ''
        }
      })
      .attr('data-angle', angle.toString())
      .attr('fill', getColor())

    // Update value text
    g.select('.value-text')
      .transition()
      .duration(300)
      .tween('text', function () {
        const currentValue = parseFloat(this.textContent || '0')
        const interpolate = d3.interpolate(currentValue, percentage)
        return function (t) {
          ;(this as SVGTextElement).textContent = `${Math.round(interpolate(t))}%`
        }
      })
  }, [percentage, size])

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size / 2 + 30}
      className="bg-neutral-900/50 rounded"
    />
  )
}

export default D3Gauge
