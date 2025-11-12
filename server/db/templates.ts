// Database operations for templates
import { query, queryOne } from '../db.js'
import type { TemplateRecord } from '../index.js'

/**
 * Get all templates
 */
export async function getAllTemplates(): Promise<TemplateRecord[]> {
  const rows = await query<{
    id: string
    name: string
    description: string | null
    content: string
    jurisdiction: string | null
    firm_style: any
    created_at: string
    updated_at: string
  }>(
    `SELECT id, name, description, content, jurisdiction, firm_style, created_at, updated_at
     FROM templates
     ORDER BY created_at ASC`
  )

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    content: row.content,
    jurisdiction: row.jurisdiction || undefined,
    firm_style: row.firm_style || {},
    created_at: row.created_at,
    updated_at: row.updated_at
  }))
}

/**
 * Get template by ID
 */
export async function getTemplate(templateId: string): Promise<TemplateRecord | undefined> {
  const row = await queryOne<{
    id: string
    name: string
    description: string | null
    content: string
    jurisdiction: string | null
    firm_style: any
    created_at: string
    updated_at: string
  }>(
    `SELECT id, name, description, content, jurisdiction, firm_style, created_at, updated_at
     FROM templates
     WHERE id = $1`,
    [templateId]
  )

  if (!row) return undefined

  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    content: row.content,
    jurisdiction: row.jurisdiction || undefined,
    firm_style: row.firm_style || {},
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * Create or update template
 */
export async function upsertTemplate(template: TemplateRecord): Promise<void> {
  await query(
    `INSERT INTO templates (id, name, description, content, jurisdiction, firm_style, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name,
         description = EXCLUDED.description,
         content = EXCLUDED.content,
         jurisdiction = EXCLUDED.jurisdiction,
         firm_style = EXCLUDED.firm_style,
         updated_at = NOW()`,
    [
      template.id,
      template.name,
      template.description || null,
      template.content,
      template.jurisdiction || null,
      JSON.stringify(template.firm_style || {}),
      template.created_at,
      template.updated_at
    ]
  )
}

