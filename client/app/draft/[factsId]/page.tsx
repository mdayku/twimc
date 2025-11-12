'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { Download, FileText, Loader2, RefreshCw, Share2, ExternalLink } from 'lucide-react'
import { generateDraft, exportToDocx, getDrafts } from '@/lib/api-service'
import { exportToGoogleDocs } from '@/lib/google-docs'
import { GoogleAuthProvider } from '@/components/google-auth-button'
import type { GenerateResponse, DraftSummary } from '@/types/api'

export default function DraftPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const factsId = params.factsId as string
  const initialVersion = searchParams.get('version')

  const [draft, setDraft] = useState<GenerateResponse | null>(null)
  const [versions, setVersions] = useState<DraftSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null)
  const [googleDocUrl, setGoogleDocUrl] = useState<string | null>(null)

  // Load draft and version history
  useEffect(() => {
    const loadDraft = async () => {
      try {
        setIsLoading(true)
        
        // Get version history
        const draftsResponse = await getDrafts(factsId)
        setVersions(draftsResponse.drafts)

        // Generate initial draft if none exists
        if (draftsResponse.drafts.length === 0 || !initialVersion) {
          const generateResponse = await generateDraft({ facts_id: factsId })
          setDraft(generateResponse)
        } else {
          // For now, regenerate to get the draft content
          // In a real app, you'd have a GET endpoint to fetch specific versions
          const generateResponse = await generateDraft({ facts_id: factsId })
          setDraft(generateResponse)
        }
      } catch (error: any) {
        console.error('Error loading draft:', error)
        toast.error(error.response?.data?.error || 'Failed to load draft')
      } finally {
        setIsLoading(false)
      }
    }

    if (factsId) {
      loadDraft()
    }
  }, [factsId, initialVersion])

  const handleRegenerate = async () => {
    try {
      setIsRegenerating(true)
      const generateResponse = await generateDraft({ facts_id: factsId })
      setDraft(generateResponse)
      
      // Refresh version history
      const draftsResponse = await getDrafts(factsId)
      setVersions(draftsResponse.drafts)
      
      toast.success(`Generated version ${generateResponse.version}`)
    } catch (error: any) {
      console.error('Error regenerating:', error)
      toast.error(error.response?.data?.error || 'Failed to regenerate draft')
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleExportDocx = async () => {
    if (!draft) return

    try {
      setIsExporting(true)
      const blob = await exportToDocx({ draft_md: draft.draft_md })
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `demand_letter_${factsId}_v${draft.version}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success('DOCX exported successfully')
    } catch (error: any) {
      console.error('Error exporting:', error)
      toast.error(error.response?.data?.error || 'Failed to export to DOCX')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportGoogleDocs = async () => {
    if (!draft) return
    if (!googleAccessToken) {
      toast.error('Please sign in with Google first')
      return
    }

    try {
      setIsExporting(true)
      const title = `Demand Letter - ${factsId} v${draft.version}`
      
      const result = await exportToGoogleDocs(googleAccessToken, draft.draft_md, title)
      
      setGoogleDocUrl(result.documentUrl)
      toast.success('Exported to Google Docs!')
    } catch (error: any) {
      console.error('Error exporting to Google Docs:', error)
      toast.error(error.message || 'Failed to export to Google Docs')
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading draft...</p>
        </div>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Draft Not Found</h2>
          <p className="text-red-700">Unable to load the draft. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <GoogleAuthProvider>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Demand Letter Draft</h1>
          <p className="mt-1 text-sm text-gray-600">
            Version {draft.version} • Generated {new Date(draft.generated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Draft Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{draft.draft_md}</ReactMarkdown>
            </div>
          </div>

          {/* Export Actions */}
          <div className="mt-6 space-y-4">
            {/* Google Docs Export */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">Export to Google Docs</h3>
              <p className="text-sm text-blue-700 mb-4">
                Export to Google Docs for real-time collaboration, comments, and change tracking.
              </p>
              
              {!googleAccessToken ? (
                <div>
                  <p className="text-sm text-blue-700 mb-3">Sign in with Google to export:</p>
                  <button
                    onClick={() => {
                      // Trigger Google OAuth flow
                      // For demo, we'll use a simple prompt
                      const token = prompt('For demo: Enter a mock Google access token (or press OK to simulate)')
                      if (token !== null) {
                        setGoogleAccessToken(token || 'mock-token-for-demo')
                        toast.success('Connected to Google (Demo Mode)')
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Sign in with Google
                  </button>
                </div>
              ) : googleDocUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center text-green-700">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Exported successfully!</span>
                  </div>
                  <a
                    href={googleDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in Google Docs
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(googleDocUrl)
                      toast.success('Link copied to clipboard')
                    }}
                    className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Copy Link
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleExportGoogleDocs}
                  disabled={isExporting}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Share2 className="w-5 h-5 mr-2" />
                      Export to Google Docs
                    </>
                  )}
                </button>
              )}
            </div>

            {/* DOCX Export (Fallback) */}
            <div>
              <button
                onClick={handleExportDocx}
                disabled={isExporting}
                className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-md text-base font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Export to DOCX (Fallback)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-600">Facts ID</dt>
                <dd className="font-mono text-xs text-gray-900">{factsId}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Version</dt>
                <dd className="text-gray-900">{draft.version}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Generated</dt>
                <dd className="text-gray-900">
                  {new Date(draft.generated_at).toLocaleDateString()}
                </dd>
              </div>
              {draft.input_tokens && (
                <div>
                  <dt className="text-gray-600">Tokens</dt>
                  <dd className="text-gray-900">
                    {draft.input_tokens} in / {draft.output_tokens} out
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Issues */}
          {draft.issues && draft.issues.length > 0 && (
            <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
              <h3 className="text-lg font-semibold text-yellow-900 mb-3">Issues</h3>
              <ul className="space-y-2 text-sm text-yellow-800">
                {draft.issues.map((issue, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">⚠️</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Version History */}
          {versions.length > 1 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Version History</h3>
              <div className="space-y-3">
                {versions.map((v) => (
                  <div
                    key={v.version}
                    className={`p-3 rounded-lg border ${
                      v.version === draft.version
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Version {v.version}</span>
                      {v.version === draft.version && (
                        <span className="text-xs text-blue-600 font-medium">Current</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      {new Date(v.generated_at).toLocaleString()}
                    </p>
                    {v.issues_count > 0 && (
                      <p className="text-xs text-yellow-600 mt-1">
                        {v.issues_count} issue(s)
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Change Log */}
          {draft.change_log && draft.change_log.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Change Log</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {draft.change_log.map((change, index) => (
                  <li key={index} className="flex items-start">
                    <FileText className="w-4 h-4 mr-2 mt-0.5 text-gray-400" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
    </GoogleAuthProvider>
  )
}

