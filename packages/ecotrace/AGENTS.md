# AGENTS.md — @tmnl/ecotrace

## Package Identity

- **Name**: `@tmnl/ecotrace`
- **Location**: `packages/ecotrace`
- **Scope**: `@tmnl/` (newer package convention)
- **Type**: Library (`projectType: library`)
- **NX Tags**: `scope:tmnl`, `type:lib`, `domain:sustainability`, `domain:tracing`

## Purpose

Environmental impact attribution engine for LLM inference requests. Computes per-request carbon emissions (kg CO₂e), water consumption (liters, 3-scope decomposition), and energy usage (Wh) by combining:

1. Request metadata (model, tokens, provider, destination IP)
2. Network path intelligence (traceroute, BGP, ASN resolution)
3. Datacenter profiles (PUE, WUE, cooling method, location)
4. Real-time grid carbon intensity (Electricity Maps, WattTime, EPA eGRID)
5. Water stress context (WRI Aqueduct)
6. Parametric energy models (calibrated against ML.ENERGY Leaderboard)

## Monorepo Context

### NX Configuration

```bash
# Build
nx run @tmnl/ecotrace:build      # → bun run build → tsc → dist/

# Test 
nx run @tmnl/ecotrace:test       # → bun run test:run → vitest run

# Typecheck
nx run @tmnl/ecotrace:typecheck  # → bun run typecheck → tsc --noEmit

# Clean
nx run @tmnl/ecotrace:clean      # → rm -rf dist reports
```

### Path Alias

If cross-package imports are needed, add to root `tsconfig.base.json`:

```json
"@tmnl/ecotrace": ["packages/ecotrace/src/index.ts"]
```

### Dependencies

- **Runtime**: `effect@3.19.18` (pinned in root, no version drift)
- **Dev**: `@effect/vitest`, `vitest`, `typescript`
- **Future**: Will likely add `@effect/platform` for HTTP client (API integrations), `@effect/schema` if not re-exported from effect

### Package Manager

**Bun. Always bun.**

```bash
cd packages/ecotrace
bun install           # Install deps
bun run build         # Build
bun run test          # Watch mode
bun run test:run      # Single run
bun run typecheck     # Type check
```

## Architecture

### Module Map

```
src/
├── index.ts                    # Barrel: re-exports public API
├── attribution.ts              # Subpath export: @tmnl/ecotrace/attribution
├── proxy.ts                    # Subpath export: @tmnl/ecotrace/proxy
├── data.ts                     # Subpath export: @tmnl/ecotrace/data
│
├── models/                     # Effect Schema domain types
│   ├── Request.ts              # LlmRequest — provider, model, tokens, timing
│   ├── Attribution.ts          # Attribution — carbon + water + energy result
│   ├── Datacenter.ts           # DatacenterProfile — PUE, WUE, location, cooling
│   ├── NetworkPath.ts          # NetworkPath — hops[], ASNs, submarine cables
│   ├── GridIntensity.ts        # GridSnapshot — real-time carbon intensity
│   └── Scenario.ts             # ScenarioConfig — what-if parameters
│
├── services/                   # Effect.Service<> pattern
│   ├── AttributionEngine.ts    # Core: request → Attribution
│   ├── DatacenterResolver.ts   # IP → ASN → provider → facility
│   ├── GridIntensity.ts        # Electricity Maps / WattTime / eGRID
│   ├── WaterStress.ts          # WRI Aqueduct lookups
│   ├── NetworkTracer.ts        # dublin-traceroute + RIPE RIS
│   ├── EnergyEstimator.ts      # Parametric energy-per-token model
│   └── ScenarioEngine.ts       # Multi-scenario simulations
│
├── data/                       # Static reference data (TypeScript, not JSON)
│   ├── egrid-subregions.ts     # EPA eGRID 2023 CO₂e factors (26 subregions)
│   ├── provider-profiles.ts    # Google/AWS/Azure PUE+WUE by region
│   ├── gpu-specs.ts            # H100/A100/L40S/TPU TDP + throughput
│   └── model-registry.ts       # GPT-4o/Claude/Llama → params → energy curve
│
└── lib/                        # Pure functions, no Effect dependencies
    ├── formulas.ts             # carbon(), water(), energyPerToken()
    ├── units.ts                # whToJoules(), litersToGallons(), etc.
    └── geo.ts                  # haversine(), detectSubmarineCrossing()
```

### Service Dependency Graph

```
AttributionEngine
├── EnergyEstimator        (model → Wh per request)
├── DatacenterResolver     (IP → facility profile)
│   └── [IPinfo API]
├── GridIntensity          (region + time → kg CO₂e/kWh)
│   └── [Electricity Maps API]
├── WaterStress            (location → risk level)
│   └── [WRI Aqueduct data]
└── NetworkTracer          (destination → path + hops)
    ├── [dublin-traceroute]
    └── [RIPE RIS API]

ScenarioEngine
└── AttributionEngine      (runs N attributions with varied params)
```

### Design Decisions

#### 1. Effect.Service for Everything

All services use `Effect.Service<>()` / `Context.Tag` pattern. This enables:
- Testability via mock layers
- Composable dependency injection
- Fiber-based concurrency for parallel API calls
- Structured errors via `Data.TaggedError`

#### 2. Static Data in TypeScript, Not JSON

Reference data (eGRID factors, GPU specs, provider profiles) lives in `.ts` files, not `.json`. Why:
- Type safety at import time
- Tree-shakeable
- Can include computed/derived values
- No runtime JSON parsing

#### 3. Three Subpath Exports

```typescript
import { AttributionEngine } from "@tmnl/ecotrace/attribution"  // Core engine
import { ProxyInterceptor } from "@tmnl/ecotrace/proxy"         // MITM proxy
import { EgridSubregions } from "@tmnl/ecotrace/data"           // Static data
```

Separation allows consumers to import only what they need. The proxy layer has system-level dependencies (network access, CA generation) that library-only users don't want.

#### 4. Formulas Are Pure Functions

`src/lib/formulas.ts` contains zero Effect code. Pure `(input) => output` functions that can be unit tested trivially and reused outside the Effect ecosystem.

```typescript
// Pure function — no Effect, no services, no side effects
export const operationalCarbon = (
  energyKwh: number,
  pue: number,
  carbonIntensityKgPerKwh: number
): number => energyKwh * pue * carbonIntensityKgPerKwh
```

#### 5. Confidence Levels

Every attribution result includes a confidence field:

| Level | Meaning |
|-------|---------|
| `measured` | Token counts from API response, real-time grid data |
| `estimated` | Parametric energy model, provider-reported PUE |
| `default` | Fallback values used (unknown provider, offline mode) |

## Core Formulas

### Operational Carbon

```
CO₂e (kg) = Energy (kWh) × PUE × Carbon_Intensity (kg CO₂e / kWh)
```

### Water Consumption (3-Scope)

```
Scope 1 (on-site)  = Energy (kWh) × PUE × WUE_onsite (L/kWh)
Scope 2 (off-site) = Energy (kWh) × PUE × WUE_offsite (L/kWh)
Total              = Scope 1 + Scope 2
```

### Energy Per Token (Parametric)

From EcoLogits methodology (calibrated on H100 via ML.ENERGY Leaderboard):

```
E_gpu (J/token) = α × e^(β × B) × P_active + γ

Where:
  P_active = active parameter count (billions)
  B = batch size
  α, β, γ = fitted coefficients from benchmark data
```

### Request Energy

```
E_server = E_server_non_gpu + (GPU_count × E_gpu)
E_request = PUE × E_server
```

### Network Energy (Estimate)

```
E_network = Σ(hop_i) × avg_router_power × time_per_hop
           ≈ hops × 0.0001 kWh  (rough estimate, ~50 Wh/GB global avg)
```

## Key Data Points (Hardcoded Reference)

### EPA eGRID Subregion CO₂e Factors (2023)

| Subregion | CO₂e (kg/kWh) | Region |
|-----------|---------------|--------|
| CAMX | 0.436 | California |
| ERCT | 0.566 | Texas (ERCOT) |
| RFCW | 0.802 | Ohio Valley |
| NEWE | 0.403 | New England |
| NWPP | 0.736 | Northwest |
| SRVC | 0.596 | Virginia/Carolinas |
| MROW | 0.811 | Upper Midwest |
| RMPA | 0.739 | Rocky Mountain |
| U.S. Average | 0.771 | — |

Full table: 26 subregions in `src/data/egrid-subregions.ts`

### Provider PUE/WUE Matrix (2024)

| Provider | Region | PUE | WUE_onsite (L/kWh) |
|----------|--------|-----|---------------------|
| Google | Global | 1.09 | ~0.001 |
| Google | Dublin | 1.08 | — |
| Google | Singapore | 1.13 | — |
| AWS | Global | 1.15 | 0.18 |
| AWS | Europe | 1.11 | 0.04 |
| AWS | APAC | 1.27 | — |
| Microsoft | Global | 1.17 | 0.27 |
| Microsoft | Americas | 1.16 | 0.34 |
| Microsoft | EMEA | 1.16 | 0.03 |

### GPU Specs

| GPU | TDP (W) | FP8 TFLOPS | Memory | Common Deployment |
|-----|---------|-----------|--------|-------------------|
| H100 SXM | 700 | 3,958 | 80GB HBM3 | Frontier inference |
| H100 PCIe | 350 | 1,979 | 80GB HBM3 | Standard inference |
| A100 | 400 | 1,248 (INT8) | 80GB HBM2e | Widespread |
| L40S | 350 | 733 | 48GB GDDR6 | Cost-optimized |
| TPU v4 | 170 | 275 | 32GB HBM | Google-internal |
| TPU v5p | 250–300 | 459 | — | Google-internal |

### Model Registry

| Model | Provider | Active Params | Est. Energy/Query (Wh) |
|-------|----------|---------------|----------------------|
| GPT-4o | OpenAI | ~200B (est.) | 0.3–0.7 |
| GPT-4o-mini | OpenAI | ~8B (est.) | 0.05–0.15 |
| Claude 3.5 Sonnet | Anthropic | ~70B (est.) | 0.15–0.35 |
| Claude 3.5 Haiku | Anthropic | ~20B (est.) | 0.05–0.12 |
| Llama 3.1 405B | Meta | 405B | 0.5–1.2 |
| Llama 3.1 70B | Meta | 70B | 0.15–0.35 |
| Llama 3.1 8B | Meta | 8B | 0.03–0.08 |
| Gemini 1.5 Pro | Google | ~300B (est.) | 0.3–0.8 |
| Mixtral 8x22B | Mistral | 39B active/141B total | 0.12–0.30 |

*Note: Proprietary model sizes are estimates. Energy ranges reflect batch size and context length variation.*

## External API Integration Plan

### Electricity Maps (Priority: High)

```
GET https://api.electricitymap.org/v3/carbon-intensity/latest\?zone\=\{zone\}
Headers: auth-token: {API_KEY}

Response: {
  zone: "US-CAL-CISO",
  carbonIntensity: 243,           // gCO₂eq/kWh
  datetime: "2025-01-15T12:00:00Z",
  updatedAt: "2025-01-15T12:05:00Z",
  isEstimated: false,
  estimationMethod: null
}
```

Free tier: 100 requests/month. Paid: 500M queries/month.

### IPinfo.io (Priority: High)

```
GET https://ipinfo.io/\{ip\}\?token\=\{TOKEN\}

Response: {
  ip: "13.107.42.14",
  hostname: "...",
  city: "Boydton",
  region: "Virginia",
  country: "US",
  loc: "36.6676,-78.3875",
  org: "AS8075 Microsoft Corporation",
  postal: "23917",
  timezone: "America/New_York"
}
```

Free tier: 50K requests/month. ASN field gives provider identification.

### RIPE RIS (Priority: Medium)

```
GET https://stat.ripe.net/data/bgp-state/data.json\?resource\=\{ip\}

Response: {
  data: {
    bgp_state: [{
      target_prefix: "13.107.42.0/24",
      path: [3356, 8075],          // AS path
      ...
    }]
  }
}
```

No auth required. Rate limited by courtesy.

### WRI Aqueduct (Priority: Low — static data)

Available as GeoJSON/CSV download. Pre-process into TypeScript lookup by lat/lon bucket.

## Testing Strategy

### Unit Tests (`test/formulas.test.ts`)

Test pure formula functions with known values:

```typescript
import { describe, expect, it } from "vitest"
import { operationalCarbon, waterConsumption, energyPerToken } from "../src/lib/formulas"

describe("operationalCarbon", () => {
  it("calculates correctly for known inputs", () => {
    // 0.34 Wh query, PUE 1.15, Virginia grid (0.535 kg/kWh)
    const result = operationalCarbon(0.00034, 1.15, 0.535)
    expect(result).toBeCloseTo(0.000209, 5) // ~0.2g CO₂e
  })

  it("returns zero for zero energy", () => {
    expect(operationalCarbon(0, 1.15, 0.535)).toBe(0)
  })
})

describe("waterConsumption", () => {
  it("decomposes into scope 1 and scope 2", () => {
    const result = waterConsumption(0.00034, 1.15, 0.38, 7.6)
    expect(result.scope1).toBeCloseTo(0.000149, 5)
    expect(result.scope2).toBeCloseTo(0.002974, 4)
    expect(result.total).toBeCloseTo(result.scope1 + result.scope2, 6)
  })
})
```

### Integration Tests (`test/attribution.test.ts`)

Test full pipeline with mock service layers:

```typescript
import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { AttributionEngine } from "../src/services/AttributionEngine"

describe("AttributionEngine", () => {
  it.effect("produces attribution for known request", () =>
    Effect.gen(function* () {
      const engine = yield* AttributionEngine
      const result = yield* engine.attribute({
        provider: "openai",
        model: "gpt-4o",
        tokensIn: 500,
        tokensOut: 200,
      })

      expect(result.carbon.kg).toBeGreaterThan(0)
      expect(result.water.total.liters).toBeGreaterThan(0)
      expect(result.energy.wh).toBeGreaterThan(0)
      expect(result.confidence).toBe("estimated")
    }).pipe(Effect.provide(TestLayers))
  )
})
```

### Scenario Tests (`test/scenarios.test.ts`)

Verify that different regions produce different impacts:

```typescript
it.effect("Oregon is cleaner than Virginia", () =>
  Effect.gen(function* () {
    const engine = yield* ScenarioEngine
    const [virginia, oregon] = yield* engine.compare({
      request: { model: "gpt-4o", tokensIn: 500, tokensOut: 200 },
      scenarios: [
        { region: "us-east-1" },
        { region: "us-west-2" },
      ]
    })

    expect(oregon.carbon.kg).toBeLessThan(virginia.carbon.kg)
  }).pipe(Effect.provide(TestLayers))
)
```

## Implementation Phases

### Phase 1: Foundation (Current)
- [x] Package scaffold (package.json, project.json, tsconfig, vitest)
- [x] README.md (comprehensive public documentation)
- [x] AGENTS.md (this file)
- [ ] `src/lib/formulas.ts` — pure calculation functions
- [ ] `src/lib/units.ts` — unit conversion helpers
- [ ] `src/data/egrid-subregions.ts` — EPA eGRID lookup table
- [ ] `src/data/provider-profiles.ts` — PUE/WUE by provider
- [ ] `src/data/gpu-specs.ts` — GPU TDP/throughput registry
- [ ] `src/data/model-registry.ts` — model → params mapping
- [ ] `test/formulas.test.ts` — unit tests for formulas

### Phase 2: Effect Services
- [ ] `src/models/*.ts` — Effect Schema domain types
- [ ] `src/services/EnergyEstimator.ts` — parametric energy model
- [ ] `src/services/DatacenterResolver.ts` — IP → facility
- [ ] `src/services/GridIntensity.ts` — carbon intensity lookups
- [ ] `src/services/AttributionEngine.ts` — orchestrator
- [ ] `test/attribution.test.ts` — integration tests

### Phase 3: Network Intelligence
- [ ] `src/services/NetworkTracer.ts` — traceroute + BGP
- [ ] `src/services/WaterStress.ts` — Aqueduct integration
- [ ] `src/lib/geo.ts` — geospatial utilities

### Phase 4: Scenario Engine
- [ ] `src/services/ScenarioEngine.ts` — multi-scenario simulations
- [ ] `test/scenarios.test.ts` — scenario validation

### Phase 5: Proxy Layer
- [ ] `src/proxy/` — MITM proxy (mitmproxy or Rust)
- [ ] Docker configuration
- [ ] Self-hosted deployment guide

### Phase 6: Visualization
- [ ] Web dashboard (may be separate package: `@tmnl/ecotrace-ui`)
- [ ] Globe visualization (D3.js + network paths)
- [ ] Cumulative tracking views

## Gotchas & Watch-Outs

### 1. Effect Version

This package uses `effect@3.19.18` (pinned in root `package.json` overrides). If the monorepo migrates to Effect v4, update the import patterns. Currently the `stx`, `db`, `entity` packages use `effect-v4` aliasing — we do NOT do that here. We use stable v3.

### 2. No React Dependency

This is a pure computation library. No React, no DOM, no browser APIs. If a UI layer is built, it should be a separate package (`@tmnl/ecotrace-ui`) that depends on this one.

### 3. API Keys Are Optional

The system must work without any API keys using static/cached data. API integrations (Electricity Maps, IPinfo) enhance accuracy but are not required. Default to EPA eGRID annual averages when real-time data is unavailable.

### 4. Unit Discipline

All internal calculations use SI units:
- Energy: **kilowatt-hours (kWh)** — not Wh, not Joules
- Carbon: **kilograms CO₂e** — not grams, not tons, not pounds
- Water: **liters** — not gallons, not cubic meters
- Power: **watts** — not kilowatts

Conversion utilities in `src/lib/units.ts` handle display formatting.

### 5. Precision

Financial-grade precision is not needed. Environmental attribution is inherently estimation. Use standard `number` type, not BigDecimal. Report to 4-6 significant figures internally, display to 2-3.

## Related Packages in Monorepo

| Package | Relationship |
|---------|-------------|
| `@tmnl/stx` | State management — may be used if ecotrace gets reactive atoms |
| `@tmnl/entity` | Entity definitions — could share domain types if overlap emerges |
| `@tmnl/datagrid` | Grid rendering — potential consumer for tabular impact data |
| `@gbg/tmnl` | Main app — will integrate ecotrace as a feature module |

## Session History

### Session 1 (Current)
- Conducted comprehensive research across 3 parallel threads:
  1. Existing tools landscape (CodeCarbon, EcoLogits, LLMCarbon, LLMCO2)
  2. Datacenter intelligence & energy grid data sources
  3. Network tracing & MITM proxy architecture
- Key findings: per-query median 0.34 Wh, public estimates overstate 4-20×, Scope 2 water dominates
- Scaffolded package with NX conventions matching `@tmnl/stx` and `@tmnl/db` patterns
- Wrote README.md (416 lines) and AGENTS.md (this file)
