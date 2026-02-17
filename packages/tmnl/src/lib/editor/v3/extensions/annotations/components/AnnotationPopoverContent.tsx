import {
  createContext,
  useContext,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { ExternalLink, Pin, PinOff, X } from 'lucide-react';

import type { PopoverContent as PopoverContentType } from '../services';
import { AnnotationPopoverNoteComposer } from './AnnotationPopoverNoteComposer';

interface AnnotationPopoverContentState {
  content: PopoverContentType;
  isEditingNote: boolean;
  isNoteIntent: boolean;
  noteDraft: string;
  resolvedNoteText: string;
  isPinned: boolean;
}

interface AnnotationPopoverContentActions {
  close: () => void;
  pin: () => void;
  action: () => void;
  startEdit: () => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  draftChange: (value: string) => void;
}

interface AnnotationPopoverContentMeta {
  icon: ReactNode;
  showPin: boolean;
  showClose: boolean;
}

interface AnnotationPopoverContentContextValue {
  state: AnnotationPopoverContentState;
  actions: AnnotationPopoverContentActions;
  meta: AnnotationPopoverContentMeta;
}

const AnnotationPopoverContentContext =
  createContext<AnnotationPopoverContentContextValue | null>(null);

function useAnnotationPopoverContent() {
  const context = useContext(AnnotationPopoverContentContext);

  if (!context) {
    throw new Error(
      'AnnotationPopoverContent compounds must be used inside AnnotationPopoverContent.Root'
    );
  }

  return context;
}

interface RootProps extends PropsWithChildren {
  state: AnnotationPopoverContentState;
  actions: AnnotationPopoverContentActions;
  meta: AnnotationPopoverContentMeta;
}

function Root({ state, actions, meta, children }: RootProps) {
  return (
    <AnnotationPopoverContentContext.Provider value={{ state, actions, meta }}>
      {children}
    </AnnotationPopoverContentContext.Provider>
  );
}

function Header() {
  const {
    state: { content, isPinned },
    actions: { close, pin },
    meta: { icon, showPin, showClose },
  } = useAnnotationPopoverContent();

  return (
    <div className="flex items-center justify-between gap-3">
      <div
        className="flex items-center gap-2.5 font-medium"
        style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
      >
        <span className="text-tmnl-accent-primary">{icon}</span>
        {content.href ? (
          <a
            className="inline-flex items-center gap-1.5 hover:underline text-tmnl-text-primary"
            href={content.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span>{content.title}</span>
            <ExternalLink className="h-4 w-4 opacity-70" />
          </a>
        ) : (
          <span className="text-tmnl-text-primary">{content.title}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {showPin && (
          <button
            className="p-2 rounded border border-tmnl-border bg-tmnl-surface-0 hover:bg-tmnl-surface-2 hover:border-tmnl-border-hover transition-colors"
            onClick={pin}
            title={isPinned ? 'Unpin' : 'Pin'}
            type="button"
          >
            {isPinned ? (
              <PinOff className="h-4 w-4 text-tmnl-accent-primary" />
            ) : (
              <Pin className="h-4 w-4 text-tmnl-text-muted" />
            )}
          </button>
        )}

        {showClose && (
          <button
            className="p-2 rounded border border-tmnl-border bg-tmnl-surface-0 hover:bg-tmnl-surface-2 hover:border-tmnl-border-hover transition-colors"
            onClick={close}
            title="Close"
            type="button"
          >
            <X className="h-4 w-4 text-tmnl-text-muted" />
          </button>
        )}
      </div>
    </div>
  );
}

function NoteBody() {
  const {
    state: { noteDraft, resolvedNoteText, isEditingNote },
    actions: { draftChange, startEdit, saveEdit, cancelEdit },
  } = useAnnotationPopoverContent();

  return (
    <AnnotationPopoverNoteComposer.Root
      actions={{
        updateDraft: draftChange,
        startEdit,
        save: saveEdit,
        cancel: cancelEdit,
      }}
      meta={{ isEditing: isEditingNote }}
      state={{
        draft: noteDraft,
        resolvedText: resolvedNoteText,
      }}
    >
      <AnnotationPopoverNoteComposer.Frame>
        {isEditingNote ? (
          <>
            <AnnotationPopoverNoteComposer.Textarea />
            <AnnotationPopoverNoteComposer.Actions>
              <AnnotationPopoverNoteComposer.CancelButton />
              <AnnotationPopoverNoteComposer.SaveButton />
            </AnnotationPopoverNoteComposer.Actions>
          </>
        ) : (
          <>
            <AnnotationPopoverNoteComposer.ReadText />
            <AnnotationPopoverNoteComposer.Actions>
              <AnnotationPopoverNoteComposer.EditButton />
            </AnnotationPopoverNoteComposer.Actions>
          </>
        )}
      </AnnotationPopoverNoteComposer.Frame>
    </AnnotationPopoverNoteComposer.Root>
  );
}

function StandardBody() {
  const {
    state: { content },
    actions: { action },
  } = useAnnotationPopoverContent();

  return (
    <>
      {content.description && (
        <p
          className="mt-3 text-tmnl-text-secondary leading-relaxed"
          style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
        >
          {content.description}
        </p>
      )}

      {(content.meta || content.actionLabel) && (
        <div className="mt-4 flex items-center justify-between gap-3">
          {content.meta ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-tmnl-surface-2 px-2.5 py-1 text-tmnl-text-muted"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {content.meta}
            </span>
          ) : (
            <span />
          )}

          {content.actionLabel && (
            <button
              className="inline-flex items-center gap-1.5 rounded-full bg-tmnl-accent-primary px-4 py-2 font-medium text-tmnl-surface-0 transition-colors hover:bg-tmnl-accent-primary/90"
              onClick={action}
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              type="button"
            >
              {content.actionLabel}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function Body() {
  const {
    state: { isNoteIntent },
  } = useAnnotationPopoverContent();

  return isNoteIntent ? <NoteBody /> : <StandardBody />;
}

export const AnnotationPopoverContent = Object.assign(Root, {
  Root,
  Header,
  Body,
  NoteBody,
  StandardBody,
});
