# Steno — Demand Letter Generator (MVP)

A focused legal document generator that helps attorneys and paralegals create professional demand letters quickly and accurately.

## Goal

Upload or enter facts, pick a template, generate a Word draft in <5s p95, and export DOCX. This MVP focuses on **accuracy to provided facts** and **clear structure** over fancy collaboration.

## Demo Flow

1. **Intake**: Attorney/paralegal fills an intake form or uploads PDFs (optional text extract)
2. **Generate**: Click Generate → LLM produces a structured draft (markdown)
3. **Edit & Export**: Quick edits (web editor) → Export DOCX, save JSON facts + draft version

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
  -d @../data/facts_seed.json

# Export to DOCX
curl -X POST http://localhost:8787/v1/export/docx \
  -H "Content-Type: application/json" \
  -d '{"draft_md":"# Test Letter\n\nThis is a test."}' \
  --output test.docx
```

## API Endpoints

- `GET /health` - Health check
- `POST /v1/intake` - Store facts and return facts_id
- `POST /v1/generate` - Generate draft from facts
- `POST /v1/export/docx` - Export markdown to DOCX

See [API_SPEC.md](./API_SPEC.md) for detailed documentation.

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

## Acceptance Criteria

See [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md) for P0/P1 features and non-functional requirements.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design and data flow.

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

