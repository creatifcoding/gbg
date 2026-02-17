import {
  createContext,
  useContext,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

interface AnnotationPopoverNoteComposerState {
  draft: string;
  resolvedText: string;
}

interface AnnotationPopoverNoteComposerActions {
  updateDraft: (nextValue: string) => void;
  startEdit: () => void;
  save: () => void;
  cancel: () => void;
}

interface AnnotationPopoverNoteComposerMeta {
  isEditing: boolean;
}

interface AnnotationPopoverNoteComposerContextValue {
  state: AnnotationPopoverNoteComposerState;
  actions: AnnotationPopoverNoteComposerActions;
  meta: AnnotationPopoverNoteComposerMeta;
}

const AnnotationPopoverNoteComposerContext =
  createContext<AnnotationPopoverNoteComposerContextValue | null>(null);

function useAnnotationPopoverNoteComposer() {
  const context = useContext(AnnotationPopoverNoteComposerContext);

  if (!context) {
    throw new Error(
      'AnnotationPopoverNoteComposer compound components must be used inside AnnotationPopoverNoteComposer.Root'
    );
  }

  return context;
}

interface RootProps extends PropsWithChildren {
  state: AnnotationPopoverNoteComposerState;
  actions: AnnotationPopoverNoteComposerActions;
  meta: AnnotationPopoverNoteComposerMeta;
}

function Root({ state, actions, meta, children }: RootProps) {
  return (
    <AnnotationPopoverNoteComposerContext.Provider
      value={{ state, actions, meta }}
    >
      {children}
    </AnnotationPopoverNoteComposerContext.Provider>
  );
}

function Frame({ children }: PropsWithChildren) {
  const {
    meta: { isEditing },
  } = useAnnotationPopoverNoteComposer();

  return (
    <div
      className="mt-3 flex flex-col gap-3"
      data-note-editing={isEditing ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}

function ReadText() {
  const { state } = useAnnotationPopoverNoteComposer();

  return (
    <p
      className="text-tmnl-text-secondary leading-relaxed whitespace-pre-wrap"
      style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
    >
      {state.resolvedText || 'No note content yet.'}
    </p>
  );
}

function Textarea() {
  const {
    state: { draft },
    actions: { updateDraft },
    meta: { isEditing },
  } = useAnnotationPopoverNoteComposer();

  return (
    <textarea
      aria-label="Annotation note editor"
      className="annotation-popover-note-textarea w-full min-h-36 rounded-md border border-tmnl-border bg-tmnl-surface-0 px-3.5 py-2.5 text-tmnl-text-primary outline-none transition-colors focus:border-tmnl-accent-primary"
      onChange={(event) => updateDraft(event.target.value)}
      readOnly={!isEditing}
      spellCheck={false}
      style={{
        fontSize: 'var(--tmnl-text-base, 16px)',
        lineHeight: '1.5',
      }}
      value={draft}
    />
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2">{children}</div>;
}

function EditButton() {
  const {
    actions: { startEdit },
  } = useAnnotationPopoverNoteComposer();

  return (
    <button
      className="rounded-md border border-tmnl-border px-3 py-1.5 text-tmnl-text-secondary hover:bg-tmnl-surface-2"
      onClick={startEdit}
      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      type="button"
    >
      Edit note
    </button>
  );
}

function CancelButton() {
  const {
    actions: { cancel },
  } = useAnnotationPopoverNoteComposer();

  return (
    <button
      className="rounded-md border border-tmnl-border px-3 py-1.5 text-tmnl-text-secondary hover:bg-tmnl-surface-2"
      onClick={cancel}
      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      type="button"
    >
      Cancel
    </button>
  );
}

function SaveButton() {
  const {
    actions: { save },
  } = useAnnotationPopoverNoteComposer();

  return (
    <button
      className="rounded-md bg-tmnl-accent-primary px-3.5 py-1.5 font-medium text-tmnl-surface-0 hover:bg-tmnl-accent-primary/90"
      onClick={save}
      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      type="button"
    >
      Save
    </button>
  );
}

export const AnnotationPopoverNoteComposer = Object.assign(Root, {
  Root,
  Frame,
  ReadText,
  Textarea,
  Actions,
  EditButton,
  CancelButton,
  SaveButton,
});
