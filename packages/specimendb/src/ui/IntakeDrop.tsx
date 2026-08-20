/**
 * IntakeDrop — compound drop/pick zone. Calls SpecimenRpcs.Intake.
 * Visual: Variant Terminal (Initiate_Intake_Protocol + tech-grid).
 *
 * @module @tmnl/specimendb/ui
 */

import { createContext, useContext, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';
import { useFocus } from '@tmnl/stx';
import { at, type CatalogState, type CatalogSurface } from './catalog-stx.js';
import './catalog.css';

const IntakeDropContext = createContext<CatalogSurface | null>(null);

const useIntakeDrop = (): CatalogSurface => {
  const ctx = useContext(IntakeDropContext);
  if (ctx === null) {
    throw new Error('IntakeDrop compound components must be used within IntakeDrop');
  }
  return ctx;
};

export type IntakeDropProps = {
  readonly catalog: CatalogSurface;
  readonly children?: ReactNode;
};

function IntakeDropRoot({ catalog, children }: IntakeDropProps) {
  return (
    <IntakeDropContext.Provider value={catalog}>
      <section className="sdb-intake" data-testid="intake-drop">
        {children ?? (
          <>
            <IntakeDropHeader />
            <IntakeDropZone />
            <IntakeDropHint />
          </>
        )}
      </section>
    </IntakeDropContext.Provider>
  );
}

function IntakeDropHeader() {
  return (
    <div className="sdb-intake-header">
      <span className="sdb-kicker-title">Local Catalog</span>
    </div>
  );
}

function IntakeDropZone() {
  const catalog = useIntakeDrop();
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const intakeStatus = useFocus(
    catalog.store,
    at<CatalogState['intakeStatus']>(catalog.store.lens.intakeStatus),
  );
  const intakeError = useFocus(
    catalog.store,
    at<CatalogState['intakeError']>(catalog.store.lens.intakeError),
  );

  const take = (files: FileList | Iterable<File> | null) => {
    if (files === null) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    void catalog.intakeFiles(list);
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setActive(false);
    take(event.dataTransfer.files);
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    take(event.target.files);
    event.target.value = '';
  };

  return (
    <>
      <button
        type="button"
        className="sdb-zone tech-grid"
        data-testid="intake-zone"
        data-active={active ? 'true' : 'false'}
        data-status={intakeStatus}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={onDrop}
      >
        <span className="sdb-zone-protocol">
          {intakeStatus === 'dropping' ? 'INTAKE_IN_FLIGHT' : 'Initiate_Intake_Protocol'}
        </span>
        <span className="sdb-zone-sub">DRAG FIELD ASSETS OR RAW DATA PACKETS HERE</span>
      </button>
      <input
        ref={inputRef}
        className="sdb-file-input"
        data-testid="intake-file"
        type="file"
        multiple
        onChange={onChange}
      />
      {intakeError !== null ? (
        <p className="sdb-error" data-testid="intake-error">
          {intakeError}
        </p>
      ) : null}
    </>
  );
}

function IntakeDropHint() {
  return (
    <p className="sdb-hint">
      System accepts .raw, .tiff, .csv telemetry, and standardized sequencing archives. EXIF extraction is automatic.
      Locality is unknown unless the file has real EXIF GPS.
    </p>
  );
}

export const IntakeDrop = Object.assign(IntakeDropRoot, {
  Header: IntakeDropHeader,
  Zone: IntakeDropZone,
  Hint: IntakeDropHint,
});
