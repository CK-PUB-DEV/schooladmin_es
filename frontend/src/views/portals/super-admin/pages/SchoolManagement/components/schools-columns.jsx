import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from './data-table-column-header'
import { DataTableRowActions } from './data-table-row-actions'

export const columns = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-0.5'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-0.5'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'school_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='School Name' />
    ),
    cell: ({ row }) => {
      return (
        <div className='flex space-x-2'>
          <span className='max-w-[500px] truncate font-medium'>
            {row.getValue('school_name')}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'abbrv',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Abbreviation' />
    ),
    cell: ({ row }) => (
      <div className='text-sm text-muted-foreground'>
        {row.getValue('abbrv') || '-'}
      </div>
    ),
  },
  {
    accessorKey: 'address',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Address' />
    ),
    cell: ({ row }) => (
      <div className='max-w-[300px] truncate text-sm text-muted-foreground'>
        {row.getValue('address') || '-'}
      </div>
    ),
  },
  {
    accessorKey: 'app_url',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='School URL' />
    ),
    cell: ({ row }) => {
      const url = row.getValue('app_url')
      return url ? (
        <a
          href={url}
          target='_blank'
          rel='noopener noreferrer'
          className='max-w-[220px] truncate text-sm text-primary hover:underline block'
        >
          {url}
        </a>
      ) : (
        <span className='text-sm text-muted-foreground'>-</span>
      )
    },
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Created' />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue('created_at'))
      return (
        <div className='text-sm text-muted-foreground'>
          {date.toLocaleDateString()}
        </div>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
