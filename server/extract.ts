// Optional: placeholder for PDF/DOCX text extraction
// For MVP, this is not implemented. Future: use pdf-parse, mammoth, etc.

/**
 * Extract text from uploaded file buffer (placeholder)
 */
export async function extractTextFromFile(
  buf: Buffer,
  mimeType: string
): Promise<string> {
  // TODO: Implement with pdf-parse (for PDF) or mammoth (for DOCX)
  // For now, return empty string
  console.warn('Text extraction not implemented in MVP')
  return ''
}

