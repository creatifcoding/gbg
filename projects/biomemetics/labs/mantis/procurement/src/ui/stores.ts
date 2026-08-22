import { stx, type StxLens } from '@tmnl/stx';

export type SelectedRowState = {
  id: string | null;
};

export type ReceiveDraftState = {
  partId: string | null;
  qty: string;
};

export type BuyAttemptState = {
  partId: string | null;
  copy: string | null;
};

export const selectedRow = stx<SelectedRowState>({ id: null });

export const receiveDraft = stx<ReceiveDraftState>({
  partId: null,
  qty: '',
});

export const buyAttempt = stx<BuyAttemptState>({
  partId: null,
  copy: null,
});

export const at = <S extends object, A>(lens: StxLens<S, A>): StxLens<S, A> =>
  lens;
