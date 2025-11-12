// Schema validation unit tests
// Note: Using basic Node.js test runner for MVP

import { strict as assert } from 'assert'
import { mergeExtractedTextWithFacts } from './index.js'

// Test mergeExtractedTextWithFacts function
console.log('🧪 Running schema validation tests...')

// Test 1: Basic facts merging with extracted text
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

const result1 = mergeExtractedTextWithFacts(testFacts1, testAttachments1)
assert.equal(result1.incident, 'Car accident at Main St and Oak Ave on March 15, 2024')
assert.equal(result1.damages.amount_claimed, 7500)
assert(result1.extracted_text, 'Should have extracted_text field')
assert.equal(result1.extracted_text.length, 1)
console.log('✅ Test 1 passed: Basic facts merging')

// Test 2: No extracted text
const testFacts2 = {
  parties: { plaintiff: 'Jane Smith', defendant: 'XYZ Inc' },
  incident: 'Slip and fall incident',
  damages: { amount_claimed: 5000 }
}

const result2 = mergeExtractedTextWithFacts(testFacts2, [])
assert.equal(result2.incident, 'Slip and fall incident')
assert.equal(result2.damages.amount_claimed, 5000)
assert(!result2.extracted_text, 'Should not have extracted_text when no attachments')
console.log('✅ Test 2 passed: No extracted text handling')

// Test 3: Multiple attachments with conflicting data
const testFacts3 = {
  parties: { plaintiff: 'Bob Johnson', defendant: 'Mega Corp' },
  incident: '',
  damages: { amount_claimed: 0 }
}

const testAttachments3 = [
  {
    filename: 'accident_report.pdf',
    extracted_text: 'Incident occurred on Highway 101. Claim amount: $15,000'
  },
  {
    filename: 'medical_bill.pdf',
    extracted_text: 'Medical expenses total $12,000. Incident: Highway accident'
  }
]

const result3 = mergeExtractedTextWithFacts(testFacts3, testAttachments3)
assert(result3.incident.includes('Highway'), 'Should extract incident from attachments')
assert.equal(result3.damages.amount_claimed, 15000, 'Should take maximum amount found')
assert.equal(result3.extracted_text.length, 2, 'Should have both attachments')
console.log('✅ Test 3 passed: Multiple attachments handling')

// Test 4: Invalid data handling
const testFacts4 = {
  parties: { plaintiff: 'Test User', defendant: 'Test Corp' },
  incident: 'Valid incident description',
  damages: { amount_claimed: 1000 }
}

const testAttachments4 = [
  {
    filename: 'invalid.pdf',
    extracted_text: ''
  }
]

const result4 = mergeExtractedTextWithFacts(testFacts4, testAttachments4)
assert.equal(result4.incident, 'Valid incident description', 'Should not overwrite valid data')
assert.equal(result4.damages.amount_claimed, 1000, 'Should not overwrite valid data')
console.log('✅ Test 4 passed: Invalid data handling')

console.log('🎉 All schema validation tests passed!')