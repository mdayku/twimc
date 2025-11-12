import Fastify from 'fastify'
import dotenv from 'dotenv'
import { generateWithBedrock } from './bedrock.js'
import { markdownToDocxBuffer } from './docx.js'

dotenv.config({ path: '../.env' })

const app = Fastify({ 
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
})

// Simple Bearer token auth for all /v1/* endpoints (MVP)
const API_TOKENS = (process.env.API_TOKENS || process.env.API_TOKEN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

app.addHook('onRequest', async (req, rep) => {
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

// In-memory storage for MVP (facts by ID)
const factsStore = new Map<string, any>()
let factsIdCounter = 1

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

// Intake endpoint - persist facts and return ID
app.post('/v1/intake', async (req, rep) => {
  const { facts_json, attachments } = (req.body as any) || {}
  
  if (!facts_json) {
    return rep.code(400).send({ error: 'facts_json is required' })
  }

  const factsId = `facts_${factsIdCounter++}`
  factsStore.set(factsId, {
    facts_json,
    attachments: attachments || [],
    created_at: new Date().toISOString()
  })

  app.log.info({ factsId }, 'Facts stored')
  return { facts_id: factsId }
})

// Generate endpoint - produce draft from facts
app.post('/v1/generate', async (req, rep) => {
  const { facts_id, facts_json, template_md, firm_style } = (req.body as any) || {}
  
  let facts = facts_json
  
  // Allow either facts_id or direct facts_json
  if (facts_id) {
    const stored = factsStore.get(facts_id)
    if (!stored) {
      return rep.code(404).send({ error: 'facts_id not found' })
    }
    facts = stored.facts_json
  }

  if (!facts) {
    return rep.code(400).send({ error: 'Either facts_id or facts_json is required' })
  }

  try {
    const { draft_md, issues } = await generateWithBedrock(facts, template_md, firm_style)
    return { draft_md, issues }
  } catch (err: any) {
    app.log.error({ err }, 'Generation failed')
    return rep.code(500).send({ error: 'Generation failed', details: err.message })
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

