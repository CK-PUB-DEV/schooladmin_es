import { useState } from 'react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'
import { useDialogs } from '@/context/dialogs-provider'
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'
import { DataTableView, TablePaginationBar } from '@/components/ui/data-table-view'
import { getColumns } from './memos-columns'
import { MemoViewDialog } from './memo-view-dialog'
import { MemoVisibilityDialog } from './memo-visibility-dialog'
import { MemoDeleteDialog } from './memo-delete-dialog'
import { useMemos } from './memos-provider'
import { Trash2 } from 'lucide-react'

export function MemosTable({ data, onAddMemo, onEditMemo, onRefresh, selectedSchool }) {
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState({})
  const [columnFilters, setColumnFilters] = useState([])
  const [sorting, setSorting] = useState([])
  const [viewDialogMemo, setViewDialogMemo] = useState(null)
  const [visibilityDialogMemo, setVisibilityDialogMemo] = useState(null)
  const { setDeleteDialogMemo } = useMemos()
  const { confirm: openConfirm } = useDialogs()

  const handleViewMemo = (memo) => {
    setViewDialogMemo(memo)
  }

  const handleViewVisibility = (memo) => {
    setVisibilityDialogMemo(memo)
  }

  const handleDeleteMemo = (memo) => {
    setDeleteDialogMemo(memo)
  }

  const handleBulkDelete = async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const selectedMemos = selectedRows.map(row => row.original)

    if (selectedMemos.length === 0) {
      return
    }

    const confirmed = await openConfirm({
      variant: 'destructive',
      title: `Delete ${selectedMemos.length} memo${selectedMemos.length === 1 ? '' : 's'}?`,
      description: 'This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })

    if (!confirmed) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const deletePromises = selectedMemos.map(memo =>
        fetch(apiUrl(`/api/admin/memos/${memo.id}`), {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({
            schoolDbConfig: {
              db_host: selectedSchool.db_host || 'localhost',
              db_port: selectedSchool.db_port || 3306,
              db_name: selectedSchool.db_name,
              db_username: selectedSchool.db_username || 'root',
              db_password: selectedSchool.db_password || '',
            },
          }),
        })
      )

      await Promise.all(deletePromises)
      toast.success(`Successfully deleted ${selectedMemos.length} memo(s)`)
      setRowSelection({})
      if (onRefresh) onRefresh()
    } catch (error) {
      toast.error('An error occurred while deleting memos')
    }
  }

  const columns = getColumns(handleViewMemo, onEditMemo, handleViewVisibility, handleDeleteMemo)

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const selectedCount = table.getFilteredSelectedRowModel().rows.length

  return (
    <>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Memo Board</h2>
            <p className='text-muted-foreground'>
              Create and manage announcements for employees.
            </p>
          </div>
          <Button onClick={onAddMemo}>
            <Plus className='mr-2 h-4 w-4' />
            Add Memo
          </Button>
        </div>

        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Input
                placeholder='Search memos...'
                value={(table.getColumn('title')?.getFilterValue()) ?? ''}
                onChange={(event) =>
                  table.getColumn('title')?.setFilterValue(event.target.value)
                }
                className='h-8 w-[150px] lg:w-[250px]'
              />
              {selectedCount > 0 && (
                <Button
                  variant='destructive'
                  size='sm'
                  onClick={handleBulkDelete}
                >
                  <Trash2 className='mr-2 h-4 w-4' />
                  Delete {selectedCount} memo{selectedCount > 1 ? 's' : ''}
                </Button>
              )}
            </div>
          </div>

          <DataTableView
            table={table}
            columns={columns}
            emptyMessage='No memos found.'
          />
          <TablePaginationBar table={table} showSelection />
        </div>
      </div>

      <MemoViewDialog
        memo={viewDialogMemo}
        open={!!viewDialogMemo}
        onClose={() => setViewDialogMemo(null)}
      />

      <MemoVisibilityDialog
        memo={visibilityDialogMemo}
        open={!!visibilityDialogMemo}
        onClose={() => setVisibilityDialogMemo(null)}
        selectedSchool={selectedSchool}
      />

      <MemoDeleteDialog
        onSuccess={onRefresh}
        selectedSchool={selectedSchool}
      />
    </>
  )
}
