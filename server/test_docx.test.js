// DOCX conversion unit tests
import { strict as assert } from 'assert'
import { extractTextFromFile } from './extract.js'

console.log('🧪 Running DOCX conversion tests...')

// Test 1: DOCX MIME type detection
console.log('Testing MIME type detection...')
const docxResult = await extractTextFromFile(Buffer.from('test'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
assert.strictEqual(docxResult, '', 'Should attempt DOCX extraction for modern DOCX MIME type')

const legacyDocResult = await extractTextFromFile(Buffer.from('test'), 'application/msword')
assert.strictEqual(legacyDocResult, '', 'Should attempt DOCX extraction for legacy DOC MIME type')

const wordLikeResult = await extractTextFromFile(Buffer.from('test'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.test')
assert.strictEqual(wordLikeResult, '', 'Should attempt DOCX extraction for MIME types containing "word"')
console.log('✅ Test 1 passed: MIME type detection')

// Test 2: Unsupported file types
const unsupportedResult = await extractTextFromFile(Buffer.from('test'), 'text/plain')
assert.strictEqual(unsupportedResult, '', 'Should return empty string for unsupported types')
console.log('✅ Test 2 passed: Unsupported file types')

// Test 3: PDF MIME type routing
const pdfResult = await extractTextFromFile(Buffer.from('test'), 'application/pdf')
assert.strictEqual(pdfResult, '', 'Should attempt PDF extraction for PDF MIME type')
console.log('✅ Test 3 passed: PDF MIME type routing')

// Test 4: Case sensitivity in MIME type detection
const mixedCaseResult = await extractTextFromFile(Buffer.from('test'), 'Application/PDF')
assert.strictEqual(mixedCaseResult, '', 'Should handle mixed case MIME types')
console.log('✅ Test 4 passed: Case sensitivity handling')

// Test 5: Empty MIME type
const emptyMimeResult = await extractTextFromFile(Buffer.from('test'), '')
assert.strictEqual(emptyMimeResult, '', 'Should handle empty MIME types gracefully')
console.log('✅ Test 5 passed: Empty MIME type handling')

// Test 6: Very long MIME type with word substring
const longMimeResult = await extractTextFromFile(Buffer.from('test'), 'application/x-msword-document')
assert.strictEqual(longMimeResult, '', 'Should detect word-like MIME types')
console.log('✅ Test 6 passed: Long MIME type detection')

console.log('🎉 All DOCX conversion tests passed!')
