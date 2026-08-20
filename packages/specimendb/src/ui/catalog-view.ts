/**
 * Fill now-slots from real Specimen components only.
 * Claim is Claim or empty. Filename is a media well label, not a claim.
 * Tag chips stay empty until someone attaches a Tag (when).
 */

import { exifOf, mediaOf, type Specimen } from '../schemas/specimen.js';

export const EMPTY_TAG_SLOTS = ['', '', ''] as const;

export const CATALOG_EXPORT_FILENAME = 'specimendb-catalog.json';

const EXIF_LOG_KEYS = ['DateTimeOriginal', 'Make', 'Model'] as const;

export const claimLine = (specimen: Specimen): string => {
  const claim = specimen.components.find((component) => component._tag === 'Claim');
  if (claim?._tag === 'Claim' && claim.text.length > 0) return claim.text;
  return '';
};

export const tagSlots = (specimen?: Specimen): readonly [string, string, string] => {
  const tags =
    specimen === undefined
      ? []
      : specimen.components.flatMap((component) => (component._tag === 'Tag' ? [component.value] : []));
  return [tags[0] ?? '', tags[1] ?? '', tags[2] ?? ''];
};

export const mediaLabel = (specimen?: Specimen): string => {
  const media = specimen === undefined ? undefined : mediaOf(specimen);
  return media?.filename ?? '';
};

export const imgSrcLabel = (specimen?: Specimen): string => {
  const name = mediaLabel(specimen);
  return name.length > 0 ? `IMG_SRC: ${name}` : 'IMG_SRC';
};

const exifString = (specimen: Specimen, key: (typeof EXIF_LOG_KEYS)[number]): string | undefined => {
  const value = exifOf(specimen)?.tags[key];
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

/** Make / Model / DateTimeOriginal only. GPS stays on the locality line. */
export const exifLogLines = (specimen: Specimen): ReadonlyArray<string> =>
  EXIF_LOG_KEYS.flatMap((key) => {
    const value = exifString(specimen, key);
    return value === undefined ? [] : [`${key} ${value}`];
  });

/** ISO createdAt, or DateTimeOriginal when that tag arrived. Never a fake "14m AGO". */
export const lastUpdatedLine = (specimen: Specimen | null): string => {
  if (specimen === null) return 'LAST_UPDATED';
  const fromExif = exifString(specimen, 'DateTimeOriginal');
  return `LAST_UPDATED ${fromExif ?? specimen.createdAt}`;
};

export const catalogExportPayload = (specimens: ReadonlyArray<Specimen>): string =>
  JSON.stringify(
    specimens.map((specimen) => ({
      id: specimen.id,
      createdAt: specimen.createdAt,
      components: specimen.components,
    })),
    null,
    2,
  );

export const downloadCatalogJson = (specimens: ReadonlyArray<Specimen>): void => {
  const blob = new Blob([catalogExportPayload(specimens)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = CATALOG_EXPORT_FILENAME;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
};
