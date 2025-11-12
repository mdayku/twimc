# API Specification

Base URL (local): `http://localhost:8787`

## Endpoints

### Health Check

```http
GET /health
```

**Description**: Check if the API is running

**Response**: 200 OK
```json
{
  "status": "ok",
  "timestamp": "2024-11-12T10:30:00.000Z"
}
```

---

### Intake Facts

```http
POST /v1/intake
```

**Description**: Store case facts and return a unique identifier

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

**Error Responses**:
- `400 Bad Request`: Missing or invalid facts_json

---

### Generate Demand Letter

```http
POST /v1/generate
```

**Description**: Generate a demand letter draft using AWS Bedrock (Claude)

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

**Required**: Either `facts_id` OR `facts_json`

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
- Damages (specials and generals)
- Demand with deadline
- Exhibits list

**Fallback Behavior**:
- If Bedrock API is unavailable, returns a template-based draft
- `issues` array will note "Bedrock API unavailable" and "Using fallback template"

**Error Responses**:
- `400 Bad Request`: Missing both facts_id and facts_json
- `404 Not Found`: facts_id does not exist
- `500 Internal Server Error`: Generation failed (see details in response)

---

### Export to DOCX

```http
POST /v1/export/docx
```

**Description**: Convert markdown draft to Word document (.docx)

**Request Body**:
```json
{
  "draft_md": "# Demand Letter\n\n## Introduction\n\nThis letter...",
  "letterhead": "Law Offices of Jane Doe\n123 Main St\nSan Francisco, CA 94102"
}
```

**Required**: `draft_md` (string)

**Response**: 200 OK
- **Content-Type**: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **Content-Disposition**: `attachment; filename="demand_letter.docx"`
- **Body**: Binary DOCX file

**Document Formatting**:
- 1-inch margins on all sides
- Letterhead centered at top (if provided)
- H1 → Title style
- H2 → Heading 1 style
- H3 → Heading 2 style
- Paragraphs with appropriate spacing
- Bullet points indented

**Error Responses**:
- `400 Bad Request`: Missing draft_md
- `500 Internal Server Error`: DOCX generation failed

---

## Common Patterns

### Authentication
**MVP**: No authentication (localhost only)  
**Future**: Bearer token in `Authorization` header

### Error Response Format
```json
{
  "error": "Brief error message",
  "details": "More specific information (if available)"
}
```

### Request IDs / Correlation
**MVP**: Not implemented  
**Future**: Return `X-Request-ID` header for tracing

---

## Examples

### Full Workflow Example

```bash
# 1. Health check
curl http://localhost:8787/health

# 2. Submit facts
curl -X POST http://localhost:8787/v1/intake \
  -H "Content-Type: application/json" \
  -d '{
    "facts_json": {
      "parties": {"plaintiff": "John Doe", "defendant": "ACME Bank"},
      "incident": "Unauthorized charges on my credit card totaling $2,500...",
      "damages": {"amount_claimed": 2500}
    }
  }' | jq

# Response: {"facts_id": "facts_1"}

# 3. Generate draft
curl -X POST http://localhost:8787/v1/generate \
  -H "Content-Type: application/json" \
  -d '{"facts_id": "facts_1"}' | jq

# Response: {"draft_md": "# Demand Letter\n\n...", "issues": []}

# 4. Export to DOCX (save draft_md to file first)
echo '# Demand Letter

## Introduction

This letter is written on behalf of John Doe...' > draft.md

curl -X POST http://localhost:8787/v1/export/docx \
  -H "Content-Type: application/json" \
  -d "{\"draft_md\": $(jq -Rs . < draft.md)}" \
  --output demand_letter.docx

# Open demand_letter.docx in Word
```

### Using Direct Facts (Bypass Intake)

```bash
curl -X POST http://localhost:8787/v1/generate \
  -H "Content-Type: application/json" \
  -d @data/facts_seed.json | jq -r '.draft_md'
```

---

## Rate Limits

**MVP**: None  
**Future**: 100 requests/minute per API key

---

## Versioning

**Current**: No versioning (v1 implied in path)  
**Future**: Version in path (`/v2/generate`) for breaking changes

---

## Future Endpoints (Not Implemented)

### List Templates
```http
GET /v1/templates
```

### Create/Update Template
```http
POST /v1/templates
```

### Get Generation History
```http
GET /v1/facts/:facts_id/drafts
```

### Validate Facts
```http
POST /v1/validate
```

---

## Testing with Postman

Import this collection structure:

1. **Environment Variables**:
   - `base_url`: `http://localhost:8787`
   - `facts_id`: (set from intake response)

2. **Collection**:
   - Health Check → GET `{{base_url}}/health`
   - Intake Facts → POST `{{base_url}}/v1/intake`
     - Test script: `pm.environment.set("facts_id", pm.response.json().facts_id)`
   - Generate Draft → POST `{{base_url}}/v1/generate`
     - Body: `{"facts_id": "{{facts_id}}"}`
   - Export DOCX → POST `{{base_url}}/v1/export/docx`
     - Body: `{"draft_md": "{{draft_md}}"}`
     - Save response as file

