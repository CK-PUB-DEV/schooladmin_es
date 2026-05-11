import { flexRender } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function getColumnLabel(column) {
  if (column.columnDef.meta?.label) return column.columnDef.meta.label
  return column.id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function MobileCard({ row, rowClassName }) {
  const cells = row.getVisibleCells()
  const selectCell = cells.find((c) => c.column.id === 'select')
  const actionsCell = cells.find((c) => c.column.id === 'actions')
  const mainCells = cells.filter((c) => c.column.id !== 'select' && c.column.id !== 'actions')

  return (
    <div
      className={cn(
        'rounded-lg border bg-background p-3 space-y-2',
        row.getIsSelected() && 'bg-muted/50 border-primary/30',
        rowClassName ? rowClassName(row) : undefined
      )}
    >
      {(selectCell || actionsCell) && (
        <div className='flex items-center justify-between'>
          <div>
            {selectCell && flexRender(selectCell.column.columnDef.cell, selectCell.getContext())}
          </div>
          <div>
            {actionsCell && flexRender(actionsCell.column.columnDef.cell, actionsCell.getContext())}
          </div>
        </div>
      )}
      <div className='divide-y'>
        {mainCells.map((cell) => (
          <div
            key={cell.id}
            className='flex items-start justify-between gap-2 py-1.5 text-sm first:pt-0 last:pb-0'
          >
            <span className='shrink-0 font-medium text-muted-foreground'>
              {getColumnLabel(cell.column)}
            </span>
            <div className='min-w-0 text-right'>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DataTableView({ table, columns, emptyMessage, rowClassName, scrollOnMobile = false }) {
  const isMobile = useIsMobile()
  const rows = table.getRowModel().rows
  const defaultEmpty = <p className='text-muted-foreground'>No results.</p>

  if (!rows?.length) {
    return (
      <div className={cn('rounded-md border bg-background', isMobile && !scrollOnMobile ? 'p-8 text-center' : '')}>
        {isMobile && !scrollOnMobile ? (
          emptyMessage ?? defaultEmpty
        ) : (
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
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  {emptyMessage ?? defaultEmpty}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    )
  }

  if (isMobile && !scrollOnMobile) {
    return (
      <div className='space-y-2'>
        {rows.map((row) => (
          <MobileCard key={row.id} row={row} rowClassName={rowClassName} />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('rounded-md border bg-background', scrollOnMobile && 'overflow-x-auto')}>
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
          {rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && 'selected'}
              className={rowClassName ? rowClassName(row) : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function TablePaginationBar({ table, showSelection = false }) {
  return (
    <div className='flex flex-col gap-2 px-2 sm:flex-row sm:items-center sm:justify-between'>
      {showSelection && table.getFilteredSelectedRowModel().rows.length > 0 && (
        <div className='text-sm text-muted-foreground'>
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
      )}
      <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:ms-auto'>
        <div className='flex items-center gap-1.5 text-sm'>
          <span className='text-muted-foreground'>Rows per page</span>
          <select
            className='h-8 w-[60px] rounded-md border border-input bg-background px-1.5 text-sm'
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {[10, 20, 30, 40, 50, 100].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='text-sm text-muted-foreground'>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <div className='flex gap-1'>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
