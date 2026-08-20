/**
 * SpecimenRail — full Workbench page. List() on mount, query + status filter, Intake.
 * Layout is the Variant Workbench HTML, not a mashed two-column shell.
 *
 * @module @tmnl/specimendb/ui
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useFocus, useStx } from '@tmnl/stx';
import { statusOf } from '../schemas/specimen.js';
import type { Specimen } from '../schemas/specimen.js';
import type { SpecimenStatus } from '../schemas/components.js';
import { at, localityLabel, visibleSpecimens, type CatalogState, type CatalogSurface } from './catalog-stx.js';
import { AccessionQuery, StatusFilters } from './catalog-controls.js';
import { claimLine, tagSlots } from './catalog-view.js';
import { useIntakeBind, type IntakeBind } from './intake-bind.js';
import { ViewportMark } from './marks.js';
import './catalog.css';

type SpecimenRailContextValue = {
  readonly catalog: CatalogSurface;
  readonly bind: IntakeBind;
};

const SpecimenRailContext = createContext<SpecimenRailContextValue | null>(null);

const useRail = (): SpecimenRailContextValue => {
  const ctx = useContext(SpecimenRailContext);
  if (ctx === null) {
    throw new Error('SpecimenRail compound components must be used within SpecimenRail');
  }
  return ctx;
};

const CLASSIFICATION_ROWS = ['Phylum', 'Class', 'Order', 'Family'] as const;
const METRIC_ROWS = ['Tensile_Str', 'Density', 'Modulus'] as const;

const StatusMark = ({
  status,
  testId,
}: {
  readonly status: SpecimenStatus;
  readonly testId?: string;
}) => (
  <span className="sdb-status-dot" data-status={status} data-testid={testId}>
    <span className="sdb-status-sq" aria-hidden="true" />
    {status}
  </span>
);

export type SpecimenRailProps = {
  readonly catalog: CatalogSurface;
  readonly children?: ReactNode;
};

function SpecimenRailRoot({ catalog, children }: SpecimenRailProps) {
  const bind = useIntakeBind(catalog);

  useEffect(() => {
    void catalog.list();
  }, [catalog]);

  return (
    <SpecimenRailContext.Provider value={{ catalog, bind }}>
      <div className="sdb-workbench" data-testid="specimen-rail">
        <input
          ref={bind.inputRef}
          className="sdb-file-input"
          data-testid="intake-file"
          type="file"
          accept="image/jpeg,image/heic,image/heif,.jpg,.jpeg,.heic,.heif"
          multiple
          onChange={bind.onChange}
        />
        {children ?? (
          <>
            <SpecimenRailStrip />
            <aside className="sdb-w-rail">
              <SpecimenRailHeader />
              <SpecimenRailQuery />
              <SpecimenRailFilters />
              <SpecimenRailList />
            </aside>
            <main className="sdb-w-main">
              <div className="sdb-w-zone-wrap">
                <SpecimenRailIntake />
              </div>
              <div className="sdb-w-body">
                <SpecimenRailDetail />
                <SpecimenRailProperties />
              </div>
            </main>
          </>
        )}
      </div>
    </SpecimenRailContext.Provider>
  );
}

function SpecimenRailStrip() {
  const { bind } = useRail();
  return (
    <aside className="sdb-w-strip">
      <span className="sdb-w-icon" data-active="true">
        <i className="ph ph-cube" />
      </span>
      <button type="button" className="sdb-w-icon" onClick={bind.open} aria-label="intake">
        <i className="ph ph-plus" />
      </button>
      <span className="sdb-w-icon">
        <i className="ph ph-squares-four" />
      </span>
      <span className="sdb-w-icon-spacer" />
      <span className="sdb-w-icon">
        <i className="ph ph-sliders" />
      </span>
    </aside>
  );
}

function SpecimenRailQuery() {
  const { catalog } = useRail();
  return <AccessionQuery catalog={catalog} />;
}

function SpecimenRailFilters() {
  const { catalog } = useRail();
  return <StatusFilters catalog={catalog} />;
}

function SpecimenRailHeader() {
  const { catalog } = useRail();
  const online = useFocus(catalog.store, at<CatalogState['online']>(catalog.store.lens.online));
  return (
    <header className="sdb-w-rail-header">
      <h1>SpecimenDB // Core</h1>
      <span className="sdb-w-icon" data-testid="rail-online" data-online={online ? 'true' : 'false'}>
        <i className="ph ph-sliders" />
        <span hidden>{online ? 'ONLINE' : 'OFFLINE'}</span>
      </span>
    </header>
  );
}

function SpecimenRailIntake() {
  const { catalog, bind } = useRail();
  const intakeStatus = useFocus(
    catalog.store,
    at<CatalogState['intakeStatus']>(catalog.store.lens.intakeStatus),
  );
  const intakeError = useFocus(
    catalog.store,
    at<CatalogState['intakeError']>(catalog.store.lens.intakeError),
  );

  return (
    <>
      <button
        type="button"
        className="sdb-w-zone"
        data-testid="intake-zone"
        data-active={bind.active ? 'true' : 'false'}
        data-status={intakeStatus}
        onClick={bind.open}
        onDragEnter={bind.onDragEnter}
        onDragOver={bind.onDragOver}
        onDragLeave={bind.onDragLeave}
        onDrop={bind.onDrop}
      >
        <span className="sdb-w-corner sdb-w-corner-tl" />
        <span className="sdb-w-corner sdb-w-corner-tr" />
        <span className="sdb-w-corner sdb-w-corner-bl" />
        <span className="sdb-w-corner sdb-w-corner-br" />
        <i className="ph ph-upload-simple sdb-t-upload" />
        <span className="sdb-w-zone-copy">
          {intakeStatus === 'dropping'
            ? 'INTAKE_IN_FLIGHT'
            : 'Initiate Intake Sequence // Drop Telemetry Data'}
        </span>
      </button>
      {intakeError !== null ? (
        <p className="sdb-error" data-testid="intake-error">
          {intakeError}
        </p>
      ) : null}
    </>
  );
}

function SpecimenRailList() {
  const { catalog } = useRail();
  const { value } = useStx(catalog.store);
  const rows = visibleSpecimens(value);

  return (
    <div className="sdb-w-list" data-testid="rail-list">
      {rows.length === 0 ? (
        <WorkbenchCardChrome />
      ) : (
        rows.map((specimen) => <SpecimenRailCard key={specimen.id} specimen={specimen} />)
      )}
    </div>
  );
}

function WorkbenchWell() {
  return (
    <div className="sdb-w-well">
      <i className="ph ph-aperture sdb-w-shutter" />
      <span className="sdb-w-well-cap" />
    </div>
  );
}

function WorkbenchCardChrome() {
  return (
    <article className="sdb-w-card" data-empty="true" data-testid="card-chrome">
      <div className="sdb-w-idrow">
        <span className="sdb-w-id" />
        <span className="sdb-status-dot" data-status="raw">
          <span className="sdb-status-sq" aria-hidden="true" />
          raw
        </span>
      </div>
      <WorkbenchWell />
      <div className="sdb-w-card-body">
        <p className="sdb-w-claim" data-testid="claim" />
        <div className="sdb-w-locality">
          <i className="ph ph-map-pin" />
          <span data-testid="locality">unknown</span>
        </div>
        <div className="sdb-w-tags">
          {tagSlots().map((_, index) => (
            <span className="sdb-w-tag" key={`empty-tag-${index}`}>
              []
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function SpecimenRailCard({ specimen }: { readonly specimen: Specimen }) {
  const { catalog } = useRail();
  const selectedId = useFocus(
    catalog.store,
    at<CatalogState['selectedId']>(catalog.store.lens.selectedId),
  );
  const status = (statusOf(specimen) ?? 'raw') satisfies SpecimenStatus;

  return (
    <button
      type="button"
      className="sdb-w-card"
      data-testid="specimen-card"
      data-selected={selectedId === specimen.id ? 'true' : 'false'}
      onClick={() => void catalog.select(specimen.id)}
    >
      <div className="sdb-w-idrow">
        <span className="sdb-w-id" data-testid="specimen-id">
          {specimen.id}
        </span>
        <StatusMark status={status} testId="status-pill" />
      </div>
      <WorkbenchWell />
      <div className="sdb-w-card-body">
        <p className="sdb-w-claim" data-testid="claim">
          {claimLine(specimen)}
        </p>
        <div className="sdb-w-locality">
          <i className="ph ph-map-pin" />
          <span data-testid="locality">{localityLabel(specimen)}</span>
        </div>
        <div className="sdb-w-tags">
          {tagSlots(specimen).map((tag, index) => (
            <span className="sdb-w-tag" key={`${specimen.id}:tag:${index}`}>
              [{tag}]
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function SpecimenRailDetail() {
  const { catalog } = useRail();
  const selected = useFocus(
    catalog.store,
    at<CatalogState['selected']>(catalog.store.lens.selected),
  );
  const status = selected === null ? undefined : (statusOf(selected) ?? 'raw');
  const body = selected === null ? '' : claimLine(selected);

  return (
    <section className="sdb-w-detail" data-testid="specimen-detail">
      <div className="sdb-w-detail-head">
        <div>
          <h1 className="sdb-w-detail-id" data-testid="detail-id">
            {selected?.id ?? ''}
          </h1>
          <p className="sdb-w-detail-claim" data-testid="detail-claim">
            {body}
          </p>
          {selected !== null ? (
            <p className="sdb-w-locality">
              <i className="ph ph-map-pin" />
              <span data-testid="detail-locality">{localityLabel(selected)}</span>
            </p>
          ) : null}
          {status !== undefined ? <StatusMark status={status} testId="detail-status" /> : null}
        </div>
        <div className="sdb-w-actions">
          <button type="button">EXPORT DB</button>
          <button type="button">RUN SIM</button>
        </div>
      </div>
      <div className="sdb-w-viewport">
        <span className="sdb-w-corner sdb-w-corner-tl" />
        <span className="sdb-w-corner sdb-w-corner-tr" />
        <span className="sdb-w-corner sdb-w-corner-bl" />
        <span className="sdb-w-corner sdb-w-corner-br" />
        <div className="sdb-w-viewport-head">
          <span>VIEWPORT_XZ</span>
          <span>MAG</span>
        </div>
        <div className="sdb-w-viewport-stage">
          <ViewportMark />
        </div>
        <div className="sdb-w-viewport-foot">
          <span className="sdb-w-active">ACTIVE_RENDER</span>
          <span />
        </div>
      </div>
    </section>
  );
}

function SpecimenRailProperties() {
  return (
    <aside className="sdb-w-props" data-testid="properties-log">
      <header className="sdb-w-props-header">PROPERTIES LOG</header>
      <section className="sdb-w-prop">
        <div className="sdb-w-prop-head">
          <span>CLASSIFICATION</span>
          <i className="ph ph-dna" />
        </div>
        <dl>
          {CLASSIFICATION_ROWS.map((row) => (
            <div className="sdb-w-row" key={row}>
              <dt>{row}</dt>
              <dd />
            </div>
          ))}
        </dl>
      </section>
      <section className="sdb-w-prop">
        <div className="sdb-w-prop-head">
          <span>STRUCTURAL METRICS</span>
          <i className="ph ph-hexagon" />
        </div>
        <dl>
          {METRIC_ROWS.map((row) => (
            <div className="sdb-w-row" key={row}>
              <dt>{row}</dt>
              <dd />
            </div>
          ))}
          <div className="sdb-w-row">
            <dt>Elev</dt>
            <dd />
          </div>
          <div className="sdb-w-row">
            <dt>Temp</dt>
            <dd />
          </div>
        </dl>
      </section>
      <section className="sdb-w-prop">
        <div className="sdb-w-prop-head">
          <span>OBSERVATION LOG</span>
          <i className="ph ph-terminal-window" />
        </div>
        <p className="sdb-w-obs" />
      </section>
      <div className="sdb-w-updated">LAST_UPDATED</div>
    </aside>
  );
}

export const SpecimenRail = Object.assign(SpecimenRailRoot, {
  Header: SpecimenRailHeader,
  Strip: SpecimenRailStrip,
  Query: SpecimenRailQuery,
  Filters: SpecimenRailFilters,
  Intake: SpecimenRailIntake,
  List: SpecimenRailList,
  Card: SpecimenRailCard,
  Detail: SpecimenRailDetail,
  Properties: SpecimenRailProperties,
});
