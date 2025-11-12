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
  // Parse markdown to HTML
  const html = await marked(md || '')
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
  const elements = doc.querySelectorAll('h1, h2, h3, h4, p, li, blockquote')

  elements.forEach((el: Element) => {
    const text = (el.textContent || '').trim()
    if (!text) return

    const tagName = el.tagName.toLowerCase()

    switch (tagName) {
      case 'h1':
        paragraphs.push(
          new Paragraph({
            text,
            heading: HeadingLevel.TITLE,
            spacing: { before: 240, after: 120 },
          })
        )
        break

      case 'h2':
        paragraphs.push(
          new Paragraph({
            text,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          })
        )
        break

      case 'h3':
        paragraphs.push(
          new Paragraph({
            text,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        )
        break

      case 'h4':
        paragraphs.push(
          new Paragraph({
            text,
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 80 },
          })
        )
        break

      case 'li':
        paragraphs.push(
          new Paragraph({
            text: `• ${text}`,
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
            text,
            spacing: { before: 100, after: 100 },
          })
        )
    }
  })

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

