# Acceptance Criteria

## P0 Features (Must Have for MVP)

### 1. Intake Endpoint
- [x] POST `/v1/intake` accepts `facts_json` with validation
- [x] Returns unique `facts_id`
- [x] Persists facts in memory storage
- [x] Validates required fields: parties, incident, damages
- [ ] Accepts optional attachments array
- [ ] Logs intake with timestamp

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
- [ ] p95 end-to-end latency < 5s for ~2-page facts input (with Bedrock)
- [x] Health endpoint responds in < 100ms
- [x] DOCX export completes in < 2s for typical letter

**Acceptance Test**: Load test with 10 concurrent requests, measure p95

### 5. Fail-Safe Behavior
- [x] Missing facts → bracketed `[TODO: ...]` placeholders
- [x] No hallucinations of facts not provided
- [x] Graceful degradation if Bedrock unavailable (fallback template)
- [x] Clear error messages for invalid inputs

**Acceptance Test**: Submit facts with missing damages, verify TODO placeholders appear

## P1 Features (Should Have, Post-MVP)

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

## Non-Functional Requirements

### Security & Privacy
- [x] All secrets stored in `.env`, never logged
- [x] AWS credentials via standard credential chain
- [ ] Bedrock Guardrails enabled (blocks personal health info)
- [ ] PII redaction in logs (configurable toggle)
- [ ] API token authentication (basic auth for MVP)

### Reliability
- [x] Graceful error handling with descriptive messages
- [x] Structured logging (Fastify logger)
- [ ] Request/response logging with correlation IDs
- [ ] Automatic retry on transient Bedrock errors

### Maintainability
- [x] TypeScript with strict mode
- [x] Type definitions for all schemas
- [x] Pre-commit hooks (no emojis, typecheck, duplicate detection)
- [x] Justfile with standard commands (typecheck, test, lint, ship)

### Observability
- [ ] Request duration metrics
- [ ] Bedrock token usage tracking
- [ ] Error rate monitoring
- [ ] Cost tracking per generate request

## Testing

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

## Definition of Done

A feature is "done" when:
1. Code is merged to main
2. TypeScript compilation passes (`just typecheck`)
3. Pre-commit hooks pass
4. Manual smoke test passes
5. Updated in this document with [x] checkbox
6. Documented in README or API_SPEC as appropriate

