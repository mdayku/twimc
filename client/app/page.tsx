import Link from 'next/link'
import { FileText, Upload, Download, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
          TWIMC
        </h1>
        <p className="text-lg text-gray-500 mb-2">
          To Whom It May Concern
        </p>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          AI-powered demand letter generator by <span className="font-semibold text-blue-600">Steno</span>. Generate professional letters in seconds.
        </p>
        <div className="pt-4">
          <Link
            href="/new"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <FileText className="w-5 h-5 mr-2" />
            Create New Letter
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Documents</h3>
          <p className="text-gray-600">
            Upload PDF or DOCX files. We automatically extract incident details and damages.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
            <Zap className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Generation</h3>
          <p className="text-gray-600">
            GPT-4o generates professional demand letters in ~15 seconds with all required sections.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4">
            <Download className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Export to Google Docs</h3>
          <p className="text-gray-600">
            Export directly to Google Docs for real-time collaboration, comments, and change tracking.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-lg mb-4">
            <FileText className="w-6 h-6 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Firm Templates</h3>
          <p className="text-gray-600">
            Create and manage custom templates that match your firm&apos;s style and jurisdiction.
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">How It Works</h2>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload & Input Facts</h3>
              <p className="text-gray-600">Upload source documents (optional) and fill in case facts: parties, incident, damages, venue.</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">AI Generates Draft</h3>
              <p className="text-gray-600">Our AI analyzes your facts and generates a complete demand letter with all required legal sections.</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Review & Edit</h3>
              <p className="text-gray-600">Review the draft, make edits, and regenerate if needed. Version history is automatically tracked.</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
              4
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Export & Collaborate</h3>
              <p className="text-gray-600">Export to Google Docs or DOCX. Invite colleagues, add comments, and track changes in real-time.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
