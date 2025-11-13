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
  
  // Parse markdown to HTML with proper options
  marked.setOptions({
    breaks: true,
    gfm: true
  })
  
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
  const elements = doc.body.querySelectorAll('*')

  // Helper to extract text runs with formatting from an element
  const getTextRuns = (element: Element): TextRun[] => {
    const runs: TextRun[] = []
    
    const processNode = (node: Node, inherited: { bold?: boolean, italic?: boolean } = {}) => {
      if (node.nodeType === 3) { // Text node
        const nodeText = node.textContent || ''
        if (nodeText.trim()) {
          runs.push(new TextRun({ 
            text: nodeText,
            bold: inherited.bold,
            italics: inherited.italic
          }))
        }
      } else if (node.nodeType === 1) { // Element node
        const elem = node as Element
        const tag = elem.tagName.toLowerCase()
        
        const newInherited = { ...inherited }
        if (tag === 'strong' || tag === 'b') {
          newInherited.bold = true
        }
        if (tag === 'em' || tag === 'i') {
          newInherited.italic = true
        }
        
        // Process children with inherited formatting
        elem.childNodes.forEach(child => processNode(child, newInherited))
      }
    }
    
    element.childNodes.forEach(node => processNode(node))
    return runs.length > 0 ? runs : [new TextRun({ text: element.textContent || '' })]
  }

  // Track which elements we've already processed
  const processed = new Set<Element>()
  
  elements.forEach((el: Element) => {
    // Skip if already processed or if it's a child of another block element
    if (processed.has(el)) return
    
    const tagName = el.tagName.toLowerCase()
    
    // Skip containers and non-block elements
    if (['html', 'body', 'ul', 'ol', 'div', 'span'].includes(tagName)) return
    
    const text = (el.textContent || '').trim()
    if (!text) return
    
    processed.add(el)

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

