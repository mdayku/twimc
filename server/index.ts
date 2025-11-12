import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })

import Fastify from 'fastify'
import { markdownToDocxBuffer } from './docx.js'
import multipart from '@fastify/multipart'
import { createHash } from 'crypto'
import type { MultipartFile } from '@fastify/multipart'
import { randomUUID } from 'crypto'
import { recordRequestDuration, recordRequestOutcome, recordOpenaiTokens, recordLlmUsageCost, getMetricsSnapshot } from './metrics.js'
import { LlmClient } from './llm/provider.js'
import { extractTextFromFile } from './extract.js'
import { initDb, closeDb } from './db.js'
import { runMigrations } from './migrations/run.js'
import * as factsDb from './db/facts.js'
import * as templatesDb from './db/templates.js'
import { createPiiRedaction, createRequestBodySerializer, createResponseBodySerializer, createErrorSerializer } from './pii.js'

// Configure PII redaction
const piiConfig = createPiiRedaction()

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        hostname: req.hostname,
        remoteAddress: req.ip,
        remotePort: req.socket?.remotePort
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        contentLength: typeof res.getHeader === 'function' ? res.getHeader('content-length') : undefined
      }),
      err: createErrorSerializer(piiConfig)
    }
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

// Add PII-safe request/response logging
app.addHook('onRequest', async (req, reply) => {
  // Log request with PII redaction
  if (piiConfig.enabled) {
    const safeBody = createRequestBodySerializer(piiConfig)(req.body)
    app.log.info({
      req: {
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          'x-request-id': req.headers['x-request-id']
        }
      },
      body: safeBody
    }, 'Request received')
  }
})

app.addHook('onResponse', async (req, reply) => {
  // Log response with PII redaction
  if (piiConfig.enabled) {
    app.log.info({
      res: {
        statusCode: reply.statusCode,
        headers: {
          'content-type': reply.getHeader('content-type'),
          'x-request-id': reply.getHeader('x-request-id')
        }
      }
    }, 'Response sent')
  }
})

// Simple Bearer token auth for all /v1/* endpoints (MVP)
const API_TOKENS = (process.env.API_TOKENS || process.env.API_TOKEN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

// Simple in-process rate limiting (per token or IP)
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000)
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 60)
type RateRecord = { count: number; resetAt: number }
const rateStore = new Map<string, RateRecord>()

function rateLimitCheck(key: string) {
  const now = Date.now()
  const rec = rateStore.get(key)
  if (!rec || rec.resetAt <= now) {
    const newRec: RateRecord = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS }
    rateStore.set(key, newRec)
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: newRec.resetAt }
  }
  if (rec.count < RATE_LIMIT_MAX) {
    rec.count += 1
    return { allowed: true, remaining: RATE_LIMIT_MAX - rec.count, resetAt: rec.resetAt }
  }
  return { allowed: false, remaining: 0, resetAt: rec.resetAt }
}

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

  // Rate limit: key by API token; fallback to IP if needed
  const rlKey = `tok:${token}`
  const result = rateLimitCheck(rlKey)
  // Rate limit headers
  rep.header('X-RateLimit-Limit', RATE_LIMIT_MAX.toString())
  rep.header('X-RateLimit-Remaining', Math.max(0, result.remaining).toString())
  rep.header('X-RateLimit-Reset', Math.floor(result.resetAt / 1000).toString())
  if (!result.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
    rep.header('Retry-After', retryAfterSec.toString())
    return rep.code(429).send({ error: 'Too Many Requests' })
  }
})

app.addHook('onResponse', async (req, rep) => {
  try {
    const start = (req as any).startHrTime as bigint | undefined
    const cid = (req as any).correlationId as string | undefined
    const durationMs = start ? Number((process.hrtime.bigint() - start) / 1000000n) : undefined
    recordRequestDuration(`${req.method} ${req.url}`, durationMs)
    recordRequestOutcome(`${req.method} ${req.url}`, rep.statusCode < 400)
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
export interface FactsRecord {
  facts_id: string
  facts_json: any
  attachments: any[]
  created_at: string
  drafts: DraftRecord[]
}

export interface DraftRecord {
  version: number
  draft_md: string
  issues: string[]
  generated_at: string
  change_log?: string[]
  input_hash?: string  // hash of inputs for change detection
  explanations?: Record<string, string>  // explanations for major clauses
}

export interface TemplateRecord {
  id: string
  name: string
  description?: string
  content: string
  jurisdiction?: string
  firm_style?: any
  created_at: string
  updated_at: string
}

// Initialize database connection and run migrations
try {
  initDb()
  await runMigrations()
  console.log('✅ Database initialized and migrations completed')
} catch (error) {
  console.error('❌ Database initialization failed:', error)
  if (process.env.DATABASE_URL) {
    throw error // Fail fast if DATABASE_URL is set but connection fails
  } else {
    console.warn('⚠️  DATABASE_URL not set, continuing with in-memory fallback (not recommended for production)')
  }
}

// Initialize templates (load from filesystem and save to database)
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

    // Save to database (upsert - will create or update)
    await templatesDb.upsertTemplate(genericTemplate)
    console.log('✅ Loaded generic demand template')
  } catch (error) {
    console.warn('⚠️  Could not load generic template:', error instanceof Error ? error.message : String(error))
  }
}

// Initialize templates on startup
await initializeTemplates()

// Initialize LLM client based on provider selection
let llmClient: LlmClient
const provider = process.env.LLM_PROVIDER || 'bedrock'

if (provider === 'openai') {
  const { OpenAILlmClient } = await import('./llm/openai.js')
  llmClient = new OpenAILlmClient()
} else {
  const { BedrockLlmClient } = await import('./llm/bedrock.js')
  llmClient = new BedrockLlmClient()
}

console.log(`✅ Initialized ${provider.toUpperCase()} LLM client`)

// Merge extracted text from attachments into structured facts
export function mergeExtractedTextWithFacts(
  facts: any,
  attachments: Array<{ filename: string; extracted_text?: string }>
): any {
  // Create a copy of facts to avoid mutation
  const mergedFacts = { ...facts }

  // Collect all extracted text from attachments
  const extractedTexts = attachments
    .filter(att => att.extracted_text && att.extracted_text.trim())
    .map(att => ({
      filename: att.filename,
      text: att.extracted_text!.trim()
    }))

  if (extractedTexts.length === 0) {
    return mergedFacts
  }

  // Add extracted text to facts
  mergedFacts.extracted_text = extractedTexts.map(et => ({
    source: et.filename,
    content: et.text
  }))

  // Try to intelligently merge specific fields if they appear to be missing
  const allText = extractedTexts.map(et => et.text).join('\n\n')

  // Look for missing plaintiff name
  if (!facts.parties?.plaintiff || facts.parties.plaintiff.trim() === '') {
    const plaintiffPatterns = [
      /Party 1[^:]*:[^:]*Name[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /Victim[^:]*:[^:]*Name[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /Driver 1[^:]*:[^:]*([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /plaintiff[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /claimant[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /injured party[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i
    ]

    for (const pattern of plaintiffPatterns) {
      const match = allText.match(pattern)
      if (match && match[1].trim().length > 3) {
        if (!mergedFacts.parties) mergedFacts.parties = {}
        mergedFacts.parties.plaintiff = match[1].trim()
        break
      }
    }
  }

  // Look for missing defendant name
  if (!facts.parties?.defendant || facts.parties.defendant.trim() === '') {
    const defendantPatterns = [
      /Employer[:\s]+([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:,? Inc\.?|,? LLC|,? Corp\.?|,? Services)?)/i,
      /Party 2[^:]*:[^:]*Employer[:\s]+([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:,? Inc\.?|,? LLC|,? Corp\.?|,? Services)?)/i,
      /At-Fault[^:]*:[^:]*Employer[:\s]+([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:,? Inc\.?|,? LLC|,? Corp\.?|,? Services)?)/i,
      /defendant[:\s]+([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:,? Inc\.?|,? LLC|,? Corp\.?|,? Services)?)/i,
      /at fault[:\s]+([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:,? Inc\.?|,? LLC|,? Corp\.?|,? Services)?)/i,
      /responsible party[:\s]+([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:,? Inc\.?|,? LLC|,? Corp\.?|,? Services)?)/i
    ]

    for (const pattern of defendantPatterns) {
      const match = allText.match(pattern)
      if (match && match[1].trim().length > 3) {
        if (!mergedFacts.parties) mergedFacts.parties = {}
        mergedFacts.parties.defendant = match[1].trim()
        break
      }
    }
  }

  // Look for missing incident description
  if (!facts.incident || facts.incident.trim() === '' || facts.incident.includes('[TODO')) {
    // Try to extract incident description from text (narrative or conclusion)
    const incidentPatterns = [
      /Narrative[:\s]*([^.]+\.[^.]+\.[^.]+\.)/i, // Get first 3 sentences of narrative
      /Officer's Conclusion[:\s]*([^.]+\.)/i,
      /incident[:\s]*([^.]*\.)/i,
      /collision[:\s]*([^.]*\.)/i,
      /accident[:\s]*([^.]*\.)/i
    ]

    for (const pattern of incidentPatterns) {
      const match = allText.match(pattern)
      if (match && match[1].trim().length > 20) {
        mergedFacts.incident = match[1].trim().replace(/\.$/, '')
        break
      }
    }
  }

  // Look for missing damage amounts
  if (!facts.damages?.amount_claimed || facts.damages.amount_claimed === 0) {
    const amountPatterns = [
      /total[^$]*\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /damages[:\s]*\$([0-9,]+(?:\.[0-9]{2})?)/i,
      /\$([0-9,]+(?:\.[0-9]{2})?)/g
    ]

    for (const pattern of amountPatterns) {
      const matches = allText.match(pattern)
      if (matches) {
        // Take the largest amount found (likely the total)
        const amounts = matches.map(m => parseFloat(m.replace(/[$,]/g, ''))).filter(a => a > 100) // Ignore small amounts
        if (amounts.length > 0) {
          mergedFacts.damages = mergedFacts.damages || {}
          mergedFacts.damages.amount_claimed = Math.max(...amounts)
          break
        }
      }
    }
  }

  // Look for missing venue
  if (!facts.venue || facts.venue.trim() === '') {
    const venuePatterns = [
      /(?:location|venue|jurisdiction)[:\s]+([A-Z][a-z]+(?:,?\s+[A-Z]{2})?)/i,
      /in ([A-Z][a-z]+,\s*[A-Z]{2})/,
      /([A-Z][a-z]+,\s*California)/i,
      /([A-Z][a-z]+,\s*CA)/
    ]

    for (const pattern of venuePatterns) {
      const match = allText.match(pattern)
      if (match && match[1].trim().length > 3) {
        mergedFacts.venue = match[1].trim()
        break
      }
    }
  }

  return mergedFacts
}

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
  return createHash('md5').update(input).digest('hex')
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
  let attachmentsMeta: Array<{ filename: string; mimetype: string; size: number; extracted_text?: string }> = []
  let attachmentsRaw: Array<{ filename: string; mimetype: string; buffer: Buffer; extracted_text?: string }> = []

  if ((req as any).isMultipart && (req as any).isMultipart()) {
    for await (const part of (req as any).parts()) {
      if (part.type === 'file') {
        const filePart = part as MultipartFile
        const buf = await bufferFromFile(filePart)
        const mimeType = filePart.mimetype || 'application/octet-stream'

        // Extract text from supported file types (PDF, DOCX)
        let extractedText = ''
        if (mimeType === 'application/pdf' ||
            mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            mimeType === 'application/msword' ||
            mimeType.includes('word')) {
          extractedText = await extractTextFromFile(buf, mimeType)
        }

        attachmentsMeta.push({
          filename: filePart.filename || 'unnamed',
          mimetype: mimeType,
          size: buf.length,
          extracted_text: extractedText || undefined
        })

        // Store raw for MVP; in production, move to object storage
        attachmentsRaw.push({
          filename: filePart.filename || 'unnamed',
          mimetype: mimeType,
          buffer: buf,
          extracted_text: extractedText || undefined
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

  // Merge extracted text from attachments into facts_json
  if (facts_json && attachmentsRaw.length > 0) {
    facts_json = mergeExtractedTextWithFacts(facts_json, attachmentsRaw)
  }

  if (!facts_json) {
    return rep.code(400).send({ error: 'facts_json is required' })
  }

  const factsId = await factsDb.generateFactsId()
  await factsDb.createFacts(factsId, facts_json, attachmentsMeta, receivedAt)

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
    factsRecord = await factsDb.getFacts(facts_id)
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
    const template = await templatesDb.getTemplate(template_id)
    if (template) {
      effectiveTemplateMd = template.content
      effectiveFirmStyle = template.firm_style || firm_style
      app.log.info({ template_id, template_name: template.name }, 'Using template for generation')
    } else {
      return rep.code(404).send({ error: 'Template not found', template_id })
    }
  }

  try {
    const { draft_md, issues, explanations, input_tokens, output_tokens } = await llmClient.generateDraft(facts, effectiveTemplateMd, effectiveFirmStyle)

    // Record LLM token usage and estimated cost
    if (provider === 'openai') {
      recordOpenaiTokens(input_tokens, output_tokens)
    }
    recordLlmUsageCost(provider as 'openai' | 'bedrock', input_tokens, output_tokens)

    // Create new draft version
    const inputHash = generateInputHash(facts, effectiveTemplateMd, effectiveFirmStyle)
    
    // Get current drafts to determine next version
    const currentDrafts = factsRecord ? await factsDb.getDrafts(facts_id) : []
    const newVersion = currentDrafts.length + 1
    const generatedAt = new Date().toISOString()

    const newDraft: DraftRecord = {
      version: newVersion,
      draft_md,
      issues,
      generated_at: generatedAt,
      input_hash: inputHash,
      change_log: [],
      explanations
    }

    // Generate change log compared to previous version
    if (currentDrafts.length > 0) {
      const prevDraft = currentDrafts[currentDrafts.length - 1]
      newDraft.change_log = generateChangeLog(prevDraft.draft_md, draft_md)
    } else {
      newDraft.change_log = ['Initial draft generated']
    }

    // Store the draft if we have a facts record
    if (factsRecord) {
      await factsDb.addDraft(facts_id, newDraft)
    }

    // Return response with versioning info
    const response = {
      draft_md,
      issues,
      explanations,
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
          explanations: requestedDraft.explanations || {},
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

// Metrics endpoint (protected with Bearer auth via onRequest hook)
app.get('/v1/metrics', async (_req, _rep) => {
  return getMetricsSnapshot()
})
// List draft versions for a facts_id
app.get('/v1/drafts/:facts_id', async (req, rep) => {
  const { facts_id } = req.params as { facts_id: string }

  const factsRecord = await factsDb.getFacts(facts_id)
  if (!factsRecord) {
    return rep.code(404).send({ error: 'facts_id not found' })
  }

  // Return summary of drafts without full content
  const drafts = factsRecord.drafts.map((draft: DraftRecord) => ({
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
  const allTemplates = await templatesDb.getAllTemplates()
  const templates = allTemplates.map(template => ({
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
  const existing = await templatesDb.getTemplate(id)

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

  await templatesDb.upsertTemplate(template)

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

// Restore previous draft version as new draft
app.post('/v1/restore/:facts_id', async (req, rep) => {
  const { facts_id } = req.params as { facts_id: string }
  const { version } = (req.body as any) || {}

  if (!version || typeof version !== 'number') {
    return rep.code(400).send({ error: 'version number is required' })
  }

  const factsRecord = await factsDb.getFacts(facts_id)
  if (!factsRecord) {
    return rep.code(404).send({ error: 'facts_id not found' })
  }

  const sourceDraft = factsRecord.drafts.find((d: DraftRecord) => d.version === version)
  if (!sourceDraft) {
    return rep.code(404).send({ error: `version ${version} not found` })
  }

  // Create new draft based on the source draft
  const newVersion = factsRecord.drafts.length + 1
  const now = new Date().toISOString()

  const restoredDraft: DraftRecord = {
    version: newVersion,
    draft_md: sourceDraft.draft_md,
    issues: [], // Clear issues for restored draft
    generated_at: now,
    input_hash: sourceDraft.input_hash,
    change_log: [`Restored from version ${version}`],
    explanations: sourceDraft.explanations
  }

  await factsDb.addDraft(facts_id, restoredDraft)

  app.log.info({ facts_id, from_version: version, to_version: newVersion }, 'Draft version restored')

  return {
    facts_id,
    restored_from_version: version,
    new_version: newVersion,
    draft_md: restoredDraft.draft_md,
    explanations: restoredDraft.explanations || {},
    generated_at: now,
    change_log: restoredDraft.change_log
  }
})

// Restore a previous draft version to latest
app.put('/v1/drafts/:facts_id/:version/restore', async (req, rep) => {
  const { facts_id, version } = req.params as { facts_id: string; version: string }
  const versionNum = parseInt(version, 10)

  const factsRecord = await factsDb.getFacts(facts_id)
  if (!factsRecord) {
    return rep.code(404).send({ error: 'facts_id not found' })
  }

  const targetDraft = factsRecord.drafts.find((d: DraftRecord) => d.version === versionNum)
  if (!targetDraft) {
    return rep.code(404).send({ error: 'version not found' })
  }

  // Create a new draft based on the target version
  const newVersion = factsRecord.drafts.length + 1
  const restoredDraft: DraftRecord = {
    version: newVersion,
    draft_md: targetDraft.draft_md,
    issues: targetDraft.issues,
    generated_at: new Date().toISOString(),
    input_hash: targetDraft.input_hash,
    change_log: [`Restored from version ${versionNum}`]
  }

  await factsDb.addDraft(facts_id, restoredDraft)

  app.log.info({ facts_id, from_version: versionNum, to_version: newVersion }, 'Draft version restored')

  return {
    facts_id,
    restored_from_version: versionNum,
    new_version: newVersion,
    generated_at: restoredDraft.generated_at,
    change_log: restoredDraft.change_log
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

// Export app for Vercel serverless or testing
export { app }

// Only start server if not in Vercel environment
if (!process.env.VERCEL) {
  const port = parseInt(process.env.PORT || '8787', 10)
  const host = '0.0.0.0'

  app.listen({ port, host }, (err, address) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    }
    app.log.info(`Server listening at ${address}`)
  })

  // Graceful shutdown
  process.on('SIGINT', async () => {
    app.log.info('Shutting down gracefully...')
    await app.close()
    await closeDb()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    app.log.info('Shutting down gracefully...')
    await app.close()
    await closeDb()
    process.exit(0)
  })
}

