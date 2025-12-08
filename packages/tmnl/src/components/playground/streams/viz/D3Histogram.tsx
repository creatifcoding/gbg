/**
 * D3 Histogram
 *
 * Latency distribution visualization.
 *
 * @module
 */

import { useRef, useEffect, useMemo } from 'react'
import * as d3 from 'd3'

// =============================================================================
// TYPES
// =============================================================================

export interface D3HistogramProps {
  /** Array of values to histogram */
  data: number[]
  /** Chart width */
  width?: number
  /** Chart height */
  height?: number
  /** X-axis label */
  xLabel?: string
  /** Bar color */
  color?: string
  /** Number of bins */
  bins?: number
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 }

// =============================================================================
// D3 HISTOGRAM
// =============================================================================

/**
 * Histogram chart using D3.
 *
 * Features:
 * - Auto-binning
 * - Smooth transitions
 * - Value distribution visualization
 */
export function D3Histogram({
  data,
  width = 400,
  height = 200,
  xLabel = 'Latency (ms)',
  color = '#f59e0b', // amber-500
  bins = 20,
}: D3HistogramProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const initialized = useRef(false)

  // Computed dimensions
  const innerWidth = width - MARGIN.left - MARGIN.right
  const innerHeight = height - MARGIN.top - MARGIN.bottom

  // Compute histogram bins
  const histogramData = useMemo(() => {
    if (data.length === 0) return []

    const [min, max] = d3.extent(data) as [number, number]
    const xScale = d3.scaleLinear().domain([min, max]).nice()

    const histogram = d3
      .bin<number, number>()
      .domain(xScale.domain() as [number, number])
      .thresholds(bins)

    return histogram(data)
  }, [data, bins])

  // Initialize structure
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    // Clear and setup
    svg.selectAll('*').remove()

    // Create group
    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // Bars group
    g.append('g').attr('class', 'bars')

    // X axis
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)

    // Y axis
    g.append('g').attr('class', 'y-axis')

    // X label
    g.append('text')
      .attr('class', 'x-label')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 35)
      .attr('text-anchor', 'middle')
      .style('fill', '#737373')
      .style('font-size', '10px')
      .style('font-family', 'monospace')
      .text(xLabel)

    // Y label
    g.append('text')
      .attr('class', 'y-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .style('fill', '#737373')
      .style('font-size', '10px')
      .style('font-family', 'monospace')
      .text('Count')

    initialized.current = true
  }, [width, height, innerWidth, innerHeight, xLabel])

  // Update data
  useEffect(() => {
    if (!svgRef.current || !initialized.current || histogramData.length === 0) return

    const svg = d3.select(svgRef.current)
    const g = svg.select('g')

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([histogramData[0]?.x0 ?? 0, histogramData[histogramData.length - 1]?.x1 ?? 100])
      .range([0, innerWidth])

    const yMax = d3.max(histogramData, (d) => d.length) ?? 10
    const yScale = d3
      .scaleLinear()
      .domain([0, yMax])
      .range([innerHeight, 0])

    // Update axes
    g.select<SVGGElement>('.x-axis')
      .transition()
      .duration(200)
      .call(d3.axisBottom(xScale).ticks(5))
      .selectAll('text')
      .style('fill', '#737373')
      .style('font-size', '10px')
      .style('font-family', 'monospace')

    g.selectAll('.x-axis path, .x-axis line').style('stroke', '#404040')

    g.select<SVGGElement>('.y-axis')
      .transition()
      .duration(200)
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll('text')
      .style('fill', '#737373')
      .style('font-size', '10px')
      .style('font-family', 'monospace')

    g.selectAll('.y-axis path, .y-axis line').style('stroke', '#404040')

    // Bars
    const bars = g.select('.bars').selectAll<SVGRectElement, d3.Bin<number, number>>('rect').data(histogramData)

    // Enter
    bars
      .enter()
      .append('rect')
      .attr('x', (d) => xScale(d.x0 ?? 0) + 1)
      .attr('width', (d) => Math.max(0, xScale(d.x1 ?? 0) - xScale(d.x0 ?? 0) - 2))
      .attr('y', innerHeight)
      .attr('height', 0)
      .attr('fill', color)
      .attr('fill-opacity', 0.7)
      .merge(bars)
      .transition()
      .duration(200)
      .attr('x', (d) => xScale(d.x0 ?? 0) + 1)
      .attr('width', (d) => Math.max(0, xScale(d.x1 ?? 0) - xScale(d.x0 ?? 0) - 2))
      .attr('y', (d) => yScale(d.length))
      .attr('height', (d) => innerHeight - yScale(d.length))

    // Exit
    bars.exit().transition().duration(200).attr('height', 0).attr('y', innerHeight).remove()
  }, [histogramData, innerWidth, innerHeight, color])

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="bg-neutral-900/50 rounded"
    />
  )
}

export default D3Histogram
