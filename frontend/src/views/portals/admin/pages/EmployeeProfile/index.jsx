import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { EmployeesProvider } from './components/employees-provider'
import { EmployeesTable } from './components/employees-table'

export default function EmployeeProfile() {
  const [employees, setEmployees] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const selectedSchool = JSON.parse(localStorage.getItem('selectedSchool') || 'null')

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token')

      if (!selectedSchool) {
        toast.error('No school selected')
        setIsLoading(false)
        return
      }

      const response = await fetch(apiUrl('/api/admin/employees'), {
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
        setEmployees(data.data || [])
      } else {
        toast.error(data.message || 'Failed to fetch employees')
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast.error('An error occurred while fetching employees')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  if (isLoading) {
    return (
      <div className='flex h-[450px] items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <EmployeesProvider>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Employee Profile</h2>
            <p className='text-muted-foreground'>
              Manage employee information and user types.
            </p>
          </div>
        </div>
        <EmployeesTable data={employees} />
      </div>
    </EmployeesProvider>
  )
}
