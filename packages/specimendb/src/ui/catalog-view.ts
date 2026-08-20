/**
 * Fill card/detail slots from real components only.
 * Empty strings keep chrome visible. Never invent ids, GPS, or taxon.
 */

import { mediaOf, type Specimen } from '../schemas/specimen.js';

export const claimLine = (specimen: Specimen): string => {
  const claim = specimen.components.find((component) => component._tag === 'Claim');
  if (claim?._tag === 'Claim' && claim.text.length > 0) return claim.text;
  return mediaOf(specimen)?.filename ?? '';
};

export const tagValues = (specimen: Specimen): ReadonlyArray<string> =>
  specimen.components.flatMap((component) => (component._tag === 'Tag' ? [component.value] : []));

export const tagSlots = (specimen?: Specimen): readonly [string, string, string] => {
  const tags = specimen === undefined ? [] : tagValues(specimen);
  return [tags[0] ?? '', tags[1] ?? '', tags[2] ?? ''];
};

export const wellKind = (specimen?: Specimen): string => {
  const media = specimen === undefined ? undefined : mediaOf(specimen);
  if (media === undefined) return '';
  return media.kind === 'jpeg' || media.kind === 'heic' ? 'OPTICAL_SCAN' : 'FIELD_SAMPLE';
};

export const imgSrcLabel = (specimen?: Specimen): string => {
  const media = specimen === undefined ? undefined : mediaOf(specimen);
  if (media === undefined) return 'IMG_SRC';
  return `IMG_SRC: ${media.filename}`;
};
