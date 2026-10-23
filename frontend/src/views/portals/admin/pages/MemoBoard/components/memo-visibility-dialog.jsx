import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

const normalizeUserIds = (rawUserIds) => {
  if (Array.isArray(rawUserIds)) return rawUserIds
  if (typeof rawUserIds === 'string' && rawUserIds.trim()) {
    try {
      const parsed = JSON.parse(rawUserIds)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function MemoVisibilityDialog({ memo, open, onClose, selectedSchool }) {
  const [employees, setEmployees] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadedSchoolKeyRef = useRef(null)

  const userIds = useMemo(() => normalizeUserIds(memo?.user_ids), [memo?.user_ids])
  const isAllUsers = userIds.length === 0
  const visibilityLabel = isAllUsers ? 'All Employees' : `${userIds.length} Employees`

  useEffect(() => {
    if (!open) return
    setSearchQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!selectedSchool) {
      setEmployees([])
      loadedSchoolKeyRef.current = null
      toast.error('No school selected')
      return
    }

    const schoolKey = `${selectedSchool.id}|${selectedSchool.db_name}`
    if (loadedSchoolKeyRef.current === schoolKey && employees.length > 0) return

    const controller = new AbortController()

    const fetchEmployees = async () => {
      setIsLoading(true)
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(apiUrl('/api/admin/employees'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({
            schoolDbConfig: {
              db_name: selectedSchool.db_name,
            },
          }),
        })

        const data = await response.json()

        if (response.ok) {
          setEmployees(data.data || [])
          loadedSchoolKeyRef.current = schoolKey
        } else {
          toast.error(data.message || 'Failed to fetch employees')
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.error('Error fetching employees:', error)
          toast.error('An error occurred while fetching employees')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchEmployees()

    return () => controller.abort()
  }, [
    open,
    selectedSchool?.db_name,
    employees.length,
  ])

  const visibleEmployees = useMemo(() => {
    if (isAllUsers) return employees
    const allowedIdSet = new Set(userIds.map((id) => String(id)))
    return employees.filter((employee) => allowedIdSet.has(String(employee.id)))
  }, [employees, isAllUsers, userIds])

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return visibleEmployees
    const query = searchQuery.trim().toLowerCase()
    return visibleEmployees.filter(
      (employee) =>
        employee.name?.toLowerCase().includes(query) ||
        employee.email?.toLowerCase().includes(query)
    )
  }, [visibleEmployees, searchQuery])

  if (!memo) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-xl'>
        <DialogHeader>
          <DialogTitle>Visibility</DialogTitle>
          <DialogDescription>
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              <span className='font-medium text-foreground'>{memo.title}</span>
              <span className='text-muted-foreground'>{'\u2022'}</span>
              <Badge variant={isAllUsers ? 'default' : 'secondary'} className='text-xs'>
                {visibilityLabel}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <Input
            placeholder='Search employees...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='h-9'
          />

          <div className='rounded-md border'>
            {isLoading ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
              </div>
            ) : (
              <ScrollArea className='h-[420px]'>
                <div className='p-4'>
                  <div className='text-sm text-muted-foreground mb-3'>
                    Showing {filteredEmployees.length} of {visibleEmployees.length}
                  </div>
                  {filteredEmployees.length > 0 ? (
                    <div className='space-y-3'>
                      {filteredEmployees.map((employee, index) => (
                        <div key={employee.id}>
                          <div className='flex items-start justify-between gap-4'>
                            <div className='min-w-0'>
                              <div className='font-medium truncate'>{employee.name}</div>
                              <div className='text-xs text-muted-foreground truncate'>
                                {employee.email}
                              </div>
                            </div>
                            <Badge variant='outline' className='text-xs shrink-0'>
                              #{employee.id}
                            </Badge>
                          </div>
                          {index < filteredEmployees.length - 1 ? (
                            <Separator className='mt-3' />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='py-12 text-center text-sm text-muted-foreground'>
                      No employees found.
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
