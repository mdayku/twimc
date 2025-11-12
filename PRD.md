# Product Requirements Document (PRD) - Steno Demand Letter Generator

## Top Priorities

1) Enable Bedrock Guardrails and add retry logic for transient errors
2) Add API token authentication to all endpoints (MVP-simple)
3) Support attachments array in intake and log timestamps
4) Add request/response logging with correlation IDs
5) Add basic metrics: request duration + Bedrock token usage
6) Meet performance target p95 < 5s (add simple benchmark harness)
7) Implement draft versioning (v1/v2) with change log
8) Add template management API: GET/POST /v1/templates

### Recent Changes
- Added Bearer auth for /v1/* and multipart attachments + timestamps for intake
- Implemented correlation ID logging (x-request-id) with duration in server logs
- Added Bedrock retry with exponential backoff and prompt-level guardrails
- Added in-process metrics: per-route request duration (avg) and Bedrock token usage (estimated)

## Overview

Steno is an AI-powered legal document generator that helps attorneys and paralegals create professional demand letters quickly and accurately. The system ingests case facts and generates structured legal documents using AWS Bedrock (Claude Sonnet), with export to Word format for final editing.

### Core Flow
1. **Intake**: Attorney/paralegal provides case facts (parties, incident, damages, venue)
2. **Generate**: AI produces a structured demand letter draft with all required legal sections
3. **Edit & Export**: Review, edit, and export to DOCX format

### Key Differentiators
- **Fact-based only**: No hallucinations - all assertions must be supported by provided facts
- **Structured output**: Consistent legal document format with all mandatory sections
- **Professional grade**: DOCX export with proper formatting for court filing
- **Fast iteration**: <5s p95 generation time for typical 2-page letter

## API Specification

### Base URL
Local development: `http://localhost:8787`

### Authentication
**Current**: Bearer token required for all `/v1/*` endpoints (localhost or deployed)  
Pass `Authorization: Bearer <token>`; configure one or more tokens via env: `API_TOKEN` or `API_TOKENS=token1,token2`

### Endpoints

#### Health Check
```http
GET /health
```
**Response**: 200 OK
```json
{
  "status": "ok",
  "timestamp": "2024-11-12T10:30:00.000Z"
}
```

#### Intake Facts
```http
POST /v1/intake
```
**Purpose**: Store case facts and return a unique identifier

**Headers**:
```http
Authorization: Bearer <token>
X-Request-Id: <optional-correlation-id>
```

**Request Body**:
```json
{
  "facts_json": {
    "parties": {
      "plaintiff": "Consumer",
      "defendant": "ACME Corp",
      "plaintiff_attorney": "Jane Doe, Esq."
    },
    "incident": "Detailed description of what happened...",
    "damages": {
      "amount_claimed": 5000,
      "specials": 3000,
      "generals": 2000,
      "breakdown": [
        { "item": "Medical bills", "amount": 2000 },
        { "item": "Lost wages", "amount": 1000 }
      ]
    },
    "venue": "California",
    "category": "Consumer protection",
    "incident_date": "2024-01-15",
    "demand_deadline_days": 30,
    "exhibits": [
      { "name": "Medical records", "description": "Hospital bill from Jan 15" }
    ]
  },
  "attachments": []
}
```

Or as multipart form (file uploads):

```http
Content-Type: multipart/form-data
Authorization: Bearer <token>

fields:
- facts_json: stringified JSON (same shape as above)
- attachments: one or more files (each up to 10MB; max 5 files)
```

**Required Fields**:
- `facts_json.parties.plaintiff` (string)
- `facts_json.parties.defendant` (string)
- `facts_json.incident` (string)
- `facts_json.damages` (object)

**Response**: 200 OK
```json
{
  "facts_id": "facts_1"
}
```

#### Generate Demand Letter
```http
POST /v1/generate
```
**Purpose**: Generate a demand letter draft using AWS Bedrock (Claude)

**Headers**:
```http
Authorization: Bearer <token>
X-Request-Id: <optional-correlation-id>
```

**Request Body** (Option 1 - Use stored facts):
```json
{
  "facts_id": "facts_1",
  "template_md": "# Optional template guidance...",
  "firm_style": {
    "tone": "firm but professional",
    "letterhead": "Law Offices of Jane Doe"
  }
}
```

**Request Body** (Option 2 - Direct facts):
```json
{
  "facts_json": { /* same structure as /v1/intake */ },
  "template_md": "# Optional template guidance...",
  "firm_style": {
    "tone": "firm but professional"
  }
}
```

**Response**: 200 OK
```json
{
  "draft_md": "# Demand Letter\n\n## Date and Recipient\n\n...",
  "issues": [
    "Draft contains 2 TODO placeholder(s) for missing information"
  ]
}
```

**Draft Structure** (sections in markdown):
- Recipient block and date
- Introduction
- Statement of Facts
- Liability
- Damages (specials/generals breakdown)
- Demand with deadline
- Exhibits list

#### Export to DOCX
```http
POST /v1/export/docx
```
**Purpose**: Convert markdown draft to Word document (.docx)

**Headers**:
```http
Authorization: Bearer <token>
X-Request-Id: <optional-correlation-id>
```

**Request Body**:
```json
{
  "draft_md": "# Demand Letter\n\n## Introduction\n\nThis letter...",
  "letterhead": "Law Offices of Jane Doe\n123 Main St\nSan Francisco, CA 94102"
}
```

**Response**: 200 OK
- **Content-Type**: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **Content-Disposition**: `attachment; filename="demand_letter.docx"`
- **Body**: Binary DOCX file

### Error Response Format
```json
{
  "error": "Brief error message",
  "details": "More specific information (if available)"
}
```

## Data Sources & Datasets

### Primary Data Source: CFPB Consumer Complaint Database

**Source**: Consumer Financial Protection Bureau (CFPB)  
**URL**: https://www.consumerfinance.gov/data-research/consumer-complaints/  
**API**: https://cfpb.github.io/api/ccdb/

**License**: Public Domain (U.S. Government Work)

**Usage Notes**:
- Data is anonymized by CFPB before publication
- Personally Identifiable Information (PII) has been removed
- This project uses complaint narratives only for generating synthetic test cases
- No actual consumer data is stored in production

### Repository Layout
```
twimc/
├── data/
│   ├── cfpb_importer.py       # CFPB CSV → facts_seed.json converter
│   ├── facts_seed.json        # Sample facts for testing/development
│   ├── templates/
│   │   └── generic_demand.md  # Generic demand letter template
│   └── LICENSES.md           # Data provenance documentation
```

### Sample Facts Structure
```json
{
  "parties": {
    "plaintiff": "Consumer",
    "defendant": "ACME Bank Corporation"
  },
  "incident": "On January 15, 2024, I noticed unauthorized charges totaling $2,450 on my credit card statement...",
  "damages": {
    "amount_claimed": 2800,
    "specials": 2800,
    "breakdown": [
      { "item": "Unauthorized charges", "amount": 2450 },
      { "item": "Overlimit fees", "amount": 350 }
    ]
  },
  "venue": "California",
  "category": "Credit card fraud",
  "incident_date": "2024-01-15",
  "demand_deadline_days": 30,
  "exhibits": [
    { "name": "Bank statements", "description": "January 2024 statement" }
  ]
}
```

### Tiny Importer (CSV → JSON)
```python
import csv, json
rows = []
with open('data/complaints.csv', newline='', encoding='utf-8') as f:
    for i, r in enumerate(csv.DictReader(f)):
        if i >= 1000: break
        rows.append({
          'parties': {'plaintiff':'Consumer','defendant':(r.get('company') or 'Unknown').strip()},
          'incident': (r.get('consumer_complaint_narrative') or '').strip(),
          'damages': {'amount_claimed': None},
          'venue': (r.get('state') or '').strip(),
          'category': (r.get('product') or '').strip()
        })
open('data/facts_seed.json','w',encoding='utf-8').write(json.dumps(rows, indent=2))
```

### Public Legal Templates
**Sources**:
- California Courts Self-Help Center
- Massachusetts Office of Consumer Affairs and Business Regulation
- General public legal education resources

**Usage**: Structure and format guidance only. No proprietary firm templates included.

## Requirements

### P0 Features (Must Have for MVP)

### 1. Intake Endpoint
- [x] POST `/v1/intake` accepts `facts_json` with validation
- [x] Returns unique `facts_id`
- [x] Persists facts in memory storage
- [x] Validates required fields: parties, incident, damages
- [x] Accepts optional attachments array (multipart or JSON metadata)
- [x] Logs intake with timestamp

**Acceptance Test**: Submit valid facts JSON, receive facts_id, retrieve via generate endpoint

### 2. Generate Endpoint
- [x] POST `/v1/generate` accepts either `facts_id` or direct `facts_json`
- [x] Connects to AWS Bedrock (Claude Sonnet)
- [x] Returns structured markdown draft with sections:
  - Recipient block and date
  - Introduction
  - Statement of Facts
  - Liability
  - Damages (specials/generals breakdown)
  - Demand with deadline
  - Exhibits list
- [x] Includes `issues` array noting any TODO placeholders
- [x] Falls back gracefully if Bedrock unavailable

**Acceptance Test**: Generate from sample facts, verify all sections present, check no hallucinations

### 3. DOCX Export
- [x] POST `/v1/export/docx` accepts `draft_md`
- [x] Converts markdown to properly formatted DOCX
- [x] Supports optional letterhead
- [x] Returns valid DOCX file with proper headers/paragraphs
- [x] Pagination and margins appropriate for legal document

**Acceptance Test**: Export generated draft, open in Word, verify formatting

### 4. Performance
- [x] p95 end-to-end latency < 5s for ~2-page facts input (with Bedrock)
- [x] Health endpoint responds in < 100ms
- [x] DOCX export completes in < 2s for typical letter

**Acceptance Test**: Load test with 10 concurrent requests, measure p95

### 5. Fail-Safe Behavior
- [x] Missing facts → bracketed `[TODO: ...]` placeholders
- [x] No hallucinations of facts not provided
- [x] Graceful degradation if Bedrock unavailable (fallback template)
- [x] Clear error messages for invalid inputs

**Acceptance Test**: Submit facts with missing damages, verify TODO placeholders appear

### P1 Features (Should Have, Post-MVP)

### 1. Versioning
- [ ] Track draft versions (v1, v2, etc.) per facts_id
- [ ] Change log showing what changed between versions
- [ ] Ability to restore previous version

### 2. Template Management
- [ ] GET `/v1/templates` lists available templates
- [ ] POST `/v1/templates` creates/updates firm templates
- [ ] Template includes firm style variables (tone, letterhead, signature block)
- [ ] Support multiple jurisdiction-specific templates

### 3. Explainability
- [ ] Include "why included" notes for major clauses
- [ ] Hover tooltips in web UI showing rationale from prompt
- [ ] Critic pass that checks factual support for each claim

### 4. Text Extraction
- [ ] Upload PDF/DOCX attachments via `/v1/intake`
- [ ] Automatic text extraction from uploaded files
- [ ] Merge extracted text with structured facts

### Non-Functional Requirements

### Security & Privacy
- [x] All secrets stored in `.env`, never logged
- [x] AWS credentials via standard credential chain
- [x] Bedrock Guardrails (prompt-level; native guardrails to follow)
- [ ] PII redaction in logs (configurable toggle)
- [x] API token authentication (Bearer) for `/v1/*`

### Reliability
- [x] Graceful error handling with descriptive messages
- [x] Structured logging (Fastify logger)
- [x] Request/response logging with correlation IDs
- [x] Automatic retry on transient Bedrock errors

### Maintainability
- [x] TypeScript with strict mode
- [x] Type definitions for all schemas
- [x] Pre-commit hooks (no emojis, typecheck, duplicate detection)
- [x] Justfile with standard commands (typecheck, test, lint, ship)

### Observability
- [x] Request duration metrics
- [x] Bedrock token usage tracking
- [ ] Error rate monitoring
- [ ] Cost tracking per generate request

### Testing

### Unit Tests (TBD)
- [ ] Schema validation tests
- [ ] Markdown to DOCX conversion tests
- [ ] Fallback template generation tests

### Integration Tests (TBD)
- [ ] End-to-end flow: intake → generate → export
- [ ] Bedrock integration (requires credentials)
- [ ] Error handling scenarios

### Evaluation Suite (See EVALS.md)
- [ ] 20 test cases across 4 tracks
- [ ] Metrics: completeness, factual fidelity, tone
- [ ] Gate: 0 unsupported claims, ≥80/100 average score

### Definition of Done

A feature is "done" when:
1. Code is merged to main
2. TypeScript compilation passes (`just typecheck`)
3. Pre-commit hooks pass
4. Manual smoke test passes
5. Updated in this document with [x] checkbox
6. Documented in README or API_SPEC as appropriate

