// DOCX export module - converts markdown to Word document
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { marked } from 'marked'
import { JSDOM } from 'jsdom'

/**
 * Convert markdown draft to DOCX buffer
 */
export async function markdownToDocxBuffer(
  md: string,
  letterhead?: string
): Promise<Buffer> {
  // Ensure md is a string
  const mdString = typeof md === 'string' ? md : String(md || '')
  
  // Parse markdown to HTML
  const html = await marked(mdString)
  const { window } = new JSDOM(html)
  const doc = window.document

  const paragraphs: Paragraph[] = []

  // Add letterhead if provided
  if (letterhead) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: letterhead, bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    )
  }

  // Convert HTML elements to DOCX paragraphs
  const elements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, ul, ol')

  elements.forEach((el: Element) => {
    const tagName = el.tagName.toLowerCase()
    
    // Skip ul/ol containers, we'll handle li elements directly
    if (tagName === 'ul' || tagName === 'ol') return
    
    const text = (el.textContent || '').trim()
    if (!text) return

    // Helper to extract text runs with formatting
    const getTextRuns = (element: Element): TextRun[] => {
      const runs: TextRun[] = []
      const processNode = (node: Node) => {
        if (node.nodeType === 3) { // Text node
          const nodeText = node.textContent || ''
          if (nodeText.trim()) {
            runs.push(new TextRun({ text: nodeText }))
          }
        } else if (node.nodeType === 1) { // Element node
          const elem = node as Element
          const elemText = elem.textContent || ''
          if (!elemText.trim()) return
          
          const tag = elem.tagName.toLowerCase()
          if (tag === 'strong' || tag === 'b') {
            runs.push(new TextRun({ text: elemText, bold: true }))
          } else if (tag === 'em' || tag === 'i') {
            runs.push(new TextRun({ text: elemText, italics: true }))
          } else {
            // Process children
            elem.childNodes.forEach(processNode)
          }
        }
      }
      
      // If element has simple text, just return it
      if (element.children.length === 0) {
        return [new TextRun({ text })]
      }
      
      // Otherwise process children
      element.childNodes.forEach(processNode)
      return runs.length > 0 ? runs : [new TextRun({ text })]
    }

    switch (tagName) {
      case 'h1':
        paragraphs.push(
          new Paragraph({
            children: getTextRuns(el),
            heading: HeadingLevel.TITLE,
            spacing: { before: 240, after: 120 },
          })
        )
        break

      case 'h2':
        paragraphs.push(
          new Paragraph({
            children: getTextRuns(el),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          })
        )
        break

      case 'h3':
        paragraphs.push(
          new Paragraph({
            children: getTextRuns(el),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        )
        break

      case 'h4':
      case 'h5':
      case 'h6':
        paragraphs.push(
          new Paragraph({
            children: getTextRuns(el),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 80 },
          })
        )
        break

      case 'li':
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: `• ${text}` })],
            spacing: { before: 60, after: 60 },
            indent: { left: 360 },
          })
        )
        break

      case 'blockquote':
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text, italics: true })],
            spacing: { before: 100, after: 100 },
            indent: { left: 720 },
          })
        )
        break

      default:
        // Regular paragraph
        paragraphs.push(
          new Paragraph({
            children: getTextRuns(el),
            spacing: { before: 100, after: 100 },
          })
        )
    }
  })
  
  // If no paragraphs were created, add the raw markdown as text
  if (paragraphs.length === 0) {
    const lines = mdString.split('\n')
    lines.forEach(line => {
      if (line.trim()) {
        paragraphs.push(new Paragraph({
          text: line,
          spacing: { after: 100 }
        }))
      }
    })
  }

  // Create the document
  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: paragraphs,
      },
    ],
  })

  // Generate buffer
  const buffer = await Packer.toBuffer(document)
  return buffer
}

