import { parsePartClass, type PartClass } from './gate';

export type BalloonDraft = {
  balloonId: string;
  name: string;
  qtyText: string;
  class: PartClass | null;
  notes: string;
};

const CLASS_LEAD =
  /^(REF|LOCK|UNVERIFIED|DRAFT|orderable)(?:\b|[;:])\s*(.*)$/s;

const ROW =
  /^\|\s*(B\d{2})\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/;

export const parseStatusNote = (
  balloonId: string,
  statusNote: string,
): { class: PartClass | null; notes: string } => {
  const trimmed = statusNote.trim();

  if (balloonId === 'B42') {
    return { class: null, notes: trimmed };
  }

  if (balloonId === 'B36') {
    return { class: 'UNVERIFIED', notes: trimmed };
  }

  if (balloonId === 'B09') {
    return { class: 'REF', notes: trimmed };
  }

  const lead = CLASS_LEAD.exec(trimmed);
  if (lead) {
    const token = parsePartClass(lead[1] ?? null);
    const leftover = (lead[2] ?? '').replace(/^;\s*/, '').trim();
    return { class: token, notes: leftover };
  }

  return { class: null, notes: trimmed };
};

export const parseBomTable = (markdown: string): BalloonDraft[] => {
  const balloons: BalloonDraft[] = [];
  for (const line of markdown.split('\n')) {
    const row = ROW.exec(line);
    if (!row) {
      continue;
    }
    const balloonId = row[1] ?? '';
    const name = (row[2] ?? '').trim();
    const qtyText = (row[3] ?? '').trim();
    const statusNote = (row[4] ?? '').trim();
    if (!/^B\d{2}$/.test(balloonId)) {
      continue;
    }
    const parsed = parseStatusNote(balloonId, statusNote);
    balloons.push({
      balloonId,
      name,
      qtyText,
      class: parsed.class,
      notes: parsed.notes,
    });
  }
  return balloons;
};

export const expectedBalloonIds = (): string[] => {
  const ids: string[] = [];
  for (let n = 1; n <= 52; n += 1) {
    ids.push(`B${String(n).padStart(2, '0')}`);
  }
  return ids;
};
