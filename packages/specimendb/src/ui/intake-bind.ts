import { useRef, useState, type ChangeEvent, type DragEvent, type RefObject } from 'react';
import type { CatalogSurface } from './catalog-stx.js';

export type IntakeBind = {
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly active: boolean;
  readonly open: () => void;
  readonly onDrop: (event: DragEvent<HTMLElement>) => void;
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onDragEnter: (event: DragEvent<HTMLElement>) => void;
  readonly onDragOver: (event: DragEvent<HTMLElement>) => void;
  readonly onDragLeave: () => void;
};

export const useIntakeBind = (catalog: CatalogSurface): IntakeBind => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);

  const take = (files: FileList | Iterable<File> | null) => {
    if (files === null) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    void catalog.intakeFiles(list);
  };

  return {
    inputRef,
    active,
    open: () => inputRef.current?.click(),
    onDrop: (event) => {
      event.preventDefault();
      setActive(false);
      take(event.dataTransfer.files);
    },
    onChange: (event) => {
      take(event.target.files);
      event.target.value = '';
    },
    onDragEnter: (event) => {
      event.preventDefault();
      setActive(true);
    },
    onDragOver: (event) => {
      event.preventDefault();
      setActive(true);
    },
    onDragLeave: () => setActive(false),
  };
};
