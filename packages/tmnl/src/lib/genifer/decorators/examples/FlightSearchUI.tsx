/**
 * EXAMPLE: React component consuming decorated ActionGroup via atoms.
 *
 * No prop drilling. No useState. No useEffect for data fetching.
 * Just atoms all the way down.
 *
 * ```
 * FlightSearchUI
 * ├── reads from: flight-search ActionGroup atoms
 * │   ├── query (Atom<string>)
 * │   ├── results (Atom<Flight[]>)
 * │   ├── loading (Atom<boolean>)
 * │   └── error (Atom<string | null>)
 * ├── dispatches to: flight-search actions
 * │   ├── search → calls OpenSky API, updates results atom
 * │   ├── clear → resets all atoms
 * │   └── setQuery → updates query atom
 * └── subscribes to: FlightSearched events
 * ```
 *
 * @module genifer/decorators/examples/FlightSearchUI
 */

import React from 'react'
import * as Atom from '@effect-atom/atom/Atom'
import {
  useActionGroup,
  useActionGroupState,
  useActionGroupDispatch,
  useGeniferEvent,
} from '../hooks'

// =============================================================================
// Full Flight Search — uses useActionGroup for everything
// =============================================================================

export function FlightSearchUI() {
  const { state, dispatch, atoms, derived } = useActionGroup('flight-search')

  return (
    <div className="flex flex-col gap-4 p-6 bg-stone-950 rounded-xl border border-stone-800">
      {/* Search Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={state.query ?? ''}
          onChange={e => Atom.set(atoms.query, e.target.value)}
          onKeyDown={e => e.key === 'Enter' && dispatch('search')}
          placeholder="Search flights (e.g., DLH, UAL)..."
          className="flex-1 px-4 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-200 font-mono placeholder:text-stone-600"
          style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
        />
        <button
          onClick={() => dispatch('search')}
          disabled={state.loading}
          className="px-6 py-2 bg-cyan-900/50 border border-cyan-700/50 rounded-lg text-cyan-300 font-mono hover:bg-cyan-800/50 disabled:opacity-50"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          {state.loading ? 'Searching...' : 'Search'}
        </button>
        <button
          onClick={() => dispatch('clear')}
          className="px-4 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-400 font-mono hover:bg-stone-800"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          Clear
        </button>
      </div>

      {/* Error */}
      {state.error && (
        <div
          className="px-4 py-2 bg-red-950/50 border border-red-800/50 rounded-lg text-red-400 font-mono"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          {state.error}
        </div>
      )}

      {/* Stats Bar */}
      <div className="flex gap-4 items-center">
        <span
          className="text-stone-500 font-mono"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {derived.resultCount ?? 0} flights
        </span>
        <span
          className="text-stone-500 font-mono"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {derived.airborneCount ?? 0} airborne
        </span>
        {state.lastSearchMs > 0 && (
          <span
            className="text-stone-600 font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {state.lastSearchMs}ms
          </span>
        )}
      </div>

      {/* Results Table */}
      {derived.hasResults && (
        <div className="overflow-auto max-h-96 border border-stone-800 rounded-lg">
          <table className="w-full">
            <thead className="bg-stone-900 sticky top-0">
              <tr>
                {['Callsign', 'Origin', 'Alt (m)', 'Vel (m/s)', 'Status'].map(h => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-stone-400 font-mono border-b border-stone-800"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(state.results ?? []).map((flight: any, i: number) => (
                <tr
                  key={flight.icao24 ?? i}
                  className="border-b border-stone-900 hover:bg-stone-900/50"
                >
                  <td
                    className="px-3 py-1.5 text-cyan-400 font-mono"
                    style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                  >
                    {flight.callsign?.trim() || flight.icao24}
                  </td>
                  <td
                    className="px-3 py-1.5 text-stone-300 font-mono"
                    style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                  >
                    {flight.originCountry}
                  </td>
                  <td
                    className="px-3 py-1.5 text-stone-400 font-mono"
                    style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                  >
                    {flight.altitude?.toFixed(0) ?? '—'}
                  </td>
                  <td
                    className="px-3 py-1.5 text-stone-400 font-mono"
                    style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                  >
                    {flight.velocity?.toFixed(1) ?? '—'}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        flight.onGround ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                    <span
                      className="ml-2 text-stone-500 font-mono"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      {flight.onGround ? 'Ground' : 'Airborne'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Optimized — Subscribe to only what you need
// =============================================================================

/** Just the search input — only re-renders when query changes */
export function FlightSearchInput() {
  const query = useActionGroupState<string>('flight-search', 'query')
  const dispatch = useActionGroupDispatch('flight-search')
  const allGroups = useActionGroup('flight-search')
  const queryAtom = allGroups.atoms.query

  return (
    <input
      type="text"
      value={query ?? ''}
      onChange={e => Atom.set(queryAtom, e.target.value)}
      onKeyDown={e => e.key === 'Enter' && dispatch('search')}
      placeholder="Search flights..."
      className="px-4 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-200 font-mono"
      style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
    />
  )
}

/** Just the result count — only re-renders when results change */
export function FlightResultCount() {
  const results = useActionGroupState<unknown[]>('flight-search', 'results')
  return (
    <span
      className="text-stone-500 font-mono"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {results?.length ?? 0} flights
    </span>
  )
}

/** Event trace — shows last search event */
export function FlightSearchTrace() {
  const lastSearch = useGeniferEvent<{
    query: string
    resultCount: number
    durationMs: number
  }>('FlightSearched')

  if (!lastSearch) return null

  return (
    <div
      className="px-3 py-1.5 bg-stone-900/50 rounded border border-stone-800 text-stone-600 font-mono"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      Last: "{lastSearch.query}" → {lastSearch.resultCount} results in {lastSearch.durationMs}ms
    </div>
  )
}
