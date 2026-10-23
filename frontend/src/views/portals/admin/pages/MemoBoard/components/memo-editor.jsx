import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, X, FileText, File, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api'
import { EmployeeSelector } from './employee-selector'

export function MemoEditor({ memo, onBack, selectedSchool }) {
  const [title, setTitle] = useState('')
  const [selectedEmployees, setSelectedEmployees] = useState([])
  const [selectedFile, setSelectedFile] = useState(null) // Store the actual File object
  const [filePreview, setFilePreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  // If editing existing memo with file URL, set it as preview
  useEffect(() => {
    if (memo) {
      setTitle(memo.title || '')
      setSelectedEmployees(memo.user_ids || [])

      if (memo.content) {
        // content is the file URL (for existing memos)
        const fileName = memo.content.split('/').pop()
        const fileType = getFileType(fileName)
        setSelectedFile({
          isExisting: true,
          fileUrl: memo.content,
          fileName: fileName,
          fileType: fileType,
        })
        setFilePreview(memo.content)
      }
    }
  }, [memo])

  const getFileType = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
    if (imageExts.includes(ext)) return 'image'
    if (ext === 'pdf') return 'pdf'
    if (ext === 'docx') return 'docx'
    return 'unknown'
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Store the file object
    setSelectedFile({
      file: file,
      fileName: file.name,
      fileType: getFileType(file.name),
    })

    // Create local preview
    const previewUrl = URL.createObjectURL(file)
    setFilePreview(previewUrl)
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (filePreview && !filePreview.startsWith('http')) {
      // Revoke object URL to free memory
      URL.revokeObjectURL(filePreview)
    }
    setFilePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadFileToS3 = async (file) => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(apiUrl('/api/admin/memos/upload-file'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
      credentials: 'include',
    })

    const data = await response.json()

    if (response.ok) {
      return data.data.fileUrl
    } else {
      throw new Error(data.message || 'Failed to upload file')
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter a memo title')
      return
    }

    if (!selectedFile) {
      toast.error('Please select a file')
      return
    }

    setIsSubmitting(true)

    try {
      let fileUrl

      // If it's a new file, upload it first
      if (selectedFile.file) {
        toast.info('Uploading file...')
        fileUrl = await uploadFileToS3(selectedFile.file)
      } else if (selectedFile.isExisting) {
        // Use existing file URL for edits
        fileUrl = selectedFile.fileUrl
      }

      // Now save the memo with the file URL
      const token = localStorage.getItem('token')
      const url = memo
        ? apiUrl(`/api/admin/memos/${memo.id}`)
        : apiUrl('/api/admin/memos/create')

      const method = memo ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          schoolDbConfig: {
            db_name: selectedSchool.db_name,
          },
          title: title.trim(),
          content: fileUrl, // Save S3 URL as content
          user_ids: selectedEmployees.length > 0 ? selectedEmployees : null,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || `Memo ${memo ? 'updated' : 'created'} successfully`)
        onBack()
      } else {
        toast.error(data.message || `Failed to ${memo ? 'update' : 'create'} memo`)
      }
    } catch (error) {
      console.error('Error saving memo:', error)
      toast.error(error.message || 'An error occurred while saving memo')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button variant='outline' size='sm' onClick={onBack}>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Memos
          </Button>
          <h2 className='text-2xl font-bold tracking-tight'>
            {memo ? 'Edit Memo' : 'Create New Memo'}
          </h2>
        </div>
        <Button onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Saving...
            </>
          ) : (
            'Save Memo'
          )}
        </Button>
      </div>

      <div className='space-y-6'>
        {/* Title Input */}
        <div className='space-y-2'>
          <Label htmlFor='title'>Memo Title</Label>
          <Input
            id='title'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Enter memo title...'
          />
        </div>

        {/* Employee Selection */}
        <EmployeeSelector
          selectedEmployees={selectedEmployees}
          onSelectionChange={setSelectedEmployees}
          selectedSchool={selectedSchool}
        />

        {/* File Upload Section */}
        <div className='space-y-4'>
          <Label>Attached File</Label>

          {!selectedFile ? (
            <div className='flex justify-center'>
              <Button
                type='button'
                variant='outline'
                size='lg'
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className='h-32 w-full max-w-md border-dashed'
              >
                <div className='flex flex-col items-center space-y-2'>
                  <Upload className='h-8 w-8 text-muted-foreground' />
                  <div className='text-sm'>Click to select file</div>
                  <div className='text-xs text-muted-foreground'>
                    Supports: Images, PDF, DOCX (Max 10MB)
                  </div>
                </div>
              </Button>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/*,.pdf,.docx'
                onChange={handleFileSelect}
                className='hidden'
              />
            </div>
          ) : (
            <div className='border rounded-lg p-4 space-y-4'>
              {/* File Preview */}
              {selectedFile.fileType === 'image' ? (
                <div className='flex justify-center'>
                  <img
                    src={filePreview}
                    alt='Preview'
                    className='max-h-96 rounded-lg'
                  />
                </div>
              ) : selectedFile.fileType === 'pdf' ? (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between p-2 bg-muted rounded-lg'>
                    <div className='flex items-center space-x-2'>
                      <FileText className='h-5 w-5 text-muted-foreground' />
                      <p className='font-medium text-sm'>{selectedFile.fileName}</p>
                    </div>
                  </div>
                  {selectedFile.isExisting ? (
                    <div className='border rounded-lg overflow-hidden'>
                      <iframe
                        src={filePreview}
                        className='w-full h-[600px]'
                        title='PDF Preview'
                      />
                    </div>
                  ) : (
                    <div className='flex items-center justify-center p-8 bg-muted rounded-lg'>
                      <FileText className='h-16 w-16 text-muted-foreground' />
                      <div className='ml-4'>
                        <p className='font-medium'>{selectedFile.fileName}</p>
                        <p className='text-sm text-muted-foreground'>
                          PDF preview will be available after saving
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedFile.fileType === 'docx' ? (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between p-2 bg-muted rounded-lg'>
                    <div className='flex items-center space-x-2'>
                      <File className='h-5 w-5 text-muted-foreground' />
                      <p className='font-medium text-sm'>{selectedFile.fileName}</p>
                    </div>
                  </div>
                  {selectedFile.isExisting ? (
                    <div className='border rounded-lg overflow-hidden'>
                      <iframe
                        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(filePreview)}`}
                        className='w-full h-[600px]'
                        title='Document Preview'
                      />
                    </div>
                  ) : (
                    <div className='flex items-center justify-center p-8 bg-muted rounded-lg'>
                      <File className='h-16 w-16 text-muted-foreground' />
                      <div className='ml-4'>
                        <p className='font-medium'>{selectedFile.fileName}</p>
                        <p className='text-sm text-muted-foreground'>
                          Document preview will be available after saving
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className='flex items-center justify-center p-8 bg-muted rounded-lg'>
                  <File className='h-16 w-16 text-muted-foreground' />
                  <div className='ml-4'>
                    <p className='font-medium'>{selectedFile.fileName}</p>
                    <p className='text-sm text-muted-foreground'>Preview not available</p>
                  </div>
                </div>
              )}

              {/* Remove Button */}
              <div className='flex justify-center'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={handleRemoveFile}
                >
                  <X className='h-4 w-4 mr-2' />
                  Remove File
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
