# LotProphet Component / Atom Map

## Current shape

- `App.tsx` is one screen component (`LotProphetMapConsole`) owning atom reads, localStorage hydration/persistence, file export, MapLibre lifecycle, filter toolbar, metrics, candidate list, detail packet, draft form, and footer.
- `atoms.ts` already has useful pure selectors for candidates, filtering, map features, gates, routes, operator actions, activation packet, and exports.
- Side effects currently mixed into the screen: localStorage edit hydration/persist, `saveFile`, MapLibre popup HTML, and live bridge mount.

## Proposed component tree

```tsx
<App>
  <RegistryProvider>
    <LotProphetScreen>
      <ScreenEffects />          // liveBridge mount, edit hydration
      <MapCanvas />              // MapLibre imperative boundary
      <ShellOverlay>
        <TopBar>
          <BrandCard />
          <FilterExportToolbar />
        </TopBar>
        <MetricRail>
          <MetricCard />*
        </MetricRail>
        <WorkspaceGrid>
          <CandidatePanel>
            <PanelHeader />
            <CandidateVirtualTable />
          </CandidatePanel>
          <ActivationPacketPanel>
            <SelectedCandidateHeader />
            <CandidateFieldSet />
            <GatePanel />
            <OperatorActionRail />
            <ServiceRouteStack />
            <PacketGeneratorPanel />
            <OperatorDraftForm />
          </ActivationPacketPanel>
        </WorkspaceGrid>
        <LegendBar />
      </ShellOverlay>
    </LotProphetScreen>
  </RegistryProvider>
</App>
```

## Second-order compound components

- `Panel`: `Panel.Root`, `Panel.Header`, `Panel.Title`, `Panel.Meta`, `Panel.Body`, `Panel.Empty`.
- `Toolbar`: `Toolbar.Root`, `Toolbar.FilterGroup`, `Toolbar.ExportButton`, `Toolbar.StatusPill`.
- `VirtualTable`: `VirtualTable.Root`, `VirtualTable.Header`, `VirtualTable.Body`, `VirtualTable.Row`, `VirtualTable.Cell`.
- `GatePanel`: `GatePanel.Root`, `GatePanel.Heading`, `GatePanel.Finding`, `GatePanel.StatusBadge`.
- `WorkflowRail`: `WorkflowRail.Root`, `WorkflowRail.Heading`, `WorkflowRail.ActionCard`.
- `PacketPreview`: `PacketPreview.Root`, `PacketPreview.SectionGrid`, `PacketPreview.ExportButton`.
- `DraftForm`: `DraftForm.Root`, `DraftForm.StatusSelect`, `DraftForm.Notes`, `DraftForm.Actions`.

## Atom / selector boundaries to add

Keep atoms pure and data-shaped; keep DOM, MapLibre, file download, and localStorage in React effects/adapters.

- `filterOptionsAtom`: static `filters` with active state/counts for toolbar rendering.
- `summaryMetricsAtom`: `[ { label, value } ]` derived from `summaryAtom`.
- `candidateListRowsAtom`: compact row VM `{ id, rank, address, leadType, price, kind, color, selected }` from `filteredCandidatesAtom`, `selectedIdAtom`.
- `candidatePanelCountAtom`: `{ filtered, total }`.
- `selectedCandidateHeaderAtom`: address, kind, lead line, status-row values.
- `selectedCandidateFieldsAtom`: ordered `{ label, value }[]` for `CandidateFieldSet`.
- `selectedGatePanelAtom`: findings plus packet-ready label/state.
- `selectedWorkflowAtom`: operator actions plus staged count.
- `selectedServiceRoutesPanelAtom`: routes plus primary/hold headline.
- `selectedPacketPanelAtom`: activation packet plus first four sections.
- `selectedDraftDirtyAtom`: compare current draft to selected candidate.
- `selectedDraftCandidateIdAtom` or keyed draft state: prevents stale draft flashes when selection changes.
- `exportBundleAtom`: optional wrapper for GeoJSON + CSV filenames/content/mime.
- `selectedMapPopupAtom`: data-only popup model `{ coordinates, title, subtitle, meta }`; no raw HTML in selector.

Existing selectors to preserve: `candidatesAtom`, `filteredCandidatesAtom`, `selectedCandidateAtom`, `mapFeatureCollectionAtom`, gate/route/action/packet selectors, `allCandidatesGeoJsonAtom`, `callSheetCsvAtom`.

## Virtual table boundaries

- `CandidateTableContainer` reads atoms and passes plain props to `CandidateVirtualTable`.
- `CandidateVirtualTable` is presentation-only: rows, columns, selected id, `onSelect`, `rowHeight`, `overscan`, optional tooltip renderer.
- Row renderer should not read atoms per row; consume a single row VM array to avoid N subscriptions and recycled-row bugs.
- Selection remains `selectedIdAtom`; filter remains `filterAtom`; virtualization viewport state stays local unless needed for deep links.
- Tooltips/popovers for virtualized rows must portal outside the scroller and be keyed by stable candidate id, not recycled row index.
- Map feature collection should remain based on `filteredCandidatesAtom`, not only visible virtual rows.

## Tooltip component contract

```ts
type TooltipProps = {
  id?: string;
  content: React.ReactNode;
  children: React.ReactElement; // trigger
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  offset?: number;
  delayMs?: number;
  disabled?: boolean;
  interactive?: boolean;
};
```

Rules: no atom reads inside tooltip, portal rendering, collision handling, `aria-describedby` for non-interactive tips, close on row unmount/selection change, and data-only map popup content instead of `setHTML` strings.

## Implementation phases

1. Extract layout/presentation components from `App.tsx` with no atom or behavior changes.
2. Add view-model selector atoms; replace inline mapping/formatting in JSX.
3. Move side effects into boundaries: `ScreenEffects`, `useCandidateEditPersistence`, `useFileExport`, `MapCanvas`.
4. Replace candidate button list with `CandidateTableContainer` + `CandidateVirtualTable`.
5. Split selected-detail area into compound panels and wire draft dirty/persist selectors.
6. Add tooltip component and use it in table rows, gates/actions, and map popup model as needed.
7. Remove unused monolith helpers and keep `App.tsx` as a thin composition root.
