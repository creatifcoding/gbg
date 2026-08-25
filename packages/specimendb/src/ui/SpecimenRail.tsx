/**
 * SpecimenRail — Workbench `/rail` route.
 * Mechanical translation of docs/variant/9263d787-0811-440f-8822-f31ee93b56a8.html.
 * Look lock: that HTML + empty-chrome stills. Not variant-02.png (Accession).
 * Named regions follow WorkbenchComposition accepted boundaries only.
 *
 * @module @tmnl/specimendb/ui
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { useFocus, useStx } from '@tmnl/stx';
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
import {
  WORKBENCH_CHROME,
  createWorkbenchSockets,
  createdAtWellOf,
  idWellOf,
  localityWellOf,
  mediaWellOf,
  preferLiveWell,
  socketAt,
  statusWellOf,
  tagWellOf,
  textWellOf,
  type ClaimSocket,
  type IntakeSocket,
  type LastUpdatedSocket,
  type LocalitySocket,
  type MediaSocket,
  type MetricsSocket,
  type ObservationSocket,
  type RailQuerySocket,
  type SelectedSocket,
  type StatusSocket,
  type TagsSocket,
  type TaxonSocket,
  type TitleSocket,
  type ViewportSocket,
  type WorkbenchSockets,
} from './WorkbenchSockets.js';
import {
  Kicker,
  Label,
  Mono,
  Pill,
  Sans,
  Socket,
  labBoxPaint,
  labTextPaint,
} from './WorkbenchLabUi.js';
import './ImportedWorkbench.css';

const WorkbenchSocketsContext = createContext<WorkbenchSockets | null>(null);

function useWorkbenchSockets(): WorkbenchSockets {
  const sockets = useContext(WorkbenchSocketsContext);
  if (sockets === null) {
    throw new Error('SpecimenRail owns Workbench sockets');
  }
  return sockets;
}

export type SpecimenRailProps = {
  readonly catalog?: CatalogSurface;
  readonly provenance?: WorkbenchProvenance;
};

type StatusChrome = {
  readonly well: string;
  readonly dot: string;
  readonly label: string;
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
        <Label
          className="font-mono text-[10px] uppercase tracking-widest text-textmuted"
          vid="17"
          data-chrome="header"
          style={labTextPaint}
        >
          {WORKBENCH_CHROME.header}
        </Label>
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
  socket,
}: {
  readonly rowVid: string;
  readonly labelVid: string;
  readonly valueVid: string;
  readonly label: string;
  readonly value: string;
  readonly valueTestId?: string;
  readonly socket?: string;
}) {
  return (
    <div className="flex justify-between" vid={rowVid}>
      <span className="text-textmuted" vid={labelVid}>
        {label}
      </span>
      {value.length === 0 ? (
        <Socket
          className="text-textmain workbench-empty-value"
          style={labBoxPaint}
        >
          <span
            vid={valueVid}
            data-testid={valueTestId}
            data-socket={socket}
          >
            {''}
          </span>
        </Socket>
      ) : (
        <span
          className="text-textmain"
          vid={valueVid}
          data-testid={valueTestId}
          data-socket={socket}
        >
          {value}
        </span>
      )}
    </div>
  );
}

function MediaCaption({ well }: { readonly well: MediaWell }) {
  const sockets = useWorkbenchSockets();
  const captionSlot = useFocus(
    sockets.media,
    socketAt<MediaSocket, MediaSocket['caption']>(sockets.media.lens.caption)
  );
  const live = well.kind === 'empty' ? '' : well.caption;
  const caption = live.length > 0 ? live : wellText(textWellOf(captionSlot));
  const blank = caption.length === 0;
  if (blank) {
    return (
      <Socket
        className="absolute bottom-2 left-2 font-mono text-[9px] text-textdim z-10 workbench-empty-caption"
        vid="31"
        style={labBoxPaint}
      >
        <span data-socket="scan-type">{''}</span>
      </Socket>
    );
  }
  return (
    <div
      className="absolute bottom-2 left-2 font-mono text-[9px] text-textdim z-10"
      vid="31"
      data-testid="media-caption"
      data-socket="scan-type"
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
        socket="media"
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
        socket="media"
      >
        {chrome}
      </Media>
    );
  }
  return (
    <Media kind="empty" className={MEDIA_CLASS} vid="28" socket="media">
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
  if (well.kind === 'empty') {
    return (
      <Socket
        className="font-mono text-[9px] text-textdim workbench-empty-tag"
        style={labBoxPaint}
      >
        <span vid={vid} data-socket="tag">
          {''}
        </span>
      </Socket>
    );
  }
  return (
    <span
      className="font-mono text-[9px] text-textdim"
      vid={vid}
      data-testid="tag"
      data-socket="tag"
    >
      {well.value}
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
  const sockets = useWorkbenchSockets();
  const titleSlot = useFocus(
    sockets.title,
    socketAt<TitleSocket, TitleSocket['well']>(sockets.title.lens.well)
  );
  const phase = useFocus(
    sockets.status,
    socketAt<StatusSocket, StatusSocket['phase']>(sockets.status.lens.phase)
  );
  const claimSlot = useFocus(
    sockets.claim,
    socketAt<ClaimSocket, ClaimSocket['well']>(sockets.claim.lens.well)
  );
  const localitySlot = useFocus(
    sockets.locality,
    socketAt<LocalitySocket, LocalitySocket['well']>(
      sockets.locality.lens.well
    )
  );
  const mediaSlot = useFocus(
    sockets.media,
    socketAt<MediaSocket, MediaSocket['well']>(sockets.media.lens.well)
  );
  const tagFirst = useFocus(
    sockets.tags,
    socketAt<TagsSocket, TagsSocket['first']>(sockets.tags.lens.first)
  );
  const tagSecond = useFocus(
    sockets.tags,
    socketAt<TagsSocket, TagsSocket['second']>(sockets.tags.lens.second)
  );
  const tagThird = useFocus(
    sockets.tags,
    socketAt<TagsSocket, TagsSocket['third']>(sockets.tags.lens.third)
  );
  const id = preferLiveWell(view.id, idWellOf(titleSlot));
  const status = preferLiveWell(view.status, statusWellOf(phase));
  const claim = preferLiveWell(view.claim, textWellOf(claimSlot));
  const locality = preferLiveWell(
    view.locality,
    localityWellOf(localitySlot)
  );
  const media = preferLiveWell(view.media, mediaWellOf(mediaSlot));
  const tags = [
    preferLiveWell(view.tags[0], tagWellOf(tagFirst)),
    preferLiveWell(view.tags[1], tagWellOf(tagSecond)),
    preferLiveWell(view.tags[2], tagWellOf(tagThird)),
  ] as const;
  const empty = id.kind === 'empty';
  const specimenId = id.kind === 'value' ? id.id : undefined;
  const statusChrome =
    status.kind === 'value' ? STATUS_CHROME[status.value] : undefined;
  const promote =
    specimenId !== undefined &&
    status.kind === 'value' &&
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
        {empty ? (
          <Socket
            className="font-mono text-sm text-textmain font-medium workbench-empty-title"
            vid="24"
            style={labBoxPaint}
          >
            <span data-socket="title">{''}</span>
          </Socket>
        ) : (
          <div
            className="font-mono text-sm text-textmain font-medium"
            vid="24"
            data-testid={id.kind === 'value' ? 'specimen-id' : undefined}
            data-socket="title"
          >
            {id.kind === 'value' ? id.id : ''}
          </div>
        )}
        {status.kind === 'value' && statusChrome !== undefined ? (
          <Status
            kind="value"
            tag="div"
            className={statusChrome.well}
            vid="25"
            value={status.value}
            testId="status-pill"
            socket="status"
            onPromote={promote}
          >
            <div className={statusChrome.dot} vid="26"></div>
            <span className={statusChrome.label} vid="27">
              {status.value}
            </span>
          </Status>
        ) : (
          <Pill
            className="workbench-empty-status"
            vid="25"
            data-socket="status"
            style={labBoxPaint}
          />
        )}
      </div>

      <MediaWellView well={media} />
      {claim.kind === 'empty' ? (
        <Socket
          className="text-xs text-textmain leading-snug tracking-tight workbench-empty-claim"
          vid="32"
          style={labBoxPaint}
        >
          <span data-socket="claim">{''}</span>
        </Socket>
      ) : (
        <div
          className="text-xs text-textmain leading-snug tracking-tight"
          vid="32"
          data-testid="claim"
          data-socket="claim"
        >
          {wellText(claim)}
        </div>
      )}
      <div className="flex flex-col gap-2 mt-1" vid="33">
        <div className="flex items-center gap-1.5 text-textmuted" vid="34">
          <i className="ph ph-crosshair text-xs" vid="35"></i>
          {locality.kind === 'value' ? (
            <Locality
              kind="value"
              tag="span"
              className="font-mono text-[10px]"
              vid="36"
              testId="locality"
              socket="locality"
              label={locality.label}
            />
          ) : (
            <Socket
              className="font-mono text-[10px] workbench-empty-locality"
              style={labBoxPaint}
            >
              <Locality
                kind="empty"
                tag="span"
                className="font-mono text-[10px]"
                vid="36"
                socket="locality"
              />
            </Socket>
          )}
        </div>
        <div
          className={`flex gap-2 ${
            tags.every((tag) => tag.kind === 'empty')
              ? 'workbench-empty-tags'
              : ''
          }`}
          vid="37"
        >
          <TagWellView well={tags[0]} vid="38" />
          <TagWellView well={tags[1]} vid="39" />
          <TagWellView well={tags[2]} vid="40" />
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
  const sockets = useWorkbenchSockets();
  const query = useFocus(
    sockets.railQuery,
    socketAt<RailQuerySocket, RailQuerySocket['query']>(
      sockets.railQuery.lens.query
    )
  );
  // Workbench has no query input. The socket stays subscribed and empty.
  void query;
  return (
    <div
      className="flex-1 overflow-y-auto p-3 flex flex-col gap-3"
      vid="21"
      data-socket="rail-query"
    >
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
  const sockets = useWorkbenchSockets();
  const mode = useFocus(
    sockets.intake,
    socketAt<IntakeSocket, IntakeSocket['mode']>(sockets.intake.lens.mode)
  );
  return (
    <Intake
      kind={mode}
      className="h-32 border-b border-charcoal-300 p-4 shrink-0 bg-void relative z-20"
      vid="137"
      socket="intake"
      chrome="intake"
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
          {WORKBENCH_CHROME.intake}
        </span>
      </div>
    </Intake>
  );
}

function WorkbenchViewport() {
  const sockets = useWorkbenchSockets();
  const mag = useFocus(
    sockets.viewport,
    socketAt<ViewportSocket, ViewportSocket['mag']>(sockets.viewport.lens.mag)
  );
  const readout = useFocus(
    sockets.viewport,
    socketAt<ViewportSocket, ViewportSocket['readout']>(
      sockets.viewport.lens.readout
    )
  );
  return (
    <div
      className="flex-1 border border-charcoal-300 bg-void relative flex items-center justify-center overflow-hidden z-10 corner-brackets"
      vid="151"
    >
      <div
        className="absolute top-3 left-3 font-mono text-[10px] text-textdim"
        vid="152"
        data-chrome="viewport-xz"
      >
        <Mono style={labTextPaint}>{WORKBENCH_CHROME.viewport}</Mono>
      </div>
      <div
        className="absolute top-3 right-3 font-mono text-[10px] text-textdim"
        vid="153"
        data-chrome="mag"
        data-socket="viewport-mag"
      >
        <Mono style={labTextPaint}>
          {`${WORKBENCH_CHROME.mag}${wellText(textWellOf(mag))}`}
        </Mono>
      </div>
      <div
        className="absolute bottom-3 left-3 font-mono text-[10px] text-textdim flex items-center gap-2"
        vid="154"
        data-chrome="active-render"
      >
        <div
          className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
          vid="155"
        ></div>
        <Mono style={labTextPaint}>{WORKBENCH_CHROME.activeRender}</Mono>
      </div>
      <div
        className="absolute bottom-3 right-3 font-mono text-[10px] text-textdim"
        vid="156"
        data-socket="viewport-readout"
      >
        {wellText(textWellOf(readout))}
      </div>

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
  const sockets = useWorkbenchSockets();
  const selected = useFocus(
    sockets.selectedId,
    socketAt<SelectedSocket, SelectedSocket['well']>(
      sockets.selectedId.lens.well
    )
  );
  const claimSlot = useFocus(
    sockets.claim,
    socketAt<ClaimSocket, ClaimSocket['well']>(sockets.claim.lens.well)
  );
  const id = preferLiveWell(view.id, idWellOf(selected));
  const claim = preferLiveWell(view.claim, textWellOf(claimSlot));
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
            id.kind === 'empty' ? 'workbench-empty-stage-copy' : undefined
          }
          vid="145"
        >
          <h1
            className={`font-mono text-3xl text-textmain tracking-tight${
              id.kind === 'empty' ? ' workbench-empty-stage-id' : ''
            }`}
            vid="146"
            data-testid="detail-id"
            data-socket="selected-id"
          >
            {id.kind === 'empty' ? (
              <Socket style={labBoxPaint}>
                <Mono style={labTextPaint}>{''}</Mono>
              </Socket>
            ) : (
              <Mono style={labTextPaint}>
                {id.kind === 'value' ? id.id : ''}
              </Mono>
            )}
          </h1>
          <p
            className={`font-sans text-textmuted mt-1 tracking-tight text-sm${
              claim.kind === 'empty' ? ' workbench-empty-stage-claim' : ''
            }`}
            vid="147"
            data-testid="detail-claim"
            data-socket="claim"
          >
            {claim.kind === 'empty' ? (
              <Socket style={labBoxPaint}>
                <Sans style={labTextPaint}>{''}</Sans>
              </Socket>
            ) : (
              <Sans style={labTextPaint}>{wellText(claim)}</Sans>
            )}
          </p>
        </div>
        <div className="flex gap-3" vid="148">
          <button
            className="px-4 py-1.5 bg-void border border-charcoal-200 text-textmuted hover:text-textmain hover:border-charcoal-100 font-mono text-[11px] uppercase tracking-widest transition-colors"
            vid="149"
            data-chrome="export-db"
          >
            {WORKBENCH_CHROME.exportDb}
          </button>
          <button
            className="px-4 py-1.5 bg-void border border-emerald-900/50 text-emerald-500 hover:bg-emerald-950/20 hover:border-emerald-700 font-mono text-[11px] uppercase tracking-widest transition-colors"
            vid="150"
            data-chrome="run-sim"
          >
            {WORKBENCH_CHROME.runSim}
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
  const sockets = useWorkbenchSockets();
  const phylum = useFocus(
    sockets.taxon,
    socketAt<TaxonSocket, TaxonSocket['phylum']>(sockets.taxon.lens.phylum)
  );
  const taxonClass = useFocus(
    sockets.taxon,
    socketAt<TaxonSocket, TaxonSocket['class']>(sockets.taxon.lens.class)
  );
  const order = useFocus(
    sockets.taxon,
    socketAt<TaxonSocket, TaxonSocket['order']>(sockets.taxon.lens.order)
  );
  const family = useFocus(
    sockets.taxon,
    socketAt<TaxonSocket, TaxonSocket['family']>(sockets.taxon.lens.family)
  );
  const taxon = {
    phylum: preferLiveWell(view.taxon.phylum, textWellOf(phylum)),
    class: preferLiveWell(view.taxon.class, textWellOf(taxonClass)),
    order: preferLiveWell(view.taxon.order, textWellOf(order)),
    family: preferLiveWell(view.taxon.family, textWellOf(family)),
  };
  return (
    <div className="space-y-3" vid="173">
      <div
        className="flex items-center justify-between border-b border-charcoal-300 pb-1.5"
        vid="174"
      >
        <Kicker
          className="font-mono text-[10px] uppercase tracking-widest text-textdim"
          vid="175"
          data-chrome="classification"
          tone="dim"
          style={labTextPaint}
        >
          {WORKBENCH_CHROME.classification}
        </Kicker>
        <i className="ph ph-dna text-textdim" vid="176"></i>
      </div>
      <div className="space-y-1.5 font-mono text-xs" vid="177">
        <WorkbenchPropertyRow
          rowVid="178"
          labelVid="179"
          valueVid="180"
          label={WORKBENCH_CHROME.phylum}
          value={rankWell(taxon.phylum)}
          valueTestId="taxon-phylum"
          socket="taxon-phylum"
        />
        <WorkbenchPropertyRow
          rowVid="181"
          labelVid="182"
          valueVid="183"
          label={WORKBENCH_CHROME.class}
          value={rankWell(taxon.class)}
          valueTestId="taxon-class"
          socket="taxon-class"
        />
        <WorkbenchPropertyRow
          rowVid="184"
          labelVid="185"
          valueVid="186"
          label={WORKBENCH_CHROME.order}
          value={rankWell(taxon.order)}
          valueTestId="taxon-order"
          socket="taxon-order"
        />
        <WorkbenchPropertyRow
          rowVid="187"
          labelVid="188"
          valueVid="189"
          label={WORKBENCH_CHROME.family}
          value={rankWell(taxon.family)}
          valueTestId="taxon-family"
          socket="taxon-family"
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
  const sockets = useWorkbenchSockets();
  const tensile = useFocus(
    sockets.metrics,
    socketAt<MetricsSocket, MetricsSocket['tensile']>(
      sockets.metrics.lens.tensile
    )
  );
  const density = useFocus(
    sockets.metrics,
    socketAt<MetricsSocket, MetricsSocket['density']>(
      sockets.metrics.lens.density
    )
  );
  const hardness = useFocus(
    sockets.metrics,
    socketAt<MetricsSocket, MetricsSocket['hardness']>(
      sockets.metrics.lens.hardness
    )
  );
  const overlap = useFocus(
    sockets.metrics,
    socketAt<MetricsSocket, MetricsSocket['overlap']>(
      sockets.metrics.lens.overlap
    )
  );
  const noteSlot = useFocus(
    sockets.metrics,
    socketAt<MetricsSocket, MetricsSocket['note']>(sockets.metrics.lens.note)
  );
  const liveNote = metricsNoteOf(view);
  const note =
    liveNote.length > 0 ? liveNote : wellText(textWellOf(noteSlot));
  return (
    <div className="space-y-3" vid="190">
      <div
        className="flex items-center justify-between border-b border-charcoal-300 pb-1.5"
        vid="191"
      >
        <Kicker
          className="font-mono text-[10px] uppercase tracking-widest text-textdim"
          vid="192"
          data-chrome="structural-metrics"
          tone="dim"
          style={labTextPaint}
        >
          {WORKBENCH_CHROME.structuralMetrics}
        </Kicker>
        <i className="ph ph-hexagon text-textdim" vid="193"></i>
      </div>
      <div className="space-y-1.5 font-mono text-xs" vid="194">
        <WorkbenchPropertyRow
          rowVid="195"
          labelVid="196"
          valueVid="197"
          label={WORKBENCH_CHROME.tensile}
          value={wellText(textWellOf(tensile))}
          socket="metrics-tensile"
        />
        <WorkbenchPropertyRow
          rowVid="198"
          labelVid="199"
          valueVid="200"
          label={WORKBENCH_CHROME.density}
          value={wellText(textWellOf(density))}
          socket="metrics-density"
        />
        <WorkbenchPropertyRow
          rowVid="201"
          labelVid="202"
          valueVid="203"
          label={WORKBENCH_CHROME.hardness}
          value={wellText(textWellOf(hardness))}
          socket="metrics-hardness"
        />
        <WorkbenchPropertyRow
          rowVid="204"
          labelVid="205"
          valueVid="206"
          label={WORKBENCH_CHROME.overlap}
          value={wellText(textWellOf(overlap))}
          socket="metrics-overlap"
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
          data-socket="metrics-note"
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
  const sockets = useWorkbenchSockets();
  const first = useFocus(
    sockets.observation,
    socketAt<ObservationSocket, ObservationSocket['first']>(
      sockets.observation.lens.first
    )
  );
  const second = useFocus(
    sockets.observation,
    socketAt<ObservationSocket, ObservationSocket['second']>(
      sockets.observation.lens.second
    )
  );
  const updated = useFocus(
    sockets.lastUpdated,
    socketAt<LastUpdatedSocket, LastUpdatedSocket['well']>(
      sockets.lastUpdated.lens.well
    )
  );
  const observations = [
    preferLiveWell(view.observations[0], textWellOf(first)),
    preferLiveWell(view.observations[1], textWellOf(second)),
  ] as const;
  const createdAt = preferLiveWell(view.createdAt, createdAtWellOf(updated));
  const observationLines = observations.flatMap((observation) =>
    observation.kind === 'value' ? [observation.text] : []
  );
  const w7 = view.w7.kind === 'value' ? view.w7.lines : [];
  const lines = [...observationLines, ...w7];
  return (
    <div className="space-y-3" vid="210">
      <div
        className="flex items-center justify-between border-b border-charcoal-300 pb-1.5"
        vid="211"
      >
        <Kicker
          className="font-mono text-[10px] uppercase tracking-widest text-textdim"
          vid="212"
          data-chrome="observation-log"
          tone="dim"
          style={labTextPaint}
        >
          {WORKBENCH_CHROME.observationLog}
        </Kicker>
        <i className="ph ph-terminal-window text-textdim" vid="213"></i>
      </div>
      <div
        className={`font-sans text-xs text-textmuted leading-relaxed tracking-tight space-y-3 ${
          lines.length === 0 ? 'workbench-empty-observation-body' : ''
        }`}
        vid="214"
      >
        {lines.length === 0
          ? [215, 216].map((sourceVid, index) => (
              <p
                key={sourceVid}
                vid={String(sourceVid)}
                data-socket={index === 0 ? 'observation-first' : 'observation-second'}
              ></p>
            ))
          : lines.map((line, index) => (
              <p
                key={`${index}:${line}`}
                data-testid={index < observationLines.length ? 'observation' : 'w7'}
                data-socket={
                  index === 0
                    ? 'observation-first'
                    : index === 1
                      ? 'observation-second'
                      : undefined
                }
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
        <Label
          vid="218"
          data-chrome="last-updated"
          style={labTextPaint}
        >
          {WORKBENCH_CHROME.lastUpdated}
        </Label>
        {createdAt.kind === 'empty' ? (
          <Socket
            className="workbench-empty-timestamp"
            style={labBoxPaint}
          >
            <span vid="219" data-socket="last-updated">
              {''}
            </span>
          </Socket>
        ) : (
          <span vid="219" data-socket="last-updated">
            {wellText(createdAt)}
          </span>
        )}
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
          data-chrome="properties-log"
        >
          {WORKBENCH_CHROME.propertiesLog}
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
  const sockets = useMemo(() => createWorkbenchSockets(), []);
  return (
    <WorkbenchSocketsContext.Provider value={sockets}>
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
    </WorkbenchSocketsContext.Provider>
  );
}
