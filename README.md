# Steno Demand Letter Generator

AI-powered demand letter drafting tool for law firms. Generate professional demand letters in seconds using GPT-4o, with support for custom templates, document uploads, and Google Docs export.

## 🚀 Features

- **AI-Powered Generation**: Uses OpenAI GPT-4o to draft professional demand letters
- **Document Upload**: Extract facts from PDF/DOCX files automatically
- **Custom Templates**: Create firm-specific templates with your style and jurisdiction
- **Version History**: Track multiple drafts with automatic change logs
- **Google Docs Export**: Export to Google Docs for collaboration and comments
- **DOCX Export**: Download as Word documents for official use
- **Mobile Responsive**: Works on desktop, tablet, and mobile devices

## 📋 Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui components

**Backend:**
- Fastify (Node.js)
- TypeScript
- PostgreSQL (Neon)
- OpenAI GPT-4o API
- AWS Bedrock (optional)

**Deployment:**
- Vercel (full stack monorepo)
- Neon PostgreSQL

## 🏃 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)
- OpenAI API key

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/mdayku/twimc.git
   cd twimc
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   
   Create `.env` in the root directory:
   ```env
   # Database
   DATABASE_URL=postgresql://...
   
   # OpenAI
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL_ID=gpt-4o
   LLM_PROVIDER=openai
   
   # API Auth
   API_TOKENS=dev-token-123
   
   # Logging
   LOG_LEVEL=info
   
   # Frontend (for local dev)
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
   NEXT_PUBLIC_API_TOKEN=dev-token-123
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id-here
   ```

4. **Run database migrations**:
   ```bash
   cd server
   npm run dev
   # Migrations run automatically on startup
   ```

5. **Start development servers**:
   ```bash
   # From root directory
   npm run dev
   
   # This runs both:
   # - Backend: http://localhost:8787
   # - Frontend: http://localhost:3000
   ```

6. **Open your browser**:
   ```
   http://localhost:3000
   ```

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick Deploy to Vercel:**

```bash
vercel login
vercel
# Follow prompts and set environment variables
vercel --prod
```

The monorepo configuration deploys both frontend and backend together on the same domain!

## 📖 API Documentation

### Endpoints

- `POST /v1/intake` - Submit case facts and attachments
- `POST /v1/generate` - Generate demand letter draft
- `GET /v1/drafts/:facts_id` - Get all drafts for a case
- `POST /v1/restore/:facts_id` - Restore previous draft version
- `POST /v1/export/docx` - Export draft to DOCX
- `GET /v1/templates` - List all templates
- `POST /v1/templates` - Create/update template
- `GET /health` - Health check
- `GET /metrics` - Performance metrics

### Authentication

All `/v1/*` endpoints require Bearer token authentication:

```bash
curl -H "Authorization: Bearer dev-token-123" \
  http://localhost:8787/v1/generate
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## 📁 Project Structure

```
twimc/
├── client/              # Next.js frontend
│   ├── app/            # App router pages
│   ├── components/     # React components
│   ├── lib/           # API client and utilities
│   └── types/         # TypeScript types
├── server/             # Fastify backend
│   ├── llm/           # LLM provider implementations
│   ├── db/            # Database queries
│   ├── migrations/    # SQL migrations
│   ├── index.ts       # Main server
│   └── vercel-handler.ts  # Vercel serverless adapter
├── vercel.json        # Vercel monorepo config
└── package.json       # Root workspace config
```

## 🎯 Demo Scenario

1. Visit homepage and explore features
2. Go to `/new` and create a new demand letter
3. Upload a PDF/DOCX document (optional)
4. Fill in case facts (plaintiff, defendant, incident, damages)
5. Click "Generate Draft" (~15 seconds with GPT-4o)
6. View the markdown-formatted draft
7. Export to Google Docs or DOCX
8. Check version history and templates

## 🔒 Security

- PII redaction in logs (emails, phone numbers, SSNs)
- Rate limiting per API token
- Bearer token authentication
- Environment variable validation
- SQL injection protection (parameterized queries)

## 📝 License

Proprietary - Steno

## 🤝 Contributing

This is a private project for Steno. Contact the team for access.

## 📧 Support

For questions or issues, contact the Steno development team.
