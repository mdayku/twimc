// Provider integration tests: OpenAI LLM provider
// Tests the OpenAI integration end-to-end

import { strict as assert } from 'assert'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from root directory
dotenv.config({ path: join(__dirname, '..', '.env') })

console.log('🧪 Running OpenAI provider integration tests...')

// Check if OpenAI is configured
const openaiApiKey = process.env.OPENAI_API_KEY
const openaiModelId = process.env.OPENAI_MODEL_ID || 'gpt-4'

if (!openaiApiKey) {
  console.log('⏭️  Skipping OpenAI provider tests (OPENAI_API_KEY not set)')
  process.exit(0)
}

// Import the OpenAI client
let OpenAILlmClient
try {
  const module = await import('./llm/openai.js')
  OpenAILlmClient = module.OpenAILlmClient
} catch (error) {
  console.error('❌ Failed to import OpenAILlmClient:', error.message)
  process.exit(1)
}

async function testClientInitialization() {
  console.log('Test 1: Client initialization...')
  
  try {
    const client = new OpenAILlmClient()
    assert(client, 'Client should be created')
    console.log('✅ Client initialization test passed')
    return true
  } catch (error) {
    console.error('❌ Client initialization failed:', error.message)
    return false
  }
}

function withTimeout(promise, ms, name) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Test "${name}" timed out after ${ms}ms`)), ms)
    )
  ])
}

async function testGenerateDraft() {
  console.log('Test 2: Generate draft with OpenAI...')
  
  try {
    const client = new OpenAILlmClient()
    
    const testFacts = {
      parties: {
        plaintiff: 'Jane Doe',
        defendant: 'XYZ Corporation'
      },
      incident: 'On March 1, 2024, XYZ Corporation failed to deliver the ordered goods on time, causing significant business losses.',
      damages: {
        amount_claimed: 5000
      }
    }

    const result = await withTimeout(
      client.generateDraft(testFacts),
      60000, // 60 second timeout for GPT-5
      'testGenerateDraft'
    )
    
    assert(result, 'Should return result')
    assert(result.draft_md, 'Should return draft markdown')
    assert(typeof result.draft_md === 'string', 'draft_md should be string')
    assert(result.draft_md.length > 0, 'draft_md should not be empty')
    assert(Array.isArray(result.issues), 'Should return issues array')
    assert(typeof result.explanations === 'object', 'Should return explanations object')
    
    // Verify content includes expected elements
    assert(result.draft_md.includes('Jane Doe'), 'Should include plaintiff name')
    assert(result.draft_md.includes('XYZ Corporation'), 'Should include defendant name')
    // LLM may rephrase dates, so check for key incident keywords instead
    const hasIncidentContent = result.draft_md.toLowerCase().includes('march') || 
                                result.draft_md.toLowerCase().includes('deliver') ||
                                result.draft_md.toLowerCase().includes('goods')
    assert(hasIncidentContent, 'Should include incident-related content')
    
    console.log(`✅ Generate draft test passed (draft length: ${result.draft_md.length} chars)`)
    return true
  } catch (error) {
    console.error('❌ Generate draft failed:', error.message)
    // Don't fail if API is unavailable (might be rate limited or down)
    if (error.message.includes('API unavailable') || error.message.includes('rate limit')) {
      console.log('⏭️  Skipping (API unavailable or rate limited)')
      return true
    }
    return false
  }
}

async function testGenerateDraftWithTemplate() {
  console.log('Test 3: Generate draft with custom template...')
  
  try {
    const client = new OpenAILlmClient()
    
    const testFacts = {
      parties: {
        plaintiff: 'Test Plaintiff',
        defendant: 'Test Defendant'
      },
      incident: 'Test incident description',
      damages: {
        amount_claimed: 1000
      }
    }

    const customTemplate = `# Custom Demand Letter Template

## Introduction
This is a custom template for the plaintiff.

## Facts
The incident details should be included here.

## Demand
We demand compensation for damages.
`

    const result = await withTimeout(
      client.generateDraft(testFacts, customTemplate),
      60000, // 60 second timeout for GPT-5
      'testGenerateDraftWithTemplate'
    )
    
    assert(result, 'Should return result')
    assert(result.draft_md, 'Should return draft markdown')
    assert(result.draft_md.includes('Test Plaintiff'), 'Should include plaintiff from facts')
    
    console.log('✅ Generate draft with template test passed')
    return true
  } catch (error) {
    console.error('❌ Generate draft with template failed:', error.message)
    if (error.message.includes('API unavailable') || error.message.includes('rate limit')) {
      console.log('⏭️  Skipping (API unavailable or rate limited)')
      return true
    }
    return false
  }
}

async function testGenerateDraftWithMinimalFacts() {
  console.log('Test 4: Generate draft with minimal facts...')
  
  try {
    const client = new OpenAILlmClient()
    
    const minimalFacts = {
      parties: {
        plaintiff: 'Minimal Plaintiff'
      },
      incident: 'Minimal incident'
    }

    const result = await withTimeout(
      client.generateDraft(minimalFacts),
      60000, // 60 second timeout for GPT-5
      'testGenerateDraftWithMinimalFacts'
    )
    
    assert(result, 'Should return result')
    assert(result.draft_md, 'Should return draft markdown')
    // Should handle missing fields gracefully
    assert(Array.isArray(result.issues), 'Should return issues array')
    
    console.log('✅ Generate draft with minimal facts test passed')
    return true
  } catch (error) {
    console.error('❌ Generate draft with minimal facts failed:', error.message)
    if (error.message.includes('API unavailable') || error.message.includes('rate limit')) {
      console.log('⏭️  Skipping (API unavailable or rate limited)')
      return true
    }
    return false
  }
}

async function testCriticPass() {
  console.log('Test 5: Critic pass functionality...')
  
  try {
    const client = new OpenAILlmClient()
    
    const testDraft = `# Demand Letter

## Introduction
This letter is written on behalf of John Doe.

## Statement of Facts
On January 15, 2024, ABC Corporation charged my account incorrectly.

## Damages
We demand $5000.
`

    const testFacts = {
      parties: {
        plaintiff: 'John Doe',
        defendant: 'ABC Corporation'
      },
      incident: 'On January 15, 2024, ABC Corporation charged my account incorrectly',
      damages: {
        amount_claimed: 5000
      }
    }

    const issues = await withTimeout(
      client.runCriticPass(testDraft, testFacts),
      60000, // 60 second timeout for GPT-5
      'testCriticPass'
    )
    
    assert(Array.isArray(issues), 'Should return issues array')
    
    console.log(`✅ Critic pass test passed (found ${issues.length} issues)`)
    return true
  } catch (error) {
    console.error('❌ Critic pass failed:', error.message)
    if (error.message.includes('API unavailable') || error.message.includes('rate limit')) {
      console.log('⏭️  Skipping (API unavailable or rate limited)')
      return true
    }
    return false
  }
}

async function testTokenTracking() {
  console.log('Test 6: Token usage tracking...')
  
  try {
    const client = new OpenAILlmClient()
    
    const testFacts = {
      parties: {
        plaintiff: 'Token Test',
        defendant: 'Token Corp'
      },
      incident: 'Token tracking test incident',
      damages: {
        amount_claimed: 100
      }
    }

    const result = await withTimeout(
      client.generateDraft(testFacts),
      60000, // 60 second timeout for GPT-5
      'testTokenTracking'
    )
    
    // Token tracking is optional, so we just check the result structure
    assert(result, 'Should return result')
    
    if (result.input_tokens !== undefined) {
      assert(typeof result.input_tokens === 'number', 'input_tokens should be number')
      assert(result.input_tokens > 0, 'input_tokens should be positive')
    }
    
    if (result.output_tokens !== undefined) {
      assert(typeof result.output_tokens === 'number', 'output_tokens should be number')
      assert(result.output_tokens > 0, 'output_tokens should be positive')
    }
    
    console.log('✅ Token tracking test passed')
    return true
  } catch (error) {
    console.error('❌ Token tracking test failed:', error.message)
    if (error.message.includes('API unavailable') || error.message.includes('rate limit')) {
      console.log('⏭️  Skipping (API unavailable or rate limited)')
      return true
    }
    return false
  }
}

async function runProviderIntegrationTests() {
  const tests = [
    testClientInitialization,
    testGenerateDraft,
    testGenerateDraftWithTemplate,
    testGenerateDraftWithMinimalFacts,
    testCriticPass,
    testTokenTracking
  ]

  let passed = 0
  let failed = 0
  let skipped = 0

  for (const test of tests) {
    try {
      const result = await test()
      if (result) {
        passed++
      } else {
        failed++
      }
    } catch (error) {
      console.error(`❌ Test ${test.name} threw error:`, error.message)
      failed++
    }
  }

  console.log(`\n📊 Provider integration tests: ${passed} passed, ${failed} failed, ${skipped} skipped`)

  return failed === 0
}

// Run the tests
runProviderIntegrationTests().then(success => {
  if (success) {
    console.log('🎉 All provider integration tests passed!')
    process.exit(0)
  } else {
    console.log('❌ Some provider integration tests failed!')
    process.exit(1)
  }
}).catch(error => {
  console.error('❌ Provider integration test suite error:', error)
  process.exit(1)
})

