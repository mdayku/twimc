import Fastify from 'fastify'
import dotenv from 'dotenv'
import { generateWithBedrock } from './bedrock.js'
import { markdownToDocxBuffer } from './docx.js'
import multipart from '@fastify/multipart'
import type { MultipartFile } from '@fastify/multipart'
import { randomUUID } from 'crypto'
import { recordRequestDuration } from './metrics.js'

dotenv.config({ path: '../.env' })

const app = Fastify({ 
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
})

// Register multipart for attachments (MVP limits)
await app.register(multipart, {
  attachFieldsToBody: false,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 5
  }
})

// Initialize templates (load from filesystem for MVP)
async function initializeTemplates() {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')

    // Load generic demand template
    const genericTemplatePath = path.join(process.cwd(), '..', 'data', 'templates', 'generic_demand.md')
    const genericContent = await fs.readFile(genericTemplatePath, 'utf-8')

    const now = new Date().toISOString()
    const genericTemplate: TemplateRecord = {
      id: 'generic-demand',
      name: 'Generic Demand Letter',
      description: 'Standard demand letter template with sections for introduction, facts, liability, damages, and demand',
      content: genericContent,
      jurisdiction: 'General',
      firm_style: {
        tone: 'professional and firm'
      },
      created_at: now,
      updated_at: now
    }

    templatesStore.set(genericTemplate.id, genericTemplate)
    console.log('✅ Loaded generic demand template')
  } catch (error) {
    console.warn('⚠️  Could not load generic template:', error instanceof Error ? error.message : String(error))
  }
}

// Initialize templates on startup
await initializeTemplates()

// Simple Bearer token auth for all /v1/* endpoints (MVP)
const API_TOKENS = (process.env.API_TOKENS || process.env.API_TOKEN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

app.addHook('onRequest', async (req, rep) => {
  // Correlation ID: honor incoming or generate new
  const incomingCid = (req.headers['x-request-id'] as string) || ''
  const cid = incomingCid && incomingCid.trim() ? incomingCid.trim() : randomUUID()
  ;(req as any).correlationId = cid
  ;(req as any).startHrTime = process.hrtime.bigint()
  rep.header('x-request-id', cid)

  // Leave health check open
  if (!req.url.startsWith('/v1/')) return
  if (API_TOKENS.length === 0) {
    req.log.warn('API_TOKENS not set; /v1/* endpoints are unprotected')
    return
  }
  const auth = req.headers['authorization'] || ''
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token || !API_TOKENS.includes(token)) {
    return rep.code(401).send({ error: 'Unauthorized' })
  }
})

app.addHook('onResponse', async (req, rep) => {
  try {
    const start = (req as any).startHrTime as bigint | undefined
    const cid = (req as any).correlationId as string | undefined
    const durationMs = start ? Number((process.hrtime.bigint() - start) / 1000000n) : undefined
    recordRequestDuration(`${req.method} ${req.url}`, durationMs)
    req.log.info({
      cid,
      method: req.method,
      url: req.url,
      statusCode: rep.statusCode,
      durationMs
    }, 'request completed')
  } catch {
    // best-effort logging
  }
})

// In-memory storage for MVP (facts by ID with versioning)
interface FactsRecord {
  facts_id: string
  facts_json: any
  attachments: any[]
  created_at: string
  drafts: DraftRecord[]
}

interface DraftRecord {
  version: number
  draft_md: string
  issues: string[]
  generated_at: string
  change_log?: string[]
  input_hash?: string  // hash of inputs for change detection
}

interface TemplateRecord {
  id: string
  name: string
  description: string
  content: string
  jurisdiction?: string
  firm_style?: any
  created_at: string
  updated_at: string
}

const factsStore = new Map<string, FactsRecord>()
let factsIdCounter = 1

// Template store (in-memory for MVP)
const templatesStore = new Map<string, TemplateRecord>()

// Utility function to generate change log between drafts
function generateChangeLog(oldDraft: string, newDraft: string): string[] {
  const changes: string[] = []

  // Simple diff: split by sections and compare
  const oldSections = oldDraft.split(/^## /m).slice(1).map(s => s.trim())
  const newSections = newDraft.split(/^## /m).slice(1).map(s => s.trim())

  const oldSectionMap = new Map<string, string>()
  const newSectionMap = new Map<string, string>()

  oldSections.forEach(section => {
    const [title, ...content] = section.split('\n', 1)
    oldSectionMap.set(title.trim(), content.join('\n').trim())
  })

  newSections.forEach(section => {
    const [title, ...content] = section.split('\n', 1)
    newSectionMap.set(title.trim(), content.join('\n').trim())
  })

  // Check for new/modified/removed sections
  for (const [title, content] of newSectionMap) {
    if (!oldSectionMap.has(title)) {
      changes.push(`Added section: ${title}`)
    } else if (oldSectionMap.get(title) !== content) {
      changes.push(`Modified section: ${title}`)
    }
  }

  for (const title of oldSectionMap.keys()) {
    if (!newSectionMap.has(title)) {
      changes.push(`Removed section: ${title}`)
    }
  }

  // Check for TODO changes
  const oldTodos = oldDraft.match(/\[TODO:[^\]]+\]/g) || []
  const newTodos = newDraft.match(/\[TODO:[^\]]+\]/g) || []

  if (newTodos.length < oldTodos.length) {
    changes.push(`Resolved ${oldTodos.length - newTodos.length} TODO placeholder(s)`)
  } else if (newTodos.length > oldTodos.length) {
    changes.push(`Added ${newTodos.length - oldTodos.length} TODO placeholder(s)`)
  }

  return changes.length > 0 ? changes : ['Minor content updates']
}

// Generate hash of inputs for change detection
function generateInputHash(facts: any, templateMd?: string, firmStyle?: any): string {
  const input = JSON.stringify({ facts, templateMd, firmStyle })
  return require('crypto').createHash('md5').update(input).digest('hex')
}

async function bufferFromFile(file: MultipartFile): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of file.file) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

// Intake endpoint - persist facts and return ID
app.post('/v1/intake', async (req, rep) => {
  const receivedAt = new Date().toISOString()

  // Handle multipart (file uploads) and JSON bodies
  let facts_json: any = undefined
  let attachmentsMeta: Array<{ filename: string; mimetype: string; size: number }> = []
  let attachmentsRaw: Array<{ filename: string; mimetype: string; buffer: Buffer }> = []

  if ((req as any).isMultipart && (req as any).isMultipart()) {
    for await (const part of (req as any).parts()) {
      if (part.type === 'file') {
        const filePart = part as MultipartFile
        const buf = await bufferFromFile(filePart)
        attachmentsMeta.push({
          filename: filePart.filename || 'unnamed',
          mimetype: filePart.mimetype || 'application/octet-stream',
          size: buf.length
        })
        // Store raw for MVP; in production, move to object storage
        attachmentsRaw.push({
          filename: filePart.filename || 'unnamed',
          mimetype: filePart.mimetype || 'application/octet-stream',
          buffer: buf
        })
      } else if (part.type === 'field') {
        if (part.fieldname === 'facts_json') {
          try {
            facts_json = JSON.parse(part.value as string)
          } catch {
            return rep.code(400).send({ error: 'facts_json must be valid JSON string in multipart form' })
          }
        }
      }
    }
  } else {
    const { facts_json: fj, attachments } = (req.body as any) || {}
    facts_json = fj
    if (Array.isArray(attachments)) {
      attachmentsMeta = attachments.map((a: any) => ({
        filename: String(a?.filename || 'unnamed'),
        mimetype: String(a?.mimetype || 'application/octet-stream'),
        size: Number(a?.size || 0)
      }))
    }
  }

  if (!facts_json) {
    return rep.code(400).send({ error: 'facts_json is required' })
  }

  const factsId = `facts_${factsIdCounter++}`
  const factsRecord: FactsRecord = {
    facts_id: factsId,
    facts_json,
    attachments: attachmentsMeta,
    created_at: receivedAt,
    drafts: []
  }
  factsStore.set(factsId, factsRecord)

  app.log.info({ factsId, receivedAt, attachments_count: attachmentsMeta.length }, 'Facts stored')
  return { facts_id: factsId, attachments: attachmentsMeta, created_at: receivedAt }
})

// Generate endpoint - produce draft from facts (with versioning)
app.post('/v1/generate', async (req, rep) => {
  const { facts_id, facts_json, template_md, firm_style, version, template_id } = (req.body as any) || {}

  let factsRecord: FactsRecord | undefined
  let facts = facts_json

  // Allow either facts_id or direct facts_json
  if (facts_id) {
    factsRecord = factsStore.get(facts_id)
    if (!factsRecord) {
      return rep.code(404).send({ error: 'facts_id not found' })
    }
    facts = factsRecord.facts_json
  }

  if (!facts) {
    return rep.code(400).send({ error: 'Either facts_id or facts_json is required' })
  }

  // Handle template selection
  let effectiveTemplateMd = template_md
  let effectiveFirmStyle = firm_style

  if (template_id && !template_md) {
    const template = templatesStore.get(template_id)
    if (template) {
      effectiveTemplateMd = template.content
      effectiveFirmStyle = template.firm_style || firm_style
      app.log.info({ template_id, template_name: template.name }, 'Using template for generation')
    } else {
      return rep.code(404).send({ error: 'Template not found', template_id })
    }
  }

  try {
    const { draft_md, issues } = await generateWithBedrock(facts, effectiveTemplateMd, effectiveFirmStyle)

    // Create new draft version
    const inputHash = generateInputHash(facts, effectiveTemplateMd, effectiveFirmStyle)
    const newVersion = (factsRecord?.drafts.length || 0) + 1
    const generatedAt = new Date().toISOString()

    const newDraft: DraftRecord = {
      version: newVersion,
      draft_md,
      issues,
      generated_at: generatedAt,
      input_hash: inputHash,
      change_log: []
    }

    // Generate change log compared to previous version
    if (factsRecord && factsRecord.drafts.length > 0) {
      const prevDraft = factsRecord.drafts[factsRecord.drafts.length - 1]
      newDraft.change_log = generateChangeLog(prevDraft.draft_md, draft_md)
    } else {
      newDraft.change_log = ['Initial draft generated']
    }

    // Store the draft if we have a facts record
    if (factsRecord) {
      factsRecord.drafts.push(newDraft)
      factsStore.set(facts_id, factsRecord)
    }

    // Return response with versioning info
    const response = {
      draft_md,
      issues,
      version: newVersion,
      generated_at: generatedAt,
      change_log: newDraft.change_log,
      facts_id: factsRecord?.facts_id || facts_id
    }

    // If specific version requested, return that instead
    if (version && factsRecord) {
      const requestedDraft = factsRecord.drafts.find(d => d.version === version)
      if (requestedDraft) {
        return {
          draft_md: requestedDraft.draft_md,
          issues: requestedDraft.issues,
          version: requestedDraft.version,
          generated_at: requestedDraft.generated_at,
          change_log: requestedDraft.change_log,
          facts_id: factsRecord.facts_id
        }
      }
    }

    return response

  } catch (err: any) {
    app.log.error({ err }, 'Generation failed')
    return rep.code(500).send({ error: 'Generation failed', details: err.message })
  }
})

// List draft versions for a facts_id
app.get('/v1/drafts/:facts_id', async (req, rep) => {
  const { facts_id } = req.params as { facts_id: string }

  const factsRecord = factsStore.get(facts_id)
  if (!factsRecord) {
    return rep.code(404).send({ error: 'facts_id not found' })
  }

  // Return summary of drafts without full content
  const drafts = factsRecord.drafts.map(draft => ({
    version: draft.version,
    generated_at: draft.generated_at,
    issues_count: draft.issues.length,
    change_log: draft.change_log
  }))

  return {
    facts_id,
    total_drafts: drafts.length,
    drafts
  }
})

// Template management endpoints
app.get('/v1/templates', async (req, rep) => {
  const templates = Array.from(templatesStore.values()).map(template => ({
    id: template.id,
    name: template.name,
    description: template.description,
    jurisdiction: template.jurisdiction,
    firm_style: template.firm_style,
    created_at: template.created_at,
    updated_at: template.updated_at
  }))

  return { templates, total: templates.length }
})

app.post('/v1/templates', async (req, rep) => {
  const { id, name, description, content, jurisdiction, firm_style } = (req.body as any) || {}

  if (!id || !name || !content) {
    return rep.code(400).send({
      error: 'Missing required fields',
      details: 'id, name, and content are required'
    })
  }

  const now = new Date().toISOString()
  const existing = templatesStore.get(id)

  const template: TemplateRecord = {
    id,
    name,
    description: description || '',
    content,
    jurisdiction,
    firm_style,
    created_at: existing?.created_at || now,
    updated_at: now
  }

  templatesStore.set(id, template)

  app.log.info({ template_id: id, action: existing ? 'updated' : 'created' }, 'Template saved')

  return {
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
      jurisdiction: template.jurisdiction,
      firm_style: template.firm_style,
      created_at: template.created_at,
      updated_at: template.updated_at
    },
    action: existing ? 'updated' : 'created'
  }
})

// Export DOCX endpoint
app.post('/v1/export/docx', async (req, rep) => {
  const { draft_md, letterhead } = (req.body as any) || {}
  
  if (!draft_md) {
    return rep.code(400).send({ error: 'draft_md is required' })
  }

  try {
    const buf = await markdownToDocxBuffer(draft_md, letterhead)
    rep.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    rep.header('Content-Disposition', 'attachment; filename="demand_letter.docx"')
    return rep.send(buf)
  } catch (err: any) {
    app.log.error({ err }, 'DOCX export failed')
    return rep.code(500).send({ error: 'DOCX export failed', details: err.message })
  }
})

// Start server
const port = parseInt(process.env.PORT || '8787', 10)
const host = '0.0.0.0'

app.listen({ port, host }, (err, address) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  app.log.info(`Server listening at ${address}`)
})

