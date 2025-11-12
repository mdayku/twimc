# Demo Status - Steno Demand Letter Generator

**Status**: ✅ Working MVP Demo  
**Repository**: https://github.com/mdayku/twimc  
**Date**: November 12, 2025

## What's Built

### Core API (Node.js + TypeScript + Fastify)
- ✅ Health check endpoint
- ✅ `/v1/intake` - Store facts with validation
- ✅ `/v1/generate` - Generate demand letters via Bedrock (with fallback)
- ✅ `/v1/export/docx` - Export markdown to Word documents
- ✅ Bearer token auth for `/v1/*` endpoints
- ✅ Correlation ID logging (`x-request-id`) + request duration
- ✅ Multipart attachments support for intake + timestamps
- ✅ In-process metrics for request duration and token usage (estimated)

### Modules
- ✅ `server/bedrock.ts` - AWS Bedrock integration with Claude Sonnet
- ✅ `server/docx.ts` - Markdown to DOCX conversion
- ✅ `server/schema/intake.ts` - Type definitions and validation
- ✅ `server/extract.ts` - Placeholder for future PDF/DOCX extraction

### Data & Templates
- ✅ Sample facts dataset (`data/facts_seed.json`) - 3 realistic test cases
- ✅ Generic demand letter template (`data/templates/generic_demand.md`)
- ✅ CFPB importer script (`data/cfpb_importer.py`)
- ✅ Data provenance documentation (`data/LICENSES.md`)

### Documentation
- ✅ `README.md` - Quick start guide
- ✅ `API_SPEC.md` - Complete API documentation with examples
- ✅ `ARCHITECTURE.md` - System design with diagrams
- ✅ `ACCEPTANCE_CRITERIA.md` - P0/P1 features checklist

### Quality Gates
- ✅ TypeScript strict mode compilation
- ✅ Pre-commit hooks (emoji check, typecheck, duplicate file detection)
- ✅ Justfile with CI commands (`just typecheck`, `just ship`)
- ✅ Git repository initialized and pushed to GitHub

## Smoke Test Results

### Test 1: Health Check
```bash
curl http://localhost:8787/health
```
**Result**: ✅ 200 OK - Server running

### Test 2: Generate Demand Letter (OpenAI)
```bash
POST /v1/generate with test facts
```
**Result**: ✅ Draft generated successfully (OpenAI default)
- All required sections present (intro, facts, liability, damages, demand)
- Explanations included for major sections
- Critic pass issues included if unsupported claims found

### Test 3: Export to DOCX
```bash
POST /v1/export/docx with markdown draft
```
**Result**: ✅ Valid DOCX created (7.7 KB)
- Proper heading levels
- Letterhead support
- Ready to open in Word

### Test 4: Intake with Attachments (PDF/DOCX)
```bash
curl -X POST http://localhost:8787/v1/intake \
  -H "Authorization: Bearer dev-token-123" \
  -F 'facts_json={"parties":{"plaintiff":"Consumer","defendant":"ACME"},"incident":"","damages":{"amount_claimed":0}}' \
  -F "attachments=@./data/example/police_report.pdf" \
  -F "attachments=@./data/example/medical_report.docx"
```
**Result**: ✅ 200 OK with `facts_id`
- Extracted text stored under `extracted_text`
- Missing `incident` and `damages.amount_claimed` auto-merged when present in documents

## Next Steps to Production

### Immediate
1. Ensure `.env` uses OpenAI by default:
   ```bash
   LLM_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL_ID=gpt-4
   ```
2. Optional: switch to Bedrock by setting `LLM_PROVIDER=bedrock` and configuring AWS creds

### P1 Features (Post-MVP)
- [ ] Real-time collaborative editing
- [ ] Version history and change tracking
- [ ] Template management UI
- [x] PDF/DOCX text extraction
- [ ] Clause library with jurisdictional tags
- [x] Explainability (why each clause was included)

### Infrastructure (Production)
- [ ] Replace in-memory storage with PostgreSQL/Redis
- [x] Authentication (Bearer token)
- [ ] Rate limiting
- [x] Request logging with correlation IDs
- [ ] Cost tracking (per-request token usage)
- [ ] Deploy to production (Vercel/AWS)

## Development Commands

```bash
# Start development server
cd server
npm run dev

# Typecheck
npm run typecheck

# Full CI pipeline
cd ..
just ship

# Import CFPB data (when CSV available)
python data/cfpb_importer.py --input data/complaints.csv --output data/facts_seed.json
```

## Known Limitations (MVP)
- In-memory storage (data lost on restart)
- No authentication
- Single-server only (no horizontal scaling yet)
- Basic error handling (no retries, circuit breakers)
- Bedrock fallback template is generic (not AI-generated)

## Files Not Tracked in Git
- `.env` - Environment variables with secrets
- `node_modules/` - Dependencies
- `*.docx` - Generated test files
- `data/complaints.csv` - Large CFPB dataset (if downloaded)

## Project Metrics
- **Total Files**: 27
- **Server Code**: 5 TypeScript files
- **Documentation**: 4 comprehensive MD files
- **Sample Data**: 3 realistic fact scenarios
- **Total Lines**: ~6,000+
- **Build Time**: TypeScript compilation < 2s
- **API Latency**: 
  - Health check: < 100ms
  - Generate (OpenAI): p95 ≈ 3300ms (bench_results.json)
  - DOCX export: ~1s

