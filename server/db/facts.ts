// Database operations for facts and drafts
import { query, queryOne, transaction } from '../db.js'
import type { FactsRecord, DraftRecord } from '../index.js'

/**
 * Get next facts_id by finding max counter value
 */
async function getNextFactsId(): Promise<string> {
  const result = await queryOne<{ max_id: number }>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(facts_id FROM 'facts_(\\d+)') AS INTEGER)), 0) + 1 as max_id
     FROM facts
     WHERE facts_id ~ '^facts_\\d+$'`
  )
  const nextNum = result?.max_id || 1
  return `facts_${nextNum}`
}

/**
 * Create a new facts record
 */
export async function createFacts(
  factsId: string,
  factsJson: any,
  attachments: any[],
  createdAt: string
): Promise<void> {
  await query(
    `INSERT INTO facts (facts_id, facts_json, attachments, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (facts_id) DO UPDATE
     SET facts_json = EXCLUDED.facts_json,
         attachments = EXCLUDED.attachments,
         updated_at = NOW()`,
    [factsId, JSON.stringify(factsJson), JSON.stringify(attachments), createdAt]
  )
}

/**
 * Get facts record by ID
 */
export async function getFacts(factsId: string): Promise<FactsRecord | undefined> {
  const row = await queryOne<{
    facts_id: string
    facts_json: any
    attachments: any[]
    created_at: string
  }>(
    `SELECT facts_id, facts_json, attachments, created_at
     FROM facts
     WHERE facts_id = $1`,
    [factsId]
  )

  if (!row) return undefined

  // Load drafts for this facts_id
  const drafts = await getDrafts(factsId)

  return {
    facts_id: row.facts_id,
    facts_json: row.facts_json,
    attachments: row.attachments,
    created_at: row.created_at,
    drafts
  }
}

/**
 * Get all drafts for a facts_id
 */
export async function getDrafts(factsId: string): Promise<DraftRecord[]> {
  const rows = await query<{
    version: number
    draft_md: string
    issues: any[]
    explanations: any
    input_hash: string | null
    change_log: any[]
    generated_at: string
  }>(
    `SELECT version, draft_md, issues, explanations, input_hash, change_log, generated_at
     FROM drafts
     WHERE facts_id = $1
     ORDER BY version ASC`,
    [factsId]
  )

  return rows.map(row => ({
    version: row.version,
    draft_md: row.draft_md,
    issues: row.issues || [],
    explanations: row.explanations || {},
    input_hash: row.input_hash || undefined,
    change_log: row.change_log || [],
    generated_at: row.generated_at
  }))
}

/**
 * Add a new draft version
 */
export async function addDraft(
  factsId: string,
  draft: DraftRecord
): Promise<void> {
  await query(
    `INSERT INTO drafts (facts_id, version, draft_md, issues, explanations, input_hash, change_log, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (facts_id, version) DO UPDATE
     SET draft_md = EXCLUDED.draft_md,
         issues = EXCLUDED.issues,
         explanations = EXCLUDED.explanations,
         input_hash = EXCLUDED.input_hash,
         change_log = EXCLUDED.change_log,
         generated_at = EXCLUDED.generated_at`,
    [
      factsId,
      draft.version,
      draft.draft_md,
      JSON.stringify(draft.issues || []),
      JSON.stringify(draft.explanations || {}),
      draft.input_hash || null,
      JSON.stringify(draft.change_log || []),
      draft.generated_at
    ]
  )
}

/**
 * Get a specific draft version
 */
export async function getDraft(factsId: string, version: number): Promise<DraftRecord | undefined> {
  const row = await queryOne<{
    version: number
    draft_md: string
    issues: any[]
    explanations: any
    input_hash: string | null
    change_log: any[]
    generated_at: string
  }>(
    `SELECT version, draft_md, issues, explanations, input_hash, change_log, generated_at
     FROM drafts
     WHERE facts_id = $1 AND version = $2`,
    [factsId, version]
  )

  if (!row) return undefined

  return {
    version: row.version,
    draft_md: row.draft_md,
    issues: row.issues || [],
    explanations: row.explanations || {},
    input_hash: row.input_hash || undefined,
    change_log: row.change_log || [],
    generated_at: row.generated_at
  }
}

/**
 * Generate next facts_id
 */
export async function generateFactsId(): Promise<string> {
  return await getNextFactsId()
}

