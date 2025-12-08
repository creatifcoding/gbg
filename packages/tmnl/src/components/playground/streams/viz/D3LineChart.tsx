/**
 * D3 Line Chart
 *
 * Throughput-over-time visualization with real-time updates.
 *
 * Pattern:
 * - useEffect #1: Initialize SVG structure once (on dimensions change)
 * - useEffect #2: Update data (scales, line, axes)
 *
 * @module
 */

import { useRef, useEffect, useMemo } from 'react'
import * as d3 from 'd3'

// =============================================================================
// TYPES
// =============================================================================

export interface TimeseriesPoint {
  timestamp: number
  value: number
}

export interface D3LineChartProps {
  /** Data points to visualize */
  data: TimeseriesPoint[]
  /** Chart width */
  width?: number
  /** Chart height */
  height?: number
  /** Y-axis label */
  yLabel?: string
  /** Line color */
  color?: string
  /** Show area fill */
  showArea?: boolean
  /** Animation duration in ms */
  animationDuration?: number
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MARGIN = { top: 20, right: 20, bottom: 30, left: 50 }

// =============================================================================
// D3 LINE CHART
// =============================================================================

/**
 * Real-time line chart using D3.
 *
 * Features:
 * - Smooth line interpolation
 * - Optional area fill
 * - Auto-scaling axes
 * - Animated transitions
 */
export function D3LineChart({
  data,
  width = 400,
  height = 200,
  yLabel = 'Value',
  color = '#22d3ee', // cyan-400
  showArea = true,
  animationDuration = 300,
}: D3LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const initialized = useRef(false)

  // Computed dimensions
  const innerWidth = width - MARGIN.left - MARGIN.right
  const innerHeight = height - MARGIN.top - MARGIN.bottom

  // Memoize scales
  const { xScale, yScale } = useMemo(() => {
    const xExtent = d3.extent(data, (d) => d.timestamp) as [number, number]
    const yMax = d3.max(data, (d) => d.value) ?? 100

    return {
      xScale: d3
        .scaleTime()
        .domain(xExtent[0] ? xExtent : [Date.now() - 60000, Date.now()])
        .range([0, innerWidth]),
      yScale: d3
        .scaleLinear()
        .domain([0, yMax * 1.1])
        .range([innerHeight, 0]),
    }
  }, [data, innerWidth, innerHeight])

  // Initialize structure
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    // Clear and setup
    svg.selectAll('*').remove()

    // Create groups
    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // X axis
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickFormat((d) => d3.timeFormat('%H:%M:%S')(d as Date))
      )
      .selectAll('text')
      .style('fill', '#737373')
      .style('font-size', '10px')
      .style('font-family', 'monospace')

    g.selectAll('.x-axis path, .x-axis line').style('stroke', '#404040')

    // Y axis
    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll('text')
      .style('fill', '#737373')
      .style('font-size', '10px')
      .style('font-family', 'monospace')

    g.selectAll('.y-axis path, .y-axis line').style('stroke', '#404040')

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
      .text(yLabel)

    // Area (if enabled)
    if (showArea) {
      g.append('path')
        .attr('class', 'area')
        .attr('fill', color)
        .attr('fill-opacity', 0.1)
    }

    // Line
    g.append('path')
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .style('stroke', '#525252')

    g.select('.grid path').style('stroke', 'none')

    initialized.current = true
  }, [width, height, innerWidth, innerHeight, yLabel, color, showArea, xScale, yScale])

  // Update data
  useEffect(() => {
    if (!svgRef.current || !initialized.current || data.length === 0) return

    const svg = d3.select(svgRef.current)
    const g = svg.select('g')

    // Update scales
    const xExtent = d3.extent(data, (d) => d.timestamp) as [number, number]
    const yMax = d3.max(data, (d) => d.value) ?? 100

    const newXScale = d3
      .scaleTime()
      .domain(xExtent)
      .range([0, innerWidth])

    const newYScale = d3
      .scaleLinear()
      .domain([0, yMax * 1.1])
      .range([innerHeight, 0])

    // Update axes with transition
    g.select<SVGGElement>('.x-axis')
      .transition()
      .duration(animationDuration)
      .call(
        d3
          .axisBottom(newXScale)
          .ticks(5)
          .tickFormat((d) => d3.timeFormat('%H:%M:%S')(d as Date))
      )
      .selectAll('text')
      .style('fill', '#737373')

    g.select<SVGGElement>('.y-axis')
      .transition()
      .duration(animationDuration)
      .call(d3.axisLeft(newYScale).ticks(5))
      .selectAll('text')
      .style('fill', '#737373')

    // Line generator
    const line = d3
      .line<TimeseriesPoint>()
      .x((d) => newXScale(d.timestamp))
      .y((d) => newYScale(d.value))
      .curve(d3.curveMonotoneX)

    // Update line
    g.select('.line')
      .datum(data)
      .transition()
      .duration(animationDuration)
      .attr('d', line)

    // Update area
    if (showArea) {
      const area = d3
        .area<TimeseriesPoint>()
        .x((d) => newXScale(d.timestamp))
        .y0(innerHeight)
        .y1((d) => newYScale(d.value))
        .curve(d3.curveMonotoneX)

      g.select('.area')
        .datum(data)
        .transition()
        .duration(animationDuration)
        .attr('d', area)
    }
  }, [data, innerWidth, innerHeight, showArea, animationDuration])

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="bg-neutral-900/50 rounded"
    />
  )
}

export default D3LineChart
