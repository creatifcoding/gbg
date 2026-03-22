# Migration Guide: v2 to v3

## Key Architectural Changes

| Aspect | v2 | v3 |
|--------|----|----|
| **Type System** | Raw TypeScript interfaces | Effect Schema (TaggedClass, TaggedStruct) |
| **IDs** | Plain strings | Branded identifiers (`SiteId = SIT-{slug}`) |
| **State Management** | Direct DB calls | State services (hexagonal port pattern) |
| **Entities** | Manual service classes | @effect/cluster Entity actors |
| **State Transitions** | Ad-hoc validation | @effect/experimental Machine (graph-validated) |
| **RPC** | Custom HTTP routes | @effect/rpc typed groups |
| **Event Sourcing** | All or nothing | Hybrid per-domain (feature-flag gated) |
| **Layer Composition** | Manual wiring | Pre-composed deployment profiles |
| **Realtime** | Custom WebSocket | ChannelService + RpcServer WebSocket |
| **Testing** | Mocked dependencies | In-memory state layers (self-contained) |

## Migration Checklist

### 1. Schema Migration

**Before (v2):**
```typescript
interface Site {
  id: string
  name: string
  status: 'active' | 'inactive' | 'maintenance'
  enterpriseId: string
  timezone: string
  address?: string
}
```

**After (v3):**
```typescript
export const SiteId = Schema.String.pipe(
  Schema.pattern(/^SIT-[a-zA-Z0-9-]+$/),
  Schema.brand('SiteId'),
)
export type SiteId = typeof SiteId.Type

export const SiteStatus = Schema.Literal(
  'planned', 'under_construction', 'operational',
  'seasonal_shutdown', 'closed', 'decommissioned',
)

export class Site extends Schema.TaggedClass<Site>()('Site', {
  id: SiteId,
  ...BaseAssetFields,
  status: SiteStatus,
  enterpriseId: EnterpriseId,
  timezone: Schema.String,
  address: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  isOperational(): boolean {
    return this.status === 'operational'
  }
}
```

**What changed:**
- `string` IDs become branded (`SiteId`, `EnterpriseId`)
- Union types become `Schema.Literal`
- Optional fields become `Schema.optionalWith(..., { as: 'Option' })`
- Entity class gets `Schema.TaggedClass` with instance methods
- Status enums are domain-specific (not generic)

### 2. State Service Migration

**Before (v2):**
```typescript
class SiteService {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Site | null> {
    return this.db.query('SELECT * FROM sites WHERE id = $1', [id])
  }

  async create(data: CreateSiteInput): Promise<Site> {
    return this.db.query('INSERT INTO sites ...', [data])
  }
}
```

**After (v3):**
```typescript
// Interface (port)
export interface SiteStateShape {
  readonly create: (params: CreateSiteParams) => Effect.Effect<Site>
  readonly get: (id: SiteId) => Effect.Effect<Site, SiteStateNotFoundError>
  readonly set: (site: Site) => Effect.Effect<void>
  readonly list: (filter: SiteFilter) => Effect.Effect<readonly Site[]>
  readonly delete: (id: SiteId) => Effect.Effect<boolean>
}

// Context tag
export class SiteState extends Context.Tag('iiot/SiteState')<
  SiteState, SiteStateShape
>() {}

// In-memory adapter (testing)
export const SiteStateInMemory: Layer.Layer<SiteState> = Layer.effect(/*...*/)

// SQL adapter (production) — bridges to SiteRepo
export const makeSiteStateSql = (repo: { /* ... */ }): SiteStateShape => ({ /* ... */ })
```

**What changed:**
- Class with constructor injection becomes Effect Context.Tag
- Promise-based methods become Effect.Effect
- `null` returns become `Option<T>` via Effect
- Two implementations: in-memory (testing) and SQL (production)
- No `async/await` — pure Effect pipelines

### 3. Entity Handler Migration

**Before (v2):**
```typescript
// Express/Fastify route handler
app.post('/api/sites', async (req, res) => {
  try {
    const site = await siteService.create(req.body)
    res.json(site)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})
```

**After (v3):**
```typescript
// Entity + Machine + RPC
export const SiteEntityHandlers = SiteEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* SiteState
    const flags = yield* IIoTFeatureFlags
    const actor = yield* Machine.boot(makeSiteMachine({ state, flags }))

    return SiteEntity.of({
      'Site.Create': (envelope) =>
        actor.send(new InternalCreateSite({ params: envelope.payload })).pipe(
          Effect.catchTag('MachineCreateError', (e) =>
            Effect.fail(new RpcQueryError({ operation: 'create', message: e.message }))
          )
        ),
    })
  })
)
```

**What changed:**
- HTTP routes become RPC definitions with typed schemas
- Manual error handling becomes `Effect.catchTags` with typed errors
- State transitions are validated by Machine state graphs
- Handlers are Layers, composed into deployment stacks
- No `try/catch` — typed error channels

### 4. Test Migration

**Before (v2):**
```typescript
describe('SiteService', () => {
  let db: MockDatabase
  let service: SiteService

  beforeEach(() => {
    db = new MockDatabase()
    service = new SiteService(db)
  })

  it('creates a site', async () => {
    const site = await service.create({ name: 'Test', ... })
    expect(site.id).toBeDefined()
  })
})
```

**After (v3):**
```typescript
import { IIoTTestLayer } from '../layers'

describe('SiteEntity', () => {
  it('creates a site', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const state = yield* SiteState
        const site = yield* state.create({
          slug: 'test',
          name: 'Test',
          enterpriseId: 'ENT-test' as EnterpriseId,
          timezone: 'UTC',
          status: Option.none(),
        })
        expect(site.id).toMatch(/^SIT-/)
      }).pipe(Effect.provide(IIoTTestLayer))
    )
  })
})
```

**What changed:**
- No manual mock setup — `IIoTTestLayer` provides everything
- Self-contained: in-memory state, disabled feature flags, all 12 entity handlers
- Typed errors — no uncaught exceptions
- `Effect.runPromise` bridges Effect to vitest

### 5. Layer Composition Migration

**Before (v2):**
```typescript
// Manual dependency wiring
const db = new Database(config)
const siteRepo = new SiteRepo(db)
const siteService = new SiteService(siteRepo)
const siteController = new SiteController(siteService)
app.use('/api/sites', siteController.router)
```

**After (v3):**
```typescript
// Layer composition
const IIoTClusterLayer = pipe(
  EntityProductionHandlersWithEvents,     // 12 entity handlers + events ON
  Layer.provide(AllStateServicesSql),      // 12 SQL-backed state services
  Layer.provide(IIoTRepositoriesLive),     // 12 repositories
)
// Requires: SqlClient.SqlClient

// Or config-driven:
const IIoTRuntimeLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const { mode } = yield* DeploymentModeConfig
    switch (mode) {
      case 'test':    return IIoTTestLayer
      case 'cluster': return IIoTClusterLayer
    }
  })
)
```

**What changed:**
- No manual wiring — Layer composition handles dependency graph
- Deployment profiles: Test, Cluster, Runtime (config-driven)
- Type-safe: compiler verifies all dependencies are satisfied
- Swappable: change `IIoTTestLayer` to `IIoTClusterLayer` to switch persistence

## Common Pitfalls

### 1. Using `undefined` instead of `Option`

```typescript
// WRONG: v2 style
const address = site.address ?? 'N/A'

// RIGHT: v3 style
const address = Option.getOrElse(site.address, () => 'N/A')
```

### 2. Using plain string IDs

```typescript
// WRONG: v2 style
const siteId: string = 'my-site'

// RIGHT: v3 style
const siteId: SiteId = makeSiteId('my-site')  // 'SIT-my-site'
```

### 3. Direct state mutation without Machine

```typescript
// WRONG: bypassing state graph validation
yield* state.set(new Site({ ...site, status: 'operational' }))

// RIGHT: go through Machine for graph-validated transitions
yield* actor.send(new InternalCommission({ siteId: site.id }))
```

### 4. Using `try/catch` instead of Effect error channels

```typescript
// WRONG: v2 error handling
try {
  const site = await siteService.get(id)
} catch (e) {
  if (e instanceof NotFoundError) { /* ... */ }
}

// RIGHT: v3 typed error channels
const site = yield* state.get(id).pipe(
  Effect.catchTag('SiteStateNotFoundError', (e) =>
    Effect.fail(new RpcNotFoundError({ siteId: e.siteId }))
  )
)
```

### 5. Creating atoms or state inside components

```typescript
// WRONG: v2 React state
const [sites, setSites] = useState<Site[]>([])

// RIGHT: v3 effect-atom
export const sitesAtom = Atom.make<Site[]>([])
// In component: const sites = useAtomValue(sitesAtom)
```

## File Mapping Reference

| v2 Location | v3 Location |
|-------------|-------------|
| `models/Site.ts` (interface) | `schemas/assets/site/schema.ts` (Effect Schema) |
| `services/SiteService.ts` | `state/SiteState.ts` + `entity/SiteEntity.ts` |
| `repos/SiteRepo.ts` (ORM) | `repos/SiteRepo.ts` (manual SQL + decode) |
| `routes/sites.ts` (Express) | `rpc/SiteRpcs.ts` + `http/` handlers |
| `__tests__/setup.ts` (mocks) | `layers/index.ts` (`IIoTTestLayer`) |
| `config/features.ts` | `infrastructure/feature-flags.ts` (Effect Config) |
