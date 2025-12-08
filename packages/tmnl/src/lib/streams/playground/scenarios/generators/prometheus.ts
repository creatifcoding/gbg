/**
 * Prometheus Metrics Payload Generator
 *
 * Generates Prometheus exposition format style JSON payloads.
 * For stress testing observability pipelines.
 *
 * Example output:
 * ```json
 * {
 *   "metrics": [
 *     {
 *       "name": "tmnl_http_requests_total",
 *       "type": "counter",
 *       "help": "Total HTTP requests",
 *       "labels": { "method": "GET", "status": "200" },
 *       "value": 1234,
 *       "timestamp": 1702000000000
 *     }
 *   ]
 * }
 * ```
 *
 * @module
 */

import type { PayloadGenerator, PayloadTier } from '../types'
import { PAYLOAD_SIZE_TARGETS } from '../types'

// ============================================================================
// PROMETHEUS TYPES
// ============================================================================

/** Prometheus metric types */
type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary'

/** Single metric entry */
interface PrometheusMetric {
  /** Metric name (snake_case) */
  name: string
  /** Metric type */
  type: MetricType
  /** Help text */
  help: string
  /** Label key-value pairs */
  labels: Record<string, string>
  /** Metric value */
  value: number
  /** Unix timestamp in milliseconds */
  timestamp: number
  /** For histograms: bucket boundaries */
  buckets?: Array<{ le: number; count: number }>
  /** For summaries: quantiles */
  quantiles?: Array<{ quantile: number; value: number }>
}

/** Prometheus metrics payload */
interface PrometheusPayload {
  metrics: PrometheusMetric[]
}

// ============================================================================
// METRIC DEFINITIONS
// ============================================================================

/** Metric name templates */
const METRIC_NAMES = [
  'http_requests_total',
  'http_request_duration_seconds',
  'http_request_size_bytes',
  'http_response_size_bytes',
  'process_cpu_seconds_total',
  'process_resident_memory_bytes',
  'process_virtual_memory_bytes',
  'process_open_fds',
  'go_goroutines',
  'go_threads',
  'node_cpu_seconds_total',
  'node_memory_MemTotal_bytes',
  'node_memory_MemFree_bytes',
  'node_disk_read_bytes_total',
  'node_disk_written_bytes_total',
  'node_network_receive_bytes_total',
  'node_network_transmit_bytes_total',
  'container_cpu_usage_seconds_total',
  'container_memory_usage_bytes',
  'container_network_receive_bytes_total',
] as const

/** Metric types for each name */
const METRIC_TYPES: MetricType[] = [
  'counter',  // http_requests_total
  'histogram', // http_request_duration_seconds
  'histogram', // http_request_size_bytes
  'histogram', // http_response_size_bytes
  'counter',  // process_cpu_seconds_total
  'gauge',    // process_resident_memory_bytes
  'gauge',    // process_virtual_memory_bytes
  'gauge',    // process_open_fds
  'gauge',    // go_goroutines
  'gauge',    // go_threads
  'counter',  // node_cpu_seconds_total
  'gauge',    // node_memory_MemTotal_bytes
  'gauge',    // node_memory_MemFree_bytes
  'counter',  // node_disk_read_bytes_total
  'counter',  // node_disk_written_bytes_total
  'counter',  // node_network_receive_bytes_total
  'counter',  // node_network_transmit_bytes_total
  'counter',  // container_cpu_usage_seconds_total
  'gauge',    // container_memory_usage_bytes
  'counter',  // container_network_receive_bytes_total
]

/** Label pools for realistic cardinality */
const LABEL_POOLS = {
  method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
  status: ['200', '201', '204', '301', '302', '400', '401', '403', '404', '500', '502', '503'],
  path: ['/api/v1/users', '/api/v1/orders', '/api/v1/products', '/health', '/metrics', '/graphql'],
  instance: ['app-001', 'app-002', 'app-003', 'app-004'],
  job: ['api-server', 'worker', 'scheduler', 'gateway'],
  cpu: ['0', '1', '2', '3', '4', '5', '6', '7'],
  device: ['sda', 'sdb', 'nvme0n1'],
  interface: ['eth0', 'eth1', 'lo'],
  container: ['api', 'worker', 'redis', 'postgres', 'nginx'],
  namespace: ['default', 'production', 'staging', 'monitoring'],
  pod: ['api-deployment-abc123', 'worker-deployment-def456', 'redis-0'],
} as const

/** Tier configuration */
const TIER_CONFIG = {
  small: { metricCount: 5, labelCardinality: 2 },   // ~500 bytes
  medium: { metricCount: 20, labelCardinality: 5 }, // ~3 kB
  large: { metricCount: 100, labelCardinality: 10 }, // ~20 kB
} as const

// ============================================================================
// GENERATOR IMPLEMENTATION
// ============================================================================

/**
 * Generate labels for a metric.
 */
const generateLabels = (
  cardinality: number,
  metricIndex: number,
  eventIndex: number
): Record<string, string> => {
  const labels: Record<string, string> = {}
  const labelKeys = Object.keys(LABEL_POOLS) as Array<keyof typeof LABEL_POOLS>

  for (let i = 0; i < cardinality; i++) {
    const key = labelKeys[(metricIndex + i) % labelKeys.length]
    const pool = LABEL_POOLS[key]
    const value = pool[(eventIndex + i) % pool.length]
    labels[key] = value
  }

  return labels
}

/**
 * Generate histogram buckets.
 */
const generateBuckets = (): Array<{ le: number; count: number }> => {
  const boundaries = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  let cumulative = 0

  return boundaries.map((le) => {
    cumulative += Math.floor(Math.random() * 100)
    return { le, count: cumulative }
  })
}

/**
 * Generate summary quantiles.
 */
const generateQuantiles = (): Array<{ quantile: number; value: number }> => {
  const quantiles = [0.5, 0.9, 0.95, 0.99]
  let prev = 0

  return quantiles.map((quantile) => {
    prev = prev + Math.random() * 0.1
    return { quantile, value: Math.round(prev * 1000) / 1000 }
  })
}

/**
 * Generate a metric value based on type.
 */
const generateValue = (type: MetricType, metricIndex: number): number => {
  switch (type) {
    case 'counter':
      // Counters are cumulative, simulate high values
      return Math.floor(Math.random() * 1000000) + metricIndex * 1000
    case 'gauge':
      // Gauges fluctuate
      return Math.round(Math.random() * 10000 * 100) / 100
    case 'histogram':
    case 'summary':
      // Sum of observations
      return Math.round(Math.random() * 1000 * 1000) / 1000
    default:
      return Math.random() * 1000
  }
}

/**
 * Prometheus metrics payload generator.
 *
 * Produces realistic infrastructure monitoring metrics
 * with configurable cardinality.
 */
export const prometheusGenerator: PayloadGenerator = {
  id: 'prometheus',
  name: 'Prometheus Metrics',
  description: 'Observability — infrastructure monitoring, APM',

  generate(tier: PayloadTier, eventIndex: number): PrometheusPayload {
    const config = TIER_CONFIG[tier]
    const timestamp = Date.now()

    const metrics: PrometheusMetric[] = Array.from(
      { length: config.metricCount },
      (_, i) => {
        const name = `tmnl_${METRIC_NAMES[i % METRIC_NAMES.length]}`
        const type = METRIC_TYPES[i % METRIC_TYPES.length]

        const metric: PrometheusMetric = {
          name,
          type,
          help: `Mock metric: ${name}`,
          labels: generateLabels(config.labelCardinality, i, eventIndex),
          value: generateValue(type, i),
          timestamp,
        }

        // Add histogram buckets for histogram types
        if (type === 'histogram') {
          metric.buckets = generateBuckets()
        }

        // Add quantiles for summary types (alternate between histogram and summary)
        if (type === 'summary' || (type === 'histogram' && i % 3 === 0)) {
          metric.quantiles = generateQuantiles()
        }

        return metric
      }
    )

    return { metrics }
  },

  estimateSizeBytes(tier: PayloadTier): number {
    return PAYLOAD_SIZE_TARGETS[tier]
  },
}

export type { PrometheusPayload, PrometheusMetric }
