/**
 * IntakeDrop — full Terminal page. Calls SpecimenRpcs.Intake.
 * Layout is the Variant Terminal HTML, not a mashed two-column shell.
 *
 * @module @tmnl/specimendb/ui
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useFocus, useStx } from '@tmnl/stx';
import { statusOf } from '../schemas/specimen.js';
import type { Specimen } from '../schemas/specimen.js';
import type { SpecimenStatus } from '../schemas/components.js';
import { at, localityLabel, onStatusPromote, visibleSpecimens, type CatalogState, type CatalogSurface } from './catalog-stx.js';
import { claimLine, imgSrcLabel, mediaLabel, tagSlots } from './catalog-view.js';
import { useIntakeBind, type IntakeBind } from './intake-bind.js';
import './catalog.css';

type IntakeDropContextValue = {
  readonly catalog: CatalogSurface;
  readonly bind: IntakeBind;
};

const IntakeDropContext = createContext<IntakeDropContextValue | null>(null);

const useIntakeDrop = (): IntakeDropContextValue => {
  const ctx = useContext(IntakeDropContext);
  if (ctx === null) {
    throw new Error('IntakeDrop compound components must be used within IntakeDrop');
  }
  return ctx;
};

const METRIC_KICKERS = [
  'CLASS / ORDER',
  'EXTRACTION VECTOR',
  'THERMAL BASE',
  'SPECTROSCOPY',
  'CELLULAR VIABILITY',
  'PROTOCOL ID',
] as const;

const StatusPill = ({
  status,
  testId,
  onPromote,
}: {
  readonly status: SpecimenStatus;
  readonly testId?: string;
  readonly onPromote?: (event: { readonly stopPropagation: () => void; readonly preventDefault: () => void }) => void;
}) => (
  <span
    className="sdb-pill"
    data-status={status}
    data-testid={testId}
    {...(onPromote !== undefined ? { 'data-promote': 'true', onClick: onPromote } : {})}
  >
    {status}
  </span>
);

export type IntakeDropProps = {
  readonly catalog: CatalogSurface;
  readonly children?: ReactNode;
};

function IntakeDropRoot({ catalog, children }: IntakeDropProps) {
  const bind = useIntakeBind(catalog);

  useEffect(() => {
    void catalog.list();
  }, [catalog]);

  return (
    <IntakeDropContext.Provider value={{ catalog, bind }}>
      <div className="sdb-terminal" data-testid="intake-drop">
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
            <aside className="sdb-t-rail">
              <IntakeDropHeader />
              <IntakeDropList />
            </aside>
            <main className="sdb-t-main">
              <IntakeDropStatusBar />
              <div className="sdb-t-stage">
                <IntakeDropZone />
                <IntakeDropDetail />
              </div>
            </main>
          </>
        )}
      </div>
    </IntakeDropContext.Provider>
  );
}

function IntakeDropHeader() {
  return (
    <header className="sdb-t-rail-header">
      <i className="ph ph-database sdb-t-mark" />
      <h1>Local Catalog</h1>
    </header>
  );
}

function IntakeDropStatusBar() {
  const { catalog } = useIntakeDrop();
  const online = useFocus(catalog.store, at<CatalogState['online']>(catalog.store.lens.online));
  return (
    <header className="sdb-t-status">
      <span className="sdb-t-brand">SPECIMEN_DB</span>
      <span className="sdb-t-sys" data-online={online ? 'true' : 'false'} data-testid="rail-online">
        <span className="sdb-t-sys-sq" />
        {online ? 'SYS_ONLINE' : 'SYS_OFFLINE'}
      </span>
    </header>
  );
}

function IntakeDropZone() {
  const { catalog, bind } = useIntakeDrop();
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
        className="sdb-t-zone"
        data-testid="intake-zone"
        data-active={bind.active ? 'true' : 'false'}
        data-status={intakeStatus}
        onClick={bind.open}
        onDragEnter={bind.onDragEnter}
        onDragOver={bind.onDragOver}
        onDragLeave={bind.onDragLeave}
        onDrop={bind.onDrop}
      >
        <span className="sdb-t-zone-grid tech-grid" />
        <i className="ph ph-upload-simple sdb-t-upload" />
        <span className="sdb-t-protocol">
          {intakeStatus === 'dropping' ? 'INTAKE_IN_FLIGHT' : 'Initiate_Intake_Protocol'}
        </span>
        <span className="sdb-t-sub">DROP FIELD MEDIA / RAW TELEMETRY HERE</span>
      </button>
      {intakeError !== null ? (
        <p className="sdb-error" data-testid="intake-error">
          {intakeError}
        </p>
      ) : null}
    </>
  );
}

function IntakeDropList() {
  const { catalog } = useIntakeDrop();
  const { value } = useStx(catalog.store);
  const rows = visibleSpecimens(value);

  return (
    <div className="sdb-t-list" data-testid="rail-list">
      {rows.length === 0 ? (
        <TerminalCardChrome />
      ) : (
        rows.map((specimen) => <IntakeDropCard key={specimen.id} specimen={specimen} />)
      )}
    </div>
  );
}

function TerminalWell({
  preview,
  caption,
}: {
  readonly preview?: string;
  readonly caption: string;
}) {
  return (
    <div className="sdb-t-well">
      <span className="sdb-t-well-grid tech-grid" />
      {preview !== undefined ? <img src={preview} alt="" data-testid="media-bytes" /> : null}
      <i className="ph ph-crosshair sdb-t-crosshair" />
      <span className="sdb-t-imgsrc">{caption}</span>
    </div>
  );
}

function TerminalCardChrome() {
  return (
    <article className="sdb-t-card" data-empty="true" data-testid="card-chrome">
      <TerminalWell caption="IMG_SRC" />
      <div className="sdb-t-card-body">
        <div className="sdb-t-card-meta">
          <span className="sdb-pill" data-status="raw">
            raw
          </span>
          <span className="sdb-t-locality" data-testid="locality">
            unknown
          </span>
        </div>
        <p className="sdb-t-claim" data-testid="claim" />
        <div className="sdb-t-tags">
          {tagSlots().map((_, index) => (
            <span className="sdb-t-tag" key={`empty-tag-${index}`} />
          ))}
        </div>
      </div>
    </article>
  );
}

function IntakeDropCard({ specimen }: { readonly specimen: Specimen }) {
  const { catalog } = useIntakeDrop();
  const selectedId = useFocus(
    catalog.store,
    at<CatalogState['selectedId']>(catalog.store.lens.selectedId),
  );
  const previews = useFocus(
    catalog.store,
    at<CatalogState['previews']>(catalog.store.lens.previews),
  );
  const status = (statusOf(specimen) ?? 'raw') satisfies SpecimenStatus;

  return (
    <button
      type="button"
      className="sdb-t-card"
      data-testid="specimen-card"
      data-selected={selectedId === specimen.id ? 'true' : 'false'}
      onClick={() => void catalog.select(specimen.id)}
    >
      <TerminalWell preview={previews[specimen.id]} caption={imgSrcLabel(specimen)} />
      <div className="sdb-t-card-body">
        <div className="sdb-t-card-meta">
          <StatusPill
            status={status}
            testId="status-pill"
            onPromote={onStatusPromote(catalog, specimen.id)}
          />
          <span className="sdb-t-locality" data-testid="locality">
            {localityLabel(specimen)}
          </span>
        </div>
        <p className="sdb-t-claim" data-testid="claim">
          {claimLine(specimen)}
        </p>
        <span className="sdb-t-id" data-testid="specimen-id">
          {specimen.id}
        </span>
        <div className="sdb-t-tags">
          {tagSlots(specimen).map((tag, index) => (
            <span className="sdb-t-tag" key={`${specimen.id}:tag:${index}`}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function IntakeDropDetail() {
  const { catalog } = useIntakeDrop();
  const selected = useFocus(
    catalog.store,
    at<CatalogState['selected']>(catalog.store.lens.selected),
  );
  const intakeError = useFocus(
    catalog.store,
    at<CatalogState['intakeError']>(catalog.store.lens.intakeError),
  );
  const status = selected === null ? undefined : (statusOf(selected) ?? 'raw');

  return (
    <section className="sdb-t-detail" data-testid="specimen-detail">
      <div className="sdb-t-detail-head">
        <h2 className="sdb-t-detail-id" data-testid="detail-id">
          {selected === null ? '>>' : `>> ${selected.id}`}
        </h2>
        <div className="sdb-t-live">
          {status !== undefined && selected !== null ? (
            <StatusPill
              status={status}
              testId="detail-status"
              onPromote={onStatusPromote(catalog, selected.id)}
            />
          ) : null}
          <span className="sdb-pill" data-status="working">
            ANALYSIS_ACTIVE
          </span>
          <span className="sdb-t-live-feed">_ LIVE_FEED</span>
        </div>
      </div>
      <div className="sdb-t-metrics">
        {METRIC_KICKERS.map((kicker) => (
          <div className="sdb-t-cell" key={kicker}>
            <div className="sdb-t-kicker">{kicker}</div>
            <div className="sdb-t-cell-value" />
          </div>
        ))}
      </div>
      <div className="sdb-t-split">
        <div className="sdb-t-wave">
          <div className="sdb-t-panel-head">WAVEFORM_ANALYSIS // CHROMATOPHORE_REACTIVITY</div>
          <div className="sdb-t-wave-grid tech-grid" />
        </div>
        <div className="sdb-t-log">
          <div className="sdb-t-panel-head">PROCESS LOG</div>
          <div className="sdb-t-log-body">
            {selected !== null ? (
              <>
                <p className="sdb-t-claim" data-testid="detail-claim">
                  {claimLine(selected)}
                </p>
                <p className="sdb-t-locality" data-testid="detail-locality">
                  {localityLabel(selected)}
                </p>
                {mediaLabel(selected) !== '' ? (
                  <p className="sdb-t-locality" data-testid="detail-media">
                    {mediaLabel(selected)}
                  </p>
                ) : null}
              </>
            ) : null}
            {intakeError !== null ? <p className="sdb-error">{intakeError}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export const IntakeDrop = Object.assign(IntakeDropRoot, {
  Header: IntakeDropHeader,
  StatusBar: IntakeDropStatusBar,
  Zone: IntakeDropZone,
  List: IntakeDropList,
  Card: IntakeDropCard,
  Detail: IntakeDropDetail,
});
