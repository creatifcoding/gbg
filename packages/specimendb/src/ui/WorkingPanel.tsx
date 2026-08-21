/**
 * WorkingPanel — full Assay page. Lift of 9b39d6bc HTML:
 * 440px rail, dashed [ INITIATE_INTAKE_PROTOCOL ], CURRENT_FOCUS_RECORD,
 * VIEWPORT_01 + channel wells, INSTRUMENT_READOUT / ENV_CONTEXT / OBSERVATION_LOG.
 *
 * @module @tmnl/specimendb/ui
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useFocus, useStx } from '@tmnl/stx';
import { statusOf } from '../schemas/specimen.js';
import type { Specimen } from '../schemas/specimen.js';
import type { SpecimenStatus } from '../schemas/components.js';
import { at, localityLabel, onStatusPromote, visibleSpecimens, type CatalogState, type CatalogSurface } from './catalog-stx.js';
import { claimLine, tagSlots } from './catalog-view.js';
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

const CHANNELS = ['CH_01_VIS', 'CH_02_UV', 'CH_03_SEM'] as const;
const INSTRUMENT_ROWS = [
  'TENSILE_YIELD',
  'FRACTURE_TOUGHNESS',
  'WATER_CONTENT',
  'CHITIN_DENSITY',
  'SPECTRAL_ALBEDO',
] as const;
const ENV_ROWS = ['TEMP_COLLECT', 'HUMIDITY'] as const;

const StatusChip = ({
  status,
  testId,
  inline,
  onPromote,
}: {
  readonly status: SpecimenStatus;
  readonly testId?: string;
  readonly inline?: boolean;
  readonly onPromote?: (event: { readonly stopPropagation: () => void; readonly preventDefault: () => void }) => void;
}) => (
  <span
    className="sdb-a-chip"
    data-status={status}
    data-inline={inline ? 'true' : undefined}
    data-testid={testId}
    {...(onPromote !== undefined ? { 'data-promote': 'true', onClick: onPromote } : {})}
  >
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
              <header className="sdb-a-rail-head">
                <div className="sdb-a-rail-brand">
                  <i className="ph-fill ph-hexagon" />
                  <span>[ SPECIMEN_DB v3.1.0 ]</span>
                </div>
                <div>
                  <button type="button" className="sdb-a-iconbtn" aria-label="filters">
                    <i className="ph ph-faders" />
                  </button>
                  <button type="button" className="sdb-a-iconbtn" aria-label="sort">
                    <i className="ph ph-sort-descending" />
                  </button>
                </div>
              </header>
              <WorkingPanelList />
            </aside>
            <main className="sdb-a-main">
              <div className="sdb-a-stage-grid" />
              <WorkingPanelIntake />
              <section className="sdb-a-work sdb-a-scroll">
                <WorkingPanelFocus />
                <div className="sdb-a-grid">
                  <div className="sdb-a-stage-col">
                    <WorkingPanelViewport />
                    <WorkingPanelChannels />
                  </div>
                  <div className="sdb-a-side">
                    <WorkingPanelInstrument />
                    <WorkingPanelEnv />
                    <WorkingPanelLog />
                  </div>
                </div>
              </section>
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
        <span className="sdb-a-zone-mark">
          <i className="ph ph-download-simple" />
        </span>
        <span className="sdb-a-zone-copy">
          <span className="sdb-a-zone-title">
            {intakeStatus === 'dropping' ? 'INTAKE_IN_FLIGHT' : '[ INITIATE_INTAKE_PROTOCOL ]'}
          </span>
          <span className="sdb-a-zone-sub">DRAG FIELD ASSETS OR RAW DATA PACKETS HERE</span>
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
      <div className="sdb-a-well">
        <span className="sdb-a-well-mark">
          <i className="ph ph-aperture" />
        </span>
        <span className="sdb-a-well-grid" />
        <span className="sdb-a-chip" data-status="raw">
          raw
        </span>
        <span className="sdb-a-idcap" />
      </div>
      <p className="sdb-a-claim" data-testid="claim" />
      <div className="sdb-a-tags">
        {tagSlots().map((_, index) => (
          <span className="sdb-a-tag" key={`empty-tag-${index}`} />
        ))}
      </div>
      <span className="sdb-a-locality" data-testid="locality">
        <i className="ph ph-navigation-arrow" />
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
    <div className="sdb-a-list sdb-a-scroll" data-testid="rail-list">
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
  const previews = useFocus(
    catalog.store,
    at<CatalogState['previews']>(catalog.store.lens.previews),
  );
  const status = (statusOf(specimen) ?? 'raw') satisfies SpecimenStatus;
  const preview = previews[specimen.id];

  return (
    <button
      type="button"
      className="sdb-a-card"
      data-testid="specimen-card"
      data-status={status}
      data-selected={selectedId === specimen.id ? 'true' : 'false'}
      onClick={() => void catalog.select(specimen.id)}
    >
      <div className="sdb-a-well">
        <span className="sdb-a-well-mark">
          <i className="ph ph-aperture" />
        </span>
        <span className="sdb-a-well-grid" />
        {preview !== undefined ? <img src={preview} alt="" /> : null}
        <StatusChip status={status} testId="status-pill" onPromote={onStatusPromote(catalog, specimen.id)} />
        <span className="sdb-a-idcap" data-testid="specimen-id">
          {specimen.id}
        </span>
      </div>
      <p className="sdb-a-claim" data-testid="claim">
        {claimLine(specimen)}
      </p>
      <div className="sdb-a-tags">
        {tagSlots(specimen).map((tag, index) => (
          <span className="sdb-a-tag" key={`${specimen.id}:tag:${index}`}>
            {tag}
          </span>
        ))}
      </div>
      <span className="sdb-a-locality" data-testid="locality">
        <i className="ph ph-navigation-arrow" />
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
        <div className="sdb-a-kicker">CURRENT_FOCUS_RECORD //</div>
        <div className="sdb-a-focus-row">
          <h1 className="sdb-a-focus-id" data-testid="detail-id">
            {selected?.id ?? ''}
          </h1>
          {status !== undefined && selected !== null ? (
            <StatusChip
              status={status}
              inline
              testId="detail-status"
              onPromote={onStatusPromote(catalog, selected.id)}
            />
          ) : null}
        </div>
        <p className="sdb-a-claim" data-testid="detail-claim">
          {selected === null ? '' : claimLine(selected)}
        </p>
        {selected !== null ? (
          <p className="sdb-a-locality" data-testid="detail-locality">
            <i className="ph ph-navigation-arrow" />
            {localityLabel(selected)}
          </p>
        ) : null}
      </div>
      <div className="sdb-a-actions">
        <button type="button" className="sdb-a-btn">
          <i className="ph ph-terminal-window" /> EXECUTE_ASSAY
        </button>
        <button type="button" className="sdb-a-btn">
          <i className="ph ph-pencil-simple" /> EDIT_META
        </button>
      </div>
    </header>
  );
}

function WorkingPanelViewport() {
  return (
    <section className="sdb-a-viewport">
      <div className="sdb-a-viewport-head">
        <span>VIEWPORT_01 // PRIMARY_SCAN</span>
        <span>MAG</span>
      </div>
      <div className="sdb-a-viewport-stage">
        <span className="sdb-a-viewport-mark">
          <i className="ph ph-scan" />
        </span>
        <div className="sdb-a-reticle">
          <span className="sdb-a-reticle-h" />
          <span className="sdb-a-reticle-v" />
          <span className="sdb-a-reticle-ring" />
          <span className="sdb-a-reticle-dot" />
        </div>
        <div className="sdb-a-scale">
          <span className="sdb-a-scale-bar" />
          <span />
        </div>
      </div>
    </section>
  );
}

function WorkingPanelChannels() {
  return (
    <section className="sdb-a-channels">
      {CHANNELS.map((channel) => (
        <div className="sdb-a-channel" key={channel}>
          <div className="sdb-a-channel-cap">{channel}</div>
          <div className="sdb-a-channel-well" />
        </div>
      ))}
      <div className="sdb-a-attach">
        <i className="ph ph-plus" />
        <span>ATTACH_LAYER</span>
      </div>
    </section>
  );
}

function WorkingPanelInstrument() {
  return (
    <section className="sdb-a-panel">
      <div className="sdb-a-panel-head">
        <span>INSTRUMENT_READOUT</span>
        <span className="sdb-a-pulse" />
      </div>
      <div className="sdb-a-panel-body">
        <div className="sdb-a-section">## PHYSICAL_PROPERTIES</div>
        {INSTRUMENT_ROWS.map((row) => (
          <div className="sdb-a-row" key={row}>
            <span>{row}</span>
            <span />
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkingPanelEnv() {
  return (
    <section className="sdb-a-panel">
      <div className="sdb-a-panel-head">
        <span>ENV_CONTEXT</span>
      </div>
      <div className="sdb-a-env">
        {ENV_ROWS.map((row) => (
          <div key={row}>
            <div className="sdb-a-env-kicker">{row}</div>
            <div className="sdb-a-env-val" />
          </div>
        ))}
        <div className="sdb-a-env-span">
          <div className="sdb-a-env-kicker">LOCALITY_NOTE</div>
          <div className="sdb-a-env-val" />
        </div>
      </div>
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
      <div className="sdb-a-panel-head">
        <span>OBSERVATION_LOG</span>
        <i className="ph ph-list-dashes" />
      </div>
      <div className="sdb-a-log-body sdb-a-scroll">
        {intakeError !== null ? <p>{intakeError}</p> : null}
        <div className="sdb-a-cursor">
          <span>&gt;</span>
          <span className="sdb-a-cursor-bar" />
        </div>
      </div>
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
