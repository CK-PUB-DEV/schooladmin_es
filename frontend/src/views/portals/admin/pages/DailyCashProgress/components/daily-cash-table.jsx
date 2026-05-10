import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
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
import { Button } from '../../../../../../components/ui/button';
import { Search, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { dailyCashColumns } from './daily-cash-columns';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);

const getRowKey = (row) => row.row_id || row.transno || row.ornum || row.transdate || '';

const groupItemsByClassification = (items) => {
  const groups = new Map();

  items.forEach((item) => {
    const key = item.classid ?? item.classification ?? 'uncategorized';
    const label = item.classification || 'Uncategorized';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        total: 0,
        count: 0,
        items: [],
      });
    }

    const group = groups.get(key);
    group.total += Number(item.amount) || 0;
    group.count += 1;
    group.items.push(item);
  });

  return Array.from(groups.values()).sort((a, b) => Number(b.total) - Number(a.total));
};

function ClassificationBreakdown({ items, overpayment, expandAll }) {
  const [expandedClasses, setExpandedClasses] = useState({});
  const grouped = useMemo(() => groupItemsByClassification(items || []), [items]);

  const toggleClass = (key) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    if (!expandAll) {
      setExpandedClasses({});
      return;
    }
    const nextExpanded = {};
    grouped.forEach((group) => {
      nextExpanded[group.key] = true;
    });
    setExpandedClasses(nextExpanded);
  }, [expandAll, grouped]);

  return (
    <div className="mt-3 space-y-2">
      {grouped.length > 0 ? (
        grouped.map((group) => {
          const isOpen = !!expandedClasses[group.key];
          return (
            <div key={group.key} className="rounded-md border bg-background/70 px-3 py-2">
              <button
                type="button"
                onClick={() => toggleClass(group.key)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <div className="text-sm font-medium">{group.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {group.count} item{group.count === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold">{formatCurrency(group.total)}</div>
              </button>

              {isOpen && (
                <div className="mt-2 space-y-2 pl-6">
                  {group.items.map((item, index) => (
                    <div
                      key={`${group.key}-item-${index}`}
                      className="grid gap-2 rounded-md border bg-background px-3 py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,120px)]"
                    >
                      <div className="text-xs text-muted-foreground">
                        {item.particulars || 'N/A'}
                      </div>
                      <div className="text-sm font-semibold sm:text-right">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="text-xs text-muted-foreground">No items recorded</div>
      )}

      {overpayment > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-amber-900">Overpayment</div>
              <div className="text-xs text-amber-700">Excess payment not tied to an item</div>
            </div>
            <div className="text-sm font-semibold text-amber-900">
              {formatCurrency(overpayment)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DailyCashTable({ data, loading }) {
  const [columnVisibility, setColumnVisibility] = useState({});
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([{ id: 'ornum', desc: false }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [expanded, setExpanded] = useState({});
  const [expandAllDetails, setExpandAllDetails] = useState(false);

  const groupedData = useMemo(() => {
    const grouped = new Map();

    (data || []).forEach((item) => {
      const key = item.transno || item.ornum || `${item.transdate}-${item.student_name || ''}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          transno: item.transno,
          ornum: item.ornum,
          transdate: item.transdate,
          student_name: item.student_name,
          sid: item.sid,
          payment_type: item.payment_type,
          items: [],
          item_count: 0,
          total_paid: 0,
          overpayment: 0,
        });
      }

      const entry = grouped.get(key);
      entry.items.push(item);
      entry.item_count += 1;
      entry.total_paid += Number(item.paid_amount) || 0;
      entry.overpayment += Number(item.overpayment) || 0;
      if (!entry.transdate && item.transdate) {
        entry.transdate = item.transdate;
      }
    });

    return Array.from(grouped.values()).map((entry) => {
      const searchParts = [
        entry.ornum,
        entry.student_name,
        entry.sid,
        entry.payment_type,
        entry.transdate,
        ...entry.items.map((item) => item.classification),
        ...entry.items.map((item) => item.particulars),
      ];

      return {
        ...entry,
        row_id: getRowKey(entry),
        item_count: entry.items.length,
        total_paid: Number(entry.total_paid.toFixed(2)),
        overpayment: Number(entry.overpayment.toFixed(2)),
        search_text: searchParts.filter(Boolean).join(' ').toLowerCase(),
      };
    });
  }, [data]);

  const globalFilterFn = (row, columnId, filterValue) => {
    const searchText = row.original.search_text || '';
    const query = String(filterValue || '').toLowerCase();
    if (!query) return true;
    return searchText.includes(query);
  };

  const table = useReactTable({
    data: groupedData,
    columns: dailyCashColumns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      globalFilter,
      expanded,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn,
    getRowCanExpand: (row) => (row.original.items || []).length > 0,
    getRowId: (row) => getRowKey(row).toString(),
  });

  useEffect(() => {
    if (!expandAllDetails) return;
    const nextExpanded = {};
    groupedData.forEach((row) => {
      if ((row.items || []).length > 0) {
        nextExpanded[getRowKey(row)] = true;
      }
    });
    setExpanded(nextExpanded);
  }, [expandAllDetails, groupedData]);

  const handleToggleAll = () => {
    const nextValue = !expandAllDetails;
    setExpandAllDetails(nextValue);
    if (!nextValue) {
      setExpanded({});
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading daily payments...</p>
        </div>
      </div>
    );
  }

  const filteredRows = table.getFilteredRowModel().rows;
  const totalPaid = filteredRows.reduce(
    (sum, row) => sum + Number(row.original.total_paid || 0),
    0
  );
  const totalOverpayment = filteredRows.reduce(
    (sum, row) => sum + Number(row.original.overpayment || 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search OR, student, or item..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleToggleAll}>
            {expandAllDetails ? 'Collapse all' : 'View all'}
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">{filteredRows.length}</span>{' '}
            transactions
          </div>
          <div className="text-muted-foreground">
            Collected:{' '}
            <span className="font-semibold text-foreground">{formatCurrency(totalPaid)}</span>
          </div>
          {totalOverpayment > 0 && (
            <div className="text-muted-foreground">
              Overpayment:{' '}
              <span className="font-semibold text-amber-700">
                {formatCurrency(totalOverpayment)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow
                    onClick={() => row.getCanExpand() && row.toggleExpanded()}
                    className="cursor-pointer hover:bg-muted/40"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={row.getVisibleCells().length} className="p-0">
                        <div className="px-6 py-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Item breakdown
                          </div>
                          <ClassificationBreakdown
                            items={row.original.items}
                            overpayment={row.original.overpayment}
                            expandAll={expandAllDetails}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={dailyCashColumns.length} className="h-24 text-center">
                  <div className="text-muted-foreground">
                    <p>No payments found</p>
                    <p className="text-sm mt-1">Try adjusting your filters</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex-1 text-sm text-muted-foreground">
          Showing {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} pages
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <select
              className="h-8 w-[70px] rounded-md border border-input bg-background px-2 text-sm"
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
              }}
            >
              {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
