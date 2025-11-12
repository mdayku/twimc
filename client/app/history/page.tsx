'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Search, Calendar, Loader2 } from 'lucide-react'
import { getDrafts } from '@/lib/api-service'

interface HistoryItem {
  facts_id: string
  plaintiff: string
  defendant: string
  created_at: string
  version_count: number
}

export default function HistoryPage() {
  const router = useRouter()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      setIsLoading(true)
      
      // Get facts_ids from localStorage
      const storedHistory = localStorage.getItem('steno_history')
      if (!storedHistory) {
        setHistory([])
        return
      }

      const historyData: HistoryItem[] = JSON.parse(storedHistory)
      
      // Fetch version counts for each facts_id
      const historyWithVersions = await Promise.all(
        historyData.map(async (item) => {
          try {
            const draftsResponse = await getDrafts(item.facts_id)
            return {
              ...item,
              version_count: draftsResponse.total_drafts,
            }
          } catch {
            // If fetch fails, keep the item without version count
            return item
          }
        })
      )

      setHistory(historyWithVersions)
    } catch (error) {
      console.error('Error loading history:', error)
      setHistory([])
    } finally {
      setIsLoading(false)
    }
  }

  // Filter history based on search query
  const filteredHistory = history.filter((item) => {
    const query = searchQuery.toLowerCase()
    return (
      item.plaintiff.toLowerCase().includes(query) ||
      item.defendant.toLowerCase().includes(query) ||
      item.facts_id.toLowerCase().includes(query)
    )
  })

  const handleViewDraft = (factsId: string) => {
    router.push(`/draft/${factsId}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Draft History</h1>
        <p className="mt-2 text-gray-600">
          View and manage your past demand letters
        </p>
      </div>

      {/* Search */}
      {history.length > 0 && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by plaintiff, defendant, or ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          {searchQuery ? (
            <>
              <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your search query
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No demand letters yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first demand letter to see it here
              </p>
              <button
                onClick={() => router.push('/new')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <FileText className="w-5 h-5 mr-2" />
                Create New Letter
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((item) => (
            <div
              key={item.facts_id}
              onClick={() => handleViewDraft(item.facts_id)}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.plaintiff} v. {item.defendant}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                    <div>
                      {item.version_count} version{item.version_count !== 1 ? 's' : ''}
                    </div>
                    <div className="font-mono text-xs text-gray-500">
                      {item.facts_id}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleViewDraft(item.facts_id)
                  }}
                  className="ml-4 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  View Draft
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Note */}
      {history.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> History is stored locally in your browser. Clearing browser data will remove this history.
          </p>
        </div>
      )}
    </div>
  )
}
