/**
 * @tmnl/entity — Heavy Entity Benchmarks
 *
 * Performance at scale with "heavy" entities:
 * - Entities with computed getters, derived methods, business logic
 * - Service-backed methods (Effect.gen programs that yield* services)
 * - Large field counts (15+ fields)
 * - Deep nesting and array fields
 * - 10K–100K instance creation, method invocation, reactive bridge
 *
 * B1: Heavy entity instantiation (15 fields, getters, methods)
 * B2: Computed getter throughput (derived from multiple fields)
 * B3: Service-backed method invocation (Effect.gen with yield*)
 * B4: Large batch — 50K heavy entities reactive hydration
 * B5: Method invocation across 10K instances
 * B6: Service layer resolution throughput
 * B7: Realistic mixed — create + compute + service call + mutate
 * B8: Memory pressure — 100K heavy instances alive simultaneously
 */

import { describe, it, expect } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import * as Effect from 'effect-v4/Effect'
import { ServiceMap } from 'effect-v4'
import { AtomRegistry } from 'effect-v4/unstable/reactivity'
import { Entity } from '../src/entity.js'

// ─── Service Definitions ─────────────────────────────────────

// ── Service shapes (plain objects) ──

const pricingImpl = {
  calculateDiscount(price: number, tier: string): number {
    const rates: Record<string, number> = { bronze: 0.05, silver: 0.10, gold: 0.15, platinum: 0.20 }
    return price * (1 - (rates[tier] ?? 0))
  },
  calculateTax(price: number, region: string): number {
    const taxes: Record<string, number> = { US: 0.08, EU: 0.20, UK: 0.17, JP: 0.10 }
    return price * (taxes[region] ?? 0.10)
  },
  calculateShipping(weight: number, zone: number): number {
    return weight * 0.5 * zone
  },
}

const auditImpl = {
  log(_entityId: number, _action: string, _details: Record<string, unknown>): void {},
  validate(entityId: number, rules: string[]): { valid: boolean; violations: string[] } {
    return { valid: entityId > 0 && rules.length > 0, violations: [] }
  },
}

const enrichmentImpl = {
  geocode(_address: string): { lat: number; lng: number } {
    return { lat: 40.7128 + Math.random() * 0.01, lng: -74.0060 + Math.random() * 0.01 }
  },
  normalize(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ')
  },
  classify(tags: readonly string[]): string {
    if (tags.length === 0) return 'uncategorized'
    if (tags.includes('urgent')) return 'high-priority'
    if (tags.includes('archive')) return 'low-priority'
    return 'standard'
  },
}

// ── Service tags (Effect v4 ServiceMap.Service) ──

class PricingService extends ServiceMap.Service<PricingService>()('bench/Pricing', {
  succeed: pricingImpl,
}) {}

class AuditService extends ServiceMap.Service<AuditService>()('bench/Audit', {
  succeed: auditImpl,
}) {}

class EnrichmentService extends ServiceMap.Service<EnrichmentService>()('bench/Enrichment', {
  succeed: enrichmentImpl,
}) {}

/** Provide all 3 services via provideService chain — runs synchronously */
function withServices<A, E>(effect: Effect.Effect<A, E, PricingService | AuditService | EnrichmentService>): Effect.Effect<A, E> {
  return effect.pipe(
    Effect.provideService(PricingService, pricingImpl as any),
    Effect.provideService(AuditService, auditImpl as any),
    Effect.provideService(EnrichmentService, enrichmentImpl as any),
  ) as Effect.Effect<A, E>
}

// ─── Heavy Entity ────────────────────────────────────────────

class Order extends Entity('Order')({
  // Identity
  id:          Entity.generated(Schema.Number),
  externalRef: Schema.String,

  // Core
  customerName: Schema.NonEmptyString,
  email:        Entity.sensitive(Schema.String),
  phone:        Entity.sensitive(Schema.String),

  // Product
  productName:  Schema.String,
  quantity:     Schema.Number,
  unitPrice:    Schema.Number,
  weight:       Schema.Number,

  // Classification
  tier:         Schema.Literals(['bronze', 'silver', 'gold', 'platinum'] as const),
  region:       Schema.Literals(['US', 'EU', 'UK', 'JP'] as const),
  zone:         Schema.Number,
  tags:         Schema.Array(Schema.String),
  status:       Schema.Literals(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const),

  // Metadata
  priority:     Entity.readonly(Schema.Number),
  score:        Entity.readonly(Schema.Number),
  createdAt:    Entity.timestamp(),
  updatedAt:    Entity.timestamp(),
  notes:        Schema.String,
}) {
  // ── Computed getters (pure, no service dep) ──

  get subtotal(): number {
    return this.quantity * this.unitPrice
  }

  get displayName(): string {
    return `${this.customerName} — ${this.productName} ×${this.quantity}`
  }

  get isHighValue(): boolean {
    return this.subtotal > 1000
  }

  get tagCount(): number {
    return this.tags.length
  }

  get statusEmoji(): string {
    const map: Record<string, string> = {
      pending: '⏳', confirmed: '✅', shipped: '📦', delivered: '🏠', cancelled: '❌'
    }
    return map[this.status] ?? '❓'
  }

  get summary(): string {
    return `[${this.statusEmoji}] ${this.displayName} — $${this.subtotal.toFixed(2)} (${this.tier}/${this.region})`
  }

  // ── Service-backed methods (Effect programs) ──

  calculateTotal(): Effect.Effect<{ discounted: number; tax: number; shipping: number; total: number }> {
    return Effect.gen(function*(this: Order) {
      const pricing = yield* PricingService
      const discounted = pricing.calculateDiscount(this.subtotal, this.tier)
      const tax = pricing.calculateTax(discounted, this.region)
      const shipping = pricing.calculateShipping(this.weight, this.zone)
      return { discounted, tax, shipping, total: discounted + tax + shipping }
    }.bind(this))
  }

  audit(action: string): Effect.Effect<void> {
    return Effect.gen(function*(this: Order) {
      const auditor = yield* AuditService
      auditor.log(this.id, action, { subtotal: this.subtotal, tier: this.tier })
    }.bind(this))
  }

  validateOrder(): Effect.Effect<{ valid: boolean; violations: string[] }> {
    return Effect.gen(function*(this: Order) {
      const auditor = yield* AuditService
      return auditor.validate(this.id, ['quantity>0', 'price>0', 'name-present'])
    }.bind(this))
  }

  classifyOrder(): Effect.Effect<string> {
    return Effect.gen(function*(this: Order) {
      const enrichment = yield* EnrichmentService
      return enrichment.classify(this.tags)
    }.bind(this))
  }

  enrichAndAudit(): Effect.Effect<{ classification: string; geo: { lat: number; lng: number } }> {
    return Effect.gen(function*(this: Order) {
      const enrichment = yield* EnrichmentService
      const auditor = yield* AuditService
      const classification = enrichment.classify(this.tags)
      const geo = enrichment.geocode(`${this.customerName} office`)
      auditor.log(this.id, 'enriched', { classification, geo })
      return { classification, geo }
    }.bind(this))
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function formatRate(ops: number, unit = 'ops/sec'): string {
  if (ops >= 1e9) return `${(ops / 1e9).toFixed(2)}G ${unit}`
  if (ops >= 1e6) return `${(ops / 1e6).toFixed(2)}M ${unit}`
  if (ops >= 1e3) return `${(ops / 1e3).toFixed(1)}K ${unit}`
  return `${ops.toFixed(0)} ${unit}`
}

const tiers = ['bronze', 'silver', 'gold', 'platinum'] as const
const regions = ['US', 'EU', 'UK', 'JP'] as const
const statuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const

const makeOrder = (i: number) => new Order({
  id: i,
  externalRef: `ORD-${String(i).padStart(6, '0')}`,
  customerName: `Customer ${i}`,
  email: `customer${i}@example.com`,
  phone: `+1-555-${String(i).padStart(4, '0')}`,
  productName: `Product ${i % 100}`,
  quantity: (i % 10) + 1,
  unitPrice: 10 + (i % 500),
  weight: 0.5 + (i % 20),
  tier: tiers[i % 4],
  region: regions[i % 4],
  zone: (i % 5) + 1,
  tags: i % 3 === 0 ? ['urgent', 'express'] : i % 5 === 0 ? ['archive'] : ['standard'],
  status: statuses[i % 5],
  priority: i % 10,
  score: i * 7,
  createdAt: Date.now() - i * 1000,
  updatedAt: Date.now(),
  notes: `Order notes for item ${i}`,
})

// ─── B1: Heavy Entity Instantiation ─────────────────────────

describe('B1: Heavy Entity Instantiation (20 fields + 6 getters + 5 methods)', () => {
  it('10K heavy entities', () => {
    const N = 10_000
    const start = performance.now()
    const items: Order[] = []
    for (let i = 0; i < N; i++) {
      items.push(makeOrder(i))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B1 Heavy 10K: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(items).toHaveLength(N)
    expect(rate).toBeGreaterThan(20_000)
  })

  it('50K heavy entities', () => {
    const N = 50_000
    const start = performance.now()
    const items: Order[] = []
    for (let i = 0; i < N; i++) {
      items.push(makeOrder(i))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B1 Heavy 50K: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(items).toHaveLength(N)
    expect(rate).toBeGreaterThan(15_000)
  })

  it('100K heavy entities', () => {
    const N = 100_000
    const start = performance.now()
    const items: Order[] = []
    for (let i = 0; i < N; i++) {
      items.push(makeOrder(i))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B1 Heavy 100K: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(items).toHaveLength(N)
    expect(rate).toBeGreaterThan(10_000)
  })
})

// ─── B2: Computed Getter Throughput ──────────────────────────

describe('B2: Computed Getters — derived field access', () => {
  it('subtotal getter — 100K invocations', () => {
    const order = makeOrder(42)
    const N = 100_000
    const start = performance.now()
    let sum = 0
    for (let i = 0; i < N; i++) {
      sum += order.subtotal
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B2 Subtotal: ${formatRate(rate)} (result: ${sum})`)
    expect(rate).toBeGreaterThan(10_000_000)
  })

  it('displayName getter — 100K invocations', () => {
    const order = makeOrder(42)
    const N = 100_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      order.displayName
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B2 DisplayName: ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(1_000_000)
  })

  it('summary getter (compound) — 100K invocations', () => {
    const order = makeOrder(42)
    const N = 100_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      order.summary
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B2 Summary: ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(500_000)
  })

  it('mixed getters across 10K different instances', () => {
    const orders = Array.from({ length: 10_000 }, (_, i) => makeOrder(i))
    const N = orders.length

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      orders[i].subtotal
      orders[i].displayName
      orders[i].isHighValue
      orders[i].statusEmoji
    }
    const elapsed = performance.now() - start
    const rate = ((N * 4) / elapsed) * 1000

    console.log(`B2 Mixed Getters: ${(N * 4).toLocaleString()} calls across ${N.toLocaleString()} instances → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(500_000)
  })
})

// ─── B3: Service-Backed Method Invocation ────────────────────

describe('B3: Service-Backed Methods (Effect.gen + yield*)', () => {
  it('calculateTotal — 1K invocations via Effect.runSync', () => {
    const order = makeOrder(42)
    const N = 1_000

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Effect.runSync(withServices(order.calculateTotal()))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B3 calculateTotal: ${N} calls in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(5_000)
  })

  it('validateOrder — 1K invocations', () => {
    const order = makeOrder(42)
    const N = 1_000

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Effect.runSync(withServices(order.validateOrder()))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B3 validateOrder: ${N} calls in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(5_000)
  })

  it('classifyOrder — 1K invocations', () => {
    const order = makeOrder(42)
    const N = 1_000

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Effect.runSync(withServices(order.classifyOrder()))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B3 classifyOrder: ${N} calls in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(10_000)
  })

  it('enrichAndAudit (multi-service) — 1K invocations', () => {
    const order = makeOrder(42)
    const N = 1_000

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Effect.runSync(withServices(order.enrichAndAudit()))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B3 enrichAndAudit: ${N} calls in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(3_000)
  })

  it('10K service calls across 1K different instances', () => {
    const orders = Array.from({ length: 1_000 }, (_, i) => makeOrder(i))
    const N = 10_000

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      const order = orders[i % 1_000]
      Effect.runSync(withServices(order.calculateTotal()))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B3 Cross-Instance: ${N.toLocaleString()} calls across 1K instances → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(5_000)
  })
})

// ─── B4: Reactive Hydration at Scale ─────────────────────────

describe('B4: Reactive Bridge — Heavy Entity Scale', () => {
  it('10K heavy entities → reactive atoms', () => {
    const N = 10_000
    const seed = Array.from({ length: N }, (_, i) => makeOrder(i))
    const registry = AtomRegistry.make()

    const start = performance.now()
    const rx = Order.reactive(registry, { getId: (t: any) => t.id, initialData: seed })
    const elapsed = performance.now() - start

    expect(registry.get(rx.items)).toHaveLength(N)
    console.log(`B4 Hydrate 10K: ${elapsed.toFixed(1)}ms → ${formatRate((N / elapsed) * 1000)}`)
    expect(elapsed).toBeLessThan(500)
    rx.dispose()
  })

  it('50K heavy entities → reactive atoms', () => {
    const N = 50_000
    const seed = Array.from({ length: N }, (_, i) => makeOrder(i))
    const registry = AtomRegistry.make()

    const start = performance.now()
    const rx = Order.reactive(registry, { getId: (t: any) => t.id, initialData: seed })
    const elapsed = performance.now() - start

    expect(registry.get(rx.items)).toHaveLength(N)
    console.log(`B4 Hydrate 50K: ${elapsed.toFixed(1)}ms → ${formatRate((N / elapsed) * 1000)}`)
    expect(elapsed).toBeLessThan(2000)
    rx.dispose()
  })

  it('update + getter read cycle across reactive bridge', () => {
    const seed = Array.from({ length: 1_000 }, (_, i) => makeOrder(i))
    const registry = AtomRegistry.make()
    const rx = Order.reactive(registry, { getId: (t: any) => t.id, initialData: seed })

    const N = 5_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      // Update an order
      rx.update(i % 1_000, { quantity: (i % 10) + 1 } as any)
      // Read via byId + getter
      const map = registry.get(rx.byId)
      const order = map.get(i % 1_000)
      if (order) (order as Order).subtotal
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B4 Update+Read: ${N.toLocaleString()} cycles in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(5_000)
    rx.dispose()
  })
})

// ─── B5: Method Invocation Across Instances ──────────────────

describe('B5: Method Invocation Scale', () => {
  it('10K orders — compute subtotal on each (getter)', () => {
    const orders = Array.from({ length: 10_000 }, (_, i) => makeOrder(i))
    const N = orders.length

    const start = performance.now()
    let totalSubtotal = 0
    for (let i = 0; i < N; i++) {
      totalSubtotal += orders[i].subtotal
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B5 Subtotal 10K: ${elapsed.toFixed(1)}ms → ${formatRate(rate)} (total: $${totalSubtotal.toFixed(0)})`)
    expect(rate).toBeGreaterThan(1_000_000)
  })

  it('10K orders — summary getter (compound string)', () => {
    const orders = Array.from({ length: 10_000 }, (_, i) => makeOrder(i))
    const N = orders.length

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      orders[i].summary
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B5 Summary 10K: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(200_000)
  })
})

// ─── B6: Service Layer Resolution ────────────────────────────

describe('B6: Service Resolution Overhead', () => {
  it('Effect.runSync + Layer.provide overhead — 10K iterations', () => {
    // Measure pure Effect overhead: gen + yield* + provide
    const trivial = Effect.gen(function*() {
      const pricing = yield* PricingService
      return pricing.calculateDiscount(100, 'gold')
    })

    const N = 10_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Effect.runSync(withServices(trivial))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B6 Service Resolve: ${N.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(10_000)
  })

  it('multi-service resolution — 3 services in one gen', () => {
    const multi = Effect.gen(function*() {
      const pricing = yield* PricingService
      const audit = yield* AuditService
      const enrichment = yield* EnrichmentService
      const d = pricing.calculateDiscount(100, 'gold')
      audit.log(1, 'test', {})
      const c = enrichment.classify(['urgent'])
      return { d, c }
    })

    const N = 10_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      Effect.runSync(withServices(multi))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B6 Multi-Service: ${N.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(5_000)
  })
})

// ─── B7: Realistic Mixed Workload ────────────────────────────

describe('B7: Realistic Mixed — create + compute + service + mutate', () => {
  it('500 ticks: create entity, compute, service call, mutate reactive', () => {
    const registry = AtomRegistry.make()
    const seed = Array.from({ length: 100 }, (_, i) => makeOrder(i))
    const rx = Order.reactive(registry, { getId: (t: any) => t.id, initialData: seed })

    const TICKS = 500
    const start = performance.now()

    for (let t = 0; t < TICKS; t++) {
      // Create a new entity
      const order = makeOrder(1000 + t)

      // Compute getters
      order.subtotal
      order.summary
      order.isHighValue

      // Service call
      Effect.runSync(withServices(order.calculateTotal()))

      // Mutate reactive bridge
      rx.update(t % 100, { notes: `Tick ${t}` } as any)

      // Read from reactive
      registry.get(rx.byId).get(t % 100)
      registry.get(rx.count)
    }

    const elapsed = performance.now() - start
    const opsPerTick = 7 // create + 3 getters + 1 service + 1 mutate + 2 reads
    const totalOps = TICKS * opsPerTick
    const rate = (totalOps / elapsed) * 1000

    console.log(`B7 Mixed: ${TICKS} ticks × ${opsPerTick} ops = ${totalOps.toLocaleString()} ops in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(10_000)
    rx.dispose()
  })
})

// ─── B8: Memory Pressure — 100K Alive ────────────────────────

describe('B8: Memory Pressure — 100K heavy instances', () => {
  it('100K instances alive, then iterate getters', () => {
    const N = 100_000
    const createStart = performance.now()
    const orders = Array.from({ length: N }, (_, i) => makeOrder(i))
    const createElapsed = performance.now() - createStart

    console.log(`B8 Create 100K: ${createElapsed.toFixed(1)}ms → ${formatRate((N / createElapsed) * 1000)}`)

    // Now iterate all, accessing getters (tests memory layout / cache)
    const iterStart = performance.now()
    let highValueCount = 0
    for (let i = 0; i < N; i++) {
      if (orders[i].isHighValue) highValueCount++
    }
    const iterElapsed = performance.now() - iterStart
    const iterRate = (N / iterElapsed) * 1000

    console.log(`B8 Iterate 100K: ${iterElapsed.toFixed(1)}ms → ${formatRate(iterRate)} (${highValueCount.toLocaleString()} high-value)`)
    expect(iterRate).toBeGreaterThan(1_000_000)

    // Compound getter iteration
    const summaryStart = performance.now()
    for (let i = 0; i < N; i++) {
      orders[i].summary
    }
    const summaryElapsed = performance.now() - summaryStart
    const summaryRate = (N / summaryElapsed) * 1000

    console.log(`B8 Summary 100K: ${summaryElapsed.toFixed(1)}ms → ${formatRate(summaryRate)}`)
    expect(summaryRate).toBeGreaterThan(200_000)
  })
})
