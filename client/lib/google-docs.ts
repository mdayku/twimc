// Google Docs export functionality

export interface GoogleDocsExportResult {
  documentId: string
  documentUrl: string
  title: string
}

/**
 * Convert markdown to Google Docs format
 * This is a simplified converter - you may want to enhance it for complex markdown
 */
export function markdownToGoogleDocsRequests(markdown: string) {
  const lines = markdown.split('\n')
  const requests: Array<Record<string, unknown>> = []
  let currentIndex = 1 // Start after title

  lines.forEach((line) => {
    if (!line.trim()) {
      // Empty line - add paragraph break
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '\n',
        },
      })
      currentIndex += 1
      return
    }

    // Handle headers
    if (line.startsWith('# ')) {
      const text = line.substring(2) + '\n'
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text,
        },
      })
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: currentIndex,
            endIndex: currentIndex + text.length - 1,
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_1',
          },
          fields: 'namedStyleType',
        },
      })
      currentIndex += text.length
    } else if (line.startsWith('## ')) {
      const text = line.substring(3) + '\n'
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text,
        },
      })
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: currentIndex,
            endIndex: currentIndex + text.length - 1,
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_2',
          },
          fields: 'namedStyleType',
        },
      })
      currentIndex += text.length
    } else if (line.startsWith('### ')) {
      const text = line.substring(4) + '\n'
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text,
        },
      })
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: currentIndex,
            endIndex: currentIndex + text.length - 1,
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_3',
          },
          fields: 'namedStyleType',
        },
      })
      currentIndex += text.length
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Bullet list item
      const text = '• ' + line.substring(2) + '\n'
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text,
        },
      })
      currentIndex += text.length
    } else {
      // Regular paragraph
      const text = line + '\n'
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text,
        },
      })
      currentIndex += text.length
    }
  })

  return requests
}

/**
 * Export markdown draft to Google Docs
 * Requires user to be authenticated with Google OAuth
 */
export async function exportToGoogleDocs(
  accessToken: string,
  draftMarkdown: string,
  title: string
): Promise<GoogleDocsExportResult> {
  try {
    // Step 1: Create a new Google Doc
    const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
      }),
    })

    if (!createResponse.ok) {
      const error = await createResponse.json()
      throw new Error(`Failed to create document: ${error.error?.message || 'Unknown error'}`)
    }

    const doc = await createResponse.json()
    const documentId = doc.documentId

    // Step 2: Convert markdown to Google Docs format and insert content
    const requests = markdownToGoogleDocsRequests(draftMarkdown)

    const batchUpdateResponse = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests,
        }),
      }
    )

    if (!batchUpdateResponse.ok) {
      const error = await batchUpdateResponse.json()
      throw new Error(`Failed to update document: ${error.error?.message || 'Unknown error'}`)
    }

    // Return document info
    return {
      documentId,
      documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
      title,
    }
  } catch (error) {
    console.error('Error exporting to Google Docs:', error)
    throw error
  }
}

