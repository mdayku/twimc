'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, FileText, X, Eye, Loader2, Save } from 'lucide-react'
import { getTemplates, createTemplate } from '@/lib/api-service'
import type { Template } from '@/types/api'
import ReactMarkdown from 'react-markdown'

// Validation schema
const templateSchema = z.object({
  id: z.string().min(1, 'Template ID is required').regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only'),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  content: z.string().min(10, 'Template content must be at least 10 characters'),
  jurisdiction: z.string().optional(),
})

type TemplateFormData = z.infer<typeof templateSchema>

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
  })

  const contentValue = watch('content')

  // Load templates
  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      const response = await getTemplates()
      setTemplates(response.templates)
    } catch (error: any) {
      console.error('Error loading templates:', error)
      toast.error(error.response?.data?.error || 'Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmit = async (data: TemplateFormData) => {
    try {
      setIsSaving(true)
      await createTemplate({
        id: data.id,
        name: data.name,
        description: data.description,
        content: data.content,
        jurisdiction: data.jurisdiction,
      })
      toast.success('Template saved successfully!')
      setShowModal(false)
      reset()
      loadTemplates()
    } catch (error: any) {
      console.error('Error saving template:', error)
      toast.error(error.response?.data?.error || 'Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
          <p className="mt-2 text-gray-600">
            Create and manage firm-specific demand letter templates
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Template
        </button>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first template to standardize demand letter generation
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <button
                  onClick={() => setPreviewTemplate(template)}
                  className="text-gray-400 hover:text-blue-600"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.name}</h3>
              {template.description && (
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
              )}
              {template.jurisdiction && (
                <span className="inline-block px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded">
                  {template.jurisdiction}
                </span>
              )}
              <div className="mt-4 text-xs text-gray-500">
                Updated {new Date(template.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create Template</h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  reset()
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="space-y-6">
                {/* Template ID */}
                <div>
                  <label htmlFor="id" className="block text-sm font-medium text-gray-700 mb-2">
                    Template ID *
                  </label>
                  <input
                    {...register('id')}
                    type="text"
                    id="id"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="contract-dispute"
                  />
                  {errors.id && (
                    <p className="mt-1 text-sm text-red-600">{errors.id.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Unique identifier (lowercase, hyphens allowed)
                  </p>
                </div>

                {/* Template Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    {...register('name')}
                    type="text"
                    id="name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Contract Dispute Template"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <input
                    {...register('description')}
                    type="text"
                    id="description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Template for breach of contract disputes"
                  />
                </div>

                {/* Jurisdiction */}
                <div>
                  <label htmlFor="jurisdiction" className="block text-sm font-medium text-gray-700 mb-2">
                    Jurisdiction (Optional)
                  </label>
                  <input
                    {...register('jurisdiction')}
                    type="text"
                    id="jurisdiction"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="California"
                  />
                </div>

                {/* Template Content */}
                <div>
                  <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                    Template Content (Markdown) *
                  </label>
                  <textarea
                    {...register('content')}
                    id="content"
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="# Demand Letter&#10;&#10;## Introduction&#10;This letter is written on behalf of {{plaintiff}}...&#10;&#10;## Statement of Facts&#10;{{incident}}&#10;&#10;## Damages&#10;Amount claimed: ${{amount_claimed}}"
                  />
                  {errors.content && (
                    <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Use markdown formatting. Placeholders like {'{'}{'{'} plaintiff {'}'}{'}'}  will be replaced with actual values.
                  </p>
                </div>

                {/* Preview */}
                {contentValue && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Preview</h3>
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 prose prose-sm max-w-none">
                      <ReactMarkdown>{contentValue}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    reset()
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Template
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{previewTemplate.name}</h2>
                {previewTemplate.description && (
                  <p className="text-sm text-gray-600 mt-1">{previewTemplate.description}</p>
                )}
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{previewTemplate.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
