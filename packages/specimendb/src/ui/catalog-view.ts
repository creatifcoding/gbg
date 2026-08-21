/**
 * Fill now-slots from real Specimen components only.
 * Claim is Claim or empty. Filename is a media well label, not a claim.
 * Tag chips stay empty until someone attaches a Tag (when).
 */

import { mediaOf, type Specimen } from '../schemas/specimen.js';

export const EMPTY_TAG_SLOTS = ['', '', ''] as const;

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
