# @tmnl/ecotrace

**Environmental impact tracing for LLM requests.**

Per-request carbon emissions, water consumption, and network path attribution — because "AI is bad for the environment" deserves numbers, not hand-waving.

---

## What This Is

Ecotrace is a measurement and estimation engine that answers a simple question:

> **"What did this LLM request actually cost the planet?"**

It works by intercepting LLM API requests via a self-hosted local proxy, tracing the network path to the serving datacenter, identifying the facility's energy and water profile, and computing per-request environmental impact using peer-reviewed formulas.

This is not a carbon offset calculator. This is not a guilt machine. This is **instrumentation** — the same discipline that gave us APM for latency and Prometheus for uptime, applied to environmental cost.

## Why This Exists

The discourse around AI's environmental impact is long on claims and short on data. You'll hear:

- *"ChatGPT uses a bottle of water per conversation"* — Sometimes. Depends on the datacenter, the cooling method, the grid, the time of day, and the model.
- *"AI is boiling the oceans"* — The entire U.S. data center sector uses ~0.5% of national water. AI is a fraction of that.
- *"Training GPT-4 emitted as much carbon as 500 cars"* — Training is a one-time cost. Inference is 90%+ of lifecycle emissions. Nobody measures inference.

Ecotrace exists to replace vibes with vectors. Every claim becomes testable. Every request becomes measurable. Every comparison becomes apples-to-apples.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User / LLM Client                        │
│  (ChatGPT, Claude, local Ollama, any OpenAI-compatible API)     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Layer 1: Request Proxy                         │
│                                                                  │
│  Self-hosted MITM proxy (local only, user-generated CA)          │
│  Captures: tokens, timing, destination IP, TLS metadata          │
│  Privacy: nothing leaves your machine                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│  Layer 2:    │ │  Layer 3:    │ │  Layer 4:        │
│  Network     │ │  Datacenter  │ │  Environmental   │
│  Intelligence│ │  Resolution  │ │  Attribution     │
│              │ │              │ │                  │
│ traceroute   │ │ IP → ASN →   │ │ Energy × PUE ×  │
│ BGP paths    │ │ Provider →   │ │ Grid_CI = CO₂   │
│ submarine    │ │ Region →     │ │ Energy × PUE ×  │
│ cables       │ │ Facility     │ │ WUE = Water     │
│ hop latency  │ │              │ │                  │
└──────┬───────┘ └──────┬───────┘ └────────┬─────────┘
       │                │                  │
       └────────────────┼──────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Layer 5: Scenario Engine                       │
│                                                                  │
│  "What if this request went to Oregon instead of Virginia?"      │
│  "What if I ran this at 2am when the grid is cleaner?"           │
│  "What's the difference between GPT-4 and Claude Sonnet?"        │
│  "How much water did my team use this quarter?"                  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### The Attribution Formula

Every request produces three environmental metrics:

```
Carbon (kg CO₂e) = Energy_kWh × PUE × Carbon_Intensity_kg_per_kWh
Water  (liters)  = Energy_kWh × PUE × (WUE_onsite + WUE_offsite)
Energy (Wh)      = f(model_params, tokens_in, tokens_out, batch_context)
```

Where:
- **PUE** (Power Usage Effectiveness) — ratio of total facility energy to IT energy. Google: 1.09, AWS: 1.15, Microsoft: 1.17. Perfect = 1.0.
- **Carbon Intensity** — kg CO₂e per kWh of grid electricity. Varies 0.03 (Norway, hydro) to 0.80+ (Poland, coal). Changes hourly.
- **WUE_onsite** — liters of water evaporated per kWh for datacenter cooling. Ranges 0.0 (air-cooled) to 2.5 (evaporative).
- **WUE_offsite** — liters of water consumed per kWh for electricity generation. U.S. average: ~7.6 L/kWh (thermal plants use water for steam/cooling).

### The Three Scopes of Water

| Scope | What | Typical Magnitude |
|-------|------|-------------------|
| **Scope 1** | On-site cooling (evaporative towers, direct-to-chip) | 0–2.5 L/kWh |
| **Scope 2** | Electricity generation (thermoelectric plant cooling) | 1.0–7.6 L/kWh |
| **Scope 3** | Hardware manufacturing (chip fabrication, server assembly) | Amortized over lifetime |

**Key insight**: Scope 2 water (power generation) typically dwarfs Scope 1 (datacenter cooling) by 3–5×. Most public discourse focuses on Scope 1 and misses the bigger number.

### Energy Per Token

Not all tokens cost the same:

| Phase | What Happens | Energy Character |
|-------|-------------|-----------------|
| **Prefill** | Process entire input prompt in parallel | Compute-bound, high power, fast |
| **Decode** | Generate output tokens one at a time | Memory-bound, lower power, slow |

Decode dominates wall-clock time (77–91%) but at lower instantaneous power. The energy-per-token varies by:

- **Model size**: ~sublinear scaling (Energy ≈ k × Parameters^0.5–0.6)
- **Batch size**: Larger batches amortize fixed overhead
- **Quantization**: INT8/FP8 cuts energy ~40–50% vs FP16
- **Context length**: Longer contexts increase prefill cost quadratically (attention)

### Production vs. Public Estimates

| Source | Energy per Query | Notes |
|--------|-----------------|-------|
| **Public estimates** (media) | 2–10 Wh | Extrapolated from single-GPU benchmarks |
| **Production reality** (at-scale) | 0.18–0.67 Wh | Batched, optimized, H100 clusters |
| **Median (200B+ params)** | **0.34 Wh** | Monte Carlo simulation, realistic workloads |
| **Overstating factor** | **4–20×** | Public estimates vs. production measurement |

Source: "Estimating Energy Per Query in Large-Scale LLM Deployments" (2025), TokenPowerBench, EcoLogits methodology.

## Data Sources

Ecotrace pulls from authoritative, open data sources:

### Real-Time Grid Carbon Intensity

| Provider | Coverage | Granularity | Access |
|----------|----------|-------------|--------|
| [Electricity Maps](https://electricitymaps.com) | 190+ countries | 5-min intervals, 72h forecast | Freemium API |
| [WattTime](https://watttime.org) | 99%+ global | Marginal emissions, 5-min | Free tier |
| [EPA eGRID](https://www.epa.gov/egrid) | U.S. only | Annual by subregion | Open data |

### Datacenter Intelligence

| Data Layer | Source | Coverage |
|-----------|--------|----------|
| IP → ASN → Provider | [IPinfo.io](https://ipinfo.io) | Global, daily updates |
| BGP path analysis | [RIPE RIS](https://ris.ripe.net), [RouteViews](http://www.routeviews.org) | Global, real-time, no auth |
| Datacenter locations | [DataCenterMap](https://www.datacentermap.com) (10,444+), [DC Hub](https://dchub.io) (20,000+) | Global |
| Submarine cables | [TeleGeography](https://www.submarinecablemap.com) | 694 cable systems |

### Provider Sustainability Reports

| Provider | PUE (Global) | WUE (L/kWh) | Report Frequency |
|----------|-------------|-------------|-----------------|
| **Google** | 1.09 | ~0.001 | Quarterly per-campus |
| **AWS** | 1.15 | 0.18 | Annual (first published 2024) |
| **Microsoft** | 1.17 | 0.27 | Annual by region |
| Industry average | 1.56 | varies | Uptime Institute survey |

### Water Stress

| Source | What | Access |
|--------|------|--------|
| [WRI Aqueduct 4.0](https://www.wri.org/aqueduct) | 13 water risk indicators, sub-basin granularity | CC BY 4.0 |
| Future projections | 2030/2050/2080 water stress scenarios | Included in Aqueduct |

### GPU Power Specifications

| GPU | TDP | FP8 TFLOPS | Common Use |
|-----|-----|-----------|-----------|
| NVIDIA H100 SXM | 700W | 3,958 | Frontier model inference |
| NVIDIA H100 PCIe | 350W | 1,979 | Standard inference |
| NVIDIA A100 | 400W | 1,248 (INT8) | Widespread deployment |
| NVIDIA L40S | 350W | 733 | Cost-optimized inference |
| Google TPU v5p | 250–300W | 459 | Google-internal |

## Module Structure

```
packages/ecotrace/
├── src/
│   ├── index.ts                  # Public API barrel export
│   ├── attribution.ts            # Subpath: @tmnl/ecotrace/attribution
│   ├── proxy.ts                  # Subpath: @tmnl/ecotrace/proxy
│   ├── data.ts                   # Subpath: @tmnl/ecotrace/data
│   │
│   ├── models/                   # Effect Schema domain models
│   │   ├── Request.ts            # LLM request envelope
│   │   ├── Attribution.ts        # Carbon + water + energy result
│   │   ├── Datacenter.ts         # Facility profile (PUE, WUE, location, cooling)
│   │   ├── NetworkPath.ts        # Traceroute hops with ASN + geolocation
│   │   ├── GridIntensity.ts      # Real-time carbon intensity snapshot
│   │   └── Scenario.ts           # What-if simulation parameters
│   │
│   ├── services/                 # Effect.Service definitions
│   │   ├── AttributionEngine.ts  # Core computation: request → environmental impact
│   │   ├── DatacenterResolver.ts # IP → ASN → provider → facility → profile
│   │   ├── GridIntensity.ts      # Real-time carbon intensity lookups
│   │   ├── WaterStress.ts        # Regional water risk assessment
│   │   ├── NetworkTracer.ts      # Traceroute + BGP path analysis
│   │   ├── EnergyEstimator.ts    # Model-aware energy-per-token estimation
│   │   └── ScenarioEngine.ts     # Multi-scenario what-if simulations
│   │
│   ├── data/                     # Static + cached reference data
│   │   ├── egrid-subregions.ts   # EPA eGRID CO₂e factors by U.S. subregion
│   │   ├── provider-profiles.ts  # Known PUE/WUE by provider + region
│   │   ├── gpu-specs.ts          # TDP + throughput by GPU model
│   │   └── model-registry.ts     # Known model → parameter count → energy profile
│   │
│   └── lib/                      # Shared utilities
│       ├── formulas.ts           # Pure math: carbon, water, energy calculations
│       ├── units.ts              # Unit conversions (Wh↔J, L↔gal, lb↔kg)
│       └── geo.ts                # Haversine distance, submarine cable detection
│
├── test/
│   ├── formulas.test.ts          # Unit tests for pure calculation functions
│   ├── attribution.test.ts       # Integration: full request → impact pipeline
│   └── scenarios.test.ts         # Scenario engine validation
│
├── package.json
├── project.json
├── tsconfig.json
├── vitest.config.ts
├── README.md                     # ← You are here
└── AGENTS.md                     # Agent handoff documentation
```

## API Design (Planned)

### Basic Usage

```typescript
import { AttributionEngine } from "@tmnl/ecotrace/attribution"
import { Effect } from "effect"

// Estimate impact for a known request
const impact = Effect.gen(function* () {
  const engine = yield* AttributionEngine
  
  return yield* engine.attribute({
    provider: "openai",
    model: "gpt-4o",
    tokensIn: 500,
    tokensOut: 200,
    region: "us-east-1",          // Optional: auto-detected from IP if omitted
    timestamp: new Date(),         // Optional: for time-of-day grid intensity
  })
})

// Result shape:
// {
//   carbon: { kg: 0.000142, context: "equivalent to 1.4m of driving" },
//   water: {
//     scope1: { liters: 0.0003, note: "datacenter cooling" },
//     scope2: { liters: 0.0025, note: "electricity generation" },
//     total: { liters: 0.0028, context: "0.6% of a water bottle" }
//   },
//   energy: { wh: 0.34, joules: 1224 },
//   network: {
//     hops: 14,
//     countries: ["US"],
//     submarineCables: [],
//     estimatedNetworkEnergy: { wh: 0.002 }
//   },
//   datacenter: {
//     provider: "Microsoft",
//     region: "East US",
//     facility: "Boydton, Virginia",
//     pue: 1.16,
//     wue: 0.38,
//     gridCarbonIntensity: 0.535,
//     waterStress: "medium-high",
//     coolingMethod: "evaporative"
//   },
//   confidence: "estimated",       // "measured" | "estimated" | "default"
//   methodology: "ecotrace-v1"
// }
```

### Scenario Comparison

```typescript
import { ScenarioEngine } from "@tmnl/ecotrace/attribution"
import { Effect } from "effect"

const comparison = Effect.gen(function* () {
  const scenarios = yield* ScenarioEngine
  
  return yield* scenarios.compare({
    request: {
      model: "gpt-4o",
      tokensIn: 500,
      tokensOut: 200,
    },
    scenarios: [
      { region: "us-east-1", label: "Virginia (coal+gas grid)" },
      { region: "us-west-2", label: "Oregon (hydro grid)" },
      { region: "eu-north-1", label: "Stockholm (near-zero carbon)" },
      { region: "us-east-1", time: "02:00", label: "Virginia at 2am (lower demand)" },
    ]
  })
})

// Returns array of attributions, one per scenario, with delta comparisons
```

### Cumulative Tracking

```typescript
import { Ecotrace } from "@tmnl/ecotrace"
import { Effect } from "effect"

const report = Effect.gen(function* () {
  const tracker = yield* Ecotrace
  
  // Get cumulative impact for a time range
  return yield* tracker.report({
    from: new Date("2025-01-01"),
    to: new Date("2025-01-31"),
    groupBy: "day",    // "hour" | "day" | "week" | "model" | "provider"
  })
})
```

## Deployment

### Self-Hosted (Docker)

```bash
# Single command to run everything
docker compose up -d

# Or with custom config
ECOTRACE_ELECTRICITY_MAPS_TOKEN=xxx docker compose up -d
```

### Library Only (No Proxy)

```bash
bun add @tmnl/ecotrace
```

Use the attribution engine directly without the proxy layer — useful for server-side estimation in your own applications.

## Methodology Notes

### What We Measure vs. What We Estimate

| Aspect | Method | Confidence |
|--------|--------|-----------|
| Token count (output) | **Measured** from API response | High |
| Token count (input) | **Estimated** from character count | Medium |
| Destination datacenter | **Resolved** from IP geolocation + ASN | Medium-High |
| PUE | **Looked up** from provider reports | High (published data) |
| WUE | **Looked up** from provider reports | Medium (less published) |
| Grid carbon intensity | **Real-time** from Electricity Maps | High |
| Energy per token | **Modeled** from parametric curves | Medium |
| Network path energy | **Estimated** from hop count × avg router power | Low |
| Embodied carbon | **Estimated** from GPU amortization models | Low |

### Limitations We're Honest About

1. **Token counting for proprietary models is imprecise.** We measure output tokens from the API response but estimate input tokenization (varies by model tokenizer).

2. **Datacenter identification sometimes resolves to a region, not a specific facility.** AWS "us-east-1" could be any of ~6 availability zones across Virginia.

3. **Embodied carbon (GPU manufacturing) is poorly characterized.** We use industry ranges, not exact figures, because manufacturers don't publish them.

4. **We don't measure actual GPU power draw.** That requires on-metal instrumentation (NVML). We estimate from published benchmarks and parametric models.

5. **Time-of-day grid effects are real but hard to pin to a specific request.** We use the grid intensity at request time, but the actual electron mix serving that datacenter is more complex.

6. **Certificate pinning in some SDKs may resist MITM interception.** The proxy works with standard HTTPS but some hardened clients (e.g., mobile SDKs) may refuse the local CA.

### Why Our Numbers Might Differ From Others

- **We use production-scale estimates**, not single-GPU benchmarks. This means our per-request numbers are **lower** than most public estimates (which overstate by 4–20×).
- **We include Scope 2 water** (electricity generation), which most tools ignore. This makes our water numbers **higher** than tools that only count datacenter cooling.
- **We account for PUE**, which adds 9–28% overhead to raw GPU energy. Tools that measure only GPU wattage undercount by this factor.

## Research References

### Foundational Papers

- Faiz et al. (2024) — "LLMCarbon: Modeling the End-to-End Carbon Footprint of Large Language Models" (ICLR 2024)
- Li et al. (2023) — "Making AI Less 'Thirsty': Uncovering and Addressing the Secret Water Footprint of AI Models"
- Wilhelm et al. (2025) — "Advocating Energy-per-Token in LLM Inference" (EuroMLSys 2025)
- TokenPowerBench (2025) — "Benchmarking the Power Consumption of LLM Inference" (arXiv:2512.03024)
- LLMCO2 (2025) — "Advancing Accurate Carbon Footprint Prediction for LLM Inferences" (HotCarbon 2025)

### Datasets

- [EPA eGRID 2023](https://www.epa.gov/egrid) — U.S. grid emission factors by subregion
- [OpenEI Hourly Emission Factors](https://data.openei.org/submissions/276) — Hourly CO₂/NOx/SO₂ by eGRID subregion
- [ML.ENERGY Leaderboard](https://ml.energy/leaderboard) — GPU energy benchmarks for LLM inference
- [WRI Aqueduct 4.0](https://www.wri.org/aqueduct) — Global water risk indicators

### Industry Reports

- Google Environmental Report 2024/2025 — Per-campus PUE, 64→66% carbon-free energy
- AWS Sustainability Report 2024 — First-ever published PUE (1.15 global)
- Microsoft Environmental Sustainability Report 2024 — Regional PUE/WUE, zero-water cooling goals
- Uptime Institute Global Data Center Survey 2024 — Industry average PUE 1.56

## Contributing

This is an open project within the GBG monorepo. If you want to:

- **Add a data source**: See `src/data/` for the pattern. Static data goes in TypeScript files, API integrations go in `src/services/`.
- **Improve energy models**: The parametric model in `EnergyEstimator.ts` is calibrated against ML.ENERGY data. Better calibration data is always welcome.
- **Add provider profiles**: `src/data/provider-profiles.ts` contains known PUE/WUE figures. Update when providers publish new data.

## License

MIT

---

*"Nothing exists until it is measured."* — Niels Bohr (also the CodeCarbon team's motto, and now ours)
