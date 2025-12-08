/**
 * TMNL Search Laboratory
 *
 * Exotic testbed showcasing Stream-first search with:
 * - Progressive result cascade (36K+ Wikipedia movies)
 * - Live stream monitor
 * - Benchmark duel (FlexSearch vs Linear)
 * - Fiber cancellation visualization
 *
 * Design: TMNL_TOKENS compliant
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Effect, Stream, Fiber } from 'effect'
import {
  createFlexSearchDriver,
  createLinearDriver,
  withMinScore,
  consoleTracedStream,
  type SearchServiceImpl,
  type SearchResult,
  type SearchError,
} from '@/lib/search'
import { TMNL_TOKENS } from '@/components/tldraw/shapes/data-grid-theme'
import { EASING } from '@/lib/animation/tokens'
import moviesData from '@/assets/data/movies.json'

// ─────────────────────────────────────────────────────────────────────────────
// Movie Types (from Wikipedia movie data)
// ─────────────────────────────────────────────────────────────────────────────

interface MovieItem {
  id: string
  title: string
  year: number
  cast: string[]
  genres: string[]
  href: string | null
  extract?: string
  thumbnail?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Design System Constants
// ─────────────────────────────────────────────────────────────────────────────

const T = TMNL_TOKENS

const STYLES = {
  // Backgrounds
  bgPrimary: { backgroundColor: T.colors.backgroundPrimary },
  bgSecondary: { backgroundColor: T.colors.backgroundSecondary },
  bgTertiary: { backgroundColor: T.colors.backgroundTertiary },
  bgHover: { backgroundColor: T.colors.backgroundHover },

  // Text
  textPrimary: { color: T.colors.textPrimary },
  textSecondary: { color: T.colors.textSecondary },
  textMuted: { color: T.colors.textMuted },

  // Borders
  borderDefault: { borderColor: T.colors.borderDefault },
  borderMuted: { borderColor: T.colors.borderMuted },

  // Accents
  accentCyan: { color: T.colors.accentCyan },
  accentGreen: { color: T.colors.accentGreen },
  accentYellow: { color: T.colors.accentYellow },
  accentRed: { color: T.colors.accentRed },

  // Typography
  fontMono: {
    fontFamily: T.typography.fontFamily.join(', '),
  },
} as const

// Spring config from animation tokens
const SPRING_SNAPPY = EASING.spring.snappy

// ─────────────────────────────────────────────────────────────────────────────
// Movie Data Processing
// ─────────────────────────────────────────────────────────────────────────────

// Raw movie type from JSON
interface RawMovie {
  title: string
  year: number
  cast: string[]
  genres: string[]
  href: string | null
  extract?: string
  thumbnail?: string
}

// Process raw movies into searchable items with IDs
const processMovies = (limit?: number): MovieItem[] => {
  const raw = moviesData as RawMovie[]
  const slice = limit ? raw.slice(0, limit) : raw
  return slice.map((movie, i) => ({
    id: `movie-${i}`,
    title: movie.title,
    year: movie.year,
    cast: movie.cast,
    genres: movie.genres,
    href: movie.href,
    extract: movie.extract,
    thumbnail: movie.thumbnail,
  }))
}

// Get decade label for year
const getDecade = (year: number): string => `${Math.floor(year / 10) * 10}s`

// ─────────────────────────────────────────────────────────────────────────────
// Stream Search Hook
// ─────────────────────────────────────────────────────────────────────────────

interface StreamStats {
  chunks: number
  items: number
  ms: number
}

type StreamStatus = 'idle' | 'streaming' | 'complete' | 'cancelled'

const useSearchStream = (driver: SearchServiceImpl<MovieItem> | null) => {
  const fiberRef = useRef<Fiber.RuntimeFiber<void, SearchError> | null>(null)
  const [results, setResults] = useState<SearchResult<MovieItem>[]>([])
  const [stats, setStats] = useState<StreamStats>({ chunks: 0, items: 0, ms: 0 })
  const [status, setStatus] = useState<StreamStatus>('idle')

  const search = useCallback(
    (query: string, traced: boolean = false) => {
      if (!driver || !query.trim()) {
        setResults([])
        setStats({ chunks: 0, items: 0, ms: 0 })
        setStatus('idle')
        return
      }

      // Cancel previous fiber
      if (fiberRef.current) {
        Effect.runFork(Fiber.interrupt(fiberRef.current))
        setStatus('cancelled')
      }

      setResults([])
      setStats({ chunks: 0, items: 0, ms: 0 })
      setStatus('streaming')

      const startTime = performance.now()
      let chunkCount = 0
      let itemCount = 0

      const baseStream = driver.search(query, { limit: 100, chunkSize: 5 }).pipe(
        withMinScore<MovieItem, SearchError>(0.1)
      )

      const stream = traced
        ? baseStream.pipe(consoleTracedStream('SearchTestbed'))
        : baseStream

      const program = stream.pipe(
        Stream.tap(() =>
          Effect.sync(() => {
            chunkCount++
          })
        ),
        Stream.runForEach((result) =>
          Effect.sync(() => {
            itemCount++
            setResults((prev) => [...prev, result])
            setStats({
              chunks: chunkCount,
              items: itemCount,
              ms: Math.round((performance.now() - startTime) * 100) / 100,
            })
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            setStatus('complete')
          })
        )
      )

      fiberRef.current = Effect.runFork(program)
    },
    [driver]
  )

  const cancel = useCallback(() => {
    if (fiberRef.current) {
      Effect.runFork(Fiber.interrupt(fiberRef.current))
      setStatus('cancelled')
      fiberRef.current = null
    }
  }, [])

  return { results, stats, status, search, cancel }
}

// ─────────────────────────────────────────────────────────────────────────────
// Benchmark Duel Hook
// ─────────────────────────────────────────────────────────────────────────────

interface DuelResult {
  time: number
  count: number
}

const useBenchmarkDuel = (
  flexDriver: SearchServiceImpl<MovieItem> | null,
  linearDriver: SearchServiceImpl<MovieItem> | null
) => {
  const [flexResult, setFlexResult] = useState<DuelResult | null>(null)
  const [linearResult, setLinearResult] = useState<DuelResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const runDuel = useCallback(
    async (query: string) => {
      if (!flexDriver || !linearDriver || !query.trim()) return

      setIsRunning(true)
      setFlexResult(null)
      setLinearResult(null)

      // Race FlexSearch
      const flexStart = performance.now()
      const flexResults = await Effect.runPromise(
        flexDriver.search(query, { limit: 50 }).pipe(Stream.runCollect)
      )
      const flexTime = performance.now() - flexStart
      setFlexResult({ time: Math.round(flexTime * 100) / 100, count: flexResults.length })

      // Race Linear
      const linearStart = performance.now()
      const linearResults = await Effect.runPromise(
        linearDriver.search(query, { limit: 50 }).pipe(Stream.runCollect)
      )
      const linearTime = performance.now() - linearStart
      setLinearResult({ time: Math.round(linearTime * 100) / 100, count: linearResults.length })

      setIsRunning(false)
    },
    [flexDriver, linearDriver]
  )

  const winner =
    flexResult && linearResult
      ? flexResult.time < linearResult.time
        ? 'flex'
        : 'linear'
      : null

  return { flexResult, linearResult, winner, isRunning, runDuel }
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: StreamStatus }) => {
  const config: Record<StreamStatus, { bg: string; text: string }> = {
    idle: { bg: T.colors.backgroundTertiary, text: T.colors.textMuted },
    streaming: { bg: T.colors.accentCyan, text: T.colors.black },
    complete: { bg: T.colors.accentGreen, text: T.colors.black },
    cancelled: { bg: T.colors.accentYellow, text: T.colors.black },
  }

  const { bg, text } = config[status]

  return (
    <motion.span
      animate={status === 'streaming' ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
      transition={{ duration: 0.8, repeat: status === 'streaming' ? Infinity : 0 }}
      className="px-2 py-0.5 text-xs uppercase rounded"
      style={{
        backgroundColor: bg,
        color: text,
        ...STYLES.fontMono,
        fontSize: T.typography.fontSizeXs,
      }}
    >
      {status}
    </motion.span>
  )
}

const ScoreBar = ({ score, label }: { score: number; label: string }) => (
  <div className="flex items-center gap-2" style={{ ...STYLES.fontMono, fontSize: T.typography.fontSizeMd }}>
    <div
      className="w-24 h-3 rounded overflow-hidden"
      style={{ backgroundColor: T.colors.backgroundTertiary }}
    >
      <motion.div
        className="h-full"
        style={{
          background: `linear-gradient(90deg, ${T.colors.accentCyan}88, ${T.colors.accentCyan})`,
        }}
        initial={{ width: 0 }}
        animate={{ width: `${score * 100}%` }}
        transition={{
          type: 'spring',
          stiffness: SPRING_SNAPPY.stiffness,
          damping: SPRING_SNAPPY.damping,
        }}
      />
    </div>
    <span style={{ color: T.colors.accentCyan, width: '3rem' }}>{score.toFixed(2)}</span>
    <span style={{ color: T.colors.textSecondary }} className="truncate flex-1">
      {label}
    </span>
  </div>
)

const GenreBadge = ({ genre }: { genre: string }) => (
  <span
    className="px-1.5 py-0.5 rounded text-xs"
    style={{
      backgroundColor: T.colors.backgroundTertiary,
      color: T.colors.textSecondary,
    }}
  >
    {genre}
  </span>
)

const ResultItem = ({
  result,
  index,
}: {
  result: SearchResult<MovieItem>
  index: number
}) => {
  const { item } = result
  const hasThumb = !!item.thumbnail

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        delay: index * 0.015,
        type: 'spring',
        stiffness: SPRING_SNAPPY.stiffness,
        damping: SPRING_SNAPPY.damping,
      }}
      className="py-2 px-3 border-l-2 transition-colors flex gap-3"
      style={{
        borderColor: T.colors.borderMuted,
        ...STYLES.fontMono,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = T.colors.accentCyan
        e.currentTarget.style.backgroundColor = T.colors.backgroundHover
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = T.colors.borderMuted
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      {/* Thumbnail */}
      {hasThumb && (
        <img
          src={item.thumbnail}
          alt=""
          className="w-12 h-16 object-cover rounded flex-shrink-0"
          style={{ backgroundColor: T.colors.backgroundTertiary }}
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <ScoreBar score={result.score} label={item.title} />
          <span
            className="px-1.5 py-0.5 rounded text-xs flex-shrink-0"
            style={{
              backgroundColor: T.colors.accentYellow + '22',
              color: T.colors.accentYellow,
            }}
          >
            {item.year}
          </span>
        </div>

        {/* Genres */}
        {item.genres.length > 0 && (
          <div className="flex gap-1 mt-1 ml-28 flex-wrap">
            {item.genres.slice(0, 4).map((g) => (
              <GenreBadge key={g} genre={g} />
            ))}
          </div>
        )}

        {/* Cast */}
        {item.cast.length > 0 && (
          <div
            className="ml-28 truncate mt-1"
            style={{ fontSize: T.typography.fontSizeXs, color: T.colors.textMuted }}
          >
            {item.cast.slice(0, 4).join(' • ')}
          </div>
        )}

        {/* Extract (description) */}
        {item.extract && (
          <div
            className="ml-28 mt-1 line-clamp-2"
            style={{ fontSize: T.typography.fontSizeXs, color: T.colors.textMuted }}
          >
            {item.extract}
          </div>
        )}
      </div>
    </motion.div>
  )
}

const StreamMonitor = ({ stats, status }: { stats: StreamStats; status: StreamStatus }) => (
  <div
    className="border rounded p-4 space-y-2"
    style={{
      backgroundColor: T.colors.backgroundSecondary,
      borderColor: T.colors.borderDefault,
      ...STYLES.fontMono,
      fontSize: T.typography.fontSizeMd,
    }}
  >
    <div className="flex justify-between items-center mb-3">
      <span
        className="uppercase tracking-wider"
        style={{ color: T.colors.textMuted, fontSize: T.typography.fontSizeXs }}
      >
        Stream Monitor
      </span>
      <StatusBadge status={status} />
    </div>

    <div className="grid grid-cols-3 gap-4">
      <div>
        <div style={{ color: T.colors.textMuted, fontSize: T.typography.fontSizeXs }}>Chunks</div>
        <div className="text-2xl" style={{ color: T.colors.accentCyan }}>{stats.chunks}</div>
      </div>
      <div>
        <div style={{ color: T.colors.textMuted, fontSize: T.typography.fontSizeXs }}>Items</div>
        <div className="text-2xl" style={{ color: T.colors.accentGreen }}>{stats.items}</div>
      </div>
      <div>
        <div style={{ color: T.colors.textMuted, fontSize: T.typography.fontSizeXs }}>Time</div>
        <div className="text-2xl" style={{ color: T.colors.accentYellow }}>{stats.ms}ms</div>
      </div>
    </div>

    {/* Throughput Gauge */}
    <div className="mt-4">
      <div style={{ color: T.colors.textMuted, fontSize: T.typography.fontSizeXs }} className="mb-1">
        Throughput
      </div>
      <div className="h-2 rounded overflow-hidden" style={{ backgroundColor: T.colors.backgroundTertiary }}>
        <motion.div
          className="h-full"
          style={{
            background: `linear-gradient(90deg, ${T.colors.accentGreen}, ${T.colors.accentCyan})`,
          }}
          animate={{
            width: status === 'streaming' ? '100%' : `${Math.min(100, stats.items)}%`,
          }}
          transition={{
            duration: status === 'streaming' ? 0.5 : 0.3,
            repeat: status === 'streaming' ? Infinity : 0,
            repeatType: 'reverse',
          }}
        />
      </div>
    </div>
  </div>
)

const DuelBar = ({
  label,
  result,
  isWinner,
  maxTime,
}: {
  label: string
  result: DuelResult | null
  isWinner: boolean
  maxTime: number
}) => (
  <div className="flex items-center gap-3">
    <span
      className="w-24"
      style={{
        ...STYLES.fontMono,
        fontSize: T.typography.fontSizeMd,
        color: isWinner ? T.colors.accentGreen : T.colors.textMuted,
      }}
    >
      {label}
    </span>
    <div
      className="flex-1 h-6 rounded overflow-hidden relative"
      style={{ backgroundColor: T.colors.backgroundTertiary }}
    >
      {result && (
        <motion.div
          className="h-full"
          style={{
            backgroundColor: isWinner ? T.colors.accentGreen : T.colors.textMuted,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${(result.time / maxTime) * 100}%` }}
          transition={{
            type: 'spring',
            stiffness: SPRING_SNAPPY.stiffness * 0.6,
            damping: SPRING_SNAPPY.damping,
          }}
        />
      )}
    </div>
    <span
      className="w-20 text-right"
      style={{ ...STYLES.fontMono, fontSize: T.typography.fontSizeMd, color: T.colors.textSecondary }}
    >
      {result ? `${result.time}ms` : '—'}
    </span>
    {isWinner && (
      <motion.span
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        style={{ color: T.colors.accentYellow }}
      >
        ★
      </motion.span>
    )}
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Main Testbed
// ─────────────────────────────────────────────────────────────────────────────

// Total movies available
const TOTAL_MOVIES = (moviesData as RawMovie[]).length

export function SearchTestbed() {
  const [query, setQuery] = useState('')
  const [traced, setTraced] = useState(false)
  const [itemCount, setItemCount] = useState(10000)
  const [movies, setMovies] = useState<MovieItem[]>([])

  // Drivers
  const [flexDriver, setFlexDriver] = useState<SearchServiceImpl<MovieItem> | null>(null)
  const [linearDriver, setLinearDriver] = useState<SearchServiceImpl<MovieItem> | null>(null)
  const [isIndexing, setIsIndexing] = useState(false)

  // Search state
  const { results, stats, status, search, cancel } = useSearchStream(flexDriver)
  const { flexResult, linearResult, winner, isRunning, runDuel } = useBenchmarkDuel(
    flexDriver,
    linearDriver
  )

  // Initialize drivers and index
  useEffect(() => {
    const init = async () => {
      setIsIndexing(true)

      // Process movies from Wikipedia dataset
      const movieItems = processMovies(itemCount)
      setMovies(movieItems)

      // Create drivers
      const flex = await Effect.runPromise(createFlexSearchDriver<MovieItem>())
      const linear = await Effect.runPromise(createLinearDriver<MovieItem>())

      // Index both - search across title, genres, cast, and extract
      const config = {
        fields: ['title', 'genres', 'cast', 'extract'] as const,
        store: true,
      }

      await Effect.runPromise(flex.index(movieItems, config))
      await Effect.runPromise(linear.index(movieItems, config))

      setFlexDriver(flex)
      setLinearDriver(linear)
      setIsIndexing(false)
    }

    init()
  }, [itemCount])

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      search(query, traced)
    }, 150)

    return () => clearTimeout(timeout)
  }, [query, traced, search])

  const maxDuelTime = Math.max(flexResult?.time ?? 1, linearResult?.time ?? 1, 1)

  return (
    <div
      className="min-h-screen p-6"
      style={{
        backgroundColor: T.colors.backgroundPrimary,
        color: T.colors.textPrimary,
        ...STYLES.fontMono,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: T.colors.accentCyan }}
          >
            TMNL SEARCH LABORATORY
          </h1>
          <p style={{ color: T.colors.textMuted, fontSize: T.typography.fontSizeMd }}>
            Stream-first search · {TOTAL_MOVIES.toLocaleString()} Wikipedia movies
          </p>
        </div>
        <div className="flex items-center gap-4" style={{ fontSize: T.typography.fontSizeMd }}>
          <span style={{ color: T.colors.textMuted }}>
            {isIndexing ? (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                style={{ color: T.colors.accentYellow }}
              >
                Indexing {itemCount.toLocaleString()} movies...
              </motion.span>
            ) : (
              <span style={{ color: T.colors.accentGreen }}>
                {movies.length.toLocaleString()} movies indexed
              </span>
            )}
          </span>
          <select
            value={itemCount}
            onChange={(e) => setItemCount(Number(e.target.value))}
            className="px-2 py-1 rounded border"
            style={{
              backgroundColor: T.colors.backgroundTertiary,
              borderColor: T.colors.borderDefault,
              color: T.colors.textSecondary,
              ...STYLES.fontMono,
              fontSize: T.typography.fontSizeMd,
            }}
          >
            <option value={5000}>5,000 movies</option>
            <option value={10000}>10,000 movies</option>
            <option value={20000}>20,000 movies</option>
            <option value={TOTAL_MOVIES}>All {TOTAL_MOVIES.toLocaleString()} movies</option>
          </select>
        </div>
      </div>

      {/* Query Input */}
      <div className="mb-6">
        <div
          className="border rounded-lg p-4"
          style={{
            backgroundColor: T.colors.backgroundSecondary,
            borderColor: T.colors.borderDefault,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span style={{ color: T.colors.accentCyan }}>&gt;</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies... try 'godfather', 'spielberg', 'horror'"
              className="flex-1 bg-transparent text-lg outline-none"
              style={{
                color: T.colors.textPrimary,
                caretColor: T.colors.accentCyan,
                ...STYLES.fontMono,
              }}
              autoFocus
            />
            {status === 'streaming' && (
              <button
                onClick={cancel}
                className="px-2 py-1 text-xs rounded transition-colors"
                style={{
                  backgroundColor: T.colors.accentYellow,
                  color: T.colors.black,
                }}
              >
                CANCEL
              </button>
            )}
          </div>
          <div className="flex items-center gap-4" style={{ fontSize: T.typography.fontSizeMd }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={traced}
                onChange={(e) => setTraced(e.target.checked)}
                style={{ accentColor: T.colors.accentCyan }}
              />
              <span style={{ color: T.colors.textMuted }}>Console Tracing</span>
            </label>
            <button
              onClick={() => runDuel(query)}
              disabled={isRunning || !query.trim()}
              className="px-3 py-1 rounded transition-colors disabled:opacity-50"
              style={{
                backgroundColor: T.colors.backgroundTertiary,
                color: T.colors.textSecondary,
              }}
            >
              {isRunning ? 'Racing...' : '⚔ Benchmark Duel'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Stream Monitor */}
        <div className="col-span-4">
          <StreamMonitor stats={stats} status={status} />

          {/* Benchmark Duel */}
          <div
            className="mt-6 border rounded p-4"
            style={{
              backgroundColor: T.colors.backgroundSecondary,
              borderColor: T.colors.borderDefault,
            }}
          >
            <div
              className="uppercase tracking-wider mb-4"
              style={{ color: T.colors.textMuted, fontSize: T.typography.fontSizeXs }}
            >
              Benchmark Duel
            </div>
            <div className="space-y-3">
              <DuelBar
                label="FlexSearch"
                result={flexResult}
                isWinner={winner === 'flex'}
                maxTime={maxDuelTime}
              />
              <DuelBar
                label="Linear"
                result={linearResult}
                isWinner={winner === 'linear'}
                maxTime={maxDuelTime}
              />
            </div>
            {winner && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-center"
                style={{ fontSize: T.typography.fontSizeMd }}
              >
                <span style={{ color: T.colors.accentGreen }}>
                  {winner === 'flex' ? 'FlexSearch' : 'Linear'} wins by{' '}
                  {Math.abs((flexResult?.time ?? 0) - (linearResult?.time ?? 0)).toFixed(2)}ms
                </span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Results Cascade */}
        <div className="col-span-8">
          <div
            className="border rounded-lg overflow-hidden"
            style={{
              backgroundColor: T.colors.backgroundSecondary,
              borderColor: T.colors.borderDefault,
            }}
          >
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${T.colors.borderDefault}` }}
            >
              <span
                className="uppercase tracking-wider"
                style={{ color: T.colors.textMuted, fontSize: T.typography.fontSizeXs }}
              >
                Results Cascade
              </span>
              <span style={{ color: T.colors.textMuted, fontSize: T.typography.fontSizeMd }}>
                {results.length} matches
              </span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {results.length === 0 && status === 'idle' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 text-center"
                    style={{ color: T.colors.textMuted }}
                  >
                    Search {movies.length.toLocaleString()} movies from Wikipedia...
                  </motion.div>
                )}
                {results.map((result, i) => (
                  <ResultItem key={result.item.id} result={result} index={i} />
                ))}
              </AnimatePresence>
              {status === 'streaming' && (
                <motion.div
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="p-4 text-center"
                  style={{ color: T.colors.accentCyan }}
                >
                  ↓ streaming...
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchTestbed
