import apiClient from './api'
import type {
  IntakeRequest,
  IntakeResponse,
  GenerateRequest,
  GenerateResponse,
  ExportRequest,
  TemplatesResponse,
  CreateTemplateRequest,
  Template,
  DraftsResponse,
  RestoreRequest,
  RestoreResponse,
  HealthResponse,
} from '@/types/api'

// Health check
export const checkHealth = async (): Promise<HealthResponse> => {
  const response = await apiClient.get<HealthResponse>('/health')
  return response.data
}

// Intake - submit facts
export const submitIntake = async (data: IntakeRequest): Promise<IntakeResponse> => {
  // If there are attachments, use FormData
  if (data.attachments && data.attachments.length > 0) {
    const formData = new FormData()
    formData.append('facts_json', JSON.stringify(data.facts_json))
    
    data.attachments.forEach((file) => {
      formData.append('attachments', file)
    })

    const response = await apiClient.post<IntakeResponse>('/v1/intake', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  // Otherwise, send JSON
  const response = await apiClient.post<IntakeResponse>('/v1/intake', {
    facts_json: data.facts_json,
  })
  return response.data
}

// Generate - create demand letter draft
export const generateDraft = async (data: GenerateRequest): Promise<GenerateResponse> => {
  const response = await apiClient.post<GenerateResponse>('/v1/generate', data)
  return response.data
}

// Export to DOCX
export const exportToDocx = async (data: ExportRequest): Promise<Blob> => {
  const response = await apiClient.post('/v1/export/docx', data, {
    responseType: 'blob',
  })
  return response.data
}

// Templates - list all
export const getTemplates = async (): Promise<TemplatesResponse> => {
  const response = await apiClient.get<TemplatesResponse>('/v1/templates')
  return response.data
}

// Templates - create or update
export const createTemplate = async (data: CreateTemplateRequest): Promise<{ template: Template; action: string }> => {
  const response = await apiClient.post<{ template: Template; action: string }>('/v1/templates', data)
  return response.data
}

// Drafts - get version history
export const getDrafts = async (factsId: string): Promise<DraftsResponse> => {
  const response = await apiClient.get<DraftsResponse>(`/v1/drafts/${factsId}`)
  return response.data
}

// Restore - create new draft from previous version
export const restoreDraft = async (factsId: string, data: RestoreRequest): Promise<RestoreResponse> => {
  const response = await apiClient.post<RestoreResponse>(`/v1/restore/${factsId}`, data)
  return response.data
}

