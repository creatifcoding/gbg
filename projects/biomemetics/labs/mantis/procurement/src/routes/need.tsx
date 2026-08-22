import { Grid, HeaderCell, SocketCell, ValueCell } from '@gbg/lab-ui';
import { createFileRoute } from '@tanstack/react-router';
import { getNeed } from '../server/fns';
import type { NeedPayload } from '../store/book';
import { Board, BoardKicker, gridFill } from '../ui/board';
import { ClassCell } from '../ui/cells';

export const Route = createFileRoute('/need')({
  loader: () => getNeed(),
  component: NeedPage,
});

const needColumns = [
  {
    field: 'balloon_id',
    headerName: 'ID',
    headerComponent: HeaderCell,
    cellRenderer: ValueCell,
    width: 72,
  },
  {
    field: 'name',
    headerName: 'Item',
    headerComponent: HeaderCell,
    cellRenderer: ValueCell,
    flex: 1,
    minWidth: 220,
  },
  {
    field: 'qty_text',
    headerName: 'Qty',
    headerComponent: HeaderCell,
    cellRenderer: ValueCell,
    width: 96,
  },
  {
    field: 'on_hand',
    headerName: 'On hand',
    headerComponent: HeaderCell,
    cellRenderer: SocketCell,
    width: 140,
  },
  {
    field: 'class',
    headerName: 'Class',
    headerComponent: HeaderCell,
    cellRenderer: ClassCell,
    width: 140,
  },
];

function NeedPage() {
  const { lines }: NeedPayload = Route.useLoaderData();
  const rows = lines.map((line) => ({
    balloon_id: line.balloon_id,
    name: line.name,
    qty_text: line.qty_text,
    on_hand: line.on_hand ?? '',
    class: line.class ?? '',
  }));

  return (
    <Board>
      <BoardKicker>
        First-tower kit versus on-hand. Demand qty is the register text. The word
        set is not an integer. On-hand stays blank until a lot exists.
      </BoardKicker>
      <div style={{ flex: 1, minHeight: gridFill.minHeight }}>
        <Grid
          columnDefs={needColumns}
          rowData={rows}
          getRowId={(params: { data?: { balloon_id?: string } }) =>
            String(params.data?.balloon_id ?? '')
          }
          suppressCellFocus
          style={gridFill}
        />
      </div>
    </Board>
  );
}
