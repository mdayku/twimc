import * as pdfParse from 'pdf-parse'
import * as mammoth from 'mammoth'

/**
 * Extract text from uploaded file buffer
 * Supports PDF and DOCX formats
 */
export async function extractTextFromFile(
  buf: Buffer,
  mimeType: string
): Promise<string> {
  try {
    if (mimeType === 'application/pdf') {
      return await extractTextFromPDF(buf)
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      mimeType.includes('word')
    ) {
      return await extractTextFromDOCX(buf)
    } else {
      console.warn(`Unsupported file type for text extraction: ${mimeType}`)
      return ''
    }
  } catch (error) {
    console.error('Error extracting text from file:', error)
    return ''
  }
}

/**
 * Extract text from PDF buffer using pdf-parse
 */
async function extractTextFromPDF(buf: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buf)
    return data.text || ''
  } catch (error) {
    console.error('Error extracting text from PDF:', error)
    return ''
  }
}

/**
 * Extract text from DOCX buffer using mammoth
 */
async function extractTextFromDOCX(buf: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer: buf })
    return result.value || ''
  } catch (error) {
    console.error('Error extracting text from DOCX:', error)
    return ''
  }
}

