/**
 * MorphCard Testbed
 *
 * Demonstrates the MorphCard and DynamicIslandCard components with:
 * - Polymorphic mode transitions (compact/expanded)
 * - TabBar navigation
 * - Server integration via CardServerService
 * - Durable stream patches
 *
 * @module testbed/MorphCardTestbed
 */

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
  type RefObject,
} from 'react';
import {
  RegistryProvider,
  useAtomSet,
  useAtomValue,
} from '@effect-atom/atom-react';
import { Atom } from '@effect-atom/atom';
import {
  DynamicIslandCard,
  MorphCard,
  AnimatedItem,
  MetricBlock,
  MetricGrid,
  MorphCardStage,
  LayoutGuard,
  type LayoutGuardMode,
  defaultTransitionStrategy,
  DEFAULT_TRANSITION,
  sendIslandEvent,
  useCardServer,
  useDurableStreamPatches,
  CardId,
  cardStateFamily,
  islandStateValueAtomFamily,
  setActiveTab,
  updateView,
  morphCardRegistry,
  cardTabStateFamily,
  type ViewRegistry,
  type StreamStatus,
} from '@/lib/morph-card';
import { HStack } from '@/lib/layout/components/Stack';
import {
  ScrambleQuote,
  type ScrambleQuoteHandle,
} from '@/components/ui/scramble-quote';
import { ChartRenderer } from '@/lib/charts';
import { cn } from '@/lib/tmnl-ui/utils/cn';
import { Badge, StatusIndicator } from '@/lib/tmnl-ui/primitives/Badge';
import {
  Effect,
  Fiber,
  Schedule,
  Stream,
  Schema,
  Queue,
  RcMap,
  Scope,
  SubscriptionRef,
} from 'effect';
import type { TransitionGrammar } from '@/lib/morph-card/schemas/transition-grammar';
import { ViewRegistrySchema } from '@/lib/morph-card/schemas/tab-schemas';
import { AnimeLayoutTarget } from '@/lib/morph-card/schemas/anime-layout';
import { Tmnl, tmnlDenseDark } from '@/lib/data-grid';
import { GeointDashboardPanel } from '@/lib/geoint/components';
import {
  createLayout,
  animate as animeAnimate,
  spring,
  random,
  set as animeSet,
  stagger,
} from 'animejs';

// =============================================================================
// Helper to create branded CardId
// =============================================================================

const makeCardId = (id: string): Schema.Schema.Type<typeof CardId> =>
  id as Schema.Schema.Type<typeof CardId>;

// =============================================================================
// Chart Grid Stream (Atom-backed, outside React)
// =============================================================================

const CHART_GRID_CARDS = [
  {
    id: 'chart-grid-latency',
    title: 'Latency',
    metric: '32ms',
    tone: '#38bdf8',
    series: [12, 18, 22, 16, 24, 20, 28, 26, 31, 29, 32, 27],
    volatility: 3,
    bias: 0.4,
    quote: 'Latency drift stays under budget.',
  },
  {
    id: 'chart-grid-throughput',
    title: 'Throughput',
    metric: '1.4k/s',
    tone: '#4ade80',
    series: [480, 520, 610, 720, 680, 760, 840, 910, 980, 1040, 1120, 1160],
    volatility: 40,
    bias: 12,
    quote: 'Flow is steady across regions.',
  },
  {
    id: 'chart-grid-errors',
    title: 'Errors',
    metric: '0.7%',
    tone: '#f97316',
    series: [0.4, 0.5, 0.6, 0.7, 0.55, 0.72, 0.68, 0.64, 0.61, 0.59, 0.6, 0.58],
    volatility: 0.08,
    bias: -0.01,
    quote: 'Error band trending down.',
  },
] as const;

type ChartGridCard = (typeof CHART_GRID_CARDS)[number];

const chartSeriesAtom = Atom.make<Record<string, number[]>>(
  Object.fromEntries(CHART_GRID_CARDS.map((card) => [card.id, card.series]))
);

const startChartSeriesStream = () => {
  const cardIds = CHART_GRID_CARDS.map((card) => card.id);
  const cardById = Object.fromEntries(
    CHART_GRID_CARDS.map((card) => [card.id, card])
  );
  const stream = Stream.fromSchedule(Schedule.spaced('350 millis')).pipe(
    Stream.mapEffect(() =>
      Effect.sync(() => {
        const id = cardIds[Math.floor(Math.random() * cardIds.length)];
        const chunkSize = 1 + Math.floor(Math.random() * 4);
        return { id, chunkSize };
      })
    )
  );

  return Effect.runFork(
    Stream.runForEach(stream, ({ id, chunkSize }) =>
      Effect.sync(() => {
        Atom.update(chartSeriesAtom, (prev) => {
          const card = cardById[id] as ChartGridCard | undefined;
          if (!card) return prev;
          const current = prev[id] ?? card.series;
          const next = [...current];
          const lastValue = current[current.length - 1] ?? 0;
          for (let i = 0; i < chunkSize; i += 1) {
            const noise = (Math.random() - 0.5) * card.volatility;
            const drift = card.bias;
            next.push(lastValue + noise + drift + i * card.bias * 0.15);
          }
          const bounded = next.slice(-32);
          return { ...prev, [id]: bounded };
        });
      })
    )
  );
};

let chartSeriesStreamFiber: Fiber.RuntimeFiber<unknown, unknown> | null = null;
if (typeof window !== 'undefined') {
  chartSeriesStreamFiber = chartSeriesStreamFiber ?? startChartSeriesStream();
}

// =============================================================================
// AnimeJS Auto-Layout Lab (React + Effect + Queues + Effect-Atom)
// =============================================================================

const ANIME_LAYOUT_TARGETS = {
  accordion: 'tmnl-layout-accordion',
  nav: 'tmnl-layout-nav',
  periodic: 'tmnl-layout-periodic',
  planets: 'tmnl-layout-planets',
  todo: 'tmnl-layout-todo',
  code: 'tmnl-layout-code',
  rgb: 'tmnl-layout-rgb',
} as const satisfies Record<string, AnimeLayoutTarget>;

type AnimeLayoutTargetKey = keyof typeof ANIME_LAYOUT_TARGETS;

const LayoutCommandSchema = Schema.Struct({
  target: AnimeLayoutTarget,
  kind: Schema.Literal(
    'accordion-toggle',
    'nav-select',
    'periodic-layout',
    'planets-layout',
    'todo-action',
    'code-toggle',
    'rgb-shuffle'
  ),
  payload: Schema.Unknown,
});

type LayoutCommand = Schema.Schema.Type<typeof LayoutCommandSchema>;

const layoutCommandRef = Effect.runSync(
  SubscriptionRef.make<LayoutCommand | null>(null)
);
const layoutCommandAtom = Atom.subscriptionRef(layoutCommandRef);

const layoutCommandQueue = Effect.runSync(Queue.unbounded<LayoutCommand>());

const useLayoutCommandQueue = (handler: (command: LayoutCommand) => void) => {
  const command = useAtomValue(layoutCommandAtom);
  const setCommand = useAtomSet(layoutCommandAtom);

  useLayoutEffect(() => {
    if (!command) return;
    const offer = Queue.offer(layoutCommandQueue, command);
    Effect.runFork(offer);
    setCommand(null);
  }, [command, setCommand]);

  useLayoutEffect(() => {
    const fiber = Effect.runFork(
      Effect.forever(
        Queue.take(layoutCommandQueue).pipe(
          Effect.tap((cmd) => Effect.sync(() => handler(cmd)))
        )
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [handler]);
};

const ColorKey = Schema.Literal('color1', 'color2', 'color3');
type ColorKey = Schema.Schema.Type<typeof ColorKey>;

const ColorInstructionSchema = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  duration: Schema.Number,
  ease: Schema.String,
  label: Schema.String,
});

type ColorInstruction = Schema.Schema.Type<typeof ColorInstructionSchema>;

const colorInstructionScope = Effect.runSync(Scope.make());
const colorInstructionMap = Effect.runSync(
  RcMap.make<ColorKey, SubscriptionRef.SubscriptionRef<ColorInstruction>>({
    lookup: (key) =>
      SubscriptionRef.make<ColorInstruction>({
        from: '#1f2937',
        to:
          key === 'color1'
            ? '#60a5fa'
            : key === 'color2'
            ? '#34d399'
            : '#fbbf24',
        duration: 600,
        ease: 'inOutQuad',
        label: key.toUpperCase(),
      }),
  }).pipe(Effect.provideService(Scope.Scope, colorInstructionScope))
);

const colorInstructionRefs = new Map<
  ColorKey,
  SubscriptionRef.SubscriptionRef<ColorInstruction>
>();

const getColorInstructionRef = (key: ColorKey) => {
  const cached = colorInstructionRefs.get(key);
  if (cached) return cached;
  const ref = Effect.runSync(
    RcMap.get(colorInstructionMap, key).pipe(
      Effect.provideService(Scope.Scope, colorInstructionScope)
    )
  );
  colorInstructionRefs.set(key, ref);
  return ref;
};

const colorInstructionAtomFamily = Atom.family((key: ColorKey) =>
  Atom.subscriptionRef(getColorInstructionRef(key))
);

const shuffleColorInstructions = () => {
  const keys: ColorKey[] = ['color1', 'color2', 'color3'];
  Effect.runFork(
    Effect.gen(function* () {
      const refs = yield* Effect.forEach(keys, (key) =>
        RcMap.get(colorInstructionMap, key)
      );
      const values = yield* Effect.forEach(refs, (ref) =>
        SubscriptionRef.get(ref)
      );
      const shuffled = [...values].sort(() => Math.random() - 0.5);
      yield* Effect.forEach(refs, (ref, index) =>
        SubscriptionRef.set(ref, {
          ...shuffled[index],
          label: keys[index].toUpperCase(),
        })
      );
    }).pipe(Effect.provideService(Scope.Scope, colorInstructionScope))
  );
};

type AccordionItem = {
  id: string;
  title: string;
  body: string;
};

const ANIME_ACCORDION_ITEMS: AccordionItem[] = [
  {
    id: 'introduce',
    title: 'Intro',
    body: 'Auto-layout accordion with spring easing and blur.',
  },
  {
    id: 'layout',
    title: 'Layout',
    body: 'Panels expand and collapse without manual measurements.',
  },
  {
    id: 'react',
    title: 'React',
    body: 'Scoped to the component root with React refs.',
  },
];

const animeAccordionOpenAtom = Atom.make<string | null>('introduce');
const animeNavActiveAtom = Atom.make<'blue' | 'green' | 'amber'>('blue');
const animePeriodicLayoutAtom = Atom.make<'table' | 'grid' | 'stack'>('table');
const animePlanetsLayoutAtom = Atom.make<'grid' | 'stack' | 'chaos'>('grid');
const animePlanetsVisibleAtom = Atom.make(4);
const animeTodoItemsAtom = Atom.make<
  Array<{ id: string; text: string; done: boolean }>
>([
  { id: 'todo-1', text: 'Ship auto-layout lab', done: false },
  { id: 'todo-2', text: 'Bind queue-driven updates', done: false },
  { id: 'todo-3', text: 'Confirm layout stability', done: true },
]);
const animeCodeVariantAtom = Atom.make(false);

type AnimeLayoutRegistry = {
  accordion?: {
    root: HTMLElement | null;
    layout: ReturnType<typeof createLayout> | null;
  };
  nav?: {
    root: HTMLElement | null;
    layout: ReturnType<typeof createLayout> | null;
    contentLayout: ReturnType<typeof createLayout> | null;
  };
  periodic?: {
    root: HTMLElement | null;
    layout: ReturnType<typeof createLayout> | null;
  };
  planets?: {
    root: HTMLElement | null;
    layout: ReturnType<typeof createLayout> | null;
  };
  todo?: {
    root: HTMLElement | null;
    layout: ReturnType<typeof createLayout> | null;
  };
  code?: {
    root: HTMLElement | null;
    layout: ReturnType<typeof createLayout> | null;
  };
};

const makeLayoutCommand = (
  target: AnimeLayoutTarget,
  kind: LayoutCommand['kind'],
  payload: LayoutCommand['payload']
): LayoutCommand => ({ target, kind, payload });

const useAnimeLayoutDispatcher = (command: LayoutCommand | null) => {
  const setCommand = useAtomSet(layoutCommandAtom);
  useLayoutEffect(() => {
    if (!command) return;
    setCommand(command);
  }, [command, setCommand]);
};

const AccordionDemo = ({
  register,
  disableAnimations,
}: {
  register: (entry: AnimeLayoutRegistry['accordion']) => void;
  disableAnimations: boolean;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<ReturnType<typeof createLayout> | null>(null);
  const openId = useAtomValue(animeAccordionOpenAtom);
  const setOpenId = useAtomSet(animeAccordionOpenAtom);
  const [isReady, setIsReady] = useState(false);

  // Initialize layout ONCE on mount, synchronously
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Create layout targeting children of root
    const layout = createLayout(root, {
      properties: ['background-color', 'border-color'],
      ease: spring({ bounce: 0.4, duration: 550 }),
      enterFrom: {
        opacity: 0,
        filter: 'blur(12px)',
        transform: 'translateY(-12px) scale(0.98)',
      },
      leaveTo: {
        opacity: 0,
        filter: 'blur(12px)',
        transform: 'translateY(-8px) scale(0.98)',
      },
    });

    layoutRef.current = layout;
    register({ root, layout });
    setIsReady(true);

    return () => {
      layout.revert();
      layoutRef.current = null;
    };
  }, [register]);

  // Animate when openId changes (after initial mount)
  useLayoutEffect(() => {
    if (!isReady) return;
    layoutRef.current?.animate(disableAnimations ? { duration: 0 } : undefined);
  }, [openId, isReady, disableAnimations]);

  const handleToggle = useCallback(
    (itemId: string, currentlyOpen: boolean) => {
      // 1. Record current state BEFORE React updates DOM
      layoutRef.current?.record();
      // 2. Update state (triggers re-render, DOM changes)
      setOpenId(currentlyOpen ? null : itemId);
      // 3. animate() is called by the useLayoutEffect above
    },
    [setOpenId]
  );

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="font-mono uppercase tracking-widest text-neutral-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Accordion
        </span>
        <span className="text-xs text-neutral-500">
          {isReady ? `atom: ${openId ?? 'none'}` : 'initializing...'}
        </span>
      </div>
      <div ref={rootRef} className={ANIME_LAYOUT_TARGETS.accordion}>
        {ANIME_ACCORDION_ITEMS.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className={cn(
                'accordion-item mb-2 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/70',
                isOpen && 'is-open border-sky-500/60 bg-sky-900/20'
              )}
              data-accordion-id={item.id}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-neutral-200"
                onClick={() => handleToggle(item.id, isOpen)}
              >
                <span>{item.title}</span>
                <span className="text-neutral-500">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="accordion-body px-4 pb-3 text-sm text-neutral-400">
                  {item.body}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// AccordionDemoV2 — Clean vertical slice, no command queue
// =============================================================================

const animeAccordionV2OpenAtom = Atom.make<string | null>('introduce');

const AccordionDemoV2 = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<ReturnType<typeof createLayout> | null>(null);
  const [openId, setOpenId] = useState<string | null>('introduce');
  const [isReady, setIsReady] = useState(false);

  // Initialize layout ONCE on mount
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const layout = createLayout(root, {
      properties: ['background-color', 'border-color'],
      ease: spring({ bounce: 0.45, duration: 600 }),
      enterFrom: {
        opacity: 0,
        filter: 'blur(12px)',
        transform: 'translateY(-16px) scale(0.96)',
      },
      leaveTo: {
        opacity: 0,
        filter: 'blur(12px)',
        transform: 'translateY(-10px) scale(0.96)',
      },
    });

    layoutRef.current = layout;
    setIsReady(true);

    return () => {
      layout.revert();
      layoutRef.current = null;
    };
  }, []);

  // Animate AFTER React commits DOM changes
  useLayoutEffect(() => {
    if (!isReady) return;
    layoutRef.current?.animate();
  }, [openId, isReady]);

  const handleToggle = (itemId: string, currentlyOpen: boolean) => {
    // 1. Snapshot current layout
    layoutRef.current?.record();
    // 2. Update state → React re-renders → DOM changes
    setOpenId(currentlyOpen ? null : itemId);
    // 3. useLayoutEffect fires animate()
  };

  return (
    <div className="rounded-2xl border border-emerald-800/50 bg-neutral-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="font-mono uppercase tracking-widest text-emerald-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Accordion V2 (Vertical Slice)
        </span>
        <span className="text-xs text-neutral-500">
          {isReady ? `open: ${openId ?? 'none'}` : 'initializing...'}
        </span>
      </div>
      <div ref={rootRef} className="accordion-v2-root">
        {ANIME_ACCORDION_ITEMS.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className={cn(
                'mb-2 overflow-hidden rounded-xl border bg-neutral-900/70',
                isOpen
                  ? 'border-emerald-500/60 bg-emerald-900/20'
                  : 'border-neutral-800'
              )}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-neutral-200"
                onClick={() => handleToggle(item.id, isOpen)}
              >
                <span>{item.title}</span>
                <span className="text-neutral-500">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-3 text-sm text-neutral-400">
                  {item.body}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Actual color values for anime.js interpolation
const NAV_COLOR_VALUES = {
  blue: 'rgba(59, 130, 246, 0.3)',
  green: 'rgba(34, 197, 94, 0.3)',
  amber: 'rgba(245, 158, 11, 0.3)',
} as const;

const NAV_COLORS = {
  blue: {
    bg: 'bg-blue-500/30',
    border: 'border-blue-500/40',
    text: 'text-blue-400',
  },
  green: {
    bg: 'bg-green-500/30',
    border: 'border-green-500/40',
    text: 'text-green-400',
  },
  amber: {
    bg: 'bg-amber-500/30',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
  },
} as const;

// Quote text for each nav color
const NAV_QUOTES = {
  blue: 'Primary systems nominal. All channels open.',
  green: 'Environmental matrix synchronized.',
  amber: 'Alert protocols engaged. Standing by.',
} as const;

const NavDemo = ({
  register,
  disableAnimations,
}: {
  register: (entry: AnimeLayoutRegistry['nav']) => void;
  disableAnimations: boolean;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentLayoutRef = useRef<ReturnType<typeof createLayout> | null>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const bgRef = useRef<HTMLSpanElement>(null);
  const scrambleRef = useRef<ScrambleQuoteHandle>(null);
  const quoteContainerRef = useRef<HTMLDivElement>(null);
  const systemTextRef = useRef<HTMLDivElement>(null);
  const active = useAtomValue(animeNavActiveAtom);
  const setActive = useAtomSet(animeNavActiveAtom);
  const prevActiveRef = useRef<'blue' | 'green' | 'amber'>(active);
  const [isReady, setIsReady] = useState(false);
  const isInitializedRef = useRef(false);

  // Initialize content layout on mount
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const contentDiv = root.querySelector('.layout-nav-content');
    if (!contentDiv) return;

    const contentLayout = createLayout(contentDiv as HTMLElement, {
      enterFrom: {
        opacity: 0,
        filter: 'blur(8px)',
        transform: 'translateY(-8px)',
      },
      leaveTo: {
        opacity: 0,
        filter: 'blur(8px)',
        transform: 'translateY(8px)',
      },
    });

    contentLayoutRef.current = contentLayout;
    register({ root, layout: null as never, contentLayout });
    setIsReady(true);

    return () => {
      contentLayout.revert();
      contentLayoutRef.current = null;
    };
  }, [register]);

  // Set initial bg position (no animation)
  useLayoutEffect(() => {
    if (isInitializedRef.current) return;

    const bg = bgRef.current;
    const btn = buttonRefs.current.get(active);
    const ul = rootRef.current?.querySelector('nav ul');
    if (!bg || !btn || !ul) return;

    const ulRect = ul.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const left = btnRect.left - ulRect.left;
    const width = btnRect.width;

    animeSet(bg, { left, width, backgroundColor: NAV_COLOR_VALUES[active] });
    isInitializedRef.current = true;
  }, [active]);

  // Animate bg indicator when active changes
  useLayoutEffect(() => {
    if (!isInitializedRef.current) return;
    if (prevActiveRef.current === active) return;

    const bg = bgRef.current;
    const btn = buttonRefs.current.get(active);
    const ul = rootRef.current?.querySelector('nav ul');
    if (!bg || !btn || !ul) return;

    const ulRect = ul.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const left = btnRect.left - ulRect.left;
    const width = btnRect.width;

    const duration = disableAnimations ? 0 : 400;

    animeAnimate(bg, {
      left,
      width,
      backgroundColor: NAV_COLOR_VALUES[active],
      duration,
      ease: 'outExpo',
      onComplete: () => {
        // Reveal quote inside layout.update() so container animates accordion-style
        const container = quoteContainerRef.current;
        const systemText = systemTextRef.current;
        const layout = contentLayoutRef.current;
        if (container && layout) {
          // Set system text to heavy weight before animation starts
          if (systemText) {
            animeSet(systemText, { fontWeight: 700 });
          }
          // Update layout with animation options - syncs all animations
          layout.update(
            () => {
              container.style.display = 'block';
            },
            {
              duration: disableAnimations ? 0 : 400,
              ease: 'out(3)',
              onBegin: () => {
                // Start scramble and font-weight animation in sync with layout
                scrambleRef.current?.replay();
                if (systemText) {
                  animeAnimate(systemText, {
                    fontWeight: 400,
                    duration: disableAnimations ? 0 : 400,
                    ease: 'out(3)',
                    onComplete: () => {
                      systemText.style.fontWeight = '';
                    },
                  });
                }
              },
              onComplete: () => {
                // Clean all layout-animated properties from container
                container.style.opacity = '';
                container.style.filter = '';
                container.style.transform = '';
                container.style.transition = '';
                container.style.willChange = '';
                container.style.width = '';
                container.style.height = '';

                // Clean section (accordion container)
                const section = container.parentElement;
                if (section) {
                  section.style.opacity = '';
                  section.style.filter = '';
                  section.style.transform = '';
                  section.style.transition = '';
                  section.style.willChange = '';
                  section.style.width = '';
                  section.style.height = '';
                }

                // Clean system text
                if (systemText) {
                  systemText.style.opacity = '';
                  systemText.style.filter = '';
                  systemText.style.transform = '';
                  systemText.style.transition = '';
                  systemText.style.willChange = '';
                }

                // Also clean the content container itself
                const contentDiv = container.closest('.layout-nav-content');
                if (contentDiv instanceof HTMLElement) {
                  contentDiv.style.transition = '';
                  contentDiv.style.willChange = '';
                }
              },
            }
          );
        }
      },
    });

    prevActiveRef.current = active;
  }, [active, disableAnimations]);

  // Animate content when active changes
  useLayoutEffect(() => {
    if (!isReady) return;
    contentLayoutRef.current?.animate(
      disableAnimations ? { duration: 0 } : undefined
    );
  }, [active, isReady, disableAnimations]);

  const handleSelect = useCallback(
    (color: 'blue' | 'green' | 'amber') => {
      contentLayoutRef.current?.record();
      setActive(color);
    },
    [setActive]
  );

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="font-mono uppercase tracking-widest text-neutral-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Nav + Content
        </span>
        <span className="text-xs text-neutral-500">
          {isReady ? `active: ${active}` : 'initializing...'}
        </span>
      </div>
      <div ref={rootRef} className={ANIME_LAYOUT_TARGETS.nav}>
        <nav className="mb-3">
          <ul className="relative flex gap-2 rounded-full border border-neutral-800 bg-neutral-900/70 p-1">
            {/* Background indicator - animated by anime.js */}
            <span
              ref={bgRef}
              className="button-bg pointer-events-none absolute inset-y-1 rounded-full"
              style={{ left: 4, width: 64 }}
            />
            {(['blue', 'green', 'amber'] as const).map((color) => (
              <li key={color}>
                <button
                  ref={(el) => {
                    if (el) buttonRefs.current.set(color, el);
                  }}
                  type="button"
                  data-color={color}
                  onClick={() => handleSelect(color)}
                  className={cn(
                    'relative z-10 rounded-full px-4 py-2 text-sm font-medium',
                    active === color
                      ? NAV_COLORS[color].text
                      : 'text-neutral-400'
                  )}
                >
                  {color}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="layout-nav-content space-y-3">
          {(['blue', 'green', 'amber'] as const).map((color) =>
            active === color ? (
              <section
                key={color}
                data-color={color}
                className={cn(
                  'rounded-xl border p-3 text-sm',
                  NAV_COLORS[color].border,
                  NAV_COLORS[color].bg
                )}
              >
                <div
                  ref={systemTextRef}
                  className={cn(
                    'text-xs uppercase tracking-widest whitespace-nowrap',
                    NAV_COLORS[color].text
                  )}
                  style={{ willChange: 'font-weight' }}
                >
                  {color} system
                </div>
                {/* Scramble quote - starts hidden, revealed after nav slide, layout handles enterFrom */}
                <div ref={quoteContainerRef} style={{ display: 'none' }}>
                  <ScrambleQuote
                    ref={scrambleRef}
                    text={NAV_QUOTES[color]}
                    preset="rapid"
                    className="mt-2 border-none bg-transparent p-0"
                    manual
                  />
                </div>
              </section>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
};

const PeriodicDemo = ({
  register,
  disableAnimations,
}: {
  register: (entry: AnimeLayoutRegistry['periodic']) => void;
  disableAnimations: boolean;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<ReturnType<typeof createLayout> | null>(null);
  const layoutMode = useAtomValue(animePeriodicLayoutAtom);
  const setLayoutMode = useAtomSet(animePeriodicLayoutAtom);
  const [lastCommand, setLastCommand] = useState<LayoutCommand | null>(null);
  const [isReady, setIsReady] = useState(false);

  const elements = useMemo(
    () => [
      { id: 'H', name: 'Hydrogen', color: '#38bdf8', col: 1, row: 1 },
      { id: 'C', name: 'Carbon', color: '#22c55e', col: 14, row: 2 },
      { id: 'O', name: 'Oxygen', color: '#f97316', col: 16, row: 2 },
      { id: 'Na', name: 'Sodium', color: '#facc15', col: 1, row: 3 },
      { id: 'Fe', name: 'Iron', color: '#ef4444', col: 8, row: 4 },
      { id: 'Au', name: 'Gold', color: '#fbbf24', col: 11, row: 6 },
    ],
    []
  );

  // Direct useLayoutEffect — no hook indirection
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const layout = createLayout(root, {
      properties: ['font-size'],
      duration: 800,
      ease: 'inOutExpo',
    });

    layoutRef.current = layout;
    register({ root, layout });
    setIsReady(true);

    return () => {
      layout.revert();
      layoutRef.current = null;
    };
  }, [register]);

  useLayoutEffect(() => {
    if (!isReady) return;
    setLastCommand(
      makeLayoutCommand(ANIME_LAYOUT_TARGETS.periodic, 'periodic-layout', {
        mode: layoutMode,
        disableAnimations,
      })
    );
  }, [layoutMode, disableAnimations, isReady]);

  useAnimeLayoutDispatcher(lastCommand);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="font-mono uppercase tracking-widest text-neutral-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Periodic
        </span>
        <div className="flex items-center gap-2">
          {(['table', 'grid', 'stack'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setLayoutMode(mode)}
              className={cn(
                'rounded-md border px-2 py-1 text-xs font-mono uppercase tracking-widest',
                layoutMode === mode
                  ? 'border-sky-400 text-sky-200'
                  : 'border-neutral-800 text-neutral-500'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={rootRef}
        className={cn(
          ANIME_LAYOUT_TARGETS.periodic,
          'grid gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3'
        )}
        style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}
      >
        {elements.map((el, index) => (
          <div
            key={el.id}
            className="element flex flex-col gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-2 text-xs text-neutral-200"
            style={{
              gridColumn: el.col,
              gridRow: el.row,
              color: el.color,
            }}
            data-color={el.color}
            data-index={index}
          >
            <span className="text-neutral-500">{el.id}</span>
            <span className="font-medium">{el.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const PlanetsDemo = ({
  register,
  disableAnimations,
}: {
  register: (entry: AnimeLayoutRegistry['planets']) => void;
  disableAnimations: boolean;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<ReturnType<typeof createLayout> | null>(null);
  const layoutMode = useAtomValue(animePlanetsLayoutAtom);
  const visibleCount = useAtomValue(animePlanetsVisibleAtom);
  const setLayoutMode = useAtomSet(animePlanetsLayoutAtom);
  const setVisibleCount = useAtomSet(animePlanetsVisibleAtom);
  const [lastCommand, setLastCommand] = useState<LayoutCommand | null>(null);
  const [isReady, setIsReady] = useState(false);

  const planets = useMemo(
    () => [
      { id: 'mercury', name: 'Mercury', color: '#64748b' },
      { id: 'venus', name: 'Venus', color: '#f59e0b' },
      { id: 'earth', name: 'Earth', color: '#22c55e' },
      { id: 'mars', name: 'Mars', color: '#ef4444' },
      { id: 'jupiter', name: 'Jupiter', color: '#f97316' },
    ],
    []
  );

  // Direct useLayoutEffect — no hook indirection
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const layout = createLayout(root, {
      properties: ['font-size'],
      enterFrom: {
        opacity: 0,
        transform: 'translateY(150%) scale(.6)',
      },
      leaveTo: {
        opacity: 0,
        transform: 'translateY(50%) scale(.6)',
      },
    });

    layoutRef.current = layout;
    register({ root, layout });
    setIsReady(true);

    return () => {
      layout.revert();
      layoutRef.current = null;
    };
  }, [register]);

  useLayoutEffect(() => {
    if (!isReady) return;
    setLastCommand(
      makeLayoutCommand(ANIME_LAYOUT_TARGETS.planets, 'planets-layout', {
        mode: layoutMode,
        visibleCount,
        disableAnimations,
      })
    );
  }, [layoutMode, visibleCount, disableAnimations, isReady]);

  useAnimeLayoutDispatcher(lastCommand);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span
          className="font-mono uppercase tracking-widest text-neutral-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Planets
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {(['grid', 'stack', 'chaos'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setLayoutMode(mode)}
              className={cn(
                'rounded-md border px-2 py-1 text-xs font-mono uppercase tracking-widest',
                layoutMode === mode
                  ? 'border-sky-400 text-sky-200'
                  : 'border-neutral-800 text-neutral-500'
              )}
            >
              {mode}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setVisibleCount((count) => Math.max(1, count - 1))}
            className="rounded-md border border-neutral-800 px-2 py-1 text-xs font-mono text-neutral-400"
          >
            remove
          </button>
          <button
            type="button"
            onClick={() =>
              setVisibleCount((count) => Math.min(planets.length, count + 1))
            }
            className="rounded-md border border-neutral-800 px-2 py-1 text-xs font-mono text-neutral-400"
          >
            add
          </button>
        </div>
      </div>
      <div
        ref={rootRef}
        className={cn(
          ANIME_LAYOUT_TARGETS.planets,
          'grid gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3'
        )}
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}
      >
        {planets.map((planet, index) => {
          const isVisible = index < visibleCount;
          return (
            <div
              key={planet.id}
              className={cn(
                'planet-card rounded-xl border border-neutral-800 bg-neutral-950/70 p-3 text-sm text-neutral-200 transition-opacity',
                !isVisible && 'is-removed opacity-0'
              )}
              data-color={planet.color}
            >
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                {planet.id}
              </div>
              <div className="mt-2 text-base" style={{ color: planet.color }}>
                {planet.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TodoDemo = ({
  register,
  disableAnimations,
}: {
  register: (entry: AnimeLayoutRegistry['todo']) => void;
  disableAnimations: boolean;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<ReturnType<typeof createLayout> | null>(null);
  const items = useAtomValue(animeTodoItemsAtom);
  const setItems = useAtomSet(animeTodoItemsAtom);
  const [text, setText] = useState('');
  const [lastCommand, setLastCommand] = useState<LayoutCommand | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Direct useLayoutEffect — no hook indirection
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const layout = createLayout(root, {
      properties: ['backgroundColor', 'color', 'accent-color'],
      ease: spring({ bounce: 0.3, duration: 450 }),
      leaveTo: {
        opacity: 0,
        transform: 'translateY(.5rem) scale(.9)',
      },
    });

    layoutRef.current = layout;
    register({ root, layout });
    setIsReady(true);

    return () => {
      layout.revert();
      layoutRef.current = null;
    };
  }, [register]);

  useLayoutEffect(() => {
    if (!isReady) return;
    setLastCommand(
      makeLayoutCommand(ANIME_LAYOUT_TARGETS.todo, 'todo-action', {
        items,
        disableAnimations,
      })
    );
  }, [items, disableAnimations, isReady]);

  useAnimeLayoutDispatcher(lastCommand);

  useLayoutEffect(() => {
    if (!isReady) return;
    layoutRef.current?.animate(disableAnimations ? { duration: 0 } : undefined);
  }, [items, disableAnimations, isReady]);

  const handleToggle = (id: string) => {
    layoutRef.current?.record();
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    );
  };

  const handleRemove = (id: string) => {
    layoutRef.current?.record();
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAdd = () => {
    const value = text.trim();
    if (!value) return;
    layoutRef.current?.record();
    setItems((prev) => [
      { id: `todo-${Date.now()}`, text: value, done: false },
      ...prev,
    ]);
    setText('');
  };

  const pending = items.filter((item) => !item.done);
  const completed = items.filter((item) => item.done);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="font-mono uppercase tracking-widest text-neutral-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Todo
        </span>
        <span className="text-xs text-neutral-500">items: {items.length}</span>
      </div>
      <div ref={rootRef} className={ANIME_LAYOUT_TARGETS.todo}>
        <div className="mb-3 flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-full rounded-md border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-neutral-200"
            placeholder="Add task"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md border border-neutral-700 px-3 py-2 text-xs font-mono text-neutral-300"
          >
            add
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="list is-active rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
            <div className="mb-2 text-xs uppercase tracking-widest text-neutral-500">
              pending
            </div>
            <ul className="space-y-2">
              {pending.map((item) => (
                <li
                  key={item.id}
                  className="item flex items-center justify-between gap-3"
                >
                  <label className="flex items-center gap-2 text-sm text-neutral-200">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggle(item.id)}
                    />
                    <span>{item.text}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="action text-xs text-neutral-500"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="list rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
            <div className="mb-2 text-xs uppercase tracking-widest text-neutral-500">
              done
            </div>
            <ul className="space-y-2">
              {completed.map((item) => (
                <li
                  key={item.id}
                  className="item flex items-center justify-between gap-3"
                >
                  <label className="flex items-center gap-2 text-sm text-neutral-400">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleToggle(item.id)}
                    />
                    <span>{item.text}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="action text-xs text-neutral-500"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const CodeDemo = ({
  register,
  disableAnimations,
}: {
  register: (entry: AnimeLayoutRegistry['code']) => void;
  disableAnimations: boolean;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLElement>(null);
  const layoutRef = useRef<ReturnType<typeof createLayout> | null>(null);
  const variant = useAtomValue(animeCodeVariantAtom);
  const setVariant = useAtomSet(animeCodeVariantAtom);
  const [lastCommand, setLastCommand] = useState<LayoutCommand | null>(null);
  const [isReady, setIsReady] = useState(false);

  const highlight = useCallback(() => {
    if (!codeRef.current) return;
    const code = codeRef.current.textContent ?? '';
    const tokens =
      code.match(
        /(['"`])(?:\\.|[^\\])*?\1|[a-zA-Z_$][a-zA-Z0-9_$]*|\s+|[^a-zA-Z_$'"`\\s]+/g
      ) || [];
    const counts: Record<string, number> = {};
    let html = '';
    for (const token of tokens) {
      if (/^\\s+$/.test(token)) {
        html += token;
        continue;
      }
      counts[token] = (counts[token] ?? 0) + 1;
      const dataAttr = `data-layout-id="${token}-${counts[token]}"`;
      if (/^['"`]/.test(token)) {
        html += `<span class="str" ${dataAttr}>${token}</span>`;
      } else if (/^[a-zA-Z_$]/.test(token)) {
        const cls = /^(const|let|return|if|else|for|new)$/.test(token)
          ? 'kw'
          : 'var';
        html += `<span class="${cls}" ${dataAttr}>${token}</span>`;
      } else {
        html += `<span class="op" ${dataAttr}>${token}</span>`;
      }
    }
    codeRef.current.innerHTML = html;
  }, []);

  // Direct useLayoutEffect — no hook indirection
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    highlight();
    const layout = createLayout(root, {
      loop: true,
      alternate: true,
      loopDelay: 500,
      duration: 1000,
      delay: 150,
      ease: 'inOutExpo',
      enterFrom: {
        opacity: 0,
        duration: 1250,
        delay: 300,
      },
      leaveTo: {
        opacity: 0,
        transform: () =>
          `translate(${random(-50, 50)}px, ${random(
            -200,
            200
          )}px) rotate(${random(-30, 30)}deg)`,
        duration: 750,
        delay: stagger([0, 200], { from: 'random' }),
        ease: 'out(3)',
      },
    });

    layoutRef.current = layout;
    register({ root, layout });
    setIsReady(true);

    return () => {
      layout.revert();
      layoutRef.current = null;
    };
  }, [register, highlight]);

  useLayoutEffect(() => {
    if (!isReady) return;
    setLastCommand(
      makeLayoutCommand(ANIME_LAYOUT_TARGETS.code, 'code-toggle', {
        variant,
        disableAnimations,
      })
    );
  }, [variant, disableAnimations, isReady]);

  useAnimeLayoutDispatcher(lastCommand);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="font-mono uppercase tracking-widest text-neutral-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Code Tokens
        </span>
        <button
          type="button"
          onClick={() => setVariant((prev) => !prev)}
          className="rounded-md border border-neutral-700 px-2 py-1 text-xs font-mono text-neutral-300"
        >
          toggle
        </button>
      </div>
      <div ref={rootRef} className={ANIME_LAYOUT_TARGETS.code}>
        <pre className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3 text-xs text-neutral-300">
          <code ref={codeRef}>
            {variant
              ? 'const layout = createLayout(container);\\nlayout.update(() => container.classList.toggle("stack"));'
              : 'const autoLayout = createLayout(root, { ease: spring({ bounce: 0.2 }) });'}
          </code>
        </pre>
      </div>
    </div>
  );
};

const RgbShuffleDemo = ({
  disableAnimations,
}: {
  disableAnimations: boolean;
}) => {
  const color1 = useAtomValue(colorInstructionAtomFamily('color1'));
  const color2 = useAtomValue(colorInstructionAtomFamily('color2'));
  const color3 = useAtomValue(colorInstructionAtomFamily('color3'));
  const setCommand = useAtomSet(layoutCommandAtom);

  const blocks = [
    { key: 'color1' as const, data: color1 },
    { key: 'color2' as const, data: color2 },
    { key: 'color3' as const, data: color3 },
  ];

  useLayoutEffect(() => {
    blocks.forEach((block) => {
      const el = document.querySelector(
        `[data-rgb-key="${block.key}"]`
      ) as HTMLElement | null;
      if (!el) return;
      animeAnimate(el, {
        backgroundColor: [block.data.from, block.data.to],
        duration: disableAnimations ? 0 : block.data.duration,
        easing: block.data.ease,
        autoplay: true,
      });
    });
  }, [blocks, disableAnimations]);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="font-mono uppercase tracking-widest text-neutral-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          RGB Shuffle
        </span>
        <button
          type="button"
          onClick={() =>
            setCommand(
              makeLayoutCommand(ANIME_LAYOUT_TARGETS.rgb, 'rgb-shuffle', {
                seed: Date.now(),
              })
            )
          }
          className="rounded-md border border-neutral-700 px-2 py-1 text-xs font-mono text-neutral-300"
        >
          shuffle
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {blocks.map((block) => (
          <div
            key={block.key}
            data-rgb-key={block.key}
            className="rounded-xl border border-neutral-800 p-3 text-sm text-neutral-900"
            style={{ backgroundColor: block.data.from }}
          >
            <div className="text-xs uppercase tracking-widest text-neutral-900/70">
              {block.data.label}
            </div>
            <div className="mt-2 text-xs text-neutral-900/80">
              {block.data.from} → {block.data.to}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnimeLayoutLab = ({
  disableAnimations,
}: {
  disableAnimations: boolean;
}) => {
  const registryRef = useRef<AnimeLayoutRegistry>({});

  // This is the actual animation logic.
  const handleCommand = useCallback(
    (command: LayoutCommand) => {
      switch (command.kind) {
        case 'accordion-toggle': {
          const entry = registryRef.current.accordion;
          if (!entry?.layout) return;
          entry.layout.animate(
            disableAnimations ? { duration: 100 } : undefined
          );
          break;
        }
        case 'nav-select': {
          const entry = registryRef.current.nav;
          if (!entry?.layout || !entry.contentLayout || !entry.root) return;
          const { active } = command.payload as { active: string };
          entry.layout.update(
            () => {
              entry.contentLayout?.record();
              // NOTE: This is where I have a bit of a concern. in our callback, with a useCallback, per React, we are using querySelectors.
              // A bit touchy, no?
              const buttonBg = entry.root?.querySelector('.button-bg');
              const button = entry.root?.querySelector(
                `button[data-color="${active}"]`
              );
              if (buttonBg && button) {
                button.appendChild(buttonBg);
              }
              entry.root?.querySelectorAll('section').forEach((section) => {
                section.classList.toggle(
                  'is-active',
                  section.getAttribute('data-color') === active
                );
                section.classList.toggle(
                  'hidden',
                  section.getAttribute('data-color') !== active
                );
              });
              entry.contentLayout?.animate();
            },
            // NOTE: No hardcoding duration.
            disableAnimations ? { duration: 0 } : undefined
          );
          break;
        }
        case 'periodic-layout': {
          const entry = registryRef.current.periodic;
          if (!entry?.layout || !entry.root) return;
          const { mode } = command.payload as { mode: string };
          entry.layout.update(
            () => {
              const elements = entry.root?.querySelectorAll('.element');
              if (!elements) return;
              const total = elements.length;

              if (mode === 'stack') {
                // Use stagger on all elements at once (anime.js handles iteration)
                animeSet(elements, {
                  x: 0,
                  y: stagger(12, { reversed: true }),
                });
              } else if (mode === 'grid') {
                elements.forEach((el) => {
                  animeSet(el as HTMLElement, {
                    x: random(-6, 6),
                    y: random(-6, 6),
                  });
                });
              } else {
                animeSet(elements, { transform: 'none' });
              }
            },
            disableAnimations
              ? { duration: 0 }
              : { duration: 800, ease: 'inOutExpo' }
          );
          break;
        }
        case 'planets-layout': {
          const entry = registryRef.current.planets;
          if (!entry?.layout || !entry.root) return;
          const { mode, visibleCount } = command.payload as {
            mode: string;
            visibleCount: number;
          };
          entry.layout.update(
            () => {
              const cards = Array.from(
                entry.root?.querySelectorAll('.planet-card') ?? []
              );
              cards.forEach((card, index) => {
                card.classList.toggle('is-removed', index >= visibleCount);
              });
              if (mode === 'stack') {
                animeSet(cards, {
                  x: 0,
                  y: stagger(10, { reversed: true }),
                  z: stagger(-20, { reversed: true }),
                });
              } else if (mode === 'chaos') {
                animeSet(cards, {
                  x: () => random(-10, 10) + 'vw',
                  y: () => random(-10, 10) + 'vh',
                  rotateZ: () => random(-20, 20),
                  scale: () => random(0.8, 1.15),
                });
              } else {
                animeSet(cards, { transform: 'none' });
              }
            },
            disableAnimations
              ? { duration: 0 }
              : { duration: 500, ease: 'out(3)' }
          );
          break;
        }
        case 'todo-action': {
          const entry = registryRef.current.todo;
          if (!entry?.layout) return;
          entry.layout.animate(disableAnimations ? { duration: 0 } : undefined);
          break;
        }
        case 'code-toggle': {
          const entry = registryRef.current.code;
          if (!entry?.layout || !entry.root) return;
          entry.layout.update(
            ({ root }) => {
              root.classList.toggle('show-animejs');
            },
            disableAnimations ? { duration: 0 } : undefined
          );
          break;
        }
        case 'rgb-shuffle': {
          shuffleColorInstructions();
          break;
        }
        default:
          break;
      }
    },
    [disableAnimations]
  );

  // NOTE: I asked for a Queue out of shrewdness. Now, let's audit whether it is at all useful, and then we'll muse on its necessity.
  useLayoutCommandQueue(handleCommand);

  return (
    <Section
      title="AnimeJS Auto-Layout Lab"
      subtitle="React-scoped auto-layout examples driven by Effect-Atom + Queue."
    >
      <div className="grid grid-cols-1 gap-6">
        <div className="grid grid-cols-2 gap-4">
          <AccordionDemo
            register={(entry) => {
              registryRef.current.accordion = entry ?? undefined;
            }}
            disableAnimations={disableAnimations}
          />
          <AccordionDemoV2 />
        </div>
        <NavDemo
          register={(entry) => {
            registryRef.current.nav = entry ?? undefined;
          }}
          disableAnimations={disableAnimations}
        />
        <PeriodicDemo
          register={(entry) => {
            registryRef.current.periodic = entry ?? undefined;
          }}
          disableAnimations={disableAnimations}
        />
        <PlanetsDemo
          register={(entry) => {
            registryRef.current.planets = entry ?? undefined;
          }}
          disableAnimations={disableAnimations}
        />
        <TodoDemo
          register={(entry) => {
            registryRef.current.todo = entry ?? undefined;
          }}
          disableAnimations={disableAnimations}
        />
        <CodeDemo
          register={(entry) => {
            registryRef.current.code = entry ?? undefined;
          }}
          disableAnimations={disableAnimations}
        />
        <RgbShuffleDemo disableAnimations={disableAnimations} />
      </div>
    </Section>
  );
};

// =============================================================================
// Layout Guard Lab (Transform-only vs FLIP vs None)
// =============================================================================

type LayoutGuardRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutGuardMetrics = {
  parent: LayoutGuardRect;
  content: LayoutGuardRect;
  delta: {
    parentWidth: number;
    parentHeight: number;
  };
  updatedAt: number;
};

const layoutGuardStepAtom = Atom.make(0);
const layoutGuardFocusModeAtom = Atom.make<LayoutGuardMode>('none');
const layoutGuardMetricsAtom = Atom.make<Record<string, LayoutGuardMetrics>>(
  {}
);

const layoutGuardSummaryAtom = Atom.make((get) => {
  const metrics = get(layoutGuardMetricsAtom);
  const entries = Object.entries(metrics).map(([id, value]) => {
    const shift =
      Math.abs(value.delta.parentWidth) + Math.abs(value.delta.parentHeight);
    return { id, shift, value };
  });
  const sorted = [...entries].sort((a, b) => a.shift - b.shift);
  const bestId = sorted[0]?.id;
  const worstId = sorted[sorted.length - 1]?.id;

  const byId = Object.fromEntries(
    entries.map((entry) => {
      let verdict = 'STABLE';
      let statement = 'Parent stayed stable during the transition.';

      if (entry.id === worstId && entries.length > 1) {
        verdict = 'JITTER';
        statement = 'Parent jittered more than the others.';
      } else if (entry.id !== bestId && entry.shift > 16) {
        verdict = 'SHIFT';
        statement = 'Minor parent shift observed.';
      }

      if (entry.id === bestId && entries.length > 1) {
        verdict = 'BEST';
        statement = 'Most stable parent of the group.';
      }

      return [
        entry.id,
        { verdict, statement, shift: entry.shift, metrics: entry.value },
      ];
    })
  );

  return { byId, leaderboard: sorted.map((entry) => entry.id) };
});

const toRect = (rect: DOMRect): LayoutGuardRect => ({
  x: rect.left,
  y: rect.top,
  width: rect.width,
  height: rect.height,
});

const useLayoutGuardMeasurements = (
  id: string,
  parentRef: RefObject<HTMLDivElement>,
  contentRef: RefObject<HTMLDivElement>,
  step: number
) => {
  useLayoutEffect(() => {
    const parent = parentRef.current;
    const content = contentRef.current;
    if (!parent || !content) return;

    const measure = () => {
      const parentRect = toRect(parent.getBoundingClientRect());
      const contentRect = toRect(content.getBoundingClientRect());
      Atom.update(layoutGuardMetricsAtom, (prev) => {
        const previous = prev[id];
        const delta = {
          parentWidth:
            parentRect.width - (previous?.parent.width ?? parentRect.width),
          parentHeight:
            parentRect.height - (previous?.parent.height ?? parentRect.height),
        };
        return {
          ...prev,
          [id]: {
            parent: parentRect,
            content: contentRect,
            delta,
            updatedAt: Date.now(),
          },
        };
      });
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(parent);
    observer.observe(content);
    return () => observer.disconnect();
  }, [contentRef, id, parentRef, step]);
};

// =============================================================================
// Demo Views for DynamicIslandCard
// =============================================================================

function OverviewView() {
  return (
    <div className="space-y-4 p-4">
      <AnimatedItem index={0}>
        <h3 className="text-sm font-mono text-neutral-300">System Overview</h3>
      </AnimatedItem>
      <AnimatedItem index={1}>
        <MetricGrid columns={2}>
          <MetricBlock label="CPU" value="42%" status="nominal" />
          <MetricBlock label="Memory" value="8.2GB" status="warning" />
          <MetricBlock label="Network" value="125 Mb/s" status="nominal" />
          <MetricBlock label="Disk" value="67%" status="nominal" />
        </MetricGrid>
      </AnimatedItem>
    </div>
  );
}

function DetailView() {
  return (
    <div className="space-y-3 p-4">
      <AnimatedItem index={0}>
        <h3 className="text-sm font-mono text-neutral-300">Detailed Metrics</h3>
      </AnimatedItem>
      {['Process Alpha', 'Process Beta', 'Process Gamma'].map((name, i) => (
        <AnimatedItem key={name} index={i + 1}>
          <div className="flex justify-between items-center py-2 border-b border-neutral-800">
            <span className="text-sm text-neutral-400">{name}</span>
            <span className="text-sm font-mono text-neutral-300">
              {Math.floor(Math.random() * 100)}%
            </span>
          </div>
        </AnimatedItem>
      ))}
    </div>
  );
}

function SettingsView() {
  return (
    <div className="space-y-4 p-4">
      <AnimatedItem index={0}>
        <h3 className="text-sm font-mono text-neutral-300">Settings</h3>
      </AnimatedItem>
      <AnimatedItem index={1}>
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 accent-neutral-400"
              defaultChecked
            />
            Auto-refresh metrics
          </label>
          <label className="flex items-center gap-3 text-sm text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 accent-neutral-400"
            />
            Show notifications
          </label>
          <label className="flex items-center gap-3 text-sm text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 accent-neutral-400"
              defaultChecked
            />
            Compact mode
          </label>
        </div>
      </AnimatedItem>
    </div>
  );
}

// =============================================================================
// Server Integration Demo
// =============================================================================

function ServerIntegrationDemo({ cardId }: { cardId: string }) {
  const { query } = useCardServer(cardId);
  const [serverStatus, setServerStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [serverData, setServerData] = useState<string | null>(null);

  const checkServer = useCallback(async () => {
    setServerStatus('loading');
    try {
      const data = await query('/health');
      setServerData(JSON.stringify(data, null, 2));
      setServerStatus('success');
    } catch (e) {
      setServerStatus('error');
      setServerData(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [query]);

  const statusColors: Record<string, string> = {
    idle: 'text-neutral-600',
    loading: 'text-neutral-400',
    success: 'text-neutral-300',
    error: 'text-red-500/70',
  };

  return (
    <div className="space-y-3">
      <div
        className="font-mono text-neutral-500 uppercase tracking-wider"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Server Integration
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={checkServer}
          disabled={serverStatus === 'loading'}
          className="px-3 py-1.5 font-mono bg-neutral-900 border border-neutral-700 hover:border-neutral-600 text-neutral-400 hover:text-neutral-300 rounded transition-colors disabled:opacity-50"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {serverStatus === 'loading' ? 'Checking...' : 'Check Health'}
        </button>
        <span
          className={`font-mono ${statusColors[serverStatus]}`}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {serverStatus}
        </span>
      </div>
      {serverData && (
        <pre
          className="font-mono text-neutral-500 bg-neutral-950 border border-neutral-800 p-2 rounded overflow-auto max-h-16"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {serverData}
        </pre>
      )}
      <div
        className="text-neutral-600"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        localhost:7682
      </div>
    </div>
  );
}

// =============================================================================
// Durable Stream Demo
// =============================================================================

function DurableStreamDemo({
  cardId,
}: {
  cardId: Schema.Schema.Type<typeof CardId>;
}) {
  const { tree, status, error } = useDurableStreamPatches(cardId, 'demo-user');

  const statusColors: Record<StreamStatus, string> = {
    streaming: 'text-neutral-300',
    error: 'text-red-500/70',
    connecting: 'text-neutral-400',
    idle: 'text-neutral-600',
  };

  return (
    <div className="space-y-3">
      <div
        className="font-mono text-neutral-500 uppercase tracking-wider"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Durable Stream
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`font-mono ${statusColors[status]}`}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {status}
        </span>
      </div>
      {error && (
        <p
          className="font-mono text-red-500/70"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {error}
        </p>
      )}
      {tree && (
        <pre
          className="font-mono text-neutral-500 bg-neutral-950 border border-neutral-800 p-2 rounded overflow-auto max-h-16"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Root: {tree.root ?? 'none'}
          {'\n'}Elements: {Object.keys(tree.elements).length}
        </pre>
      )}
      <div
        className="text-neutral-600"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        localhost:4437
      </div>
    </div>
  );
}

// =============================================================================
// Section Component
// =============================================================================

interface SectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function Section({ title, subtitle, children }: SectionProps) {
  return (
    <div className="p-6 border border-neutral-800 rounded-lg bg-neutral-950/80 backdrop-blur">
      <div className="mb-4 pb-3 border-b border-neutral-800">
        <h3 className="text-sm font-mono text-neutral-200">{title}</h3>
        {subtitle && (
          <p
            className="text-neutral-500 mt-1"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// =============================================================================
// Basic MorphCard Demo
// =============================================================================

function BasicMorphCardDemo({
  disableAnimations,
}: {
  disableAnimations: boolean;
}) {
  const cardId = 'basic-demo';
  const brandedCardId = makeCardId(cardId);
  const snapshot = useAtomValue(cardStateFamily.snapshot(brandedCardId));
  const machineState = useAtomValue(islandStateValueAtomFamily(brandedCardId));
  const tabState = useAtomValue(cardTabStateFamily(cardId));
  const activeTab = tabState.activeTab ?? 'compact';
  const stateMachineConfig = {
    sizes: {
      compact: { width: 240, height: 96 },
      expanded: { width: 420, height: 220 },
      default: { width: 320, height: 140 },
    },
    reticle: 'corners',
  } as const;

  const views = useMemo<ViewRegistry<'compact' | 'expanded'>>(
    () => ({
      compact: {
        id: 'compact',
        label: 'Compact',
        sizeKey: 'compact',
        transition: DEFAULT_TRANSITION,
        render: () => (
          <div className="p-4 space-y-3">
            <AnimatedItem index={0}>
              <h4 className="text-sm font-mono text-neutral-300">
                System Status
              </h4>
            </AnimatedItem>
            <AnimatedItem index={1}>
              <MetricGrid columns={2}>
                <MetricBlock label="Uptime" value="99.9%" status="nominal" />
                <MetricBlock label="Latency" value="12ms" status="nominal" />
              </MetricGrid>
            </AnimatedItem>
          </div>
        ),
      },
      expanded: {
        id: 'expanded',
        label: 'Expanded',
        sizeKey: 'expanded',
        transition: DEFAULT_TRANSITION,
        complex: true,
        render: () => (
          <div className="p-4 space-y-3">
            <AnimatedItem index={0}>
              <h4 className="text-sm font-mono text-neutral-300">
                System Status
              </h4>
            </AnimatedItem>
            <AnimatedItem index={1}>
              <MetricGrid columns={2}>
                <MetricBlock label="Uptime" value="99.9%" status="nominal" />
                <MetricBlock label="Latency" value="12ms" status="nominal" />
              </MetricGrid>
            </AnimatedItem>
            <AnimatedItem index={2}>
              <div className="text-sm text-neutral-400">
                Expanded diagnostics now include deeper telemetry bands.
              </div>
            </AnimatedItem>
          </div>
        ),
      },
    }),
    []
  );

  return (
    <Section title="MorphCard Core" subtitle="SizeKey + transition grammar">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab(cardId, 'compact', morphCardRegistry)}
            className={`px-3 py-1 font-mono rounded transition-colors ${
              activeTab === 'compact'
                ? 'bg-neutral-800 text-neutral-200 border border-neutral-600'
                : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:border-neutral-700'
            }`}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Compact
          </button>
          <button
            onClick={() => setActiveTab(cardId, 'expanded', morphCardRegistry)}
            className={`px-3 py-1 font-mono rounded transition-colors ${
              activeTab === 'expanded'
                ? 'bg-neutral-800 text-neutral-200 border border-neutral-600'
                : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:border-neutral-700'
            }`}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Expanded
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
          <MorphCardStage minHeight={260}>
            <DynamicIslandCard
              cardId={cardId}
              initialSizeKey="compact"
              stateMachineConfig={stateMachineConfig}
              transitionStrategy={defaultTransitionStrategy}
              config={{ borderIntensity: 0.08 }}
              tabConfig={{ autoHide: true }}
              disableAnimations={disableAnimations}
              views={views}
            >
              {null}
            </DynamicIslandCard>
          </MorphCardStage>

          <div className="border border-neutral-800 rounded-xl bg-neutral-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-neutral-300">
                Live State
              </span>
              <span
                className="font-mono text-neutral-500"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                machine: {machineState}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['sizeKey', snapshot.sizeKey],
                ['previous', snapshot.previousSizeKey],
                ['reticle', snapshot.reticle],
                ['complexity', snapshot.complexity],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-neutral-800 bg-neutral-950 p-2"
                >
                  <div
                    className="font-mono text-neutral-500 uppercase tracking-wider"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    {label}
                  </div>
                  <div className="text-sm font-mono text-neutral-200">
                    {String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// =============================================================================
// DynamicIslandCard Demo
// =============================================================================

function DynamicIslandCardDemo({
  disableAnimations,
}: {
  disableAnimations: boolean;
}) {
  const cardId = 'island-demo';
  const brandedCardId = makeCardId(cardId);
  const snapshot = useAtomValue(cardStateFamily.snapshot(brandedCardId));
  const machineState = useAtomValue(islandStateValueAtomFamily(brandedCardId));
  const stateMachineConfig = {
    sizes: {
      compact: { width: 260, height: 110 },
      expanded: { width: 460, height: 260 },
      detail: { width: 520, height: 300 },
      default: { width: 320, height: 160 },
    },
    reticle: 'grid',
  } as const;

  return (
    <Section
      title="DynamicIslandCard"
      subtitle="Tabbed views driving sizeKey + grammar"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
          <DynamicIslandCard
            cardId={cardId}
            initialSizeKey="expanded"
            stateMachineConfig={stateMachineConfig}
            transitionStrategy={defaultTransitionStrategy}
            dynamicSize
            disableAnimations={disableAnimations}
            tabConfig={{
              position: 'top',
              accentColor: '#525252', // neutral-600
            }}
            className="bg-neutral-950 rounded"
            config={{ borderIntensity: 0.08 }}
          >
            <DynamicIslandCard.View
              id="overview"
              label="Overview"
              icon="◎"
              sizeKey="compact"
              transition="morph:smooth"
            >
              <OverviewView />
            </DynamicIslandCard.View>
            <DynamicIslandCard.View
              id="detail"
              label="Detail"
              icon="◈"
              sizeKey="detail"
              transition="cinematic:slow"
              complex
            >
              <DetailView />
            </DynamicIslandCard.View>
            <DynamicIslandCard.View
              id="settings"
              label="Settings"
              icon="⚙"
              sizeKey="expanded"
              transition="snap:fast"
            >
              <SettingsView />
            </DynamicIslandCard.View>
          </DynamicIslandCard>

          <div className="border border-neutral-800 rounded-xl bg-neutral-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-neutral-300">
                Island Diagnostics
              </span>
              <span
                className="font-mono text-neutral-500"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                machine: {machineState}
              </span>
            </div>
            <div className="space-y-2">
              {[
                ['sizeKey', snapshot.sizeKey],
                ['previous', snapshot.previousSizeKey],
                ['reticle', snapshot.reticle],
                ['complexity', snapshot.complexity],
                ['transition', snapshot.transition.verb],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-neutral-800 pb-2"
                >
                  <span
                    className="font-mono text-neutral-500 uppercase tracking-wider"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    {label}
                  </span>
                  <span className="text-sm font-mono text-neutral-200">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function TransitionTargetView({ cardId }: { cardId: string }) {
  const brandedCardId = makeCardId(cardId);
  const snapshot = useAtomValue(cardStateFamily.snapshot(brandedCardId));
  return (
    <div className="p-4 space-y-3">
      <AnimatedItem index={0}>
        <h4 className="text-sm font-mono text-neutral-300">
          Transition Target
        </h4>
      </AnimatedItem>
      <AnimatedItem index={1}>
        <MetricGrid columns={2}>
          <MetricBlock
            label="sizeKey"
            value={snapshot.sizeKey}
            status="nominal"
          />
          <MetricBlock
            label="complex"
            value={snapshot.complexity}
            status="warning"
          />
        </MetricGrid>
      </AnimatedItem>
    </div>
  );
}

// =============================================================================
// Chart Grid Demo
// =============================================================================

function ChartGridDemo({ disableAnimations }: { disableAnimations: boolean }) {
  const stateMachineConfig = {
    sizes: {
      compact: { width: 280, height: 170 },
      expanded: { width: 420, height: 230 },
      detail: { width: 460, height: 260 },
      default: { width: 320, height: 190 },
    },
    reticle: 'grid',
  } as const;

  const cards = useMemo(() => CHART_GRID_CARDS, []);
  const seriesById = useAtomValue(chartSeriesAtom);

  return (
    <Section
      title="Chart Grid"
      subtitle="Multiple DynamicIslands in a shared layout"
    >
      <HStack gap={16} align="start" wrap>
        {cards.map((card) => (
          <MorphCardStage
            key={card.id}
            minHeight={220}
            className="bg-transparent p-0"
          >
            <DynamicIslandCard
              cardId={card.id}
              initialSizeKey="compact"
              stateMachineConfig={stateMachineConfig}
              transitionStrategy={defaultTransitionStrategy}
              dynamicSize
              disableAnimations={disableAnimations}
              tabConfig={{ position: 'top', accentColor: card.tone }}
              config={{ borderIntensity: 0.08 }}
              className="bg-neutral-950/70"
            >
              <DynamicIslandCard.View
                id="overview"
                label="Overview"
                sizeKey="compact"
                transition="morph:smooth"
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-neutral-300">
                      {card.title}
                    </span>
                    <span className="text-sm font-mono text-neutral-200">
                      {card.metric}
                    </span>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
                    <ChartRenderer
                      chartType="Line"
                      chartId={`${card.id}-overview`}
                      className="w-full"
                      config={{
                        data: (seriesById[card.id] ?? card.series).map(
                          (value, index) => ({
                            x: index + 1,
                            y: value,
                          })
                        ),
                        xField: 'x',
                        yField: 'y',
                        smooth: true,
                        autoFit: true,
                        lineStyle: { lineWidth: 2, stroke: card.tone },
                        axis: false,
                        tooltip: false,
                        animation: false,
                      }}
                      height={96}
                      fill={false}
                      useDefaultStyling={false}
                    />
                  </div>
                  <div className="text-xs font-mono text-neutral-500">
                    Last 12 samples
                  </div>
                </div>
              </DynamicIslandCard.View>
              <DynamicIslandCard.View
                id="detail"
                label="Detail"
                sizeKey="expanded"
                transition="cinematic:slow"
                complex
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-neutral-300">
                      {card.title} Detail
                    </span>
                    <span className="text-sm font-mono text-neutral-200">
                      {card.metric}
                    </span>
                  </div>
                  <MorphCard.Stack direction="row" gap={12} align="center">
                    <MorphCard.Div className="w-[220px] shrink-0 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
                      <ChartRenderer
                        chartType="Line"
                        chartId={`${card.id}-detail`}
                        className="w-full"
                        config={{
                          data: (seriesById[card.id] ?? card.series)
                            .concat(seriesById[card.id]?.slice(-4) ?? [])
                            .map((value, index) => ({
                              x: index + 1,
                              y: value,
                            })),
                          xField: 'x',
                          yField: 'y',
                          smooth: true,
                          autoFit: true,
                          lineStyle: { lineWidth: 2, stroke: card.tone },
                          axis: false,
                          tooltip: false,
                          animation: false,
                        }}
                        height={120}
                        fill={false}
                        useDefaultStyling={false}
                      />
                    </MorphCard.Div>
                    <MorphCard.Div className="min-w-0 flex-1">
                      <ScrambleQuote text={card.quote} author="Operations" />
                    </MorphCard.Div>
                  </MorphCard.Stack>
                </div>
              </DynamicIslandCard.View>
            </DynamicIslandCard>
          </MorphCardStage>
        ))}
      </HStack>
    </Section>
  );
}

// =============================================================================
// View Registry Demo
// =============================================================================

function ViewRegistryDemo({
  disableAnimations,
}: {
  disableAnimations: boolean;
}) {
  const cardId = 'views-registry-demo';
  const brandedCardId = makeCardId(cardId);
  const snapshot = useAtomValue(cardStateFamily.snapshot(brandedCardId));
  const tabState = useAtomValue(cardTabStateFamily(cardId));
  const stateMachineConfig = {
    sizes: {
      compact: { width: 240, height: 120 },
      expanded: { width: 480, height: 280 },
      alert: { width: 360, height: 200 },
      default: { width: 300, height: 140 },
    },
    reticle: 'pulse',
  } as const;

  const views = useMemo<ViewRegistry<'compact' | 'expanded' | 'alert'>>(
    () => ({
      status: {
        id: 'status',
        label: 'Status',
        icon: '◎',
        sizeKey: 'compact',
        transition: { verb: 'morph', modifier: 'smooth' },
        render: ({ active }) => (
          <div className="p-4 space-y-3">
            <AnimatedItem index={0}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-neutral-300">
                  Edge Node
                </span>
                <span
                  className="font-mono text-neutral-500"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {active ? 'ACTIVE' : 'IDLE'}
                </span>
              </div>
            </AnimatedItem>
            <AnimatedItem index={1}>
              <MetricGrid columns={2}>
                <MetricBlock label="Temp" value="73°F" status="nominal" />
                <MetricBlock label="Load" value="62%" status="warning" />
              </MetricGrid>
            </AnimatedItem>
          </div>
        ),
      },
      timeline: {
        id: 'timeline',
        label: 'Timeline',
        icon: '◈',
        sizeKey: 'expanded',
        transition: { verb: 'cinematic', modifier: 'slow' },
        complex: true,
        render: () => (
          <div className="p-4 space-y-3">
            <AnimatedItem index={0}>
              <h3 className="text-sm font-mono text-neutral-300">
                IIoT Event Timeline
              </h3>
            </AnimatedItem>
            {['Valve spike', 'PLC handshake', 'Sensor recalibration'].map(
              (label, index) => (
                <AnimatedItem key={label} index={index + 1}>
                  <div className="flex items-center justify-between border-b border-neutral-800 py-2">
                    <span className="text-sm text-neutral-400">{label}</span>
                    <span className="text-sm font-mono text-neutral-300">
                      T-{(index + 1) * 4}m
                    </span>
                  </div>
                </AnimatedItem>
              )
            )}
          </div>
        ),
      },
      alerts: {
        id: 'alerts',
        label: 'Alerts',
        icon: '⚠',
        sizeKey: 'alert',
        transition: { verb: 'snap', modifier: 'fast' },
        reticle: 'corners',
        render: ({ sizeKey }) => (
          <div className="p-4 space-y-3">
            <AnimatedItem index={0}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-neutral-300">
                  Anomaly Queue
                </span>
                <span
                  className="font-mono text-neutral-500"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  size:{sizeKey}
                </span>
              </div>
            </AnimatedItem>
            {['Pressure drift', 'Cooling lag', 'Power transient'].map(
              (label) => (
                <AnimatedItem key={label} index={1}>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 px-3 py-2 flex items-center justify-between">
                    <span className="text-sm text-neutral-300">{label}</span>
                    <span className="text-sm font-mono text-red-300">P1</span>
                  </div>
                </AnimatedItem>
              )
            )}
          </div>
        ),
      },
    }),
    []
  );
  const validation = useMemo(() => {
    const entries = Object.entries(views);
    const dataOnly = Object.fromEntries(
      entries.map(([key, view]) => {
        const { render, ...rest } = view;
        return [key, rest];
      })
    );
    const decoded = Schema.decodeUnknownEither(ViewRegistrySchema)(dataOnly);
    if (decoded._tag === 'Left') {
      return { ok: false, message: 'schema validation failed' };
    }
    const validated = decoded.right as Record<string, { id: string }>;
    for (const [key, value] of Object.entries(validated)) {
      if (value.id !== key) {
        return { ok: false, message: `id mismatch: ${key} != ${value.id}` };
      }
    }
    for (const [key, value] of entries) {
      if (!value.render && !value.content) {
        return { ok: false, message: `view "${key}" missing render/content` };
      }
    }
    return { ok: true, message: 'validated' };
  }, [views]);

  return (
    <Section
      title="View Registry"
      subtitle="Typed views map + runtime validation"
    >
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
        <DynamicIslandCard
          cardId={cardId}
          initialSizeKey="compact"
          stateMachineConfig={stateMachineConfig}
          transitionStrategy={defaultTransitionStrategy}
          dynamicSize
          disableAnimations={disableAnimations}
          tabConfig={{ position: 'top' }}
          config={{ borderIntensity: 0.08 }}
          views={views}
        >
          {null}
        </DynamicIslandCard>

        <div className="border border-neutral-800 rounded-xl bg-neutral-950/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono text-neutral-300">
              Registry Diagnostics
            </span>
            <span
              className="font-mono text-neutral-500"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              active: {tabState.activeTab ?? 'none'}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span
                className="font-mono text-neutral-500 uppercase tracking-wider"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                validation
              </span>
              <span
                className={`text-sm font-mono ${
                  validation.ok ? 'text-emerald-300' : 'text-red-300'
                }`}
              >
                {validation.message}
              </span>
            </div>
            {[
              ['sizeKey', snapshot.sizeKey],
              ['previous', snapshot.previousSizeKey],
              ['transition', snapshot.transition.verb],
              ['reticle', snapshot.reticle],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-neutral-800 pb-2"
              >
                <span
                  className="font-mono text-neutral-500 uppercase tracking-wider"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {label}
                </span>
                <span className="text-sm font-mono text-neutral-200">
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

// =============================================================================
// State Switch Scenarios
// =============================================================================

function StateSwitchScenarios({
  disableAnimations,
}: {
  disableAnimations: boolean;
}) {
  const cardId = 'switch-scenarios';
  const brandedCardId = makeCardId(cardId);
  const snapshot = useAtomValue(cardStateFamily.snapshot(brandedCardId));
  const machineState = useAtomValue(islandStateValueAtomFamily(brandedCardId));
  const stateMachineConfig = {
    sizes: {
      minimal: { width: 160, height: 56 },
      compact: { width: 260, height: 110 },
      expanded: { width: 460, height: 240 },
      ultra: { width: 560, height: 320 },
      default: { width: 320, height: 160 },
    },
    reticle: 'corners',
  } as const;
  const gridData = useMemo(
    () => [
      { id: 'A1', name: 'Valve 17', value: 63.4, status: 'nominal' },
      { id: 'B4', name: 'Pump 03', value: 78.2, status: 'warning' },
      { id: 'C2', name: 'Sensor 9', value: 51.9, status: 'nominal' },
      { id: 'D8', name: 'Relay 12', value: 90.1, status: 'critical' },
    ],
    []
  );
  const gridColumns = useMemo(
    () => [
      { field: 'id', headerName: 'ID', width: 80 },
      { field: 'name', headerName: 'NAME', flex: 1 },
      { field: 'value', headerName: 'VALUE', width: 110 },
      { field: 'status', headerName: 'STATUS', width: 120 },
    ],
    []
  );
  const views = useMemo<
    ViewRegistry<'minimal' | 'compact' | 'expanded' | 'ultra' | 'default'>
  >(
    () => ({
      compact: {
        id: 'compact',
        label: 'Compact',
        sizeKey: 'compact',
        transition: { verb: 'morph', modifier: 'smooth' },
        render: () => (
          <div className="p-4 space-y-3">
            <AnimatedItem index={0}>
              <h4 className="text-sm font-mono text-neutral-300">
                Compact View
              </h4>
            </AnimatedItem>
            <AnimatedItem index={1}>
              <MetricGrid columns={2}>
                <MetricBlock
                  label="Mode"
                  value={snapshot.sizeKey}
                  status="nominal"
                />
                <MetricBlock
                  label="Reticle"
                  value={snapshot.reticle}
                  status="nominal"
                />
              </MetricGrid>
            </AnimatedItem>
          </div>
        ),
      },
      expanded: {
        id: 'expanded',
        label: 'Expanded',
        sizeKey: 'expanded',
        transition: { verb: 'cinematic', modifier: 'slow' },
        complex: true,
        render: () => (
          <div className="p-4 space-y-4">
            <AnimatedItem index={0}>
              <h4 className="text-sm font-mono text-neutral-300">
                Expanded View
              </h4>
            </AnimatedItem>
            <AnimatedItem index={1}>
              <div className="grid grid-cols-2 gap-3">
                <MetricBlock
                  label="Mode"
                  value={snapshot.sizeKey}
                  status="nominal"
                />
                <MetricBlock
                  label="Reticle"
                  value={snapshot.reticle}
                  status="nominal"
                />
                <MetricBlock
                  label="Complexity"
                  value={snapshot.complexity}
                  status="warning"
                />
                <MetricBlock
                  label="Prev"
                  value={snapshot.previousSizeKey}
                  status="nominal"
                />
              </div>
            </AnimatedItem>
            <AnimatedItem index={2}>
              <div style={{ height: 140 }}>
                <Tmnl.DataGrid
                  id="switch-grid"
                  variant={tmnlDenseDark}
                  rowData={gridData}
                  columnDefs={gridColumns}
                >
                  <Tmnl.DataGrid.Header>
                    <Tmnl.DataGrid.Title
                      title="NODES"
                      badge={gridData.length}
                    />
                  </Tmnl.DataGrid.Header>
                  <Tmnl.DataGrid.Body />
                </Tmnl.DataGrid>
              </div>
            </AnimatedItem>
          </div>
        ),
      },
      geoint: {
        id: 'geoint',
        label: 'GeoInt',
        sizeKey: 'ultra',
        transition: { verb: 'expand', modifier: 'smooth' },
        dynamicSize: true,
        minWidth: 520,
        minHeight: 260,
        render: () => (
          <div className="p-3">
            <div
              className="font-mono text-neutral-500 uppercase tracking-wider"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              GEOINT PANEL
            </div>
            <div
              className="mt-2 rounded-lg border border-neutral-800 overflow-hidden"
              style={{ height: 240 }}
            >
              <GeointDashboardPanel
                panelId="morph-geoint"
                label="MorphCard GeoInt"
                initialLayout="analytics"
              />
            </div>
          </div>
        ),
      },
      default: {
        id: 'default',
        label: 'Fallback',
        sizeKey: 'default',
        transition: { verb: 'snap', modifier: 'fast' },
        render: () => (
          <div className="p-4 space-y-2">
            <AnimatedItem index={0}>
              <h4 className="text-sm font-mono text-neutral-300">
                Fallback View
              </h4>
            </AnimatedItem>
            <AnimatedItem index={1}>
              <div className="text-sm text-neutral-400">
                Only compact + expanded are defined. Default view handles
                everything else.
              </div>
            </AnimatedItem>
          </div>
        ),
      },
    }),
    [gridColumns, gridData, snapshot]
  );

  const transitionTo = useCallback(
    (
      sizeKey: 'minimal' | 'compact' | 'expanded' | 'ultra',
      complexity: 'simple' | 'complex'
    ) => {
      const nextTab =
        sizeKey === 'compact' || sizeKey === 'expanded' || sizeKey === 'ultra'
          ? sizeKey === 'ultra'
            ? 'geoint'
            : sizeKey
          : 'default';
      setActiveTab(cardId, nextTab, morphCardRegistry);
      sendIslandEvent(brandedCardId, {
        type: 'TRANSITION',
        sizeKey,
        grammar: DEFAULT_TRANSITION,
        complexity,
      });
      sendIslandEvent(brandedCardId, {
        type: 'INTERMEDIATE_TRANSITION',
        grammar: DEFAULT_TRANSITION,
      });
    },
    [brandedCardId]
  );

  const setReticle = useCallback(
    (reticle: 'corners' | 'grid' | 'pulse' | 'glitch') => {
      sendIslandEvent(brandedCardId, { type: 'SET_RETICLE', reticle });
    },
    [brandedCardId]
  );

  const setComplexity = useCallback(
    (complexity: 'simple' | 'complex') => {
      sendIslandEvent(brandedCardId, { type: 'SET_COMPLEXITY', complexity });
    },
    [brandedCardId]
  );

  return (
    <Section
      title="State Switch Scenarios"
      subtitle="Explicit transitions + reticle overrides + complexity toggles"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            ['Minimal', 'minimal', 'simple'],
            ['Compact', 'compact', 'simple'],
            ['Expanded', 'expanded', 'complex'],
            ['Ultra', 'ultra', 'complex'],
          ].map(([label, sizeKey, complexity]) => (
            <button
              key={label}
              onClick={() =>
                transitionTo(
                  sizeKey as 'minimal' | 'compact' | 'expanded' | 'ultra',
                  complexity as 'simple' | 'complex'
                )
              }
              className="px-3 py-1 font-mono rounded transition-colors bg-neutral-900 text-neutral-400 border border-neutral-800 hover:border-neutral-700"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() =>
              sendIslandEvent(brandedCardId, { type: 'RESET_POSITION' })
            }
            className="px-3 py-1 font-mono rounded transition-colors bg-neutral-950 text-neutral-500 border border-neutral-800 hover:border-neutral-700"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Reset Position
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="font-mono text-neutral-500 uppercase tracking-wider"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Reticle
          </div>
          {(['corners', 'grid', 'pulse', 'glitch'] as const).map((reticle) => (
            <button
              key={reticle}
              onClick={() => setReticle(reticle)}
              className="px-2 py-1 font-mono rounded border border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-700"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {reticle}
            </button>
          ))}
          <div
            className="ml-2 font-mono text-neutral-500 uppercase tracking-wider"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Complexity
          </div>
          {(['simple', 'complex'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setComplexity(level)}
              className="px-2 py-1 font-mono rounded border border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-700"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
          <MorphCardStage minHeight={300}>
            <DynamicIslandCard
              cardId={cardId}
              initialSizeKey="compact"
              stateMachineConfig={stateMachineConfig}
              transitionStrategy={defaultTransitionStrategy}
              config={{ borderIntensity: 0.08 }}
              dynamicSize
              disableAnimations={disableAnimations}
              views={views}
            >
              {null}
            </DynamicIslandCard>
          </MorphCardStage>

          <div className="border border-neutral-800 rounded-xl bg-neutral-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-neutral-300">
                Scenario Diagnostics
              </span>
              <span
                className="font-mono text-neutral-500"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                machine: {machineState}
              </span>
            </div>
            <div className="space-y-2">
              {[
                ['sizeKey', snapshot.sizeKey],
                ['previous', snapshot.previousSizeKey],
                ['reticle', snapshot.reticle],
                ['complexity', snapshot.complexity],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-neutral-800 pb-2"
                >
                  <span
                    className="font-mono text-neutral-500 uppercase tracking-wider"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    {label}
                  </span>
                  <span className="text-sm font-mono text-neutral-200">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// =============================================================================
// Server/Stream Integration Demo
// =============================================================================

function IntegrationDemo() {
  const cardId = makeCardId('integration-demo');

  return (
    <Section
      title="Server Integration"
      subtitle="CardServerService + Durable Streams"
    >
      <div className="grid grid-cols-2 gap-6">
        <ServerIntegrationDemo cardId="integration-demo" />
        <DurableStreamDemo cardId={cardId} />
      </div>
    </Section>
  );
}

// =============================================================================
// Transition Gallery
// =============================================================================

function TransitionGallery({
  disableAnimations,
}: {
  disableAnimations: boolean;
}) {
  const cardId = 'transition-gallery';
  const islandCardId = 'transition-gallery-tabs';
  const brandedCardId = makeCardId(cardId);
  const brandedIslandId = makeCardId(islandCardId);
  const snapshot = useAtomValue(cardStateFamily.snapshot(brandedCardId));
  const cardTabState = useAtomValue(cardTabStateFamily(cardId));
  const machineState = useAtomValue(islandStateValueAtomFamily(brandedCardId));
  const islandSnapshot = useAtomValue(
    cardStateFamily.snapshot(brandedIslandId)
  );
  const stateMachineConfig = {
    sizes: {
      compact: { width: 240, height: 100 },
      expanded: { width: 440, height: 220 },
      default: { width: 320, height: 140 },
    },
    reticle: 'corners',
  } as const;
  const activeGrammarRef = useRef(DEFAULT_TRANSITION);
  const [tabIndex, setTabIndex] = useState(0);
  const tabs = useMemo(() => ['overview', 'detail', 'settings'], []);
  const activeViewId = cardTabState.activeTab ?? 'compact';
  const views = useMemo<ViewRegistry>(
    () => ({
      compact: {
        id: 'compact',
        label: 'Compact',
        sizeKey: 'compact',
        transition: DEFAULT_TRANSITION,
        render: () => <TransitionTargetView cardId={cardId} />,
      },
      expanded: {
        id: 'expanded',
        label: 'Expanded',
        sizeKey: 'expanded',
        transition: DEFAULT_TRANSITION,
        render: () => <TransitionTargetView cardId={cardId} />,
      },
    }),
    [cardId]
  );
  const deltaComplexity = useCallback(
    (grammar: TransitionGrammar): 'simple' | 'complex' => {
      const complexVerbs: Array<TransitionGrammar['verb']> = [
        'glitch',
        'teleport',
        'cinematic',
      ];
      return complexVerbs.includes(grammar.verb) ? 'complex' : 'simple';
    },
    []
  );
  const tabTransitionStrategy = useCallback(
    () => Effect.succeed([activeGrammarRef.current]),
    []
  );

  const transitions = [
    {
      label: 'Morph Smooth',
      note: 'Baseline ease-in/out morph',
      complex: false,
      build: (_args: {
        current: 'compact' | 'expanded';
        next: 'compact' | 'expanded';
      }): TransitionGrammar => ({
        verb: 'morph',
        modifier: 'smooth',
      }),
    },
    {
      label: 'Snap Fast',
      note: 'Instant, crisp layout swap',
      complex: false,
      build: (_args: {
        current: 'compact' | 'expanded';
        next: 'compact' | 'expanded';
      }): TransitionGrammar => ({
        verb: 'snap',
        modifier: 'fast',
      }),
    },
    {
      label: 'Expand Smooth',
      note: 'Growth emphasis on expansion',
      complex: false,
      build: (_args: {
        current: 'compact' | 'expanded';
        next: 'compact' | 'expanded';
      }): TransitionGrammar => ({
        verb: 'expand',
        modifier: 'smooth',
      }),
    },
    {
      label: 'Collapse Fast',
      note: 'Quick contraction on collapse',
      complex: false,
      build: (_args: {
        current: 'compact' | 'expanded';
        next: 'compact' | 'expanded';
      }): TransitionGrammar => ({
        verb: 'collapse',
        modifier: 'fast',
      }),
    },
    {
      label: 'Slide Directional',
      note: 'Direction flips with size',
      complex: false,
      build: (args: {
        current: 'compact' | 'expanded';
        next: 'compact' | 'expanded';
      }): TransitionGrammar => ({
        verb: 'slide',
        modifier: 'smooth',
        direction: args.next === 'expanded' ? 'up' : 'down',
      }),
    },
    {
      label: 'Fade Smooth',
      note: 'Opacity-driven change',
      complex: false,
      build: (_args: {
        current: 'compact' | 'expanded';
        next: 'compact' | 'expanded';
      }): TransitionGrammar => ({
        verb: 'fade',
        modifier: 'smooth',
      }),
    },
    {
      label: 'Glitch Sharp',
      note: 'Aggressive chromatic glitch',
      complex: true,
      build: (_args: {
        current: 'compact' | 'expanded';
        next: 'compact' | 'expanded';
      }): TransitionGrammar => ({
        verb: 'glitch',
        modifier: 'sharp',
      }),
    },
    {
      label: 'Teleport Bounce',
      note: 'Jump with bounce settle',
      complex: true,
      build: (_args: {
        current: 'compact' | 'expanded';
        next: 'compact' | 'expanded';
      }): TransitionGrammar => ({
        verb: 'teleport',
        modifier: 'bounce',
      }),
    },
    {
      label: 'Elastic Bounce',
      note: 'Stretch + recoil',
      complex: true,
      build: (_args: {
        current: 'compact' | 'expanded';
        next: 'compact' | 'expanded';
      }): TransitionGrammar => ({
        verb: 'elastic',
        modifier: 'bounce',
      }),
    },
    {
      label: 'Cinematic Slow',
      note: 'Heavy filmic easing',
      complex: true,
      build: (_args: {
        current: 'compact' | 'expanded';
        next: 'compact' | 'expanded';
      }): TransitionGrammar => ({
        verb: 'cinematic',
        modifier: 'slow',
      }),
    },
    {
      label: 'Auto (Delta)',
      note: 'Grammar chosen from size delta',
      complex: undefined,
      build: (args: {
        current: 'compact' | 'expanded';
        next: 'compact' | 'expanded';
      }): TransitionGrammar => {
        const sizes = stateMachineConfig.sizes;
        const currentSize = sizes[args.current] ?? sizes.default;
        const nextSize = sizes[args.next] ?? sizes.default;
        const delta =
          Math.abs(nextSize.width - currentSize.width) +
          Math.abs(nextSize.height - currentSize.height);
        if (delta < 80) return { verb: 'morph', modifier: 'smooth' };
        if (delta < 180) {
          return {
            verb: 'slide',
            modifier: 'smooth',
            direction: args.next === 'expanded' ? 'up' : 'down',
          };
        }
        if (delta < 320) return { verb: 'cinematic', modifier: 'slow' };
        return { verb: 'teleport', modifier: 'bounce' };
      },
    },
  ] as const;

  const [activeExample, setActiveExample] = useState(transitions[0]);
  const triggerTransition = useCallback(
    (example: (typeof transitions)[number]) => {
      const currentSize = activeViewId === 'expanded' ? 'expanded' : 'compact';
      const nextSize = currentSize === 'compact' ? 'expanded' : 'compact';
      const parsed = example.build({
        current: currentSize,
        next: nextSize,
      });
      const isComplex =
        typeof example.complex === 'boolean'
          ? example.complex
          : deltaComplexity(parsed) === 'complex';
      activeGrammarRef.current = parsed;
      setActiveExample(example);
      updateView(
        cardId,
        nextSize,
        { transition: parsed, complex: isComplex },
        morphCardRegistry
      );
      setActiveTab(cardId, nextSize, morphCardRegistry);
      const nextTab = (tabIndex + 1) % tabs.length;
      setTabIndex(nextTab);
      updateView(
        islandCardId,
        tabs[nextTab],
        { transition: parsed, complex: isComplex },
        morphCardRegistry
      );
      setActiveTab(islandCardId, tabs[nextTab], morphCardRegistry);
    },
    [activeViewId, cardId, deltaComplexity, islandCardId, tabIndex, tabs]
  );

  return (
    <Section
      title="Transition Gallery"
      subtitle="10 animation grammars for layout + tab transitions"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {transitions.map((item) => (
            <button
              key={item.label}
              onClick={() => triggerTransition(item)}
              className="px-3 py-1 font-mono rounded border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 transition-colors"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          className="rounded-lg border border-neutral-800 bg-neutral-950/80 px-3 py-2 text-neutral-400 font-mono"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {activeExample.label}: {activeExample.note}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
          <div className="min-h-[260px] flex flex-col gap-4 rounded-xl bg-neutral-950/60 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-neutral-400">
                SizeKey Transition
              </span>
            </div>
            <MorphCardStage
              minHeight={220}
              className="flex-1 bg-transparent p-0"
            >
              <DynamicIslandCard
                cardId={cardId}
                initialSizeKey="compact"
                stateMachineConfig={stateMachineConfig}
                transitionStrategy={defaultTransitionStrategy}
                config={{ borderIntensity: 0.08 }}
                views={views}
                tabConfig={{ autoHide: true }}
                disableAnimations={disableAnimations}
              />
            </MorphCardStage>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-neutral-400">
                Tab Layout Transition
              </span>
            </div>
            <MorphCardStage minHeight={220} className="bg-transparent p-0">
              <DynamicIslandCard
                cardId={islandCardId}
                initialSizeKey="compact"
                stateMachineConfig={stateMachineConfig}
                transitionStrategy={tabTransitionStrategy}
                tabConfig={{ position: 'top' }}
                config={{ borderIntensity: 0.08 }}
                disableAnimations={disableAnimations}
                className="mx-auto"
              >
                <DynamicIslandCard.View
                  id="overview"
                  label="Overview"
                  sizeKey="compact"
                >
                  <OverviewView />
                </DynamicIslandCard.View>
                <DynamicIslandCard.View
                  id="detail"
                  label="Detail"
                  sizeKey="expanded"
                >
                  <DetailView />
                </DynamicIslandCard.View>
                <DynamicIslandCard.View
                  id="settings"
                  label="Settings"
                  sizeKey="compact"
                >
                  <SettingsView />
                </DynamicIslandCard.View>
              </DynamicIslandCard>
            </MorphCardStage>
          </div>

          <div className="border border-neutral-800 rounded-xl bg-neutral-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-neutral-300">
                Transition Diagnostics
              </span>
              <span
                className="font-mono text-neutral-500"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                machine: {machineState}
              </span>
            </div>
            <div className="space-y-2">
              {[
                ['sizeKey', snapshot.sizeKey],
                ['previous', snapshot.previousSizeKey],
                ['transition', snapshot.transition.verb],
                ['modifier', snapshot.transition.modifier],
                ['direction', snapshot.transition.direction ?? 'none'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-neutral-800 pb-2"
                >
                  <span
                    className="font-mono text-neutral-500 uppercase tracking-wider"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    {label}
                  </span>
                  <span className="text-sm font-mono text-neutral-200">
                    {String(value)}
                  </span>
                </div>
              ))}
              <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2 mt-3">
                <div
                  className="font-mono text-neutral-500 uppercase tracking-wider"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  tab sizeKey
                </div>
                <div className="text-sm font-mono text-neutral-200">
                  {String(islandSnapshot.sizeKey)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// =============================================================================
// Layout Guard Lab
// =============================================================================

type LayoutGuardCardProps = {
  id: string;
  title: string;
  mode: LayoutGuardMode;
  step: number;
  focusMode: LayoutGuardMode;
  disableAnimations: boolean;
};

function LayoutGuardCard({
  id,
  title,
  mode,
  step,
  focusMode,
  disableAnimations,
}: LayoutGuardCardProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutGuardMeasurements(id, parentRef, contentRef, step);

  const layouts = [
    {
      label: 'Compact Payload',
      rows: 2,
      columns: 2,
      padding: 'p-3',
      badge: 'C',
      note: 'Tight footprint, minimal rows.',
    },
    {
      label: 'Expanded Payload',
      rows: 3,
      columns: 3,
      padding: 'p-4',
      badge: 'E',
      note: 'Expanded grid, wider footing.',
    },
    {
      label: 'Detail Payload',
      rows: 4,
      columns: 2,
      padding: 'p-5',
      badge: 'D',
      note: 'Tall stack, dense details.',
    },
  ];

  const layout = layouts[step % layouts.length];
  const isFocused = focusMode === mode;
  const effectiveMode = disableAnimations ? 'none' : mode;

  return (
    <div
      ref={parentRef}
      className={cn(
        'rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4 transition-opacity',
        isFocused ? 'opacity-100' : 'opacity-70'
      )}
    >
      <div className="flex items-center justify-between pb-3">
        <div className="space-y-1">
          <div className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
            {title}
          </div>
          <div className="text-sm font-mono text-neutral-300">
            {layout.label}
          </div>
        </div>
        <div className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
          {mode}
        </div>
      </div>

      <LayoutGuard
        mode={effectiveMode}
        layoutKey={step}
        contentRef={contentRef}
        lockParent
        className="w-full"
      >
        <div
          className={cn(
            'rounded-xl border border-neutral-800 bg-neutral-950/90',
            layout.padding
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-neutral-500">
              MODE {layout.badge}
            </span>
            <span className="text-xs font-mono text-neutral-400">
              step {step}
            </span>
          </div>
          <div
            className={cn(
              'mt-3 grid gap-2',
              layout.columns === 3 ? 'grid-cols-3' : 'grid-cols-2'
            )}
          >
            {Array.from({ length: layout.rows * layout.columns }).map(
              (_, index) => (
                <div
                  key={`${id}-${index}`}
                  className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-xs font-mono text-neutral-300"
                >
                  {id.slice(0, 2).toUpperCase()}-{index + 1}
                </div>
              )
            )}
          </div>
          <div className="mt-3 text-xs text-neutral-500">{layout.note}</div>
        </div>
      </LayoutGuard>
    </div>
  );
}

function LayoutGuardLab({ disableAnimations }: { disableAnimations: boolean }) {
  const step = useAtomValue(layoutGuardStepAtom);
  const focusMode = useAtomValue(layoutGuardFocusModeAtom);
  const summary = useAtomValue(layoutGuardSummaryAtom);
  const metrics = useAtomValue(layoutGuardMetricsAtom);
  const setStep = useAtomSet(layoutGuardStepAtom);
  const setFocusMode = useAtomSet(layoutGuardFocusModeAtom);

  const verdictStatements: Record<string, string[]> = {
    BEST: [
      'Pantone mint glow: layout holds its line.',
      'Stability confirmed. Parent size remains composed.',
      'Delta minimal. Motion reads clean and calm.',
    ],
    STABLE: [
      'Layout settled. Parent size holds steady.',
      'Minor oscillations cleared. Stable drift.',
      'Holding. Parent geometry stays consistent.',
    ],
    SHIFT: [
      'Noticeable slide. Parent size reacted to motion.',
      'Reflow detected. Parent responded to content.',
      'Measured shift. Consider guardrails.',
    ],
    JITTER: [
      'Highest jitter. Parent geometry flexed.',
      'Layout thrash warning. Parent reacted strongly.',
      'Unstable resize detected. Guard recommended.',
    ],
  };

  const verdictBadge: Record<
    string,
    'success' | 'info' | 'warning' | 'error' | 'default'
  > = {
    BEST: 'success',
    STABLE: 'info',
    SHIFT: 'warning',
    JITTER: 'error',
  };

  const modes: LayoutGuardMode[] = ['none', 'transform', 'flip'];

  return (
    <Section
      title="Layout Guard Lab"
      subtitle="Compare transform-only vs FLIP vs none (parent stability + layout shifts)."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep((prev) => prev + 1)}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-1 font-mono text-xs text-neutral-200 hover:border-neutral-500"
          >
            Dispatch Transition
            <span className="text-neutral-500">step {step}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFocusMode(mode)}
              className={cn(
                'rounded-md border px-3 py-1 font-mono text-xs uppercase tracking-widest',
                focusMode === mode
                  ? 'border-sky-400 text-sky-200'
                  : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <LayoutGuardCard
          id="guard-none"
          title="No Guard"
          mode="none"
          step={step}
          focusMode={focusMode}
          disableAnimations={disableAnimations}
        />
        <LayoutGuardCard
          id="guard-transform"
          title="Transform Only"
          mode="transform"
          step={step}
          focusMode={focusMode}
          disableAnimations={disableAnimations}
        />
        <LayoutGuardCard
          id="guard-flip"
          title="FLIP"
          mode="flip"
          step={step}
          focusMode={focusMode}
          disableAnimations={disableAnimations}
        />
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-500">
            Guardrail Diagnostics
          </span>
          <span className="text-xs font-mono text-neutral-500">
            leaderboard: {summary.leaderboard.join(' → ') || 'n/a'}
          </span>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {(['guard-none', 'guard-transform', 'guard-flip'] as const).map(
            (id) => {
              const data = summary.byId[id];
              const snapshot = metrics[id];
              const verdict = data?.verdict ?? 'STABLE';
              const statementOptions =
                verdictStatements[verdict] ?? verdictStatements.STABLE;
              const statement =
                statementOptions[step % statementOptions.length];
              const badgeVariant = verdictBadge[verdict] ?? 'default';

              return (
                <div
                  key={id}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 shadow-[0_0_35px_rgba(15,23,42,0.55)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative h-7 w-7 rounded-full border border-neutral-700 bg-neutral-900/70 backdrop-blur">
                        <div className="absolute inset-0 rounded-full bg-emerald-400/10 blur-[6px]" />
                        <svg
                          viewBox="0 0 24 24"
                          className="relative z-10 h-7 w-7 p-1.5 text-emerald-300"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="9.5" opacity="0.25" />
                          <path d="M8.5 12.3l2.3 2.2 4.7-5.1" />
                        </svg>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                          {id.replace('guard-', '')}
                        </div>
                        <div className="text-sm font-mono text-neutral-200">
                          {verdict === 'BEST' ? 'Stable winner' : 'Diagnostics'}
                        </div>
                      </div>
                    </div>
                    <Badge variant={badgeVariant}>{verdict}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <StatusIndicator
                      status={
                        verdict === 'JITTER'
                          ? 'error'
                          : verdict === 'SHIFT'
                          ? 'warning'
                          : 'active'
                      }
                      label="Layout signal"
                    />
                    <span className="text-[11px] font-mono text-neutral-500">
                      shift {data?.shift.toFixed(1) ?? '--'}
                    </span>
                  </div>
                  <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950/80 p-2 text-xs text-neutral-400">
                    <span className="text-emerald-300">{statement}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-[11px] font-mono text-neutral-400">
                    <div>
                      parent: {snapshot?.parent.width.toFixed(1) ?? '--'} ×{' '}
                      {snapshot?.parent.height.toFixed(1) ?? '--'}
                    </div>
                    <div>
                      content: {snapshot?.content.width.toFixed(1) ?? '--'} ×{' '}
                      {snapshot?.content.height.toFixed(1) ?? '--'}
                    </div>
                    <div>
                      updated:{' '}
                      {snapshot?.updatedAt
                        ? new Date(snapshot.updatedAt).toLocaleTimeString()
                        : '--'}
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>
    </Section>
  );
}

// =============================================================================
// Main Testbed
// =============================================================================

export function MorphCardTestbed() {
  const [disableAnimations, setDisableAnimations] = useState(false);

  return (
    <RegistryProvider>
      <div className="min-h-screen bg-black px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="pb-4 border-b border-neutral-800 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-mono text-neutral-300">
                MorphCard Testbed
              </h1>
              <p
                className="text-neutral-500 mt-1"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                SizeKey-driven cards, XState transitions, and tabbed views
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDisableAnimations((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-1 font-mono text-xs text-neutral-300 hover:border-neutral-500"
            >
              Animations
              <span className="text-neutral-500">
                {disableAnimations ? 'OFF' : 'ON'}
              </span>
            </button>
          </div>

          {/* Demo Grid */}
          <div className="grid grid-cols-1 gap-6">
            <BasicMorphCardDemo disableAnimations={disableAnimations} />
            <DynamicIslandCardDemo disableAnimations={disableAnimations} />
            <ChartGridDemo disableAnimations={disableAnimations} />
            <ViewRegistryDemo disableAnimations={disableAnimations} />
            <StateSwitchScenarios disableAnimations={disableAnimations} />
            <TransitionGallery disableAnimations={disableAnimations} />
            <AnimeLayoutLab disableAnimations={disableAnimations} />
            <LayoutGuardLab disableAnimations={disableAnimations} />
          </div>

          {/* Integration Section */}
          <IntegrationDemo />

          {/* Footer */}
          <div
            className="pt-4 border-t border-neutral-800 font-mono text-neutral-700"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            POST /morph-agent/fix · POST /morph-agent/evolve
          </div>
        </div>
      </div>
    </RegistryProvider>
  );
}

export default MorphCardTestbed;
