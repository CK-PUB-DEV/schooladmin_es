import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { MemosProvider } from './components/memos-provider'
import { MemosTable } from './components/memos-table'
import { MemoEditor } from './components/memo-editor'

export default function MemoBoard() {
  const [memos, setMemos] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState('table') // 'table' or 'editor'
  const [currentMemo, setCurrentMemo] = useState(null)
  const selectedSchool = JSON.parse(localStorage.getItem('selectedSchool') || 'null')

  const fetchMemos = async () => {
    try {
      const token = localStorage.getItem('token')

      if (!selectedSchool) {
        toast.error('No school selected')
        setIsLoading(false)
        return
      }

      const response = await fetch(apiUrl('/api/admin/memos'), {
        method: 'POST',
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
        setMemos(data.data || [])
      } else {
        toast.error(data.message || 'Failed to fetch memos')
      }
    } catch (error) {
      console.error('Error fetching memos:', error)
      toast.error('An error occurred while fetching memos')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMemos()
  }, [])

  const handleAddMemo = () => {
    setCurrentMemo(null)
    setViewMode('editor')
  }

  const handleEditMemo = (memo) => {
    setCurrentMemo(memo)
    setViewMode('editor')
  }

  const handleBackToTable = () => {
    setViewMode('table')
    setCurrentMemo(null)
    fetchMemos()
  }

  if (isLoading) {
    return (
      <div className='flex h-[450px] items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <MemosProvider>
      {viewMode === 'table' ? (
        <div className='space-y-6'>
          <MemosTable
            data={memos}
            onAddMemo={handleAddMemo}
            onEditMemo={handleEditMemo}
            onRefresh={fetchMemos}
            selectedSchool={selectedSchool}
          />
        </div>
      ) : (
        <MemoEditor
          memo={currentMemo}
          onBack={handleBackToTable}
          selectedSchool={selectedSchool}
        />
      )}
    </MemosProvider>
  )
}
