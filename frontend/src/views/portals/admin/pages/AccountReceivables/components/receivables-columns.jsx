import { ArrowUpDown } from 'lucide-react';
import { Button } from '../../../../../../components/ui/button';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value) || 0);

export const receivableColumns = [
  {
    id: 'student_name',
    accessorFn: (row) => row.full_name || '',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Student Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const fullName = row.getValue('student_name') || 'N/A';
      return (
        <div className="max-w-[240px]">
          <div className="font-medium truncate">{fullName}</div>
          <div className="text-xs text-muted-foreground truncate">
            {row.original.sid || 'No SID'}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'level_name',
    header: 'Level',
    cell: ({ row }) => (
      <div className="text-sm">{row.getValue('level_name') || 'N/A'}</div>
    ),
  },
  {
    accessorKey: 'total_fees',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Payables
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="font-semibold">{formatCurrency(row.getValue('total_fees'))}</div>
    ),
  },
  {
    accessorKey: 'total_paid',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Paid
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-sm text-emerald-700">{formatCurrency(row.getValue('total_paid'))}</div>
    ),
  },
  {
    accessorKey: 'balance',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Balance
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const balance = Number(row.getValue('balance')) || 0;
      return balance > 0 ? (
        <div className="font-semibold text-rose-700">{formatCurrency(balance)}</div>
      ) : (
        <div className="text-muted-foreground">-</div>
      );
    },
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
    accessorKey: 'last_calculated_at',
    header: 'Updated',
    cell: ({ row }) => {
      const value = row.getValue('last_calculated_at');
      return <div className="text-xs text-muted-foreground">{value || '-'}</div>;
    },
  },
];
