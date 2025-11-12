# Steno — Demand Letter Generator

AI-powered legal document generator that helps attorneys and paralegals create professional demand letters quickly and accurately. **Fact-based only** - no hallucinations, all assertions must be supported by provided evidence.

## Core Features

- ✅ **Structured Legal Documents**: Consistent format with all mandatory sections (introduction, facts, liability, damages, demand)
- ✅ **AI-Powered Generation**: AWS Bedrock Claude Sonnet with guardrails for factual accuracy
- ✅ **Professional Export**: DOCX format with proper legal document formatting
- ✅ **Fast Iteration**: <5s p95 generation for typical 2-page demand letters

## Demo Flow

1. **Intake**: Provide case facts (parties, incident, damages, venue)
2. **Generate**: AI produces structured demand letter draft
3. **Edit & Export**: Review, edit, and export to DOCX

## Quick Start

### Prerequisites

- Node.js 18+ and npm/pnpm
- AWS account with Bedrock access (Claude Sonnet model enabled)
- AWS credentials configured (via `~/.aws/credentials` or environment variables)

### Setup

```bash
# 1. Install dependencies
cd server
npm install

# 2. Configure environment
cp ../.env .env  # or create from .env.example
# Edit .env and set:
#   BEDROCK_REGION=us-east-1
#   BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
#   (optional) BEDROCK_GUARDRAILS_ID=grd-xxxxxxxx
#   API_TOKEN=dev-token-123              # or API_TOKENS=token1,token2

# 3. Run the server
npm run dev
```

The API will be available at `http://localhost:8787`

### Test the API

```bash
# Health check
curl http://localhost:8787/health

# Generate a demand letter
curl -X POST http://localhost:8787/v1/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token-123" \
  -d @../data/facts_seed.json

# Export to DOCX
curl -X POST http://localhost:8787/v1/export/docx \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token-123" \
  -d '{"draft_md":"# Test Letter\n\nThis is a test."}' \
  --output test.docx

# Intake with multipart (attachments)
curl -X POST http://localhost:8787/v1/intake \
  -H "Authorization: Bearer dev-token-123" \
  -F 'facts_json={"parties":{"plaintiff":"Consumer","defendant":"ACME"},"incident":"...","damages":{"amount_claimed":1000}}' \
  -F "attachments=@path/to/evidence.pdf" \
  -F "attachments=@path/to/photo.jpg"
```

## API Endpoints

- `GET /health` - Health check
- `POST /v1/intake` - Store facts and return facts_id
- `POST /v1/generate` - Generate draft from facts
- `POST /v1/export/docx` - Export markdown to DOCX

See [PRD.md](./PRD.md) for complete API specification.

## Project Structure

```
twimc/
├── server/               # Node.js API server
│   ├── index.ts         # Main Fastify server
│   ├── bedrock.ts       # AWS Bedrock integration
│   ├── docx.ts          # DOCX export
│   ├── extract.ts       # Text extraction (placeholder)
│   └── schema/          # Type definitions
├── data/                # Data and templates
│   ├── cfpb_importer.py # CFPB data converter
│   ├── facts_seed.json  # Sample facts for testing
│   ├── templates/       # Demand letter templates
│   └── LICENSES.md      # Data provenance
├── githooks/            # Git pre-commit hooks
└── scripts/             # Utility scripts
```

## Development Workflow

### Typecheck

```bash
cd server
npm run typecheck
```

### Using Justfile Commands

From project root:

```bash
just typecheck  # Run TypeScript compiler
just ship       # Run full CI pipeline (typecheck + test + lint)
```

### Pre-commit Hooks

The repository includes pre-commit hooks that:
- Block emojis in code
- Run quick typecheck on changed TS files
- Show existing files when adding new ones (avoid duplicates)

Link hooks:

```bash
# Windows (PowerShell as admin)
New-Item -ItemType SymbolicLink -Path .git\hooks\pre-commit -Target ..\..\githooks\pre-commit

# Unix/Mac
ln -sf ../../githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Data Sources

- **CFPB Consumer Complaint Database**: Public domain complaint narratives for generating test facts
- **Public legal templates**: Structure guidance from California Courts and other public resources
- All data is anonymized; see [data/LICENSES.md](./data/LICENSES.md)

## Documentation

- **[PRD.md](./PRD.md)** - Complete Product Requirements Document with API spec, acceptance criteria, and data sources
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and data flow
- **[DEMO_STATUS.md](./DEMO_STATUS.md)** - Current demo status and smoke test results

## Security & Compliance

- Secrets stored in `.env` (never committed)
- Bedrock Guardrails enabled (optional)
- PII redaction in logs (configurable)
- Basic token auth for API routes (TBD)

## Roadmap

**Current (MVP)**:
- Single-user API
- In-memory storage
- Basic template support
- DOCX export

**Next**:
- Real-time collaborative editing
- Clause library with jurisdiction tags
- Version history and change tracking
- PDF text extraction

## License

MIT (or your preferred license)

## Contributing

This is an MVP project. Contributions welcome after initial release.

