import { ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../../../../../../components/ui/button';
import { Badge } from '../../../../../../components/ui/badge';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const dailyCashColumns = [
  {
    id: 'index',
    header: '#',
    cell: ({ row, table }) => {
      const sortedRows = table.getSortedRowModel().rows;
      const index = sortedRows.findIndex((r) => r.id === row.id);
      return <div className="text-xs text-muted-foreground w-6 text-center">{index + 1}</div>;
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'expand',
    header: '',
    cell: ({ row }) => {
      if (!row.getCanExpand()) return null;
      const isExpanded = row.getIsExpanded();
      return (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(event) => {
            event.stopPropagation();
            row.toggleExpanded();
          }}
          aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'ornum',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        OR Number
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="font-mono font-medium text-sm">{row.getValue('ornum')}</div>
    ),
  },
  {
    accessorKey: 'transdate',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Date & Time
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-sm">{formatDateTime(row.getValue('transdate'))}</div>
    ),
  },
  {
    accessorKey: 'student_name',
    header: 'Student',
    cell: ({ row }) => (
      <div className="max-w-[220px]">
        <div className="font-medium truncate">{row.getValue('student_name') || 'N/A'}</div>
        <div className="text-xs text-muted-foreground truncate">{row.original.sid || 'No SID'}</div>
      </div>
    ),
  },
  {
    accessorKey: 'item_count',
    header: 'Items',
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.getValue('item_count') || 0}</div>
    ),
  },
  {
    accessorKey: 'total_paid',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Total Paid
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="font-semibold">{formatCurrency(row.getValue('total_paid'))}</div>
    ),
  },
  {
    accessorKey: 'overpayment',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Overpayment
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const overpayment = Number(row.getValue('overpayment')) || 0;
      return overpayment > 0 ? (
        <div className="font-semibold text-amber-700">{formatCurrency(overpayment)}</div>
      ) : (
        <div className="text-muted-foreground">-</div>
      );
    },
  },
  {
    accessorKey: 'payment_type',
    header: 'Payment Type',
    cell: ({ row }) => {
      const paymentType = row.getValue('payment_type');
      const colors = {
        CASH: 'border-emerald-200 bg-emerald-500/10 text-emerald-700',
        CHEQUE: 'border-blue-200 bg-blue-500/10 text-blue-700',
        BANK: 'border-violet-200 bg-violet-500/10 text-violet-700',
        GCASH: 'border-amber-200 bg-amber-500/10 text-amber-700',
        PALAWAN: 'border-rose-200 bg-rose-500/10 text-rose-700',
      };
      return (
        <Badge
          className={colors[paymentType] || 'border-slate-200 bg-slate-500/10 text-slate-700'}
          variant="outline"
        >
          {paymentType || 'N/A'}
        </Badge>
      );
    },
  },
];
