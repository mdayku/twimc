// Debug the fallback template
function generateFallbackDraft(facts) {
  const plaintiff = facts.parties?.plaintiff || '[TODO: Plaintiff name]'
  const defendant = facts.parties?.defendant || '[TODO: Defendant name]'
  const incident = facts.incident || '[TODO: Incident description]'
  const venue = facts.venue || '[TODO: Venue]'
  const damageAmount = facts.damages?.amount_claimed || '[TODO: Amount]'

  return `# Demand Letter

## Date and Recipient

Date: ${new Date().toLocaleDateString()}

To: ${defendant}
${venue}

## Introduction

This letter is written on behalf of ${plaintiff} to demand compensation for damages arising from the incident described below.

## Statement of Facts

${incident.slice(0, 800)}

## Liability

[TODO: Insert liability analysis based on provided facts]

## Damages

### Special Damages
- Amount claimed: $${damageAmount}

### General Damages
[TODO: Insert general damages calculation]

## Demand

We demand payment of $${damageAmount} within 30 days of receipt of this letter.

Failure to respond may result in legal action without further notice.

## Exhibits

${facts.exhibits?.map((ex, i) => `${i + 1}. ${ex.name}: ${ex.description}`).join('\n') || '[TODO: List exhibits]'}

---

Sincerely,
`
}

const completeFacts = {
  parties: {
    plaintiff: 'John Smith',
    defendant: 'ABC Corporation'
  },
  incident: 'Car accident on Main Street on January 15, 2024',
  venue: '123 Legal Avenue, Law City, State 12345',
  damages: {
    amount_claimed: 25000
  },
  exhibits: [
    { name: 'Police Report', description: 'Official accident report' },
    { name: 'Medical Bills', description: 'Hospital treatment records' }
  ]
}

const result = generateFallbackDraft(completeFacts)
console.log('Generated draft:')
console.log(result)
console.log('---')
console.log('Contains "$25,000":', result.includes('$25,000'))
console.log('Contains "25000":', result.includes('25000'))
console.log('Contains "25,000":', result.includes('25,000'))
