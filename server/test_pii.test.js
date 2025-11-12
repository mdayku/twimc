// PII Redaction unit tests
import { strict as assert } from 'assert'
import { createPiiRedaction, redactPii, redactObject } from './pii.js'

console.log('🧪 Running PII redaction tests...')

// Test 1: Basic PII redaction enabled
const config = createPiiRedaction({ enabled: true })

// Test email redaction
const emailText = 'Contact john.doe@example.com for more info'
const redactedEmail = redactPii(emailText, config)
assert(!redactedEmail.includes('john.doe@example.com'), 'Email should be redacted')
assert(redactedEmail.includes('[REDACTED]'), 'Should contain redaction placeholder')
console.log('✅ Test 1a passed: Email redaction')

// Test phone number redaction
const phoneText = 'Call me at (555) 123-4567 or 555-987-6543'
const redactedPhone = redactPii(phoneText, config)
assert(!redactedPhone.includes('(555) 123-4567'), 'Phone should be redacted')
assert(!redactedPhone.includes('555-987-6543'), 'Second phone should be redacted')
console.log('✅ Test 1b passed: Phone number redaction')

// Test SSN redaction
const ssnText = 'SSN: 123-45-6789'
const redactedSSN = redactPii(ssnText, config)
assert(!redactedSSN.includes('123-45-6789'), 'SSN should be redacted')
console.log('✅ Test 1c passed: SSN redaction')

// Test 2: PII redaction disabled
const disabledConfig = createPiiRedaction({ enabled: false })
const originalText = 'Contact john.doe@example.com for more info'
const unredactedText = redactPii(originalText, disabledConfig)
assert.strictEqual(unredactedText, originalText, 'Text should be unchanged when redaction disabled')
console.log('✅ Test 2 passed: Redaction disabled')

// Test 3: Object redaction
const testObject = {
  facts_id: 'safe-id-123', // This should not be redacted
  user: {
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '(555) 123-4567',
    address: '123 Main Street, Anytown, NY 12345'
  },
  metadata: {
    timestamp: '2024-01-01T00:00:00Z' // This should not be redacted
  }
}

const redactedObject = redactObject(testObject, config)
assert.strictEqual(redactedObject.facts_id, 'safe-id-123', 'Safe ID should not be redacted')
assert.strictEqual(redactedObject.metadata.timestamp, '2024-01-01T00:00:00Z', 'Timestamp should not be redacted')
assert(!redactedObject.user.email.includes('john.smith@example.com'), 'Email in object should be redacted')
assert(!redactedObject.user.phone.includes('(555) 123-4567'), 'Phone in object should be redacted')
assert(!redactedObject.user.name.includes('John Smith'), 'Name in object should be redacted')
console.log('✅ Test 3 passed: Object redaction')

// Test 4: Environment variable configuration
// Temporarily set environment variable
const originalEnv = process.env.PII_REDACTION_ENABLED
process.env.PII_REDACTION_ENABLED = 'true'
const envConfig = createPiiRedaction()
assert.strictEqual(envConfig.enabled, true, 'Should read enabled from env var')

process.env.PII_REDACTION_ENABLED = 'false'
const envConfigDisabled = createPiiRedaction()
assert.strictEqual(envConfigDisabled.enabled, false, 'Should read disabled from env var')

// Restore original env
process.env.PII_REDACTION_ENABLED = originalEnv
console.log('✅ Test 4 passed: Environment variable configuration')

// Test 5: Array redaction
const testArray = [
  'Safe text',
  'Contact john@example.com',
  { nested: { email: 'jane@example.com' } }
]

const redactedArray = redactObject(testArray, config)
assert.strictEqual(redactedArray[0], 'Safe text', 'Safe array element should be unchanged')
assert(!redactedArray[1].includes('john@example.com'), 'Email in array should be redacted')
assert(!redactedArray[2].nested.email.includes('jane@example.com'), 'Nested email should be redacted')
console.log('✅ Test 5 passed: Array redaction')

console.log('🎉 All PII redaction tests passed!')
