# 🎯 Demo Guide for TWIMC

## Quick Demo Flow

### 1. Access Your Deployed App
Your app is now live on Vercel! Visit your deployment URL.

### 2. Sample Document for Testing
I've created a sample incident report for you to test the upload feature:

**File:** `sample_incident_report.docx` (in the root directory)

**What it contains:**
- **Plaintiff:** Sarah Johnson
- **Defendant:** ABC Delivery Services, Inc.
- **Incident:** Car accident at Main Street & Oak Avenue on January 15, 2024
- **Damages:** $44,550 total (medical, property, lost wages)
- **Details:** Driver ran red light, police report, witnesses, medical treatment

### 3. Demo Steps

#### Step 1: Homepage
- Show the clean TWIMC branding
- Highlight the 4 key features
- Click "Create New Letter"

#### Step 2: Intake Form (`/new`)
- **Upload the sample document** (drag & drop `sample_incident_report.docx`)
- Watch it extract the incident details automatically
- Fill in any remaining fields:
  - Plaintiff: Sarah Johnson
  - Defendant: ABC Delivery Services, Inc.
  - Incident: (auto-filled from document)
  - Amount Claimed: $44,550
  - Venue: Los Angeles, CA
- Click "Generate Draft"

#### Step 3: Draft View (`/draft/[factsId]`)
- Watch the AI generate the letter (~15 seconds)
- Show the markdown preview with all sections:
  - Date and recipient
  - Introduction
  - Statement of facts
  - Liability analysis
  - Damages breakdown
  - Demand for payment
- Highlight the version number (v1)

#### Step 4: Export Options
- **Export to DOCX**: Download for Word editing
- **Export to Google Docs**: (requires Google OAuth setup)
  - Shows collaboration capabilities
  - Can invite team members
  - Add comments and suggestions

#### Step 5: Additional Features
- **Templates** (`/templates`): Show custom template creation
- **History** (`/history`): Show all generated letters
- **Version History**: Generate another draft to show v2, v3, etc.

### 4. Key Talking Points

**For Law Firms:**
- ⚡ **Speed**: 15 seconds vs hours of manual drafting
- 📄 **Accuracy**: Extracts facts from source documents
- 🎨 **Customization**: Firm-specific templates
- 👥 **Collaboration**: Google Docs export for team review
- 📊 **Tracking**: Version history for all drafts

**Technical Highlights:**
- 🤖 **AI-Powered**: GPT-4o for professional legal writing
- 🔒 **Secure**: PII redaction, rate limiting, Bearer auth
- 💾 **Persistent**: PostgreSQL database (Neon)
- 🚀 **Fast**: Sub-second API responses, ~15s generation
- 📱 **Responsive**: Works on desktop, tablet, mobile

### 5. Sample Data for Manual Entry

If you want to demo without uploading a file:

```
Plaintiff: Sarah Johnson
Defendant: ABC Delivery Services, Inc.
Incident: On January 15, 2024, plaintiff was struck by defendant's delivery truck at Main Street and Oak Avenue. Defendant ran a red light.
Amount Claimed: $44,550
Venue: Los Angeles, CA
```

### 6. Troubleshooting

**If Google Docs export doesn't work:**
- This requires Google Cloud Console setup (see DEPLOYMENT.md Step 2)
- For demo purposes, focus on DOCX export which works immediately

**If generation is slow:**
- GPT-4o typically takes 10-20 seconds
- This is normal for AI generation
- Show the loading state and explain the AI is analyzing the facts

### 7. Next Steps After Demo

1. ✅ **Deployment**: Already done!
2. 🔧 **Google OAuth**: Set up Google Cloud Console for Docs export
3. 🎨 **Branding**: Add firm logo and colors
4. 📝 **Templates**: Create firm-specific templates
5. 👥 **Team Access**: Add team members with API tokens
6. 📊 **Analytics**: Monitor usage and performance

---

## 🎉 You're Ready to Demo!

The app is fully functional and production-ready. Just upload the sample document and watch TWIMC generate a professional demand letter in seconds!

**Your Vercel URL:** Check your Vercel dashboard for the deployment URL
**Sample File:** `sample_incident_report.docx` in the root directory

