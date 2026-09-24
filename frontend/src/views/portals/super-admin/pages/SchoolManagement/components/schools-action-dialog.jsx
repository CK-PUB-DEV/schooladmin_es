import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, Upload, X } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useSchools } from './schools-provider'

const schoolFormSchema = z.object({
  school_name: z.string().min(2, 'School name must be at least 2 characters'),
  abbrv: z.string().optional(),
  image_logo: z.string().optional(),
  address: z.string().optional(),
  finance_v1: z.boolean().default(false),
  app_url: z
    .string()
    .trim()
    .refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), 'Enter a valid URL starting with http:// or https://')
    .optional(),
  db_host: z.string().min(1, 'Database host is required'),
  db_port: z.coerce.number().int().min(1, 'Database port must be a valid number'),
  db_name: z.string().min(2, 'Database name must be at least 2 characters'),
  db_username: z.string().min(2, 'Database username must be at least 2 characters'),
  db_password: z.string().optional(),
})

export function SchoolsActionDialog({ open, onSuccess }) {
  const { setOpen, currentRow } = useSchools()
  const isEdit = !!currentRow
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedLogoPath, setUploadedLogoPath] = useState('')

  const form = useForm({
    resolver: zodResolver(schoolFormSchema),
    defaultValues: {
      school_name: '',
      abbrv: '',
      image_logo: '',
      address: '',
      finance_v1: false,
      app_url: '',
      db_host: 'localhost',
      db_port: 3306,
      db_name: '',
      db_username: '',
      db_password: '',
    },
  })

  useEffect(() => {
    if (open && isEdit && currentRow) {
      form.reset({
        school_name: currentRow.school_name,
        abbrv: currentRow.abbrv || '',
        image_logo: currentRow.image_logo || '',
        address: currentRow.address || '',
        finance_v1: Boolean(Number(currentRow.finance_v1)),
        app_url: currentRow.app_url || '',
        db_host: currentRow.db_host || 'localhost',
        db_port: currentRow.db_port || 3306,
        db_name: currentRow.db_name,
        db_username: currentRow.db_username,
        db_password: '',
      })
      setUploadedLogoPath(currentRow.image_logo || '')
    } else if (open && !isEdit) {
      form.reset({
        school_name: '',
        abbrv: '',
        image_logo: '',
        address: '',
        finance_v1: false,
        app_url: '',
        db_host: 'localhost',
        db_port: 3306,
        db_name: '',
        db_username: '',
        db_password: '',
      })
      setUploadedLogoPath('')
    }
    setConnectionStatus(null)
    setSelectedFile(null)
  }, [open, isEdit, currentRow, form])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const uploadLogo = async () => {
    if (!selectedFile) return uploadedLogoPath

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('logo', selectedFile)

      const token = localStorage.getItem('token')
      const response = await fetch(apiUrl('/api/super-admin/schools/upload-logo'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Logo uploaded successfully')
        setUploadedLogoPath(data.data.filePath)
        return data.data.filePath
      } else {
        toast.error(data.message || 'Failed to upload logo')
        return uploadedLogoPath
      }
    } catch (error) {
      toast.error('Failed to upload logo')
      return uploadedLogoPath
    } finally {
      setIsUploading(false)
    }
  }

  const testConnection = async () => {
    const values = form.getValues()

    if (!values.db_name || !values.db_username) {
      toast.error('Please fill in database name and username first')
      return
    }

    setIsTesting(true)
    setConnectionStatus(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(apiUrl('/api/super-admin/schools/test-connection'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          db_host: values.db_host,
          db_port: values.db_port,
          db_name: values.db_name,
          db_username: values.db_username,
          db_password: values.db_password,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setConnectionStatus('success')
        toast.success(data.message || 'Database connection successful')
      } else {
        setConnectionStatus('error')
        toast.error(data.message || 'Database connection failed')
      }
    } catch (error) {
      setConnectionStatus('error')
      toast.error('Failed to test connection')
    } finally {
      setIsTesting(false)
    }
  }

  const onSubmit = async (data) => {
    setIsSubmitting(true)

    try {
      // Upload logo first if a file is selected
      let logoPath = uploadedLogoPath
      if (selectedFile) {
        logoPath = await uploadLogo()
      }

      // Include the logo path in the data
      const schoolData = {
        ...data,
        finance_v1: data.finance_v1 ? 1 : 0,
        image_logo: logoPath,
      }

      const token = localStorage.getItem('token')
      const url = isEdit
        ? apiUrl(`/api/super-admin/schools/${currentRow.id}`)
        : apiUrl('/api/super-admin/schools')

      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(schoolData),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(result.message || `School ${isEdit ? 'updated' : 'created'} successfully`)
        setOpen(null)
        form.reset()
        setSelectedFile(null)
        setUploadedLogoPath('')
        if (onSuccess) onSuccess()
      } else {
        toast.error(result.message || `Failed to ${isEdit ? 'update' : 'create'} school`)
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen) => {
    if (!newOpen) {
      setOpen(null)
      form.reset()
      setConnectionStatus(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-w-lg max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit School' : 'Add School'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the school database configuration.'
              : 'Configure the database connection for the new school.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='school_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Name</FormLabel>
                  <FormControl>
                    <Input placeholder='Enter school name' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='abbrv'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abbreviation (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder='e.g., SHS' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='space-y-2'>
              <FormLabel>School Logo (Optional)</FormLabel>
              <div className='flex items-start gap-4'>
                <div className='flex-1'>
                  <div className='flex items-center gap-2'>
                    <Input
                      type='file'
                      accept='image/*'
                      onChange={handleFileChange}
                      disabled={isUploading}
                      className='cursor-pointer'
                    />
                    {isUploading && <Loader2 className='h-4 w-4 animate-spin' />}
                  </div>
                  {selectedFile && (
                    <p className='text-xs text-muted-foreground mt-1'>
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>
                {(uploadedLogoPath || (isEdit && currentRow?.image_logo)) && (
                  <div className='relative w-20 h-20 border rounded-lg overflow-hidden bg-muted flex items-center justify-center'>
                    <img
                      src={apiUrl(uploadedLogoPath || currentRow?.image_logo)}
                      alt='School logo preview'
                      className='w-full h-full object-contain'
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.parentElement.innerHTML = '<span class="text-xs text-muted-foreground">Preview unavailable</span>'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <FormField
              control={form.control}
              name='address'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Enter school address'
                      className='resize-none'
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='finance_v1'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between rounded-md border border-input px-3 py-2'>
                  <FormLabel className='font-normal'>Finance V1</FormLabel>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(!!checked)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='app_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder='https://app-school.essentiel.ph' {...field} />
                  </FormControl>
                  <FormDescription>
                    Base URL of the school&apos;s Essentiel app. Required for Student Ledgers (Finance V2).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='db_host'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Host</FormLabel>
                  <FormControl>
                    <Input placeholder='localhost' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='db_port'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Port</FormLabel>
                  <FormControl>
                    <Input type='number' min={1} placeholder='3306' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='db_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Name</FormLabel>
                  <FormControl>
                    <Input placeholder='school_database' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='db_username'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Username</FormLabel>
                  <FormControl>
                    <Input placeholder='db_user' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='db_password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Password (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type='password'
                      placeholder={isEdit ? 'Leave empty to keep current' : 'Leave empty if no password'}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={testConnection}
                disabled={isTesting}
                className='flex-1'
              >
                {isTesting ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              {connectionStatus === 'success' && (
                <CheckCircle2 className='h-5 w-5 text-green-600' />
              )}
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    {isEdit ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>{isEdit ? 'Update School' : 'Add School'}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
