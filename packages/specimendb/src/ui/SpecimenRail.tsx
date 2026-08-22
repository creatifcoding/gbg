/**
 * SpecimenRail — Workbench `/rail` route.
 * Mechanical translation of docs/variant/9263d787-0811-440f-8822-f31ee93b56a8.html.
 * Look lock: that HTML + empty-chrome stills. Not variant-02.png (Accession).
 * Named regions follow WorkbenchComposition accepted boundaries only.
 *
 * @module @tmnl/specimendb/ui
 */

import { useEffect } from 'react';
import { useStx } from '@tmnl/stx';
import type { SpecimenId } from '../schemas/identifiers.js';
import type { SpecimenStatus } from '../schemas/components.js';
import { Intake } from './Intake.js';
import { Locality } from './Locality.js';
import { Media } from './Media.js';
import { Status } from './Status.js';
import {
  onStatusPromote,
  visibleSpecimens,
  type CatalogSurface,
} from './catalog-stx.js';
import type { StatusPromote } from './Status.js';
import { EMPTY_RAIL_CARD_VIDS } from './WorkbenchComposition.js';
import {
  EMPTY_WORKBENCH_VIEW,
  metricsNoteOf,
  projectWorkbenchRecord,
  wellText,
  type MediaWell,
  type TagWell,
  type TextWell,
  type WorkbenchProvenance,
  type WorkbenchRecordView,
} from './WorkbenchRecord.js';
import './ImportedWorkbench.css';

export type SpecimenRailProps = {
  readonly catalog?: CatalogSurface;
  readonly provenance?: WorkbenchProvenance;
};

type StatusChrome = {
  readonly well: string;
  readonly dot: string;
  readonly label: string;
};

const EMPTY_STATUS_CHROME: StatusChrome = {
  well: 'flex items-center gap-1.5 px-1.5 py-0.5 border border-charcoal-300',
  dot: 'w-1.5 h-1.5 bg-charcoal-200',
  label: 'font-mono text-[9px] uppercase tracking-wider text-textdim',
};

const STATUS_CHROME: Record<SpecimenStatus, StatusChrome> = {
  raw: {
    well: 'flex items-center gap-1.5 px-1.5 py-0.5 bg-amber-950/30 border border-amber-900/50',
    dot: 'w-1.5 h-1.5 bg-amber-500',
    label: 'font-mono text-[9px] uppercase tracking-wider text-amber-400',
  },
  filed: {
    well: 'flex items-center gap-1.5 px-1.5 py-0.5 bg-cyan-950/30 border border-cyan-900/50',
    dot: 'w-1.5 h-1.5 bg-cyan-500',
    label: 'font-mono text-[9px] uppercase tracking-wider text-cyan-400',
  },
  working: {
    well: 'flex items-center gap-1.5 px-1.5 py-0.5 bg-emerald-950/30 border border-emerald-900/50',
    dot: 'w-1.5 h-1.5 bg-emerald-500',
    label: 'font-mono text-[9px] uppercase tracking-wider text-emerald-400',
  },
  dead: {
    well: 'flex items-center gap-1.5 px-1.5 py-0.5 bg-rose-950/30 border border-rose-900/50',
    dot: 'w-1.5 h-1.5 bg-rose-500',
    label: 'font-mono text-[9px] uppercase tracking-wider text-rose-400',
  },
};

const MEDIA_CLASS =
  'w-full h-40 bg-void border border-charcoal-200 relative overflow-hidden flex items-center justify-center';

const CARD_CLASS =
  'bg-charcoal-500 border border-charcoal-300 p-3 flex flex-col gap-3 hover:border-charcoal-100 transition-colors cursor-pointer group';

type WorkbenchTreeProps = {
  readonly cards: 'chrome' | readonly WorkbenchRecordView[];
  readonly selected: WorkbenchRecordView;
  readonly selectedId: SpecimenId | null;
  readonly onSelect?: (id: SpecimenId) => void;
  readonly onPromote?: (id: SpecimenId) => StatusPromote;
};

function WorkbenchHeader() {
  return (
    <header
      className="h-12 border-b border-charcoal-300 flex items-center justify-between px-4 bg-void shrink-0"
      vid="14"
    >
      <div className="flex items-center gap-2" vid="15">
        <i className="ph ph-database text-textdim" vid="16"></i>
        <span
          className="font-mono text-[10px] uppercase tracking-widest text-textmuted"
          vid="17"
        >
          SpecimenDB // Core
        </span>
      </div>
      <div className="flex gap-2" vid="18">
        <button
          className="text-textdim hover:text-textmain transition-colors"
          vid="19"
        >
          <i className="ph ph-faders text-lg" vid="20"></i>
        </button>
      </div>
    </header>
  );
}

function WorkbenchPropertyRow({
  rowVid,
  labelVid,
  valueVid,
  label,
  value,
  valueTestId,
}: {
  readonly rowVid: string;
  readonly labelVid: string;
  readonly valueVid: string;
  readonly label: string;
  readonly value: string;
  readonly valueTestId?: string;
}) {
  return (
    <div className="flex justify-between" vid={rowVid}>
      <span className="text-textmuted" vid={labelVid}>
        {label}
      </span>
      <span className="text-textmain" vid={valueVid} data-testid={valueTestId}>
        {value}
      </span>
    </div>
  );
}

function MediaCaption({ well }: { readonly well: MediaWell }) {
  const caption = well.kind === 'empty' ? '' : well.caption;
  return (
    <div
      className="absolute bottom-2 left-2 font-mono text-[9px] text-textdim z-10"
      vid="31"
      data-testid={caption.length > 0 ? 'media-caption' : undefined}
    >
      {caption}
    </div>
  );
}

function MediaWellView({ well }: { readonly well: MediaWell }) {
  const chrome = (
    <>
      <div
        className="absolute inset-0 bg-gradient-to-b from-charcoal-500 to-void opacity-50"
        vid="29"
      ></div>
      <i
        className="ph ph-aperture text-charcoal-200 text-4xl z-10"
        vid="30"
      ></i>
      <MediaCaption well={well} />
    </>
  );
  if (well.kind === 'preview') {
    return (
      <Media
        kind="bytes"
        className={MEDIA_CLASS}
        vid="28"
        src={well.src}
        testId="media-bytes"
      >
        {chrome}
      </Media>
    );
  }
  if (well.kind === 'metadata') {
    return (
      <Media
        kind="label"
        className={MEDIA_CLASS}
        vid="28"
        label={well.caption}
        labelClassName="hidden"
        testId="media-metadata"
      >
        {chrome}
      </Media>
    );
  }
  return (
    <Media kind="empty" className={MEDIA_CLASS} vid="28">
      {chrome}
    </Media>
  );
}

function TagWellView({
  well,
  vid,
}: {
  readonly well: TagWell;
  readonly vid: string;
}) {
  return (
    <span
      className={`font-mono text-[9px] text-textdim${
        well.kind === 'empty' ? ' workbench-empty-tag' : ''
      }`}
      vid={vid}
      data-testid={well.kind === 'value' ? 'tag' : undefined}
    >
      {well.kind === 'value' ? well.value : ''}
    </span>
  );
}

function WorkbenchCard({
  view,
  selected,
  cardVid = '22',
  onSelect,
  onPromote,
}: {
  readonly view: WorkbenchRecordView;
  readonly selected: boolean;
  readonly cardVid?: string;
  readonly onSelect?: (id: SpecimenId) => void;
  readonly onPromote?: (id: SpecimenId) => StatusPromote;
}) {
  const empty = view.id.kind === 'empty';
  const specimenId = view.id.kind === 'value' ? view.id.id : undefined;
  const statusChrome =
    view.status.kind === 'value'
      ? STATUS_CHROME[view.status.value]
      : EMPTY_STATUS_CHROME;
  const promote =
    specimenId !== undefined &&
    view.status.kind === 'value' &&
    onPromote !== undefined
      ? onPromote(specimenId)
      : undefined;
  return (
    <div
      className={CARD_CLASS}
      vid={cardVid}
      data-empty={empty ? 'true' : undefined}
      data-testid={empty ? 'card-chrome' : 'specimen-card'}
      data-selected={empty ? undefined : selected ? 'true' : 'false'}
      role={empty ? undefined : 'button'}
      tabIndex={empty ? undefined : 0}
      aria-pressed={empty ? undefined : selected}
      onClick={
        specimenId !== undefined && onSelect !== undefined
          ? () => onSelect(specimenId)
          : undefined
      }
      onKeyDown={(event) => {
        if (
          specimenId !== undefined &&
          onSelect !== undefined &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault();
          onSelect(specimenId);
        }
      }}
    >
      <div className="flex justify-between items-start" vid="23">
        <div
          className={`font-mono text-sm text-textmain font-medium ${
            empty ? 'workbench-empty-title' : ''
          }`}
          vid="24"
          data-testid={view.id.kind === 'value' ? 'specimen-id' : undefined}
        >
          {view.id.kind === 'value' ? view.id.id : ''}
        </div>
        {view.status.kind === 'value' ? (
          <Status
            kind="value"
            tag="div"
            className={statusChrome.well}
            vid="25"
            value={view.status.value}
            testId="status-pill"
            onPromote={promote}
          >
            <div className={statusChrome.dot} vid="26"></div>
            <span className={statusChrome.label} vid="27">
              {view.status.value}
            </span>
          </Status>
        ) : (
          <Status
            kind="empty"
            tag="div"
            className={`${statusChrome.well} workbench-empty-status`}
            vid="25"
          >
            <div className={statusChrome.dot} vid="26"></div>
            <span className={statusChrome.label} vid="27"></span>
          </Status>
        )}
      </div>

      <MediaWellView well={view.media} />
      <div
        className={`text-xs text-textmain leading-snug tracking-tight ${
          view.claim.kind === 'empty' ? 'workbench-empty-claim' : ''
        }`}
        vid="32"
        data-testid={view.claim.kind === 'value' ? 'claim' : undefined}
      >
        {wellText(view.claim)}
      </div>
      <div className="flex flex-col gap-2 mt-1" vid="33">
        <div className="flex items-center gap-1.5 text-textmuted" vid="34">
          <i className="ph ph-crosshair text-xs" vid="35"></i>
          {view.locality.kind === 'value' ? (
            <Locality
              kind="value"
              tag="span"
              className="font-mono text-[10px]"
              vid="36"
              testId="locality"
              label={view.locality.label}
            />
          ) : (
            <Locality
              kind="empty"
              tag="span"
              className="font-mono text-[10px] workbench-empty-locality"
              vid="36"
            />
          )}
        </div>
        <div
          className={`flex gap-2 ${
            view.tags.every((tag) => tag.kind === 'empty')
              ? 'workbench-empty-tags'
              : ''
          }`}
          vid="37"
        >
          <TagWellView well={view.tags[0]} vid="38" />
          <TagWellView well={view.tags[1]} vid="39" />
          <TagWellView well={view.tags[2]} vid="40" />
        </div>
      </div>
    </div>
  );
}

function WorkbenchCardList({
  cards,
  selectedId,
  onSelect,
  onPromote,
}: {
  readonly cards: WorkbenchTreeProps['cards'];
  readonly selectedId: SpecimenId | null;
  readonly onSelect?: (id: SpecimenId) => void;
  readonly onPromote?: (id: SpecimenId) => StatusPromote;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" vid="21">
      {cards === 'chrome' ? (
        EMPTY_RAIL_CARD_VIDS.map((cardVid) => (
          <WorkbenchCard
            key={cardVid}
            view={EMPTY_WORKBENCH_VIEW}
            selected={false}
            cardVid={cardVid}
          />
        ))
      ) : (
        cards.map((view) => (
          <WorkbenchCard
            key={view.id.kind === 'value' ? view.id.id : 'empty'}
            view={view}
            selected={view.id.kind === 'value' && view.id.id === selectedId}
            onSelect={onSelect}
            onPromote={onPromote}
          />
        ))
      )}
    </div>
  );
}

function WorkbenchIntakeChrome() {
  return (
    <Intake
      kind="chrome"
      className="h-32 border-b border-charcoal-300 p-4 shrink-0 bg-void relative z-20"
      vid="137"
    >
      <div
        className="w-full h-full border border-dashed border-charcoal-200 bg-charcoal-600 hover:bg-charcoal-500 hover:border-textdim transition-all cursor-crosshair flex flex-col items-center justify-center gap-2 group corner-brackets"
        vid="138"
      >
        <i
          className="ph ph-scan text-textdim text-2xl group-hover:text-cyan-500 transition-colors"
          vid="139"
        ></i>
        <span
          className="font-mono text-[11px] text-textdim uppercase tracking-[0.2em] group-hover:text-cyan-400 transition-colors"
          vid="140"
        >
          Initiate Intake Sequence // Drop Telemetry Data
        </span>
      </div>
    </Intake>
  );
}

function WorkbenchViewport() {
  return (
    <div
      className="flex-1 border border-charcoal-300 bg-void relative flex items-center justify-center overflow-hidden z-10 corner-brackets"
      vid="151"
    >
      <div
        className="absolute top-3 left-3 font-mono text-[10px] text-textdim"
        vid="152"
      >
        VIEWPORT_XZ
      </div>
      <div
        className="absolute top-3 right-3 font-mono text-[10px] text-textdim"
        vid="153"
      >
        MAG
      </div>
      <div
        className="absolute bottom-3 left-3 font-mono text-[10px] text-textdim flex items-center gap-2"
        vid="154"
      >
        <div
          className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
          vid="155"
        ></div>
        ACTIVE_RENDER
      </div>
      <div
        className="absolute bottom-3 right-3 font-mono text-[10px] text-textdim"
        vid="156"
      ></div>

      <div
        className="relative w-[400px] h-[400px] flex items-center justify-center"
        vid="157"
      >
        <div
          className="absolute inset-0 border border-dashed border-charcoal-200 rounded-full animate-[spin_60s_linear_infinite] opacity-50"
          vid="158"
        ></div>
        <div
          className="absolute inset-8 border border-charcoal-300 rounded-full flex items-center justify-center"
          vid="159"
        >
          <svg
            width="240"
            height="240"
            viewBox="0 0 100 100"
            className="text-charcoal-200 fill-none stroke-current opacity-80"
            strokeWidth="0.5"
            vid="160"
          >
            <path
              d="M50 10 L90 30 L90 70 L50 90 L10 70 L10 30 Z"
              strokeDasharray="2 2"
              className="animate-[spin_40s_linear_infinite_reverse] origin-center"
              vid="161"
            ></path>
            <path
              d="M50 20 L80 35 L80 65 L50 80 L20 65 L20 35 Z"
              vid="162"
            ></path>
            <path
              d="M50 30 L70 40 L70 60 L50 70 L30 60 L30 40 Z"
              strokeDasharray="1 3"
              vid="163"
            ></path>
            <circle
              cx="50"
              cy="50"
              r="10"
              className="stroke-emerald-900"
              vid="164"
            ></circle>
            <line
              x1="50"
              y1="10"
              x2="50"
              y2="90"
              strokeOpacity="0.5"
              vid="165"
            ></line>
            <line
              x1="10"
              y1="30"
              x2="90"
              y2="70"
              strokeOpacity="0.5"
              vid="166"
            ></line>
            <line
              x1="10"
              y1="70"
              x2="90"
              y2="30"
              strokeOpacity="0.5"
              vid="167"
            ></line>
          </svg>
        </div>
        <div
          className="w-1 h-1 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] z-20"
          vid="168"
        ></div>
      </div>
    </div>
  );
}

function WorkbenchStage({ view }: { readonly view: WorkbenchRecordView }) {
  return (
    <div
      className="flex-1 border-r border-charcoal-300 p-6 flex flex-col relative overflow-hidden bg-void"
      vid="142"
    >
      <div
        className="absolute inset-0 grid-bg opacity-30 pointer-events-none"
        vid="143"
      ></div>
      <header className="flex justify-between items-start mb-6 z-10" vid="144">
        <div
          className={
            view.id.kind === 'empty' ? 'workbench-empty-stage-copy' : undefined
          }
          vid="145"
        >
          <h1
            className="font-mono text-3xl text-textmain tracking-tight"
            vid="146"
            data-testid="detail-id"
          >
            {view.id.kind === 'value' ? view.id.id : ''}
          </h1>
          <p
            className="font-sans text-textmuted mt-1 tracking-tight text-sm"
            vid="147"
            data-testid="detail-claim"
          >
            {wellText(view.claim)}
          </p>
        </div>
        <div className="flex gap-3" vid="148">
          <button
            className="px-4 py-1.5 bg-void border border-charcoal-200 text-textmuted hover:text-textmain hover:border-charcoal-100 font-mono text-[11px] uppercase tracking-widest transition-colors"
            vid="149"
          >
            Export DB
          </button>
          <button
            className="px-4 py-1.5 bg-void border border-emerald-900/50 text-emerald-500 hover:bg-emerald-950/20 hover:border-emerald-700 font-mono text-[11px] uppercase tracking-widest transition-colors"
            vid="150"
          >
            Run Sim
          </button>
        </div>
      </header>
      <WorkbenchViewport />
    </div>
  );
}

function rankWell(well: TextWell): string {
  return well.kind === 'value' ? well.text : '';
}

function WorkbenchClassification({
  view,
}: {
  readonly view: WorkbenchRecordView;
}) {
  return (
    <div className="space-y-3" vid="173">
      <div
        className="flex items-center justify-between border-b border-charcoal-300 pb-1.5"
        vid="174"
      >
        <span
          className="font-mono text-[10px] uppercase tracking-widest text-textdim"
          vid="175"
        >
          Classification
        </span>
        <i className="ph ph-dna text-textdim" vid="176"></i>
      </div>
      <div className="space-y-1.5 font-mono text-xs" vid="177">
        <WorkbenchPropertyRow
          rowVid="178"
          labelVid="179"
          valueVid="180"
          label="Phylum"
          value={rankWell(view.taxon.phylum)}
          valueTestId="taxon-phylum"
        />
        <WorkbenchPropertyRow
          rowVid="181"
          labelVid="182"
          valueVid="183"
          label="Class"
          value={rankWell(view.taxon.class)}
          valueTestId="taxon-class"
        />
        <WorkbenchPropertyRow
          rowVid="184"
          labelVid="185"
          valueVid="186"
          label="Order"
          value={rankWell(view.taxon.order)}
          valueTestId="taxon-order"
        />
        <WorkbenchPropertyRow
          rowVid="187"
          labelVid="188"
          valueVid="189"
          label="Family"
          value={rankWell(view.taxon.family)}
          valueTestId="taxon-family"
        />
      </div>
    </div>
  );
}

function WorkbenchStructuralMetrics({
  view,
}: {
  readonly view: WorkbenchRecordView;
}) {
  const note = metricsNoteOf(view);
  return (
    <div className="space-y-3" vid="190">
      <div
        className="flex items-center justify-between border-b border-charcoal-300 pb-1.5"
        vid="191"
      >
        <span
          className="font-mono text-[10px] uppercase tracking-widest text-textdim"
          vid="192"
        >
          Structural Metrics
        </span>
        <i className="ph ph-hexagon text-textdim" vid="193"></i>
      </div>
      <div className="space-y-1.5 font-mono text-xs" vid="194">
        <WorkbenchPropertyRow
          rowVid="195"
          labelVid="196"
          valueVid="197"
          label="Tensile_Str"
          value=""
        />
        <WorkbenchPropertyRow
          rowVid="198"
          labelVid="199"
          valueVid="200"
          label="Density"
          value=""
        />
        <WorkbenchPropertyRow
          rowVid="201"
          labelVid="202"
          valueVid="203"
          label="Hardness_HV"
          value=""
        />
        <WorkbenchPropertyRow
          rowVid="204"
          labelVid="205"
          valueVid="206"
          label="Overlap_Idx"
          value=""
        />
      </div>
      <div
        className={`mt-2 p-2 bg-charcoal-500 border border-charcoal-300 font-mono text-[10px] text-emerald-400 flex items-start gap-2 ${
          note.length === 0 ? 'workbench-empty-metrics-note' : ''
        }`}
        vid="207"
      >
        <i className="ph ph-check-circle mt-0.5" vid="208"></i>
        <span
          vid="209"
          data-testid={note.length > 0 ? 'provenance-note' : undefined}
        >
          {note}
        </span>
      </div>
    </div>
  );
}

function WorkbenchObservationLog({
  view,
}: {
  readonly view: WorkbenchRecordView;
}) {
  const observations = view.observations.flatMap((observation) =>
    observation.kind === 'value' ? [observation.text] : []
  );
  const w7 = view.w7.kind === 'value' ? view.w7.lines : [];
  const lines = [...observations, ...w7];
  return (
    <div className="space-y-3" vid="210">
      <div
        className="flex items-center justify-between border-b border-charcoal-300 pb-1.5"
        vid="211"
      >
        <span
          className="font-mono text-[10px] uppercase tracking-widest text-textdim"
          vid="212"
        >
          Observation Log
        </span>
        <i className="ph ph-terminal-window text-textdim" vid="213"></i>
      </div>
      <div
        className={`font-sans text-xs text-textmuted leading-relaxed tracking-tight space-y-3 ${
          lines.length === 0 ? 'workbench-empty-observation-body' : ''
        }`}
        vid="214"
      >
        {lines.length === 0
          ? [215, 216].map((sourceVid) => (
              <p key={sourceVid} vid={String(sourceVid)}></p>
            ))
          : lines.map((line, index) => (
              <p
                key={`${index}:${line}`}
                data-testid={index < observations.length ? 'observation' : 'w7'}
                vid={String(215 + index)}
              >
                {line}
              </p>
            ))}
      </div>
      <div
        className="font-mono text-[10px] text-textdim border-t border-charcoal-300 pt-2 flex justify-between"
        data-testid="last-updated"
        vid="217"
      >
        <span vid="218">LAST_UPDATED</span>
        <span vid="219">{wellText(view.createdAt)}</span>
      </div>
    </div>
  );
}

function WorkbenchPropertiesLog({
  view,
}: {
  readonly view: WorkbenchRecordView;
}) {
  return (
    <div className="w-[340px] shrink-0 bg-void flex flex-col z-20" vid="169">
      <div
        className="h-10 border-b border-charcoal-300 flex items-center px-4 shrink-0 bg-charcoal-600"
        vid="170"
      >
        <span
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-textmuted"
          vid="171"
        >
          Properties Log
        </span>
      </div>
      <div
        className="flex-1 p-5 space-y-8 overflow-y-auto custom-scrollbar"
        vid="172"
      >
        <WorkbenchClassification view={view} />
        <WorkbenchStructuralMetrics view={view} />
        <WorkbenchObservationLog view={view} />
      </div>
    </div>
  );
}

function WorkbenchTree({
  cards,
  selected,
  selectedId,
  onSelect,
  onPromote,
}: WorkbenchTreeProps) {
  return (
    <div
      className="h-screen w-screen overflow-hidden flex font-sans text-sm selection:bg-charcoal-200 selection:text-gray-200"
      vid="12"
    >
      <aside
        className="w-[420px] flex-shrink-0 flex flex-col bg-void border-r border-charcoal-300 relative z-20"
        vid="13"
      >
        <WorkbenchHeader />
        <WorkbenchCardList
          cards={cards}
          selectedId={selectedId}
          onSelect={onSelect}
          onPromote={onPromote}
        />
      </aside>
      <main
        className="flex-1 flex flex-col bg-charcoal-600 relative z-10 min-w-0"
        vid="136"
      >
        <WorkbenchIntakeChrome />
        <div className="flex-1 flex min-h-0" vid="141">
          <WorkbenchStage view={selected} />
          <WorkbenchPropertiesLog view={selected} />
        </div>
      </main>
    </div>
  );
}

function WorkbenchLive({
  catalog,
  provenance,
}: {
  readonly catalog: CatalogSurface;
  readonly provenance: WorkbenchProvenance;
}) {
  const { value } = useStx(catalog.store);

  useEffect(() => {
    void catalog.list();
  }, [catalog]);

  const rows = visibleSpecimens(value);
  const cards: WorkbenchTreeProps['cards'] =
    rows.length === 0
      ? 'chrome'
      : rows.map((specimen) =>
          projectWorkbenchRecord(
            {
              kind: 'specimen',
              specimen,
              preview: value.previews[specimen.id],
            },
            { kind: 'none' }
          )
        );
  const selected = projectWorkbenchRecord(
    value.selected === null
      ? { kind: 'empty' }
      : {
          kind: 'specimen',
          specimen: value.selected,
          preview: value.previews[value.selected.id],
        },
    provenance
  );

  return (
    <WorkbenchTree
      cards={cards}
      selected={selected}
      selectedId={value.selectedId}
      onSelect={(id) => {
        void catalog.select(id);
      }}
      onPromote={(id) => onStatusPromote(catalog, id)}
    />
  );
}

export function SpecimenRail(props: SpecimenRailProps = {}) {
  const provenance = props.provenance ?? { kind: 'none' };
  return (
    <div className="imported-workbench" data-testid="specimen-rail">
      {props.catalog === undefined ? (
        <WorkbenchTree
          cards="chrome"
          selected={projectWorkbenchRecord({ kind: 'empty' }, provenance)}
          selectedId={null}
        />
      ) : (
        <WorkbenchLive catalog={props.catalog} provenance={provenance} />
      )}
    </div>
  );
}
