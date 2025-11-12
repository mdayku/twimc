// Debug the merge function
console.log('Starting debug...')

// Copy the merge function locally to avoid server startup
function mergeExtractedTextWithFacts(
  facts,
  attachments
) {
  // Create a copy of facts to avoid mutation
  const mergedFacts = { ...facts }

  // Collect all extracted text from attachments
  const extractedTexts = attachments
    .filter(att => att.extracted_text && att.extracted_text.trim())
    .map(att => ({
      filename: att.filename,
      text: att.extracted_text.trim()
    }))

  if (extractedTexts.length === 0) {
    return mergedFacts
  }

  // Add extracted text to facts
  mergedFacts.extracted_text = extractedTexts.map(et => ({
    source: et.filename,
    content: et.text
  }))

  // Try to intelligently merge specific fields if they appear to be missing
  const allText = extractedTexts.map(et => et.text).join('\n\n')

  // Look for missing incident description
  console.log('DEBUG: facts.incident:', JSON.stringify(facts.incident))
  console.log('DEBUG: condition check - !facts.incident:', !facts.incident)
  console.log('DEBUG: condition check - trim empty:', facts.incident?.trim() === '')
  console.log('DEBUG: condition check - includes TODO:', facts.incident?.includes('[TODO]'))
  if (!facts.incident || facts.incident.trim() === '' || facts.incident.includes('[TODO]')) {
    console.log('DEBUG: Looking for incident in:', allText)
    // Try to extract incident description from text
    const incidentPatterns = [
      /incident[:\s]*(.*)/i,
      /accident[:\s]*(.*)/i,
      /occurred[:\s]*(.*)/i
    ]

    for (const pattern of incidentPatterns) {
      const match = allText.match(pattern)
      console.log('DEBUG: Pattern', pattern, 'match:', match)
      if (match && match[1].trim().length > 10) {
        mergedFacts.incident = match[1].trim()
        console.log('DEBUG: Set incident to:', mergedFacts.incident)
        break
      }
    }
  }

  // Look for missing damage amounts
  if (!facts.damages?.amount_claimed || facts.damages.amount_claimed === 0) {
    const amountPatterns = [
      /\$([0-9,]+(?:\.[0-9]{2})?)/g,
      /([0-9,]+(?:\.[0-9]{2})?) dollars?/i,
      /amount[:\s]*\$?([0-9,]+(?:\.[0-9]{2})?)/i
    ]

    for (const pattern of amountPatterns) {
      const matches = allText.match(pattern)
      if (matches) {
        // Take the first/largest amount found
        const amounts = matches.map(m => parseFloat(m.replace(/[$,]/g, ''))).filter(a => a > 0)
        if (amounts.length > 0) {
          mergedFacts.damages = mergedFacts.damages || {}
          mergedFacts.damages.amount_claimed = Math.max(...amounts)
          break
        }
      }
    }
  }

  return mergedFacts
}

const testFacts1 = {
  parties: { plaintiff: 'John Doe', defendant: 'ABC Corp' },
  incident: '[TODO: Incident description]',
  damages: { amount_claimed: 0 }
}

const testAttachments1 = [
  {
    filename: 'police_report.pdf',
    extracted_text: 'Incident: Car accident at Main St and Oak Ave on March 15, 2024. Damage amount: $7,500'
  }
]

console.log('Input facts:', JSON.stringify(testFacts1, null, 2))
console.log('Attachments:', JSON.stringify(testAttachments1, null, 2))

const result = mergeExtractedTextWithFacts(testFacts1, testAttachments1)

console.log('Result:', JSON.stringify(result, null, 2))
