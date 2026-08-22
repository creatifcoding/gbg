import {
  Grid,
  HeaderCell,
  SocketCell,
  Table,
  ValueCell,
} from '@gbg/lab-ui';
import { createFileRoute } from '@tanstack/react-router';
import { useFocus, useStxSet } from '@tmnl/stx';
import { getRegister } from '../server/fns';
import type { RegisterPayload } from '../store/book';
import { Board, BoardKicker, gridFill } from '../ui/board';
import { ClassCell } from '../ui/cells';
import { at, selectedRow } from '../ui/stores';

export const Route = createFileRoute('/register')({
  loader: () => getRegister(),
  component: RegisterPage,
});

const registerColumns = [
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
    field: 'class',
    headerName: 'Class',
    headerComponent: HeaderCell,
    cellRenderer: ClassCell,
    width: 140,
  },
  {
    field: 'sku',
    headerName: 'SKU',
    headerComponent: HeaderCell,
    cellRenderer: SocketCell,
    width: 140,
  },
  {
    field: 'notes',
    headerName: 'Notes',
    headerComponent: HeaderCell,
    cellRenderer: ValueCell,
    flex: 1,
    minWidth: 240,
  },
];

const alternateColumns = [
  { accessorKey: 'part_id', header: 'ID' },
  { accessorKey: 'name', header: 'Item' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'notes', header: 'Notes' },
];

const whereColumns = [
  { accessorKey: 'parent_id', header: 'Parent' },
  { accessorKey: 'relation', header: 'Relation' },
  { accessorKey: 'child_id', header: 'Child' },
];

function RegisterPage() {
  const { parts, skus, alternates, whereUsed }: RegisterPayload =
    Route.useLoaderData();
  const selectedId = useFocus(selectedRow, at(selectedRow.lens.id));
  const { setAt, lens } = useStxSet(selectedRow);

  const rows = parts.map((part) => {
    const sku = skus.find((row) => row.balloon_id === part.balloon_id);
    return {
      balloon_id: part.balloon_id,
      name: part.name,
      qty_text: part.qty_text,
      class: part.class ?? '',
      sku: sku?.mpn ?? '',
      notes: part.notes,
    };
  });

  const alternateRows = alternates.map((alt) => ({
    part_id: alt.part_id,
    name: alt.name,
    status: alt.status,
    sku: alt.mpn ?? '',
    notes: alt.notes,
  }));

  const whereRows = whereUsed.map((row) => ({
    parent_id: row.parent_id,
    relation: row.relation,
    child_id: row.child_id,
  }));

  return (
    <Board>
      <BoardKicker>
        Balloon register B01–B52. Qty stays text. Class is a slot, not a buy.
        Manufacturer SKU sockets stay blank until a real MPN exists.
      </BoardKicker>
      <div
        data-region="register-table"
        style={{ flex: 1, minHeight: gridFill.minHeight }}
      >
        <Grid
          columnDefs={registerColumns}
          rowData={rows}
          getRowId={(params: { data?: { balloon_id?: string } }) =>
            String(params.data?.balloon_id ?? '')
          }
          rowSelection="single"
          suppressCellFocus
          onRowClicked={(event: { data?: { balloon_id?: string } }) => {
            const id = event.data?.balloon_id;
            if (typeof id === 'string') {
              setAt(lens.id, id);
            }
          }}
          onGridReady={(event: {
            api: { getRowNode: (id: string) => { setSelected: (value: boolean) => void } | undefined };
          }) => {
            if (selectedId) {
              event.api.getRowNode(selectedId)?.setSelected(true);
            }
          }}
          style={gridFill}
        />
      </div>
      <BoardKicker>Rejected alternate</BoardKicker>
      <Table columns={alternateColumns} data={alternateRows} />
      <BoardKicker>Where used. Design relationships only.</BoardKicker>
      <Table columns={whereColumns} data={whereRows} />
    </Board>
  );
}
