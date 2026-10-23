import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMemos } from './memos-provider'

export function MemoDeleteDialog({ onSuccess, selectedSchool }) {
  const { deleteDialogMemo, setDeleteDialogMemo } = useMemos()
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const isOpen = !!deleteDialogMemo

  const handleDelete = async () => {
    if (confirmText !== deleteDialogMemo?.title) {
      toast.error('Memo title does not match')
      return
    }

    setIsDeleting(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(apiUrl(`/api/admin/memos/${deleteDialogMemo.id}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          schoolDbConfig: {
            db_name: selectedSchool.db_name,
          },
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || `Memo "${deleteDialogMemo?.title}" deleted successfully`)
        setDeleteDialogMemo(null)
        setConfirmText('')
        if (onSuccess) onSuccess()
      } else {
        toast.error(data.message || 'Failed to delete memo')
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenChange = (newOpen) => {
    if (!newOpen && !isDeleting) {
      setDeleteDialogMemo(null)
      setConfirmText('')
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the memo{' '}
            <span className='font-semibold'>{deleteDialogMemo?.title}</span> and
            remove it from the system.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className='space-y-2'>
          <Label htmlFor='confirm-text'>
            Type <span className='font-semibold'>{deleteDialogMemo?.title}</span>{' '}
            to confirm:
          </Label>
          <Input
            id='confirm-text'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={deleteDialogMemo?.title}
            disabled={isDeleting}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmText('')} disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={confirmText !== deleteDialogMemo?.title || isDeleting}
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
          >
            {isDeleting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
