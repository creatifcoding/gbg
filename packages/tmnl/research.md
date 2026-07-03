# Research: React Native cross-platform stack for TMNL migration

## Summary
Expo + Expo Router is the strongest v1 shell for iOS/Android/Web because it is explicitly built for universal React Native apps with file-based routing across Android, iOS, and web. Windows and macOS are feasible through Microsoft-maintained React Native out-of-tree platforms, but Linux desktop is not first-class in mainstream React Native; treat Linux as a separate spike via React Native Skia renderer / experimental desktop platforms or a RN Web desktop shell, not as equal-risk v1 scope.

For custom TMNL-native UI, use React Native Skia + Gesture Handler + Reanimated as the core interaction/rendering stack, FlashList/LegendList for high-performance lists, Victory Native/Skia for charts, MapLibre first for open geospatial work, and defer AG Grid/tldraw parity into dedicated native primitives rather than WebViews.

## Findings
1. **Expo Router is the right app shell for mobile + web, but not the whole desktop story** — Expo Router is described by Expo as a file-based router for React Native and web apps that supports Android, iOS, and web with shared navigation concepts. Use it as the main shell for iOS/Android/Web and keep platform escape hatches for native modules. [Expo Router introduction](https://docs.expo.dev/router/introduction/)

2. **React Native desktop is officially “out-of-tree”** — React Native’s own docs list Windows, macOS, web, tvOS, visionOS, and Skia as community/partner-maintained out-of-tree platforms rather than core RN targets. This means desktop support is real but carries version-lag, dependency, and native-build risk. [React Native out-of-tree platforms](https://reactnative.dev/docs/out-of-tree-platforms)

3. **Windows is credible for v1 if treated as a platform-specific target** — React Native Windows advertises native Windows apps across PC, Xbox, Surface tablets, 2-in-1s, and dual-screen devices. This maps well to the Zenbook/touch/HMI direction, but Expo does not officially absorb RN Windows as a normal Expo target; expect custom native project work. [React Native Windows](https://microsoft.github.io/react-native-windows/)

4. **macOS is credible but separately versioned** — Microsoft’s `react-native-macos` is a working fork of React Native adding the official macOS implementation. It is viable for native macOS, but it is not the same operational path as Expo iOS/Android/Web. [react-native-macos](https://github.com/microsoft/react-native-macos)

5. **Linux desktop is the highest-risk requested platform** — Mainstream RN docs do not list a mature React Native Linux peer alongside Windows/macOS. The closest credible routes are React Native Skia as an out-of-tree renderer with Linux/macOS support, experimental projects such as GPUI/Fabric-based desktop renderers, or a React Native Web/Electron/Tauri-style shell. Recommendation: do not block the first HMI/touch slice on native Linux parity. [React Native out-of-tree platforms](https://reactnative.dev/docs/out-of-tree-platforms)

6. **Skia is the core replacement for DOM/canvas-heavy TMNL UI** — React Native Skia brings the Skia graphics engine to React Native, requires modern RN/React versions, and has Expo templates. Its Canvas behaves like a normal RN view while using its own renderer, making it the best foundation for reticles, overlays, schematics, map adorners, tldraw-like surfaces, custom charts, and HMI widgets. [React Native Skia installation](https://shopify.github.io/react-native-skia/docs/getting-started/installation), [Skia Canvas](https://shopify.github.io/react-native-skia/docs/canvas/overview/)

7. **Gesture Handler + Reanimated is the correct touch/animation substrate** — Gesture Handler supports recent RN releases and recommends Reanimated for UI-thread gesture interactions. Skia docs also recommend Gesture Handler when integrating gestures with Reanimated. Use this trio for sliders, drawers, drag reticles, canvas manipulation, multi-touch, kinetic pan/zoom, and touch-first HMI controls. [Gesture Handler installation](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation/), [Reanimated getting started](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/), [Skia gestures](https://shopify.github.io/react-native-skia/docs/animations/gestures/)

8. **FlashList is the default high-volume list/grid primitive; LegendList is a serious contender** — FlashList is documented as a fast, performant RN list and Expo lists it for Android, iOS, tvOS, and Web, included in Expo Go. FlashList v2 is rebuilt for the new architecture. LegendList is pure TypeScript, supports RN and Web entrypoints, and is attractive for dynamic-size items and low native dependency risk. Use FlashList first where Expo support matters; evaluate LegendList for dynamic, composable table-like surfaces. [FlashList docs](https://shopify.github.io/flash-list/docs/), [Expo FlashList](https://docs.expo.dev/versions/latest/sdk/flash-list/), [LegendList API](https://www.legendapp.com/open-source/list/v3/api)

9. **AG Grid has no true native equivalent; rebuild as headless data model + virtualized RN surface** — AG Grid’s current tldraw example is explicitly a web custom shape rendering AG Grid inside tldraw. For native, preserve TMNL’s column schemas, selection, sorting, filtering, and commands, but render with FlashList/LegendList plus custom cells, sticky headers, and Skia overlays. TanStack Table can supply headless table logic, but rendering must be RN-native. [tldraw AG Grid shape example](https://tldraw.dev/examples/ag-grid-shape), [TanStack Table](https://tanstack.com/table/latest)

10. **tldraw should become a native canvas/workspace subsystem, not a port** — tldraw is DOM/web-centric in the evidence found; native parity should be decomposed into shape schema, selection model, command stack, persistence, and rendering adapters. Use Skia for drawing, Gesture Handler/Reanimated for interaction, and TMNL Effect/STX atoms for state. This preserves logic without smuggling a WebView into the app. [Skia Canvas](https://shopify.github.io/react-native-skia/docs/canvas/overview/)

11. **MapLibre is the better default map stack for open/offline/vector-tile work** — MapLibre React Native describes itself as interactive vector tile maps with MapLibre Native in Expo and React Native supporting Android and iOS. It is the preferred starting point for TMNL/GEOINT-style open mapping. Risk: desktop/web parity is separate, and v11/new-architecture changes may be sharp. [MapLibre React Native](https://maplibre.org/maplibre-react-native/), [maplibre-react-native GitHub](https://github.com/maplibre/maplibre-react-native)

12. **Mapbox RN is powerful but not official Mapbox product and requires custom native builds** — Mapbox’s own tutorial states `@rnmapbox/maps` is community-maintained and not an official Mapbox product. Its install docs say it cannot be used in Expo Go because it requires custom native code; use custom dev builds/EAS or bare workflow. Use Mapbox only when Mapbox services/styles/licensing are required. [Mapbox React Native tutorial](https://docs.mapbox.com/help/tutorials/getting-started-react-native/), [@rnmapbox/maps install](https://rnmapbox.github.io/docs/install)

13. **Expo GL is available for mobile/web 2D/3D experiments, but not the default UI layer** — Expo GL provides `GLView` as an OpenGL ES render target and GL context for Android, iOS, and Web. Use it for specialized GL/three.js surfaces, shaders, and simulation experiments; prefer Skia/Reanimated for ordinary UI and HMI components. [Expo GLView](https://docs.expo.dev/versions/latest/sdk/gl-view/)

14. **Victory Native is the best researched charting fit** — Victory Native is documented as a React Native charting library focused on performance and customization, powered by D3, Skia, and Reanimated. It aligns with the chosen graphics stack and should be the first charting evaluation target before rolling all chart primitives by hand. [Victory Native](https://commerce.nearform.com/open-source/victory-native/)

## Recommendations
1. **Adopt Expo + Expo Router for the primary app package**: ship iOS, Android, and Web preview from this path.
2. **Create separate platform spikes for Windows/macOS**: do not assume Expo solves them; use RN Windows/macOS native projects as adapters around shared packages.
3. **Put Linux in R&D, not v1 commitment**: evaluate RN Skia renderer / experimental desktop renderer / RN Web shell after the HMI vertical slice works.
4. **Core UI stack**: `@shopify/react-native-skia` + `react-native-gesture-handler` + `react-native-reanimated`.
5. **Lists/data grid**: FlashList first, LegendList second, TanStack Table only for headless table logic.
6. **Maps**: MapLibre first; Mapbox only for proprietary Mapbox requirements.
7. **Charts**: Victory Native first; direct Skia for bespoke HMI instruments.
8. **AG Grid/tldraw migration**: preserve data/shape/command logic; rewrite renderers as native Skia/list surfaces. No WebView.

## Risks
1. **Desktop fragmentation** — iOS/Android/Web, Windows, macOS, and Linux do not share one equally supported RN runtime.
2. **Expo Go limitations** — Mapbox/MapLibre, Skia edge cases, and custom native modules often require custom dev builds.
3. **New Architecture coupling** — FlashList v2, MapLibre v11, and modern Skia/Reanimated stacks increasingly assume new RN architecture; version alignment must be deliberate.
4. **AG Grid feature loss** — enterprise grid features will not appear automatically in native; column virtualization, keyboard navigation, range selection, copy/paste, aggregation, and pinned rows need explicit implementation.
5. **tldraw parity risk** — infinite canvas, shape editing, handles, snapping, multiplayer, export, and text editing are product subsystems, not just render components.
6. **Linux native uncertainty** — credible experiments exist, but evidence does not support treating Linux native RN as equally mature with Windows/macOS.

## Sources
- Kept: Expo Router introduction (https://docs.expo.dev/router/introduction/) — primary source for Expo Router universal routing.
- Kept: React Native out-of-tree platforms (https://reactnative.dev/docs/out-of-tree-platforms) — primary RN framing for non-iOS/Android targets.
- Kept: React Native Windows (https://microsoft.github.io/react-native-windows/) — primary Windows feasibility source.
- Kept: react-native-macos (https://github.com/microsoft/react-native-macos) — primary macOS feasibility source.
- Kept: React Native Skia docs (https://shopify.github.io/react-native-skia/docs/getting-started/installation) — primary Skia install/platform constraints.
- Kept: Skia Canvas docs (https://shopify.github.io/react-native-skia/docs/canvas/overview/) — evidence for Canvas as RN view/rendering layer.
- Kept: Gesture Handler docs (https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation/) — primary gesture compatibility guidance.
- Kept: Reanimated docs (https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/) — primary animation setup.
- Kept: FlashList docs and Expo FlashList docs (https://shopify.github.io/flash-list/docs/, https://docs.expo.dev/versions/latest/sdk/flash-list/) — primary list recommendation evidence.
- Kept: LegendList API (https://www.legendapp.com/open-source/list/v3/api) — pure TS RN/Web list option.
- Kept: MapLibre React Native (https://maplibre.org/maplibre-react-native/) — primary open map recommendation evidence.
- Kept: @rnmapbox/maps install and Mapbox tutorial (https://rnmapbox.github.io/docs/install, https://docs.mapbox.com/help/tutorials/getting-started-react-native/) — evidence for custom native build and community-maintained status.
- Kept: Expo GLView (https://docs.expo.dev/versions/latest/sdk/gl-view/) — primary GL support source.
- Kept: Victory Native (https://commerce.nearform.com/open-source/victory-native/) — charting fit.
- Kept: tldraw AG Grid shape example (https://tldraw.dev/examples/ag-grid-shape) — shows current AG Grid/tldraw integration is web-rendered.
- Dropped: SEO comparison articles and generic blog posts — redundant or less authoritative than official docs/repos.
- Dropped: Small drawing-canvas GitHub projects — interesting for inspiration but too immature to anchor architecture.
- Dropped: Devclass article on RN Windows — useful color, but not necessary versus Microsoft/RN primary docs.

## Gaps
- Need hands-on compatibility matrix for exact RN/Expo SDK version, Effect v4, effect-atom/STX, Skia, Reanimated, MapLibre, and FlashList.
- Need Windows/macOS proof-of-concept to measure how much shared Expo code can realistically run under RN Windows/macOS.
- Need Linux decision spike: RN Skia renderer vs RN Web desktop shell vs experimental GPUI/Fabric renderer.
- Need native data-grid prototype to validate sticky headers, virtualization, selection, keyboard/touch interaction, and large datasets.
