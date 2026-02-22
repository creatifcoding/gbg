/**
 * EXAMPLE: Full decorator usage — "Give me a search bar against OpenSky"
 *
 * This file demonstrates every decorator family working in tandem with Effect:
 *   - Schema.Class for typed, validated data
 *   - @actionGroup / @action / @state / @computed for reactive state
 *   - @rpc / @handler for dynamic RPC definition
 *   - @event / @emits for event bus wiring
 *   - @tool for LLM tool registration
 *   - @traced / @span for observability
 *   - @validated / @schema for runtime validation
 *
 * Every class has real methods. Every field is an atom.
 * React subscribes. LLM generates. Same runtime.
 *
 * @module genifer/decorators/examples/flight-search
 */

import { Schema, Effect } from 'effect'
import { HttpClient } from '@effect/platform'
import { component, renders } from '../component'
import { actionGroup, action, state, computed, ActionGroupAtoms } from '../action-group'
import { rpc, handler, success, error as rpcError } from '../rpc'
import { event, emits } from '../event'
import { tool, param, result } from '../tool'
import { traced, span } from '../traced'
import { validated, schema } from '../validated'

// =============================================================================
// 1. DOMAIN SCHEMAS — Schema.Class for typed, validated data
// =============================================================================

/** A single flight from OpenSky */
class Flight extends Schema.Class<Flight>('Flight')({
  icao24: Schema.String,
  callsign: Schema.NullOr(Schema.String),
  originCountry: Schema.String,
  longitude: Schema.NullOr(Schema.Number),
  latitude: Schema.NullOr(Schema.Number),
  altitude: Schema.NullOr(Schema.Number),
  velocity: Schema.NullOr(Schema.Number),
  onGround: Schema.Boolean,
}) {
  get displayName(): string {
    return this.callsign?.trim() || this.icao24
  }

  get position(): { lat: number; lon: number } | null {
    if (this.latitude == null || this.longitude == null) return null
    return { lat: this.latitude, lon: this.longitude }
  }
}

/** Bounding box for geographic queries */
class BoundingBox extends Schema.Class<BoundingBox>('BoundingBox')({
  minLat: Schema.Number,
  maxLat: Schema.Number,
  minLon: Schema.Number,
  maxLon: Schema.Number,
}) {
  get isValid(): boolean {
    return this.minLat < this.maxLat && this.minLon < this.maxLon
  }
}

// =============================================================================
// 2. CUSTOM EVENT — Schema.TaggedClass + @event decorator
// =============================================================================

@event('FlightSearched', { persistent: true })
class FlightSearchedEvent extends Schema.TaggedClass<FlightSearchedEvent>()(
  'FlightSearchedEvent',
  {
    query: Schema.String,
    resultCount: Schema.Number,
    durationMs: Schema.Number,
    timestamp: Schema.Number,
  },
) {
  get isSlowSearch(): boolean {
    return this.durationMs > 2000
  }
}

// =============================================================================
// 3. DYNAMIC RPC — Schema.Class + @rpc + @handler
// =============================================================================

@rpc('opensky/SearchFlights', {
  description: 'Search real-time flight data from OpenSky Network API',
})
class SearchFlightsRpc extends Schema.Class<SearchFlightsRpc>('SearchFlightsRpc')({
  query: Schema.optional(Schema.String),
  bbox: Schema.optional(BoundingBox),
}) {
  @success()
  static readonly Result = Schema.Array(Flight)

  @rpcError()
  static readonly Error = Schema.TaggedError<SearchFlightsError>()(
    'SearchFlightsError',
    { message: Schema.String },
  )

  @handler({ _tag: 'custom' })
  @traced
  execute() {
    return Effect.gen(function*(this: SearchFlightsRpc) {
      const http = yield* HttpClient.HttpClient

      // Build URL with query params
      let url = 'https://opensky-network.org/api/states/all'
      const params = new URLSearchParams()
      if (this.bbox) {
        params.set('lamin', String(this.bbox.minLat))
        params.set('lamax', String(this.bbox.maxLat))
        params.set('lomin', String(this.bbox.minLon))
        params.set('lomax', String(this.bbox.maxLon))
      }
      const qs = params.toString()
      if (qs) url += `?${qs}`

      const response = yield* http.get(url)
      const data = yield* response.json as Effect.Effect<{
        states: Array<Array<unknown>>
      }>

      // Parse OpenSky response into Flight instances
      const flights = (data.states ?? [])
        .filter((s: unknown[]) => {
          if (!this.query) return true
          const callsign = (s[1] as string)?.trim().toLowerCase() ?? ''
          return callsign.includes(this.query.toLowerCase())
        })
        .map((s: unknown[]) => new Flight({
          icao24: s[0] as string,
          callsign: s[1] as string | null,
          originCountry: s[2] as string,
          longitude: s[5] as number | null,
          latitude: s[6] as number | null,
          altitude: s[7] as number | null,
          velocity: s[9] as number | null,
          onGround: s[8] as boolean,
        }))

      return flights
    }.bind(this))
  }
}

// Standalone error class for the TaggedError
class SearchFlightsError extends Schema.TaggedError<SearchFlightsError>()(
  'SearchFlightsError',
  { message: Schema.String },
) {}

// =============================================================================
// 4. ACTION GROUP — Schema.Class + @actionGroup + @action + @state + @computed
//    Every field is an Atom. Every method operates on atoms. React subscribes.
// =============================================================================

@actionGroup('flight-search', {
  description: 'Search and display real-time flight data from OpenSky Network',
})
class FlightSearch extends Schema.Class<FlightSearch>('FlightSearch')({
  query: Schema.optionalWith(Schema.String, { default: () => '' }),
  results: Schema.optionalWith(Schema.Array(Flight), { default: () => [] }),
  loading: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  error: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  lastSearchMs: Schema.optionalWith(Schema.Number, { default: () => 0 }),
}) {
  // --- Actions: Real methods that read/write atoms ---

  @action('search', { type: 'callRpc', debounceMs: 300 })
  @emits('FlightSearched')
  @span('flight-search.execute')
  search() {
    return Effect.gen(function*() {
      const atoms = yield* ActionGroupAtoms
      yield* atoms.set('loading', true)
      yield* atoms.set('error', null)

      const query = yield* atoms.get<string>('query')
      const start = Date.now()

      // Create and execute the RPC
      const rpcInstance = new SearchFlightsRpc({ query })
      const flights = yield* rpcInstance.execute()

      const durationMs = Date.now() - start

      yield* atoms.set('results', flights)
      yield* atoms.set('loading', false)
      yield* atoms.set('lastSearchMs', durationMs)

      // Return value used by @emits('FlightSearched') decorator
      return new FlightSearchedEvent({
        query,
        resultCount: flights.length,
        durationMs,
        timestamp: Date.now(),
      })
    }).pipe(
      Effect.catchAll((err) =>
        Effect.gen(function*() {
          const atoms = yield* ActionGroupAtoms
          yield* atoms.set('loading', false)
          yield* atoms.set('error', String(err))
          return new FlightSearchedEvent({
            query: '',
            resultCount: 0,
            durationMs: 0,
            timestamp: Date.now(),
          })
        })
      )
    )
  }

  @action('clear')
  clear() {
    // Plain object return → partial state update (each key sets the atom)
    return { query: '', results: [], error: null }
  }

  @action('setQuery')
  setQuery() {
    // For controlled input binding — payload is the new query string
    return Effect.gen(function*() {
      const atoms = yield* ActionGroupAtoms
      // payload comes from dispatch('setQuery', 'DLH')
      // but we can't receive it here directly in the class method —
      // the dispatch wrapper passes it as the first arg
    })
  }

  // --- Computed: Derived atoms, auto-recalculate ---

  @computed
  get resultCount(): number {
    return this.results.length
  }

  @computed
  get hasResults(): boolean {
    return this.results.length > 0
  }

  @computed
  get airborneCount(): number {
    return this.results.filter(f => !f.onGround).length
  }
}

// =============================================================================
// 5. COMPONENT — Schema.Class + @component + @renders
// =============================================================================

@component({
  domain: 'interactive',
  tier: 'domain',
  description: 'Pre-wired flight search bar with OpenSky integration',
  hasChildren: false,
})
class FlightSearchBar extends Schema.Class<FlightSearchBar>('FlightSearchBar')({
  placeholder: Schema.optionalWith(Schema.String, { default: () => 'Search flights...' }),
  actionGroup: Schema.optionalWith(Schema.String, { default: () => 'flight-search' }),
}) {
  /** This would be the renderer in the catalog — shown here for completeness */
  @renders()
  render() {
    // In real usage, this returns JSX that uses useActionGroup(this.actionGroup)
    // to subscribe to atoms and dispatch actions
    return null
  }
}

// =============================================================================
// 6. TOOL — Schema.Class + @tool + @param + @result
// =============================================================================

@tool({
  name: 'search_opensky',
  label: 'Search OpenSky',
  description: 'Search real-time flight data from OpenSky Network. Returns flight positions, callsigns, and status.',
  rendererStyle: 'table',
})
class SearchOpenskyTool extends Schema.Class<SearchOpenskyTool>('SearchOpenskyTool')({
  query: Schema.String.annotations({ description: 'Flight callsign or partial match (e.g., "DLH", "UAL")' }),
  limit: Schema.optionalWith(Schema.Number.annotations({ description: 'Max results to return' }), { default: () => 20 }),
}) {
  @result()
  static readonly Result = Schema.Array(Flight)

  @traced
  execute() {
    return Effect.gen(function*(this: SearchOpenskyTool) {
      const rpcInstance = new SearchFlightsRpc({ query: this.query })
      const flights = yield* rpcInstance.execute()
      return flights.slice(0, this.limit)
    }.bind(this))
  }
}

// =============================================================================
// 7. VALIDATION EXAMPLE — @validated + @schema
// =============================================================================

class FlightValidator {
  @validated
  validateBoundingBox(@schema(BoundingBox) bbox: BoundingBox): boolean {
    return bbox.isValid
  }

  @validated
  @traced
  enrichFlight(@schema(Flight) flight: Flight) {
    return Effect.gen(function*() {
      yield* Effect.annotateCurrentSpan('callsign', flight.displayName)
      // ... enrich with additional data
      return flight
    })
  }
}

// =============================================================================
// EXPORTS — Make everything available
// =============================================================================

export {
  Flight,
  BoundingBox,
  FlightSearchedEvent,
  SearchFlightsRpc,
  FlightSearch,
  FlightSearchBar,
  SearchOpenskyTool,
  FlightValidator,
}
