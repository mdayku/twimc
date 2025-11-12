# 🚀 Deployment Guide - TWIMC

**Product:** TWIMC (To Whom It May Concern)  
**Company:** Steno

## ✅ Pre-Deployment Status

**Code Quality:**
- ✅ All TypeScript compilation passes (client + server)
- ✅ All ESLint checks pass (0 errors, 0 warnings)
- ✅ Production build successful
- ✅ All tests passing (unit + integration + e2e)

**Features Complete:**
- ✅ Backend API with OpenAI GPT-4o integration
- ✅ PostgreSQL database with migrations
- ✅ File upload and text extraction (PDF/DOCX)
- ✅ Draft generation with versioning
- ✅ Template management
- ✅ Frontend with Next.js 14, templates, history, Google Docs export

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Code is already pushed to `https://github.com/mdayku/twimc.git`
3. **Environment Variables**: You'll need to configure these in Vercel

## Step 1: Deploy Full Stack to Vercel (Monorepo)

The project is configured as a monorepo with both frontend and backend deploying together!

### Option A: Deploy via Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from the root directory**:
   ```bash
   vercel
   ```

4. **Follow the prompts**:
   - Set up and deploy? **Y**
   - Which scope? Select your account
   - Link to existing project? **N**
   - Project name? **twimc** (or your preferred name)
   - In which directory is your code located? **./** (root)
   - Want to override settings? **N**

5. **Set environment variables** (for both frontend and backend):
   ```bash
   # Frontend variables
   vercel env add NEXT_PUBLIC_API_BASE_URL
   # Enter: /api (relative path - same domain!)
   
   vercel env add NEXT_PUBLIC_API_TOKEN
   # Enter: dev-token-123 (or your actual API token)
   
   vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID
   # Enter: your-google-client-id-here (will update after Google Cloud setup)
   
   # Backend variables
   vercel env add DATABASE_URL
   # Enter: your Neon PostgreSQL connection string
   
   vercel env add OPENAI_API_KEY
   # Enter: your OpenAI API key
   
   vercel env add OPENAI_MODEL_ID
   # Enter: gpt-4o
   
   vercel env add LLM_PROVIDER
   # Enter: openai
   
   vercel env add API_TOKENS
   # Enter: dev-token-123 (or your secure token)
   
   vercel env add LOG_LEVEL
   # Enter: info
   ```

6. **Deploy to production**:
   ```bash
   vercel --prod
   ```

### Option B: Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository: `mdayku/twimc`
3. Configure project:
   - **Framework Preset**: Other (monorepo detected automatically)
   - **Root Directory**: `./` (leave as root)
   - **Build Command**: `npm run build`
4. Add environment variables (see list above in Option A, step 5)
5. Click **Deploy**

**Note:** With this setup:
- Frontend is accessible at `https://your-app.vercel.app`
- Backend API is at `https://your-app.vercel.app/api/v1/*`
- No CORS issues since they're on the same domain!

## Step 2: Configure Google Cloud Console

**Note**: Do this AFTER deploying to Vercel, as you'll need the deployed URL.

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**

2. **Create a new project**:
   - Click "Select a project" → "New Project"
   - Name: "TWIMC - Steno"
   - Click "Create"

3. **Enable required APIs**:
   - Go to "APIs & Services" → "Library"
   - Search and enable:
     - Google Drive API
     - Google Docs API

4. **Configure OAuth consent screen**:
   - Go to "APIs & Services" → "OAuth consent screen"
   - User Type: **External**
   - App name: **TWIMC by Steno**
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add the following scopes:
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/documents`
   - Test users: Add your email address

5. **Create OAuth 2.0 credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **Web application**
   - Name: **TWIMC Web Client**
   - Authorized JavaScript origins:
     - `https://your-vercel-url.vercel.app` (your deployed Vercel URL)
     - `http://localhost:3000` (for local development)
   - Authorized redirect URIs:
     - `https://your-vercel-url.vercel.app` (your deployed Vercel URL)
     - `http://localhost:3000` (for local development)
   - Click "Create"
   - **Copy the Client ID**

6. **Update Vercel environment variable**:
   ```bash
   vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID production
   # Paste your actual Google Client ID
   ```

7. **Redeploy frontend**:
   ```bash
   vercel --prod
   ```

## Step 3: Test the Deployment

1. Visit your Vercel URL (e.g., `https://twimc-client.vercel.app`)
2. Test the intake form at `/new`
3. Upload a document and generate a draft
4. Try exporting to Google Docs (after OAuth setup)
5. Check templates and history pages

## Troubleshooting

### Frontend can't connect to backend
- Check `NEXT_PUBLIC_API_BASE_URL` is set to `/api` (relative path)
- Verify backend environment variables are set in Vercel
- Check Vercel function logs for errors

### Google OAuth not working
- Verify `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set
- Check authorized origins and redirect URIs in Google Cloud Console
- Ensure APIs are enabled (Drive, Docs)

### Environment variables not updating
- Run `vercel env pull` to sync local `.env.local`
- Redeploy after changing environment variables: `vercel --prod`

## Production Checklist

- [ ] Full stack deployed to Vercel (frontend + backend together)
- [ ] All environment variables set in Vercel (frontend and backend)
- [ ] Google Cloud project created
- [ ] Google Drive & Docs APIs enabled
- [ ] OAuth consent screen configured
- [ ] OAuth credentials created with Vercel URL
- [ ] Test all features end-to-end
- [ ] Update `API_TOKENS` to a secure token (not `dev-token-123`)
- [ ] Set up custom domain (optional)

## 🎯 Demo Scenario

**Perfect for showcasing the tool:**

1. **Start at homepage** - Show the clean UI and features
2. **Go to /new** - Demonstrate the intake form
3. **Upload a sample document** - Show drag-and-drop
4. **Fill in facts** - Plaintiff, defendant, incident, damages
5. **Generate draft** - Watch the AI work (takes ~15s with GPT-4o)
6. **Show markdown preview** - Beautiful formatting
7. **Export to Google Docs** - Collaborate and comment
8. **Show version history** - Multiple drafts tracked
9. **Show templates** - Firm-specific customization

## Next Steps

After deployment:
1. Test the full workflow (see demo scenario above)
2. Invite collaborators to test
3. Monitor Vercel logs for errors
4. Consider setting up monitoring/analytics
5. Plan for production database (already using Neon PostgreSQL)

