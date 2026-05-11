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
import { Search, ArrowUpDown } from 'lucide-react';
import { Input } from '../../../../../../components/ui/input';
import { Button } from '../../../../../../components/ui/button';
import { DataTableView, TablePaginationBar } from '../../../../../../components/ui/data-table-view';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0);

export function MonthlySummaryTable({ data, loading }) {
  const [columnVisibility, setColumnVisibility] = useState({});
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([{ id: 'total_amount', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');

  const totalAmount = (data || []).reduce(
    (sum, item) => sum + Number(item.total_amount || 0),
    0
  );

  const columns = [
    {
      accessorKey: 'item',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Item
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="max-w-[260px] truncate font-medium">{row.getValue('item')}</div>
      ),
    },
    {
      accessorKey: 'total_amount',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Total Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-semibold">{formatCurrency(row.getValue('total_amount'))}</div>
      ),
    },
    {
      accessorKey: 'transaction_count',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Transactions
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-sm">{formatNumber(row.getValue('transaction_count'))}</div>
      ),
    },
    {
      id: 'share',
      header: 'Share',
      cell: ({ row }) => {
        const amount = Number(row.original.total_amount || 0);
        const percent = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
        return <div className="text-sm text-muted-foreground">{percent.toFixed(1)}%</div>;
      },
    },
  ];

  const table = useReactTable({
    data: data || [],
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      globalFilter,
    },
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
          <p className="text-sm text-muted-foreground">Loading monthly items...</p>
        </div>
      </div>
    );
  }

  const filteredRows = table.getFilteredRowModel().rows;
  const filteredTotal = filteredRows.reduce(
    (sum, row) => sum + Number(row.original.total_amount || 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">{filteredRows.length}</span> items
          </div>
          <div className="text-muted-foreground">
            Total:{' '}
            <span className="font-semibold text-foreground">{formatCurrency(filteredTotal)}</span>
          </div>
        </div>
      </div>

      <DataTableView
        table={table}
        columns={columns}
        scrollOnMobile
        emptyMessage={
          <div className="text-muted-foreground">
            <p>No items found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        }
      />

      <TablePaginationBar table={table} />
    </div>
  );
}
