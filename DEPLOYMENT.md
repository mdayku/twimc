# 🚀 Deployment Guide

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

## Step 1: Deploy Frontend to Vercel

### Option A: Deploy via Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from the client directory**:
   ```bash
   cd client
   vercel
   ```

4. **Follow the prompts**:
   - Set up and deploy? **Y**
   - Which scope? Select your account
   - Link to existing project? **N**
   - Project name? **twimc-client** (or your preferred name)
   - In which directory is your code located? **.**
   - Want to override settings? **N**

5. **Set environment variables**:
   ```bash
   vercel env add NEXT_PUBLIC_API_BASE_URL
   # Enter: http://localhost:8787 (for now, will update after backend deployment)
   
   vercel env add NEXT_PUBLIC_API_TOKEN
   # Enter: dev-token-123 (or your actual API token)
   
   vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID
   # Enter: your-google-client-id-here (will update after Google Cloud setup)
   ```

6. **Deploy to production**:
   ```bash
   vercel --prod
   ```

### Option B: Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository: `mdayku/twimc`
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
4. Add environment variables:
   - `NEXT_PUBLIC_API_BASE_URL` = `http://localhost:8787` (temporary)
   - `NEXT_PUBLIC_API_TOKEN` = `dev-token-123`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = `your-google-client-id-here` (temporary)
5. Click **Deploy**

## Step 2: Deploy Backend (Optional - for production)

### Option A: Deploy Backend to Vercel

1. **Create a new Vercel project for the backend**:
   ```bash
   cd ../server
   vercel
   ```

2. **Configure as Node.js project**:
   - Set environment variables in Vercel dashboard:
     - `DATABASE_URL`
     - `OPENAI_API_KEY`
     - `OPENAI_MODEL_ID`
     - `LLM_PROVIDER`
     - `API_TOKENS`
     - `LOG_LEVEL`

3. **Add `vercel.json` to server directory**:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "index.ts",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "index.ts"
       }
     ]
   }
   ```

### Option B: Keep Backend Local (For Demo)

If you're just demoing, you can keep the backend running locally on `http://localhost:8787` and update the frontend's `NEXT_PUBLIC_API_BASE_URL` to point to your local machine's IP address (if accessing from other devices) or use a tunnel service like ngrok.

## Step 3: Configure Google Cloud Console

**Note**: Do this AFTER deploying to Vercel, as you'll need the deployed URL.

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**

2. **Create a new project**:
   - Click "Select a project" → "New Project"
   - Name: "Steno Demand Letter Generator"
   - Click "Create"

3. **Enable required APIs**:
   - Go to "APIs & Services" → "Library"
   - Search and enable:
     - Google Drive API
     - Google Docs API

4. **Configure OAuth consent screen**:
   - Go to "APIs & Services" → "OAuth consent screen"
   - User Type: **External**
   - App name: **Steno Demand Letter Generator**
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
   - Name: **Steno Web Client**
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

## Step 4: Update Backend URL (if deployed)

If you deployed the backend to Vercel or another service:

1. **Update frontend environment variable**:
   ```bash
   vercel env add NEXT_PUBLIC_API_BASE_URL production
   # Enter your backend URL (e.g., https://twimc-server.vercel.app)
   ```

2. **Redeploy frontend**:
   ```bash
   vercel --prod
   ```

## Step 5: Test the Deployment

1. Visit your Vercel URL (e.g., `https://twimc-client.vercel.app`)
2. Test the intake form at `/new`
3. Upload a document and generate a draft
4. Try exporting to Google Docs (after OAuth setup)
5. Check templates and history pages

## Troubleshooting

### Frontend can't connect to backend
- Check `NEXT_PUBLIC_API_BASE_URL` is set correctly
- Ensure backend is running and accessible
- Check CORS settings if backend is on different domain

### Google OAuth not working
- Verify `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set
- Check authorized origins and redirect URIs in Google Cloud Console
- Ensure APIs are enabled (Drive, Docs)

### Environment variables not updating
- Run `vercel env pull` to sync local `.env.local`
- Redeploy after changing environment variables: `vercel --prod`

## Production Checklist

- [ ] Frontend deployed to Vercel
- [ ] Backend deployed (or running locally with tunnel)
- [ ] Google Cloud project created
- [ ] Google Drive & Docs APIs enabled
- [ ] OAuth consent screen configured
- [ ] OAuth credentials created
- [ ] Environment variables set in Vercel
- [ ] Test all features end-to-end
- [ ] Update `NEXT_PUBLIC_API_TOKEN` to a secure token (not `dev-token-123`)
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

