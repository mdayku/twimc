// Facts and Intake types
export interface Parties {
  plaintiff?: string
  defendant?: string
  plaintiff_attorney?: string
  plaintiff_firm?: string
}

export interface Damages {
  amount_claimed?: number
  specials?: number
  generals?: number
  breakdown?: Array<{
    item: string
    amount: number
  }>
}

export interface FactsJson {
  parties?: Parties
  incident?: string
  damages?: Damages
  venue?: string
  category?: string
  incident_date?: string
  demand_deadline_days?: number
  exhibits?: Array<{
    name: string
    description: string
  }>
}

export interface IntakeRequest {
  facts_json: FactsJson
  attachments?: File[]
}

export interface IntakeResponse {
  facts_id: string
  attachments?: Array<{
    filename: string
    size: number
    mime_type: string
  }>
  created_at: string
}

// Generate types
export interface GenerateRequest {
  facts_id?: string
  facts_json?: FactsJson
  template_md?: string
  template_id?: string
  firm_style?: {
    tone?: string
    letterhead?: string
  }
}

export interface GenerateResponse {
  draft_md: string
  issues: string[]
  explanations?: Record<string, string>
  version: number
  generated_at: string
  change_log: string[]
  facts_id?: string
  input_tokens?: number
  output_tokens?: number
}

// Export types
export interface ExportRequest {
  draft_md: string
  letterhead?: string
}

// Template types
export interface Template {
  id: string
  name: string
  description?: string
  content: string
  jurisdiction?: string
  firm_style?: {
    tone?: string
    letterhead?: string
  }
  created_at: string
  updated_at: string
}

export interface TemplatesResponse {
  templates: Template[]
  total: number
}

export interface CreateTemplateRequest {
  id: string
  name: string
  description?: string
  content: string
  jurisdiction?: string
  firm_style?: {
    tone?: string
    letterhead?: string
  }
}

// Draft history types
export interface DraftSummary {
  version: number
  generated_at: string
  issues_count: number
  change_log: string[]
}

export interface DraftsResponse {
  facts_id: string
  total_drafts: number
  drafts: DraftSummary[]
}

// Restore types
export interface RestoreRequest {
  version: number
}

export interface RestoreResponse {
  facts_id: string
  restored_from_version: number
  new_version: number
  generated_at: string
  change_log: string[]
}

// Health check
export interface HealthResponse {
  status: string
  timestamp: string
}

// Error response
export interface ErrorResponse {
  error: string
  details?: string
}

