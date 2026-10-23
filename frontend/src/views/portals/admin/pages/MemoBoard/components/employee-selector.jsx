import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader2, X } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

export function EmployeeSelector({ selectedEmployees, onSelectionChange, selectedSchool }) {
  const [employees, setEmployees] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAllSelected, setIsAllSelected] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    // If selectedEmployees is empty or null, it means ALL is selected
    setIsAllSelected(!selectedEmployees || selectedEmployees.length === 0)
  }, [selectedEmployees])

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token')

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

  // Filter employees based on search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees
    const query = searchQuery.toLowerCase()
    return employees.filter(emp =>
      emp.name.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query)
    )
  }, [employees, searchQuery])

  const handleAllChange = (checked) => {
    if (checked) {
      setIsAllSelected(true)
      onSelectionChange([]) // Clear all individual selections
    } else {
      setIsAllSelected(false)
    }
  }

  const handleEmployeeChange = (employeeId, checked) => {
    if (checked) {
      setIsAllSelected(false) // Unselect ALL when selecting individual
      onSelectionChange([...selectedEmployees, employeeId])
    } else {
      onSelectionChange(selectedEmployees.filter(id => id !== employeeId))
    }
  }

  const getSelectedEmployeesNames = () => {
    if (isAllSelected) return []
    return employees
      .filter(emp => selectedEmployees.includes(emp.id))
      .map(emp => emp.name)
  }

  const handleRemoveEmployee = (employeeId) => {
    onSelectionChange(selectedEmployees.filter(id => id !== employeeId))
  }

  const selectedNames = getSelectedEmployeesNames()

  return (
    <div>
      <Label>Visibility</Label>

      {/* Display selected employees */}
      <div className='mt-2 min-h-[40px] w-full rounded-md border p-2 flex flex-wrap gap-2 items-center'>
        {isAllSelected ? (
          <Badge variant='default'>All Employees</Badge>
        ) : selectedNames.length > 0 ? (
          selectedNames.map((name, index) => {
            const employeeId = employees.find(e => e.name === name)?.id
            return (
              <Badge key={index} variant='secondary' className='gap-1'>
                {name}
                <X
                  className='h-3 w-3 cursor-pointer hover:text-destructive'
                  onClick={() => handleRemoveEmployee(employeeId)}
                />
              </Badge>
            )
          })
        ) : (
          <span className='text-sm text-muted-foreground'>No employees selected</span>
        )}
      </div>

      {/* Selection popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant='outline' size='sm' className='mt-2'>
            Select Employees
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-80' align='start'>
          <div className='space-y-4'>
            {/* ALL checkbox */}
            <div className='flex items-center space-x-2'>
              <Checkbox
                id='all-employees'
                checked={isAllSelected}
                onCheckedChange={handleAllChange}
              />
              <Label
                htmlFor='all-employees'
                className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer'
              >
                All Employees
              </Label>
            </div>

            <div className='border-t pt-4'>
              {/* Search input */}
              <Input
                placeholder='Search employees...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='h-8 mb-2'
              />

              {/* Employee list */}
              {isLoading ? (
                <div className='flex items-center justify-center py-8'>
                  <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
                </div>
              ) : (
                <ScrollArea className='h-[300px]'>
                  <div className='space-y-2'>
                    {filteredEmployees.length > 0 ? (
                      filteredEmployees.map((employee) => (
                        <div key={employee.id} className='flex items-center space-x-2'>
                          <Checkbox
                            id={`employee-${employee.id}`}
                            checked={selectedEmployees.includes(employee.id)}
                            onCheckedChange={(checked) => handleEmployeeChange(employee.id, checked)}
                          />
                          <Label
                            htmlFor={`employee-${employee.id}`}
                            className='text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1'
                          >
                            <div>
                              <div>{employee.name}</div>
                              <div className='text-xs text-muted-foreground'>{employee.email}</div>
                            </div>
                          </Label>
                        </div>
                      ))
                    ) : (
                      <div className='text-center py-4 text-sm text-muted-foreground'>
                        No employees found
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
