import { ArrowUpDown } from 'lucide-react';
import { Button } from '../../../../../../components/ui/button';
import { Badge } from '../../../../../../components/ui/badge';
import { Checkbox } from '../../../../../../components/ui/checkbox';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(value || 0);
};

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

const getOverpayment = (row) => {
  if (row.overpayment_amount !== undefined) return Number(row.overpayment_amount) || 0;
  if (Number(row.cancelled) === 1) return 0;
  const totalAmount = Number(row.totalamount) || 0;
  const amountPaid = Number(row.amountpaid) || 0;
  const changeAmount = Number(row.change_amount) || 0;
  if (changeAmount > 0) return 0;
  const difference = amountPaid - totalAmount;
  return difference > 0 ? difference : 0;
};

export const transactionColumns = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'ornum',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          OR Number
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="font-mono font-medium text-sm">{row.getValue('ornum')}</div>
    ),
  },
  {
    accessorKey: 'transdate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Date & Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="text-sm">{formatDateTime(row.getValue('transdate'))}</div>
    ),
  },
  {
    id: 'student_name',
    accessorFn: (row) => row.full_name || row.studname || '',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Student Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const fullName = row.getValue('student_name') || 'N/A';
      return (
        <div className="max-w-[220px]">
          <div className="font-medium truncate">{fullName}</div>
          <div className="text-xs text-muted-foreground truncate">{row.original.grade_level}</div>
        </div>
      );
    },
  },
  {
    accessorKey: 'items',
    header: 'Items',
    cell: ({ row }) => {
      const items = row.getValue('items');
      if (!items) return <span className="text-muted-foreground text-xs">No items</span>;
      return (
        <div className="max-w-[200px] text-xs text-muted-foreground truncate" title={items}>
          {items}
        </div>
      );
    },
  },
  {
    accessorKey: 'totalamount',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Total Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="font-semibold">{formatCurrency(row.getValue('totalamount'))}</div>
    ),
  },
  {
    accessorKey: 'change_amount',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Change
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const changeAmount = Number(row.getValue('change_amount')) || 0;
      return changeAmount > 0 ? (
        <div className="font-semibold text-emerald-700">{formatCurrency(changeAmount)}</div>
      ) : (
        <div className="text-muted-foreground">-</div>
      );
    },
  },
  {
    id: 'overpayment',
    accessorFn: (row) => getOverpayment(row),
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Overpayment
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const overpayment = row.getValue('overpayment');
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
  {
    id: 'transacted_by',
    accessorFn: (row) => row.transacted_by || '',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Transacted By
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="text-sm">
        <div className="font-medium">{row.getValue('transacted_by') || 'N/A'}</div>
      </div>
    ),
  },
  {
    accessorKey: 'cancelled',
    header: 'Status',
    cell: ({ row }) => {
      const cancelled = Number(row.getValue('cancelled')) === 1;
      const posted = Number(row.original.posted) === 1;

      if (cancelled) {
        return (
          <div>
            <Badge variant="destructive">Cancelled</Badge>
            {row.original.cancelledremarks && (
              <div className="text-xs text-muted-foreground mt-1">
                {row.original.cancelledremarks}
              </div>
            )}
          </div>
        );
      }

      if (posted) {
        return (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-500/10 text-emerald-700"
          >
            Posted
          </Badge>
        );
      }

      return (
        <Badge variant="outline" className="border-slate-200 bg-slate-500/10 text-slate-700">
          Pending
        </Badge>
      );
    },
  },
];
