import { useState } from 'react';
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Input } from '../../../../../../components/ui/input';
import { Button } from '../../../../../../components/ui/button';
import { Search } from 'lucide-react';
import { transactionColumns } from './transaction-columns';
import { DataTableView, TablePaginationBar } from '../../../../../../components/ui/data-table-view';

export function TransactionTable({ data, loading }) {
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState({});
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([{ id: 'transdate', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data: data || [],
    columns: transactionColumns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: 'includesString',
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading transactions...</p>
        </div>
      </div>
    );
  }

  const totalAmount = (data || []).reduce((sum, row) => {
    if (row.cancelled !== 1) {
      return sum + parseFloat(row.totalamount || 0);
    }
    return sum;
  }, 0);

  const cancelledAmount = (data || []).reduce((sum, row) => {
    if (row.cancelled === 1) {
      return sum + parseFloat(row.totalamount || 0);
    }
    return sum;
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">
              {table.getFilteredRowModel().rows.length}
            </span>{' '}
            transactions
          </div>
          <div className="text-muted-foreground">
            Total:{' '}
            <span className="font-semibold text-foreground">
              {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(totalAmount)}
            </span>
          </div>
          {cancelledAmount > 0 && (
            <div className="text-muted-foreground">
              Cancelled:{' '}
              <span className="font-semibold text-destructive">
                {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cancelledAmount)}
              </span>
            </div>
          )}
        </div>
      </div>

      <DataTableView
        table={table}
        columns={transactionColumns}
        scrollOnMobile
        rowClassName={(row) => (row.original.cancelled === 1 ? 'opacity-60' : undefined)}
        emptyMessage={
          <div className="text-muted-foreground">
            <p>No transactions found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        }
      />

      <TablePaginationBar table={table} showSelection />
    </div>
  );
}
