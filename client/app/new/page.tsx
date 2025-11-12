'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Upload, Loader2, FileText, X } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { submitIntake, generateDraft } from '@/lib/api-service'
import type { FactsJson } from '@/types/api'

// Validation schema - most fields optional since they can be auto-filled from documents
// Only attorney info is always required
const factsSchema = z.object({
  plaintiff: z.string().optional(),
  defendant: z.string().optional(),
  plaintiff_attorney: z.string().min(1, 'Your name is required'),
  plaintiff_firm: z.string().min(1, 'Your firm name is required'),
  incident: z.string().optional(),
  venue: z.string().optional(),
  amount_claimed: z.number().min(0, 'Amount must be positive').optional(),
  specials: z.number().optional(),
  generals: z.number().optional(),
})

type FormData = z.infer<typeof factsSchema>

export default function NewLetterPage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(factsSchema),
    defaultValues: {
      amount_claimed: 0,
      plaintiff: '',
      defendant: '',
      incident: '',
      venue: '',
      plaintiff_attorney: '',
      plaintiff_firm: '',
    },
  })

  // Watch form values to check if auto-filled
  const formValues = watch()

  // File upload with react-dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles) => {
      setFiles((prev) => [...prev, ...acceptedFiles])
      toast.success(`${acceptedFiles.length} file(s) added`)
    },
    onDropRejected: (rejections) => {
      rejections.forEach((rejection) => {
        toast.error(`${rejection.file.name}: ${rejection.errors[0].message}`)
      })
    },
  })

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)

    try {
      // Prepare facts JSON
      const factsJson: FactsJson = {
        parties: {
          plaintiff: data.plaintiff || undefined,
          defendant: data.defendant || undefined,
          plaintiff_attorney: data.plaintiff_attorney || undefined,
          plaintiff_firm: data.plaintiff_firm || undefined,
        },
        incident: data.incident || undefined,
        damages: {
          amount_claimed: data.amount_claimed || undefined,
          specials: data.specials || undefined,
          generals: data.generals || undefined,
        },
        venue: data.venue || undefined,
      }

      // Submit intake
      const intakeResponse = await submitIntake({
        facts_json: factsJson,
        attachments: files.length > 0 ? files : undefined,
      })

      // Save to localStorage for history
      const historyItem = {
        facts_id: intakeResponse.facts_id,
        plaintiff: data.plaintiff,
        defendant: data.defendant,
        created_at: new Date().toISOString(),
        version_count: 0,
      }
      
      const existingHistory = localStorage.getItem('steno_history')
      const history = existingHistory ? JSON.parse(existingHistory) : []
      history.unshift(historyItem) // Add to beginning
      localStorage.setItem('steno_history', JSON.stringify(history))
      
      toast.success('Facts submitted successfully!')

      // Auto-generate draft
      setIsGenerating(true)
      const generateResponse = await generateDraft({
        facts_id: intakeResponse.facts_id,
      })

      toast.success('Draft generated!')
      
      // Navigate to draft page
      router.push(`/draft/${intakeResponse.facts_id}?version=${generateResponse.version}`)
    } catch (error) {
      console.error('Error:', error)
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'Failed to submit facts')
    } finally {
      setIsSubmitting(false)
      setIsGenerating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Demand Letter</h1>
        <p className="mt-2 text-gray-600">
          Upload documents (optional) and fill in the case facts below.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Documents (Optional)</h2>
          
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-blue-600">Drop files here...</p>
            ) : (
              <>
                <p className="text-gray-600 mb-2">
                  Drag & drop PDF or DOCX files here, or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Max 5 files, 10MB each
                </p>
              </>
            )}
          </div>

          {/* Uploaded Files List */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Facts Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Case Facts</h2>

          {/* Parties */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="plaintiff" className="block text-sm font-medium text-gray-700 mb-2">
                Plaintiff <span className="text-gray-400 text-xs">(auto-filled from document)</span>
              </label>
              <input
                {...register('plaintiff')}
                type="text"
                id="plaintiff"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Will be extracted from uploaded document"
              />
              {errors.plaintiff && (
                <p className="mt-1 text-sm text-red-600">{errors.plaintiff.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="defendant" className="block text-sm font-medium text-gray-700 mb-2">
                Defendant <span className="text-gray-400 text-xs">(auto-filled from document)</span>
              </label>
              <input
                {...register('defendant')}
                type="text"
                id="defendant"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Will be extracted from uploaded document"
              />
              {errors.defendant && (
                <p className="mt-1 text-sm text-red-600">{errors.defendant.message}</p>
              )}
            </div>
          </div>

          {/* Attorney Info - Always Required */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="plaintiff_attorney" className="block text-sm font-medium text-gray-700 mb-2">
                Your Name *
              </label>
              <input
                {...register('plaintiff_attorney')}
                type="text"
                id="plaintiff_attorney"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Jane Smith, Esq."
              />
              {errors.plaintiff_attorney && (
                <p className="mt-1 text-sm text-red-600">{errors.plaintiff_attorney.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="plaintiff_firm" className="block text-sm font-medium text-gray-700 mb-2">
                Your Firm *
              </label>
              <input
                {...register('plaintiff_firm')}
                type="text"
                id="plaintiff_firm"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Smith & Associates LLP"
              />
              {errors.plaintiff_firm && (
                <p className="mt-1 text-sm text-red-600">{errors.plaintiff_firm.message}</p>
              )}
            </div>
          </div>

          {/* Incident */}
          <div>
            <label htmlFor="incident" className="block text-sm font-medium text-gray-700 mb-2">
              Incident Description <span className="text-gray-400 text-xs">(auto-filled from document)</span>
            </label>
            <textarea
              {...register('incident')}
              id="incident"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Will be extracted from uploaded document..."
            />
            {errors.incident && (
              <p className="mt-1 text-sm text-red-600">{errors.incident.message}</p>
            )}
          </div>

          {/* Venue */}
          <div>
            <label htmlFor="venue" className="block text-sm font-medium text-gray-700 mb-2">
              Venue <span className="text-gray-400 text-xs">(auto-filled from document)</span>
            </label>
            <input
              {...register('venue')}
              type="text"
              id="venue"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Superior Court of California, County of Los Angeles"
            />
          </div>

          {/* Damages */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label htmlFor="amount_claimed" className="block text-sm font-medium text-gray-700 mb-2">
                Amount Claimed *
              </label>
              <input
                {...register('amount_claimed', { valueAsNumber: true })}
                type="number"
                id="amount_claimed"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="5000"
              />
              {errors.amount_claimed && (
                <p className="mt-1 text-sm text-red-600">{errors.amount_claimed.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="specials" className="block text-sm font-medium text-gray-700 mb-2">
                Special Damages (Optional)
              </label>
              <input
                {...register('specials', { valueAsNumber: true })}
                type="number"
                id="specials"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="3000"
              />
            </div>

            <div>
              <label htmlFor="generals" className="block text-sm font-medium text-gray-700 mb-2">
                General Damages (Optional)
              </label>
              <input
                {...register('generals', { valueAsNumber: true })}
                type="number"
                id="generals"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="2000"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || isGenerating}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {isSubmitting ? 'Submitting...' : 'Generating Draft...'}
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 mr-2" />
                Submit & Generate Draft
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

