/**
 * WorkingPanel — full Assay page. 440px rail, dashed h-28 intake,
 * CURRENT_FOCUS_RECORD, viewport + 4 channels, instrument / env / log.
 *
 * @module @tmnl/specimendb/ui
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useFocus, useStx } from '@tmnl/stx';
import { statusOf } from '../schemas/specimen.js';
import type { Specimen } from '../schemas/specimen.js';
import type { SpecimenStatus } from '../schemas/components.js';
import { at, localityLabel, visibleSpecimens, type CatalogState, type CatalogSurface } from './catalog-stx.js';
import { claimLine } from './catalog-view.js';
import { useIntakeBind, type IntakeBind } from './intake-bind.js';
import './assay.css';

type AssayContextValue = {
  readonly catalog: CatalogSurface;
  readonly bind: IntakeBind;
};

const AssayContext = createContext<AssayContextValue | null>(null);

const useAssay = (): AssayContextValue => {
  const ctx = useContext(AssayContext);
  if (ctx === null) {
    throw new Error('WorkingPanel compound components must be used within WorkingPanel');
  }
  return ctx;
};

const CHANNELS = ['CH-01', 'CH-02', 'CH-03', 'CH-04'] as const;
const INSTRUMENT_ROWS = ['GAIN', 'OFFSET', 'WINDOW'] as const;
const ENV_ROWS = ['SALINITY', 'PRESSURE', 'CURRENT'] as const;

const StatusChip = ({
  status,
  testId,
}: {
  readonly status: SpecimenStatus;
  readonly testId?: string;
}) => (
  <span className="sdb-a-chip" data-status={status} data-testid={testId}>
    {status}
  </span>
);

export type WorkingPanelProps = {
  readonly catalog: CatalogSurface;
  readonly children?: ReactNode;
};

function WorkingPanelRoot({ catalog, children }: WorkingPanelProps) {
  const bind = useIntakeBind(catalog);

  useEffect(() => {
    void catalog.list();
  }, [catalog]);

  return (
    <AssayContext.Provider value={{ catalog, bind }}>
      <div className="sdb-assay" data-testid="working-panel">
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
            <aside className="sdb-a-rail">
              <header className="sdb-a-rail-head">WORKING SET</header>
              <WorkingPanelList />
            </aside>
            <main className="sdb-a-main">
              <WorkingPanelIntake />
              <WorkingPanelFocus />
              <div className="sdb-a-stage">
                <WorkingPanelViewport />
                <WorkingPanelChannels />
              </div>
              <div className="sdb-a-panels">
                <WorkingPanelInstrument />
                <WorkingPanelEnv />
                <WorkingPanelLog />
              </div>
            </main>
          </>
        )}
      </div>
    </AssayContext.Provider>
  );
}

function WorkingPanelIntake() {
  const { catalog, bind } = useAssay();
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
        className="sdb-a-zone"
        data-testid="intake-zone"
        data-active={bind.active ? 'true' : 'false'}
        data-status={intakeStatus}
        onClick={bind.open}
        onDragEnter={bind.onDragEnter}
        onDragOver={bind.onDragOver}
        onDragLeave={bind.onDragLeave}
        onDrop={bind.onDrop}
      >
        <span className="sdb-a-zone-copy">
          {intakeStatus === 'dropping' ? 'INTAKE_IN_FLIGHT' : 'INITIATE_INTAKE_PROTOCOL'}
        </span>
      </button>
      {intakeError !== null ? (
        <p className="sdb-a-error" data-testid="intake-error">
          {intakeError}
        </p>
      ) : null}
    </>
  );
}

function AssayCardChrome() {
  return (
    <article className="sdb-a-card" data-empty="true" data-testid="card-chrome">
      <div className="sdb-a-idrow">
        <span className="sdb-a-id" />
        <span className="sdb-a-chip" data-status="raw">
          raw
        </span>
      </div>
      <p className="sdb-a-claim" data-testid="claim" />
      <span className="sdb-a-locality" data-testid="locality">
        unknown
      </span>
    </article>
  );
}

function WorkingPanelList() {
  const { catalog } = useAssay();
  const { value } = useStx(catalog.store);
  const rows = visibleSpecimens(value);

  return (
    <div className="sdb-a-list" data-testid="rail-list">
      {rows.length === 0 ? (
        <AssayCardChrome />
      ) : (
        rows.map((specimen) => <WorkingPanelCard key={specimen.id} specimen={specimen} />)
      )}
    </div>
  );
}

function WorkingPanelCard({ specimen }: { readonly specimen: Specimen }) {
  const { catalog } = useAssay();
  const selectedId = useFocus(
    catalog.store,
    at<CatalogState['selectedId']>(catalog.store.lens.selectedId),
  );
  const status = (statusOf(specimen) ?? 'raw') satisfies SpecimenStatus;

  return (
    <button
      type="button"
      className="sdb-a-card"
      data-testid="specimen-card"
      data-selected={selectedId === specimen.id ? 'true' : 'false'}
      onClick={() => void catalog.select(specimen.id)}
    >
      <div className="sdb-a-idrow">
        <span className="sdb-a-id" data-testid="specimen-id">
          {specimen.id}
        </span>
        <StatusChip status={status} testId="status-pill" />
      </div>
      <p className="sdb-a-claim" data-testid="claim">
        {claimLine(specimen)}
      </p>
      <span className="sdb-a-locality" data-testid="locality">
        {localityLabel(specimen)}
      </span>
    </button>
  );
}

function WorkingPanelFocus() {
  const { catalog } = useAssay();
  const selected = useFocus(
    catalog.store,
    at<CatalogState['selected']>(catalog.store.lens.selected),
  );
  const status = selected === null ? undefined : (statusOf(selected) ?? 'raw');

  return (
    <header className="sdb-a-focus" data-testid="specimen-detail">
      <div>
        <div className="sdb-a-kicker">CURRENT_FOCUS_RECORD</div>
        <h1 className="sdb-a-focus-id" data-testid="detail-id">
          {selected?.id ?? ''}
        </h1>
        <p className="sdb-a-claim" data-testid="detail-claim">
          {selected === null ? '' : claimLine(selected)}
        </p>
        {selected !== null ? (
          <p className="sdb-a-locality" data-testid="detail-locality">
            {localityLabel(selected)}
          </p>
        ) : null}
      </div>
      {status !== undefined ? <StatusChip status={status} testId="detail-status" /> : null}
    </header>
  );
}

function WorkingPanelViewport() {
  return (
    <section className="sdb-a-viewport">
      <div className="sdb-a-kicker">VIEWPORT</div>
      <div className="sdb-a-viewport-stage" />
    </section>
  );
}

function WorkingPanelChannels() {
  return (
    <section className="sdb-a-channels">
      {CHANNELS.map((channel) => (
        <div className="sdb-a-channel" key={channel}>
          <div className="sdb-a-kicker">{channel}</div>
          <div className="sdb-a-channel-well" />
        </div>
      ))}
    </section>
  );
}

function WorkingPanelInstrument() {
  return (
    <section className="sdb-a-panel">
      <div className="sdb-a-kicker">INSTRUMENT</div>
      {INSTRUMENT_ROWS.map((row) => (
        <div className="sdb-a-row" key={row}>
          <span>{row}</span>
          <span />
        </div>
      ))}
    </section>
  );
}

function WorkingPanelEnv() {
  return (
    <section className="sdb-a-panel">
      <div className="sdb-a-kicker">ENVIRONMENT</div>
      {ENV_ROWS.map((row) => (
        <div className="sdb-a-row" key={row}>
          <span>{row}</span>
          <span />
        </div>
      ))}
    </section>
  );
}

function WorkingPanelLog() {
  const { catalog } = useAssay();
  const intakeError = useFocus(
    catalog.store,
    at<CatalogState['intakeError']>(catalog.store.lens.intakeError),
  );
  return (
    <section className="sdb-a-panel sdb-a-log" data-testid="assay-log">
      <div className="sdb-a-kicker">LOG</div>
      <div className="sdb-a-log-body">{intakeError !== null ? <p>{intakeError}</p> : null}</div>
    </section>
  );
}

export const WorkingPanel = Object.assign(WorkingPanelRoot, {
  Intake: WorkingPanelIntake,
  List: WorkingPanelList,
  Card: WorkingPanelCard,
  Focus: WorkingPanelFocus,
  Viewport: WorkingPanelViewport,
  Channels: WorkingPanelChannels,
  Instrument: WorkingPanelInstrument,
  Env: WorkingPanelEnv,
  Log: WorkingPanelLog,
});
