import {
  Grid,
  HeaderCell,
  Mono,
  Socket,
  SocketCell,
  ValueCell,
  Kicker,
} from '@gbg/lab-ui';
import { createFileRoute } from '@tanstack/react-router';
import { useFocus } from '@tmnl/stx';
import { getReceive } from '../server/fns';
import type { ReceivePayload } from '../store/book';
import { Board, BoardKicker, Inspector, gridFill } from '../ui/board';
import { at, receiveDraft } from '../ui/stores';

export const Route = createFileRoute('/receive')({
  loader: () => getReceive(),
  component: ReceivePage,
});

const lotColumns = [
  {
    field: 'receipt_id',
    headerName: 'Receipt',
    headerComponent: HeaderCell,
    cellRenderer: ValueCell,
    flex: 1,
  },
  {
    field: 'po',
    headerName: 'PO',
    headerComponent: HeaderCell,
    cellRenderer: SocketCell,
    width: 140,
  },
  {
    field: 'lot_id',
    headerName: 'Lot',
    headerComponent: HeaderCell,
    cellRenderer: ValueCell,
    flex: 1,
  },
  {
    field: 'part_id',
    headerName: 'ID',
    headerComponent: HeaderCell,
    cellRenderer: ValueCell,
    width: 72,
  },
  {
    field: 'qty',
    headerName: 'Qty',
    headerComponent: HeaderCell,
    cellRenderer: ValueCell,
    width: 96,
  },
];

function ReceivePage() {
  const { receipts, lots }: ReceivePayload = Route.useLoaderData();
  const draftPart = useFocus(receiveDraft, at(receiveDraft.lens.partId));
  const draftQty = useFocus(receiveDraft, at(receiveDraft.lens.qty));

  const rows = lots.map((lot) => ({
    receipt_id: lot.receipt_id ?? '',
    po: '',
    lot_id: lot.lot_id,
    part_id: lot.part_id,
    qty: lot.qty ?? '',
  }));

  return (
    <Board>
      <BoardKicker>
        Receipt and lot. Blank until something actually arrives. Nothing has been
        received.
      </BoardKicker>
      <Inspector>
        <Kicker>Receive draft</Kicker>
        <Socket aria-label="part">{draftPart ?? undefined}</Socket>
        <Socket aria-label="qty">{draftQty === '' ? undefined : draftQty}</Socket>
      </Inspector>
      {receipts.length === 0 && lots.length === 0 ? (
        <Inspector>
          <Socket aria-label="receipt" />
          <Socket aria-label="lot" />
          <Mono>No receipts. No lots.</Mono>
        </Inspector>
      ) : (
        <div style={{ flex: 1, minHeight: gridFill.minHeight }}>
          <Grid
            columnDefs={lotColumns}
            rowData={rows}
            getRowId={(params: { data?: { lot_id?: string } }) =>
              String(params.data?.lot_id ?? '')
            }
            suppressCellFocus
            style={gridFill}
          />
        </div>
      )}
    </Board>
  );
}
