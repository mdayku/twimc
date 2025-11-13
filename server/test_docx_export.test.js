// DOCX export unit tests
import { strict as assert } from 'assert'
import { markdownToDocxBuffer } from './docx.js'

console.log('🧪 Running DOCX export tests...')

// Test 1: Simple markdown conversion
console.log('Test 1: Simple markdown to DOCX...')
const simpleMd = `# Heading 1

This is a paragraph.

## Heading 2

Another paragraph with **bold** text.`

const buffer1 = await markdownToDocxBuffer(simpleMd)
assert.ok(buffer1 instanceof Buffer, 'Should return a Buffer')
assert.ok(buffer1.length > 0, 'Buffer should not be empty')
console.log(`✅ Test 1 passed: Generated ${buffer1.length} bytes`)

// Test 2: Complex demand letter structure
console.log('Test 2: Complex demand letter...')
const demandLetterMd = `# DEMAND LETTER

**Law Firm Name**
Attorney Name, Esq.
123 Main Street
Los Angeles, CA 90001

November 13, 2024

ABC Delivery Services, Inc.
789 Commerce Blvd
Los Angeles, CA 90001

**Re: Demand for Settlement - Sarah Johnson v. ABC Delivery Services, Inc.**

## Introduction

Dear Claims Manager,

On behalf of my client, Sarah Johnson, we hereby formally demand an amicable resolution to the incident arising from a traffic collision involving your company's employee, Michael Thompson, which occurred on January 15, 2024.

## Statement of Facts

On January 15, 2024, at approximately 3:45 PM, my client was lawfully stopped at a red light at the intersection of Wilshire Boulevard and Vermont Avenue in Los Angeles, California. Without warning, a delivery truck operated by your employee, Michael Thompson, rear-ended my client's vehicle at high speed.

The force of the impact was substantial, causing significant damage to my client's vehicle and resulting in serious personal injuries.

## Liability

Your company is liable for the injuries and damages sustained by my client under the doctrine of respondeat superior. Your employee was acting within the course and scope of his employment at the time of the collision.

## Damages

### Economic Damages (Special Damages)
- Past medical expenses: $12,595
- Future medical expenses: $8,000
- Lost wages: $18,000

### Non-Economic Damages (General Damages)
- Pain and suffering: $50,000
- Emotional distress: $10,000

**Total Damages: $98,595**

## Demand

We demand payment of $100,000 within 30 days of receipt of this letter. Failure to respond may result in litigation without further notice.

Please direct all correspondence to my office at the address and phone number listed above.

Sincerely,

Attorney Name, Esq.
Law Firm Name
Attorney for Sarah Johnson`

const buffer2 = await markdownToDocxBuffer(demandLetterMd)
assert.ok(buffer2 instanceof Buffer, 'Should return a Buffer')
assert.ok(buffer2.length > 1000, 'Complex document should be substantial')
console.log(`✅ Test 2 passed: Generated ${buffer2.length} bytes`)

// Test 3: Empty markdown
console.log('Test 3: Empty markdown...')
const buffer3 = await markdownToDocxBuffer('')
assert.ok(buffer3 instanceof Buffer, 'Should handle empty markdown')
console.log(`✅ Test 3 passed: Generated ${buffer3.length} bytes`)

// Test 4: Markdown with lists
console.log('Test 4: Markdown with lists...')
const listMd = `## Damages Include:

- Medical bills
- Lost wages
- Pain and suffering

## Next Steps:

1. Review this letter
2. Contact our office
3. Arrange payment`

const buffer4 = await markdownToDocxBuffer(listMd)
assert.ok(buffer4 instanceof Buffer, 'Should handle lists')
assert.ok(buffer4.length > 0, 'List document should not be empty')
console.log(`✅ Test 4 passed: Generated ${buffer4.length} bytes`)

// Test 5: Markdown with special characters
console.log('Test 5: Special characters...')
const specialMd = `# Test & Symbols

Amount: $100,000

Contact: attorney@lawfirm.com

Quote: "This is important"`

const buffer5 = await markdownToDocxBuffer(specialMd)
assert.ok(buffer5 instanceof Buffer, 'Should handle special characters')
assert.ok(buffer5.length > 0, 'Should not be empty')
console.log(`✅ Test 5 passed: Generated ${buffer5.length} bytes`)

// Test 6: Markdown with letterhead
console.log('Test 6: With letterhead...')
const letterhead = 'Law Firm Name\n123 Main St\nLos Angeles, CA 90001'
const buffer6 = await markdownToDocxBuffer('# Letter Content', letterhead)
assert.ok(buffer6 instanceof Buffer, 'Should handle letterhead')
assert.ok(buffer6.length > 0, 'Should not be empty')
console.log(`✅ Test 6 passed: Generated ${buffer6.length} bytes with letterhead`)

console.log('🎉 All DOCX export tests passed!')

