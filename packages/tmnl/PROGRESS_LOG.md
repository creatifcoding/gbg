# TMNL MorphCard Progress Log

Format: YYYY-MM-DD | area | status | note

2026-01-20 | morph-card dynamic-island | in-progress | Engine spine in place (card-state service, XState machine, island bridge, reticle overlay). UI still bound to legacy CardMode sizing; sizeKey not yet drives layout; transitionStrategy/shift-drag not wired; catalog/testbed still legacy.
2026-01-21 | morph-card dynamic-island | in-progress | Wired MorphCard layout to sizeKey with stateMachineConfig size map and machine transition; transitionStrategy now required and default strategy exported; DynamicIslandCard drives transitions via strategy when no override; catalog/testbed updated to new props for validation.
2026-01-21 | morph-card dynamic-island | in-progress | Implemented shift-drag handling with bounds clamping; MorphCard now applies x/y translation from card-state position and initializes basePosition+sizeKey before actor creation; drag events sent to island machine and sync into card state.
2026-01-21 | morph-card prompts | in-progress | Updated MorphCard catalog description to sizeKey/stateMachineConfig sizing; updated JSONRender testbed MorphCard prompt to include initialSizeKey + size map for server-side generation alignment.
2026-01-21 | ui-generate | in-progress | Hardened unified prompt rules against code fences and added server-side JSONL sanitizer to strip ``` fences in /ui-generate streaming output.
2026-01-21 | dynamic-island tabs | in-progress | Fixed tab reactivity by switching DynamicIslandCard and TabBar from registry.get to useAtomValue for tabs/state atoms so activeTab updates rerender views and indicators.
2026-01-21 | morph-card testbed | in-progress | Overhauled MorphCard testbed with live state diagnostics, sizeKey controls, shift-drag cue, and tabbed island diagnostics; upgraded typography to 12px floor via CSS vars.
2026-01-21 | morph-card interactions | in-progress | Added shift+double-click reset to return card to base position via RESET_POSITION event.
2026-01-21 | morph-card overflow | in-progress | Clipped card containers to prevent radius overhang, moved scrolling to explicit inner wrapper, and added scrollable prop passthrough (MorphCard + DynamicIslandCard + catalog/testbed).
2026-01-21 | morph-card testbed | in-progress | Enabled dynamicSize on DynamicIslandCard demo to allow content-driven height instead of clipping on overview tab.
2026-01-21 | morph-card dynamic-size | in-progress | Added DynamicIslandCard passthrough for dynamicSize/min/max sizing props and removed scrollable on testbed to allow content-driven expansion.
2026-01-21 | morph-card testbed | in-progress | Removed extra preview borders and softened card borderIntensity in testbed to eliminate double-border artifacts.
2026-01-21 | morph-card dynamic-size | in-progress | Removed fixed width during dynamicSize, added ResizeObserver to measure actual card size and drive reticle overlay, reducing stale size border artifacts.
2026-01-21 | morph-card atoms | in-progress | Swapped measured size + drag state to atom-backed streams with debounced get.stream, added Atom.fn ops for updates, and preserved drag transient fields during island snapshot sync.
2026-01-21 | morph-card testbed | in-progress | Added state switch scenarios section with explicit transitions, reticle overrides, complexity toggles, and diagnostics.
2026-01-21 | morph-card size-views | in-progress | Added SizeView strategy + SizeView component for sizeKey-scoped views with Effect resolver, schema entry, and motion-friendly content keying.
2026-01-21 | morph-card size-views | in-progress | Added sizeViewProvider registry (typed map of sizeKey -> view render function) alongside sizeViews and Effect strategy.
2026-01-21 | morph-card views | in-progress | Renamed sizeViewProvider -> views with typed SizeViewRegistry and SizeKeysFromConfig helper for sizeKey-safe mappings.
2026-01-21 | morph-card views | in-progress | views prop now accepts typed registry entries (ReactNode or render fn), and fixed SizeView element TDZ by renaming local variable.
2026-01-21 | morph-card testbed | in-progress | Added Transition Gallery section with 10 grammar buttons and diagnostics for layout/tab animation tuning.
2026-01-21 | morph-card testbed | in-progress | Transition Gallery buttons now drive both sizeKey and tab transitions, and machine parses grammar strings defensively.
2026-01-21 | morph-card testbed | in-progress | Transition Gallery now uses a grammar ref to avoid stale strategy, replaces unsupported verbs, and centers the tab demo.
2026-01-21 | morph-card testbed | in-progress | Transition Gallery grammars now type-safe (objects/builders), dynamic direction based on size, and notes added for meaningful examples.
2026-01-21 | morph-card testbed | in-progress | Transition Gallery now uses type-safe grammar builders with delta-based auto option and complexity heuristic fallback.
2026-01-21 | morph-card transitions | in-progress | Added size-delta heuristic to defaultTransitionStrategy with optional size map and wired DynamicIslandCard to pass sizes.
2026-01-21 | morph-card views | in-progress | Implemented runtime schema validation for views registry (data-only), enforced key/id match, and added content rendering via UITree.
2026-01-21 | morph-card views | in-progress | Swapped throw-based view registry validation for Effect-based validation with structured failures and effect logging.
2026-01-21 | morph-card testbed | in-progress | Added View Registry demo section with typed views map, IIoT views, and diagnostics panel.
2026-01-21 | morph-card views | in-progress | Fixed Effect validation yield issue by switching from Effect.fromEither to Either check + Effect.fail in views registry validation.
2026-01-21 | morph-card testbed | in-progress | Migrated State Switch Scenarios to views registry only (DynamicIslandCard with views map + tab sync).
2026-01-21 | morph-card testbed | in-progress | Added TMNL.DataGrid to expanded state-switch view and GeoInt panel view for ultra sizeKey in registry.
2026-01-21 | morph-card views | in-progress | Added per-view dynamic sizing overrides (dynamicSize + min/max) with active-view resolution in DynamicIslandCard and example in GeoInt view.
2026-01-21 | morph-card views | in-progress | Routed DynamicIslandCard to view registry atom (seeded from views prop), made tabs derive from registry, and added context CRUD methods with optional gating.
2026-01-21 | morph-card views | in-progress | Updated DynamicIslandCard.View to register into the registry (render-based) so registry is the sole source of truth.
2026-01-21 | morph-card dynamic-size | in-progress | Dynamic sizing now ignores size preset defaults (no implicit min/max); content dimensions override presets unless explicit constraints provided.
2026-01-21 | morph-card dynamic-size | in-progress | Made dynamic-size cards shrink-to-fit (inline-block, fit-content) and removed internal h-full/overflow constraints to allow growth in both directions.
2026-01-21 | morph-card testbed | in-progress | Enabled dynamicSize on View Registry + State Switch Scenarios DynamicIslandCard demos so content can grow beyond size presets.
2026-01-21 | morph-card dynamic-size | in-progress | Rolled back fit-content/overflow tweaks and restored original dynamicSize min/max defaults and content sizing (demo fixed via dynamicSize prop).
2026-01-21 | morph-card transitions | in-progress | Removed contentKey override and ensured DynamicIslandCard always runs transitions on tab change, even without explicit view overrides.
2026-01-21 | morph-card transitions | in-progress | Default tab transitions now use morph:smooth unless a view provides an explicit grammar, ensuring smooth animations on tab changes.
2026-01-21 | morph-card views | in-progress | Added view layout intent (fitContent + min/max) and view-keyed AnimatePresence in DynamicIslandCard so tab changes animate without sizeKey changes.
