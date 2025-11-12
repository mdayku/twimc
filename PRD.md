# Product Requirements Document (PRD) - Steno Demand Letter Generator

## Top Priorities

### Backend (Complete ✅)
1) ✅ Add PII redaction in logs (configurable toggle) - COMPLETED
2) ✅ Replace in-memory storage with PostgreSQL/Redis - COMPLETED (PostgreSQL)
3) ✅ End-to-end tests: intake → generate → export - COMPLETED
4) ✅ Unit tests for DOCX conversion - COMPLETED
5) ✅ Fallback template unit tests - COMPLETED
6) ✅ Integration tests: error handling scenarios - COMPLETED
7) ✅ Provider integration tests (OpenAI) - COMPLETED

### Frontend Core Features (Complete ✅)
1) ✅ Initialize React app (Next.js/Vite) with TypeScript, Tailwind, ESLint - COMPLETED
2) ✅ Set up API client with Bearer auth and error handling - COMPLETED
3) ✅ Create routing and main layout (Home, New Letter, History, Templates) - COMPLETED
4) ✅ Build intake form with file upload (drag-and-drop, PDF/DOCX support) - COMPLETED
5) ✅ Create facts input form with validation (parties, incident, damages) - COMPLETED
6) ✅ Implement draft generation page with loading state and markdown preview - COMPLETED
7) ✅ Build draft editor with markdown support and live preview - COMPLETED
8) ✅ Set up Google OAuth 2.0 integration (Cloud Console, Drive API, Docs API) - COMPLETED
9) ✅ Implement export to Google Docs with markdown conversion - COMPLETED

### Remaining Tasks (Ready for Deployment! 🚀)
1) ✅ Create templates page (list, create, edit, preview) - COMPLETED
2) ✅ Build draft history page with version timeline - COMPLETED
3) ✅ Add UI polish (design system, toast notifications, accessibility) - COMPLETED
4) ✅ Fix all ESLint warnings and TypeScript errors - COMPLETED
5) ✅ Configure monorepo deployment (frontend + backend together) - COMPLETED
6) 🚧 Deploy to Vercel (manual: `vercel` command) - READY
7) 🚧 Configure Google Cloud Console (manual setup after Vercel deployment) - PENDING

### Recent Changes
- ✅ **Monorepo Deployment**: Configured Vercel to deploy frontend + backend together on same domain (no CORS!)
- ✅ **Serverless Ready**: Refactored backend to work as Vercel serverless functions
- ✅ **Code Quality**: All ESLint warnings fixed, TypeScript errors resolved, production build successful
- ✅ **Frontend Complete**: Templates page, history page, UI polish, Google Docs integration all implemented
- ✅ **Testing Suite Complete**: All unit tests (schema, PII, DOCX, fallback), integration tests (e2e, error handling), and provider tests passing
- ✅ **PII Redaction**: Configurable redaction of emails, phone numbers, SSNs in logs and error messages
- ✅ **PostgreSQL Migration**: Replaced in-memory storage with persistent PostgreSQL database (facts, drafts, templates)
- ✅ **Rate Limiting**: In-process rate limiting per API token with standard HTTP headers
- ✅ **OpenAI Integration**: Switched from GPT-5 to GPT-4o for faster response times (15s vs 83s)
- Added Bearer auth for /v1/* and multipart attachments + timestamps for intake
- Implemented correlation ID logging (x-request-id) with duration in server logs
- Added Bedrock retry with exponential backoff and prompt-level guardrails
- Added in-process metrics: per-route request duration (avg) and token usage tracking
- Implemented draft versioning (v1/v2) with automatic change logs and version history API
- Added draft restore functionality (POST /v1/restore/:facts_id) to create new drafts from previous versions
- Added template management API (GET/POST /v1/templates) with database-backed storage
- Enhanced generate responses with explanations for why major legal sections were included
- Added critic pass: AI reviews drafts for factual accuracy and identifies unsupported claims
- Added LLM provider abstraction: Support for both OpenAI and AWS Bedrock with simple env flag switch
- Added PDF/DOCX file upload to /v1/intake with automatic text extraction using pdf-parse and mammoth
- Implemented intelligent text merging: Extract incident details and damage amounts from uploaded documents

## Overview

Steno is an AI-powered legal document generator that helps attorneys and paralegals create professional demand letters quickly and accurately. The system ingests case facts and generates structured legal documents using either OpenAI GPT models or AWS Bedrock (Claude Sonnet), with export to Word format for final editing.

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
  ],
  "explanations": {
    "Introduction": "Included to formally introduce the demand and establish the sender's position",
    "Statement of Facts": "Included to provide chronological narrative of the events based on provided incident details",
    "Liability": "Included to explain why the defendant is legally responsible for the damages",
    "Damages": "Included to quantify the financial losses suffered based on provided damage amounts",
    "Demand": "Included to clearly state the compensation requested and deadline for response"
  },
  "version": 1,
  "generated_at": "2024-11-12T17:45:00.000Z",
  "change_log": ["Initial draft generated"],
  "facts_id": "facts_1"
}
```

**Versioning**: Each `/v1/generate` call creates a new version. Use `version` parameter to retrieve specific versions, or `PUT /v1/drafts/:facts_id/:version/restore` to create a new draft from a previous version.

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

#### List Draft Versions
```http
GET /v1/drafts/:facts_id
```

**Purpose**: List all draft versions for a facts record

**Response**: 200 OK
```json
{
  "facts_id": "facts_1",
  "total_drafts": 2,
  "drafts": [
    {
      "version": 1,
      "generated_at": "2024-11-12T17:45:00.000Z",
      "issues_count": 0,
      "change_log": ["Initial draft generated"]
    },
    {
      "version": 2,
      "generated_at": "2024-11-12T17:46:00.000Z",
      "issues_count": 1,
      "change_log": ["Modified section: Damages", "Resolved 1 TODO placeholder"]
    }
  ]
}
```

#### List Templates
```http
GET /v1/templates
```

**Purpose**: List all available demand letter templates

**Response**: 200 OK
```json
{
  "templates": [
    {
      "id": "generic-demand",
      "name": "Generic Demand Letter",
      "description": "Standard demand letter template with sections for introduction, facts, liability, damages, and demand",
      "jurisdiction": "General",
      "firm_style": {
        "tone": "professional and firm"
      },
      "created_at": "2024-11-12T17:45:00.000Z",
      "updated_at": "2024-11-12T17:45:00.000Z"
    }
  ],
  "total": 1
}
```

#### Create/Update Template
```http
POST /v1/templates
```

**Purpose**: Create a new template or update an existing one

**Request Body**:
```json
{
  "id": "contract-dispute",
  "name": "Contract Dispute Template",
  "description": "Template for breach of contract disputes",
  "content": "# Demand Letter Template\n\n## Structure Guidelines...",
  "jurisdiction": "California",
  "firm_style": {
    "tone": "firm but professional",
    "letterhead": "Law Offices of Smith & Associates"
  }
}
```

**Required Fields**: `id`, `name`, `content`

**Response**: 200 OK
```json
{
  "template": {
    "id": "contract-dispute",
    "name": "Contract Dispute Template",
    "description": "Template for breach of contract disputes",
    "jurisdiction": "California",
    "firm_style": {
      "tone": "firm but professional",
      "letterhead": "Law Offices of Smith & Associates"
    },
    "created_at": "2024-11-12T17:45:00.000Z",
    "updated_at": "2024-11-12T17:45:00.000Z"
  },
  "action": "created"
}
```

#### Restore Draft Version
```http
POST /v1/restore/:facts_id
```

**Purpose**: Create a new draft by restoring content from a previous version

**Request Body**:
```json
{
  "version": 2
}
```

**Required Fields**: `version` (number)

**Response**: 200 OK
```json
{
  "facts_id": "facts_1",
  "restored_from_version": 2,
  "new_version": 4,
  "generated_at": "2024-11-12T18:30:00.000Z",
  "change_log": ["Restored from version 2"]
}
```

### Error Response Format
```json
{
  "error": "Brief error message",
  "details": "More specific information (if available)"
}
```

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
- [x] Track draft versions (v1, v2, etc.) per facts_id
- [x] Change log showing what changed between versions
- [x] Ability to restore previous version

### 2. Template Management
- [x] GET `/v1/templates` lists available templates
- [x] POST `/v1/templates` creates/updates firm templates
- [x] Template includes firm style variables (tone, letterhead, signature block)
- [ ] Support multiple jurisdiction-specific templates

### 3. Explainability
- [x] Include "why included" notes for major clauses
- [ ] Hover tooltips in web UI showing rationale from prompt
- [x] Critic pass that checks factual support for each claim

### 4. Text Extraction
- [x] Upload PDF/DOCX attachments via `/v1/intake`
- [x] Automatic text extraction from uploaded files
- [x] Merge extracted text with structured facts

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
- [x] Bedrock/OpenAI token usage tracking
- [ ] Error rate monitoring
- [ ] Cost tracking per generate request

### Testing

### Unit Tests
- [x] Schema validation tests (facts merge & attachments)
- [ ] Markdown to DOCX conversion tests
- [ ] Fallback template generation tests

### Integration Tests
- [ ] End-to-end flow: intake → generate → export
- [ ] Provider integration (OpenAI)
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

---

## Frontend Development Plan

### Project Overview
Build a React-based web application for the Steno Demand Letter Generator that allows attorneys to upload documents, generate AI-powered demand letters, and export to Google Docs for collaboration.

**Demo Goal:** Complete intake → generate → export to Google Docs workflow

### Phase 1: Project Setup & Foundation (P0) - COMPLETED

#### 1.1 Initialize React Application
- [x] Create React app with TypeScript (Vite or Next.js)
- [x] Set up project structure (components, pages, hooks, utils, types)
- [x] Configure Tailwind CSS or preferred styling solution
- [x] Set up ESLint, Prettier, and TypeScript strict mode
- [x] Create `.env` file with API base URL and tokens

#### 1.2 API Client Setup
- [x] Create API client service (`/src/services/api.ts`)
- [x] Implement Bearer token authentication
- [x] Add request/response interceptors for error handling
- [x] Create TypeScript types for all API endpoints
- [x] Add loading states and error handling utilities

#### 1.3 Routing & Layout
- [x] Set up React Router (or Next.js routing)
- [x] Create main layout component with navigation
- [x] Define routes: Home, New Letter, Letter History, Templates, Settings
- [x] Add protected route wrapper (if multi-user in future)

### Phase 2: Core Features - Intake & Generation (P0) - COMPLETED

#### 2.1 Document Upload & Facts Intake
**User Story:** "As an attorney, I want to upload source documents and generate a draft demand letter"

- [x] Create `IntakePage` component
- [x] Build file upload component (drag-and-drop + click to upload)
  - [x] Support PDF and DOCX files
  - [x] Show file preview/name after upload
  - [x] Display file size and type
  - [x] Allow multiple file uploads
- [x] Create facts input form with fields:
  - [x] Parties (plaintiff, defendant, plaintiff_attorney)
  - [x] Incident description (textarea with character count)
  - [x] Venue (text input)
  - [x] Damages (amount_claimed, specials, generals)
  - [x] Optional: Damage breakdown (dynamic list)
- [x] Add form validation (Zod or Yup)
- [x] Implement "Submit Facts" button → POST `/v1/intake`
- [x] Handle multipart/form-data for file uploads
- [x] Display success message with `facts_id`
- [x] Show loading spinner during upload/processing

#### 2.2 Draft Generation
**User Story:** "Generate a draft demand letter using AI"

- [x] Create `GeneratePage` component (or modal)
- [x] Display submitted facts summary (read-only)
- [x] Add "Generate Draft" button → POST `/v1/generate`
- [x] Show generation progress indicator (with estimated time: ~15s)
- [x] Display generated draft in markdown preview
- [x] Show metadata: version, generated_at, issues
- [x] Add "Regenerate" button for new versions
- [x] Display version history (v1, v2, v3...)

#### 2.3 Draft Editor & Preview
**User Story:** "Edit and refine the demand letter"

- [x] Create `DraftEditor` component
- [x] Implement markdown editor (react-markdown-editor-lite or similar)
- [x] Add rich text formatting toolbar
- [x] Show live preview of formatted letter
- [x] Add "Save Draft" functionality (local state or API)
- [x] Implement undo/redo functionality
- [x] Add word count and character count

### Phase 3: Export to Google Docs (P0 - Demo Critical) - COMPLETED

#### 3.1 Google Drive Integration
**User Story:** "Export the final demand letter to Google Docs for collaboration"

- [x] Set up Google OAuth 2.0 client (Google Cloud Console) - Manual setup required
- [x] Add Google Drive API and Google Docs API scopes
- [x] Create `GoogleAuthButton` component
- [x] Implement OAuth flow (popup or redirect)
- [x] Store access token securely (session storage or state)
- [x] Add "Export to Google Docs" button on draft page

#### 3.2 Export Functionality
- [x] Create `exportToGoogleDocs` service function
- [x] Convert markdown draft to Google Docs format
  - [x] Use Google Docs API `documents.create`
  - [x] Map markdown headings to Google Docs styles
  - [x] Preserve formatting (bold, italic, lists)
- [x] Create document in user's Google Drive
- [x] Add document metadata (title: "Demand Letter - [Plaintiff] v [Defendant]")
- [x] Return shareable link to created document
- [x] Display success modal with link to open in Google Docs
- [x] Add "Copy Link" button for easy sharing

#### 3.3 Post-Export Actions
- [x] Show "Open in Google Docs" button (opens in new tab)
- [x] Display sharing instructions (invite collaborators, comment, etc.)
- [x] Add option to export to DOCX as fallback (existing API endpoint)

#### 3.4 Google Cloud Console Setup (Manual Steps Required)
- [ ] Create Google Cloud project
- [ ] Enable Google Docs API and Google Drive API
- [ ] Configure OAuth consent screen with required scopes
- [ ] Create OAuth 2.0 credentials (Web application)
- [ ] Add authorized JavaScript origins (localhost:3000)
- [ ] Copy Client ID to `.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

### Phase 4: Template Management (P0)

#### 4.1 Template Library
**User Story:** "Create and manage firm-specific demand letter templates"

- [ ] Create `TemplatesPage` component
- [ ] Fetch and display all templates → GET `/v1/templates`
- [ ] Show template cards with: name, description, created_at
- [ ] Add "Create New Template" button
- [ ] Implement template preview modal

#### 4.2 Template Editor
- [ ] Create `TemplateEditor` component
- [ ] Add form fields: name, description, content (markdown)
- [ ] Show template syntax guide (placeholders like `{{plaintiff}}`)
- [ ] Add "Save Template" button → POST `/v1/templates`
- [ ] Implement template validation
- [ ] Add "Use Template" button on intake page (dropdown selector)

#### 4.3 Template Selection in Generation
- [ ] Add template selector to intake form
- [ ] Pass `template_id` to `/v1/generate` endpoint
- [ ] Show which template was used in draft metadata

### Phase 5: Draft History & Versioning (P1)

#### 5.1 Draft History Page
- [ ] Create `HistoryPage` component
- [ ] Fetch all facts records (need new API endpoint or extend existing)
- [ ] Display list of past demand letters with:
  - [ ] Plaintiff vs Defendant
  - [ ] Created date
  - [ ] Number of versions
  - [ ] Status (draft, exported)
- [ ] Add search/filter functionality
- [ ] Implement pagination

#### 5.2 Version Management
- [ ] Fetch draft versions → GET `/v1/drafts/:facts_id`
- [ ] Display version timeline (v1, v2, v3...)
- [ ] Show diff between versions (react-diff-viewer)
- [ ] Add "Restore Version" button → POST `/v1/restore/:facts_id`
- [ ] Highlight current/active version

### Phase 6: UI/UX Polish (P1)

#### 6.1 Design System
- [ ] Create reusable component library:
  - [ ] Button (primary, secondary, danger)
  - [ ] Input, Textarea, Select
  - [ ] Card, Modal, Toast notifications
  - [ ] Loading spinner, Progress bar
  - [ ] File upload dropzone
- [ ] Implement consistent color scheme (legal/professional theme)
- [ ] Add responsive design (mobile, tablet, desktop)
- [ ] Create empty states for all pages

#### 6.2 User Feedback & Notifications
- [ ] Add toast notifications for success/error messages
- [ ] Implement loading states for all async operations
- [ ] Add confirmation modals for destructive actions
- [ ] Show validation errors inline on forms
- [ ] Add helpful tooltips and hints

#### 6.3 Accessibility
- [ ] Add ARIA labels to all interactive elements
- [ ] Ensure keyboard navigation works throughout
- [ ] Test with screen readers
- [ ] Add focus indicators
- [ ] Ensure color contrast meets WCAG AA standards

### Phase 7: Advanced Features (P2 - Nice to Have)

#### 7.1 Critic Pass Integration
- [ ] Add "Review Draft" button → POST `/v1/critic`
- [ ] Display AI-identified issues in sidebar
- [ ] Highlight problematic sections in editor
- [ ] Add "Resolve" button for each issue

#### 7.2 Metrics & Analytics
- [ ] Add analytics tracking (Plausible or similar)
- [ ] Track: letters generated, export method, generation time
- [ ] Create admin dashboard for usage stats

### Phase 8: Testing & Deployment (P0)

#### 8.1 Testing
- [ ] Write unit tests for utility functions
- [ ] Add component tests (React Testing Library)
- [ ] Create E2E tests for critical flows (Playwright or Cypress)
- [ ] Test Google OAuth flow end-to-end
- [ ] Test file upload with large files

#### 8.2 Deployment
- [ ] Deploy to Vercel (or Netlify)
- [ ] Configure environment variables
- [ ] Set up custom domain (if available)
- [ ] Add HTTPS/SSL
- [ ] Configure CORS for API calls
- [ ] Set up error monitoring (Sentry)

### Technical Stack Recommendations

**Core:**
- Framework: Next.js 14 (App Router) or Vite + React 18
- Language: TypeScript
- Styling: Tailwind CSS + shadcn/ui components
- State Management: Zustand or React Context
- Forms: React Hook Form + Zod validation
- API Client: Axios or native fetch with custom wrapper

**Key Libraries:**
- Markdown: `react-markdown` + `react-markdown-editor-lite`
- File Upload: `react-dropzone`
- Google APIs: `@react-oauth/google` + `gapi-script`
- Notifications: `react-hot-toast` or `sonner`
- Routing: Next.js routing or `react-router-dom`
- Date Formatting: `date-fns`
- Icons: `lucide-react` or `react-icons`

### Demo Day Checklist (Minimum Viable Demo)

**Must Have for Demo:**
- [x] Backend API running and tested
- [x] Landing page with clear value proposition
- [x] Intake form with file upload (PDF/DOCX)
- [x] Generate button that shows loading state
- [x] Draft preview with markdown rendering
- [x] Export to Google Docs button (OAuth flow implemented)
- [x] Success modal showing Google Docs link
- [x] Basic styling (professional, clean)
- [ ] Google Cloud Console configured (manual setup required)

**Demo Script:**
1. **Intro:** "This is Steno's Demand Letter Generator"
2. **Upload:** "I'll upload this accident report PDF..."
3. **Fill Facts:** "Enter plaintiff, defendant, and damages..."
4. **Generate:** "Click generate... AI drafts the letter in ~15 seconds"
5. **Review:** "Here's the draft with all legal sections..."
6. **Export:** "Now I'll export to Google Docs for collaboration..."
7. **Collaborate:** "I can now invite colleagues, add comments, track changes..."

### Priority Order for Development

1. **Day 1:** Project setup, API client, intake form, file upload
2. **Day 2:** Generate draft, markdown preview, basic styling
3. **Day 3:** Google OAuth, export to Google Docs, success flow
4. **Day 4:** Templates, draft history, UI polish
5. **Day 5:** Testing, deployment, demo rehearsal

### Notes
- Focus on **demo-ready** features first (P0)
- Keep UI simple and professional
- Google Docs export is the "wow" factor for demo
- Test OAuth flow thoroughly (it can be finicky)
- Have DOCX export as backup if Google Docs fails during demo

