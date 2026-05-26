import { useMemo, useState } from 'react';
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../../../components/ui/table';
import { Input } from '../../../../../../components/ui/input';
import { Search } from 'lucide-react';
import { receivableColumns } from './receivables-columns';
import { DataTableView, TablePaginationBar } from '../../../../../../components/ui/data-table-view';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);

export function ReceivablesTable({ data, loading, isFinanceV1 = false }) {
  if (isFinanceV1) {
    return <ReceivablesTableV1 data={data} loading={loading} />;
  }

  return <ReceivablesTableV2 data={data} loading={loading} />;
}

function ReceivablesTableV1({ data, loading }) {
  const [search, setSearch] = useState('');

  const rows = Array.isArray(data) ? data : [];
  const normalizedSearch = search.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((row) => {
      const haystack = [
        row.full_name,
        row.name,
        row.sid,
        row.level_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [rows, normalizedSearch]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.totalAssessment += Number(row.total_fees || 0);
        acc.totalDiscount += Number(row.discount || 0);
        acc.totalNetAssessed += Number(row.net_assessed || 0);
        acc.totalPayment += Number(row.total_paid || 0);
        acc.totalBalance += Number(row.balance || 0);
        return acc;
      },
      {
        totalAssessment: 0,
        totalDiscount: 0,
        totalNetAssessed: 0,
        totalPayment: 0,
        totalBalance: 0,
      }
    );
  }, [filteredRows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading receivables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <div className="relative w-[220px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-md border bg-background">
        <div className="h-[520px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs font-semibold text-muted-foreground">
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead className="w-[120px] text-center">ID</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead className="w-[120px] text-center">Level</TableHead>
                <TableHead className="w-[80px] text-center">Units</TableHead>
                <TableHead className="w-[140px] text-right">Total Assessment</TableHead>
                <TableHead className="w-[120px] text-right">Discount</TableHead>
                <TableHead className="w-[140px] text-right">Net Assessed</TableHead>
                <TableHead className="w-[140px] text-right">Total Payment</TableHead>
                <TableHead className="w-[120px] text-right">Balance</TableHead>
              </TableRow>
              <TableRow className="bg-muted/30 text-xs font-semibold">
                <TableHead colSpan={5} className="text-right">
                  TOTAL
                </TableHead>
                <TableHead className="text-right">
                  {formatCurrency(totals.totalAssessment)}
                </TableHead>
                <TableHead className="text-right">
                  {formatCurrency(totals.totalDiscount)}
                </TableHead>
                <TableHead className="text-right">
                  {formatCurrency(totals.totalNetAssessed)}
                </TableHead>
                <TableHead className="text-right">
                  {formatCurrency(totals.totalPayment)}
                </TableHead>
                <TableHead className="text-right">
                  {formatCurrency(totals.totalBalance)}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length ? (
                filteredRows.map((row, index) => (
                  <TableRow key={`${row.id}-${row.sid || index}`} className="text-xs">
                    <TableCell className="text-center">{index + 1}</TableCell>
                    <TableCell className="text-center">{row.sid || '-'}</TableCell>
                    <TableCell className="font-medium">
                      {row.full_name || row.name || row.sid || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-center">{row.level_name || '-'}</TableCell>
                    <TableCell className="text-center">{row.units ?? ''}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.total_fees)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.discount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.net_assessed)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.total_paid)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.balance)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    No students found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function ReceivablesTableV2({ data, loading }) {
  const [columnVisibility, setColumnVisibility] = useState({});
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([{ id: 'total_fees', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data: data || [],
    columns: receivableColumns,
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
          <p className="text-sm text-muted-foreground">Loading receivables...</p>
        </div>
      </div>
    );
  }

  const filteredRows = table.getFilteredRowModel().rows;
  const totalPayables = filteredRows.reduce((sum, row) => sum + Number(row.original.total_fees || 0), 0);
  const totalPaid = filteredRows.reduce((sum, row) => sum + Number(row.original.total_paid || 0), 0);
  const totalBalance = filteredRows.reduce((sum, row) => sum + Number(row.original.balance || 0), 0);
  const totalOverpayment = filteredRows.reduce(
    (sum, row) => sum + Number(row.original.overpayment || 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">{filteredRows.length}</span> students
          </div>
          <div className="text-muted-foreground">
            Payables: <span className="font-semibold text-foreground">{formatCurrency(totalPayables)}</span>
          </div>
          <div className="text-muted-foreground">
            Paid: <span className="font-semibold text-emerald-700">{formatCurrency(totalPaid)}</span>
          </div>
          <div className="text-muted-foreground">
            Balance: <span className="font-semibold text-rose-700">{formatCurrency(totalBalance)}</span>
          </div>
          {totalOverpayment > 0 && (
            <div className="text-muted-foreground">
              Overpaid: <span className="font-semibold text-amber-700">{formatCurrency(totalOverpayment)}</span>
            </div>
          )}
        </div>
      </div>

      <DataTableView
        table={table}
        columns={receivableColumns}
        emptyMessage={
          <div className="text-muted-foreground">
            <p>No receivables found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        }
      />

      <TablePaginationBar table={table} />
    </div>
  );
}
