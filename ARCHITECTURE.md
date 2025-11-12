# Architecture

## System Overview

Steno is a single-purpose API service that generates legal demand letters using AWS Bedrock (Claude) with a focus on factual accuracy and document formatting.

## High-Level Architecture

```mermaid
flowchart LR
    Client[Client: curl/Postman/Future UI] --> API[Node.js API - Fastify]
    API --> Store[(In-Memory Store)]
    API --> Bedrock[AWS Bedrock - Claude Sonnet]
    API --> DOCX[DOCX Export Library]
    Bedrock --> GR[Guardrails - Optional]
    API --> Logger[Structured Logging]
```

## Components

### API Server (`server/index.ts`)
- **Framework**: Fastify (lightweight, fast, TypeScript-friendly)
- **Port**: 8787 (configurable via `.env`)
- **Logging**: Pino via Fastify logger
- **State**: In-memory Map for facts storage (MVP only)

**Responsibilities**:
- Request validation
- Route handling
- Error handling and logging
- Orchestrating calls to Bedrock and DOCX modules

### Bedrock Integration (`server/bedrock.ts`)
- **SDK**: `@aws-sdk/client-bedrock-runtime` (v3)
- **Model**: Claude 3.5 Sonnet (configurable via `BEDROCK_MODEL_ID`)
- **Region**: us-east-1 (configurable via `BEDROCK_REGION`)
- **Credentials**: Standard AWS credential chain (profile, env vars, IAM role)

**Responsibilities**:
- Construct system and user prompts
- Call Bedrock InvokeModel API
- Parse Claude's response
- Detect TODO placeholders in generated drafts
- Provide fallback template if Bedrock unavailable

**Prompt Strategy**:
- **System**: Instructs Claude to be cautious, use only provided facts, insert TODO placeholders for missing info
- **User**: Includes facts JSON, template guidance, firm style preferences, required sections

**Guardrails** (Optional):
- Configured via `BEDROCK_GUARDRAILS_ID` in `.env`
- Blocks: PII/PHI, profanity, off-topic content
- Enforces: Facts-only claims, professional tone

### DOCX Export (`server/docx.ts`)
- **Library**: `docx` (9.x)
- **Markdown Parser**: `marked` + `jsdom`

**Responsibilities**:
- Parse markdown to HTML
- Convert HTML elements to DOCX paragraphs
- Apply proper heading levels (H1→Title, H2→Heading1, etc.)
- Insert letterhead block if provided
- Set page margins (1 inch all sides)
- Return buffer for streaming response

### Schema & Validation (`server/schema/intake.ts`)
- TypeScript interfaces for `FactsJson`, `Parties`, `Damages`
- Basic validation function: checks required fields, types
- Future: Use Zod or JSON Schema for comprehensive validation

### Text Extraction (`server/extract.ts`)
- Placeholder for future PDF/DOCX text extraction
- Libraries to consider: `pdf-parse`, `mammoth`
- Not implemented in MVP

## Data Flow

### Generate Demand Letter Flow

```
1. Client sends POST /v1/generate with facts_json
   └─> index.ts validates request body

2. index.ts calls generateWithBedrock(facts_json, template_md, firm_style)
   └─> bedrock.ts constructs prompt

3. bedrock.ts sends InvokeModelCommand to AWS Bedrock
   └─> Claude Sonnet processes prompt
   └─> Returns structured markdown draft

4. bedrock.ts parses response, detects TODOs
   └─> Returns { draft_md, issues }

5. index.ts returns JSON response to client
```

### Export DOCX Flow

```
1. Client sends POST /v1/export/docx with draft_md
   └─> index.ts validates request body

2. index.ts calls markdownToDocxBuffer(draft_md, letterhead)
   └─> docx.ts parses markdown → HTML → DOCX paragraphs

3. docx.ts creates Document with sections
   └─> Packer.toBuffer() generates DOCX binary

4. index.ts streams buffer with appropriate headers
   └─> Client receives demand_letter.docx file
```

## Storage (MVP)

**In-Memory Map**: `factsStore = new Map<string, any>()`

- Key: `facts_{counter}` (e.g., `facts_1`, `facts_2`)
- Value: `{ facts_json, attachments, created_at }`

**Limitations**:
- Data lost on server restart
- No persistence
- No concurrency control
- Single-server only

**Future**: Replace with Redis, PostgreSQL, or DynamoDB for production

## Configuration

All configuration via environment variables (`.env` file):

```ini
# AWS Bedrock
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_GUARDRAILS_ID=  # Optional

# Server
PORT=8787
LOG_LEVEL=info
```

## Error Handling

### Strategy
- **Validation errors**: 400 Bad Request with descriptive message
- **Not found**: 404 with specific resource identifier
- **Bedrock errors**: 500 Internal Server Error, log details, use fallback if possible
- **Unexpected errors**: 500, log stack trace, return generic message

### Fallback Behavior
- If Bedrock API fails → use `generateFallbackDraft()` with template
- Fallback draft includes TODO placeholders for dynamic sections
- Issues array includes note about fallback usage

## Security Considerations

### Current
- AWS credentials via standard chain (never in code)
- Secrets in `.env` (excluded from git)
- No authentication on API endpoints (localhost only)

### Future
- Bearer token authentication on all endpoints
- Rate limiting per client
- Input sanitization (prevent prompt injection)
- PII redaction in logs (configurable)
- Audit log for all generations (who, when, facts_id)

## Performance Characteristics

### Latency Targets
- **Health check**: < 100ms
- **Intake**: < 200ms (in-memory write)
- **Generate**: < 5s p95 (Bedrock API call)
- **Export DOCX**: < 2s (markdown parsing + DOCX generation)

### Bottlenecks
- **Bedrock API**: Network latency + model inference time (2-4s typical)
- **DOCX generation**: Parsing markdown via jsdom (~100-500ms for large docs)

### Optimization Opportunities
- Cache frequently used templates
- Stream Bedrock responses (currently waits for full completion)
- Parallelize DOCX generation if exporting multiple letters

## Deployment (Future)

### MVP: Local Development
- Run via `npm run dev`
- Access at `http://localhost:8787`

### Production Considerations
- **Container**: Dockerize with multi-stage build
- **Hosting**: AWS ECS Fargate, Lambda (with longer timeout), or EC2
- **IAM**: Service role with Bedrock InvokeModel permission only
- **Monitoring**: CloudWatch logs, X-Ray tracing
- **Secrets**: AWS Secrets Manager or Parameter Store
- **Scaling**: Stateless design allows horizontal scaling

## Technology Choices

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | Node.js 18+ | Fast, TypeScript support, AWS SDK v3 |
| Framework | Fastify | Lightweight, schema validation, Pino logging |
| LLM | AWS Bedrock (Claude Sonnet) | Enterprise-ready, guardrails, no OpenAI dependency |
| Document Export | `docx` library | Pure JS, no Office dependencies, well-maintained |
| Markdown Parser | `marked` | Fast, standards-compliant, extensible |
| HTML Parser | `jsdom` | Full DOM API for markdown→HTML→DOCX conversion |
| Language | TypeScript (strict) | Type safety, IDE support, catches errors early |

## Extension Points

### Adding New Document Types
- Create new module (e.g., `server/pdf.ts`)
- Add route in `index.ts`: `POST /v1/export/pdf`
- Use similar markdown parsing approach

### Adding Collaboration Features
- Switch to persistent storage (PostgreSQL)
- Add WebSocket support for real-time updates
- Implement OT/CRDT for concurrent editing

### Adding Clause Library
- Create `server/clauses/` directory with JSON clause database
- Add vector embeddings for semantic search
- Integrate retrieval into prompt construction

