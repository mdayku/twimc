// End-to-end integration tests
// Tests the full flow: intake -> generate -> draft validation

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787'

console.log('🧪 Running end-to-end integration tests...')

// Test data
const testFacts = {
  parties: {
    plaintiff: 'John Smith',
    defendant: 'ABC Corporation'
  },
  incident: 'Car accident on Main Street on January 15, 2024 at 2:30 PM',
  venue: 'Superior Court of California, County of Los Angeles',
  damages: {
    amount_claimed: 25000
  }
}

const testToken = process.env.API_TOKEN || process.env.API_TOKENS || ''

async function makeRequest(endpoint, method = 'GET', body = null, headers = {}) {
  const url = `${BASE_URL}${endpoint}`
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }

  // Only add auth header if we have tokens configured
  if (testToken) {
    config.headers['Authorization'] = `Bearer ${testToken}`
  }

  if (body) {
    config.body = JSON.stringify(body)
  }

  const response = await fetch(url, config)
  const data = await response.json().catch(() => null)

  return {
    status: response.status,
    ok: response.ok,
    data
  }
}

async function testFullFlow() {
  console.log('Testing full intake -> generate flow...')

  // Step 1: Intake - submit facts
  console.log('Step 1: Submitting facts via intake...')
  const intakeResponse = await makeRequest('/v1/intake', 'POST', {
    facts_json: testFacts
  })

  if (!intakeResponse.ok) {
    console.error('❌ Intake failed:', intakeResponse.data)
    return false
  }

  const factsId = intakeResponse.data?.facts_id
  if (!factsId) {
    console.error('❌ No facts_id returned from intake')
    return false
  }

  console.log('✅ Intake successful, facts_id:', factsId)

  // Step 2: Generate - create draft from facts
  console.log('Step 2: Generating draft...')
  const generateResponse = await makeRequest('/v1/generate', 'POST', {
    facts_id: factsId
  })

  if (!generateResponse.ok) {
    console.error('❌ Generate failed:', generateResponse.data)
    return false
  }

  const draft = generateResponse.data
  if (!draft?.draft_md) {
    console.error('❌ No draft returned from generate')
    return false
  }

  console.log('✅ Generate successful, draft length:', draft.draft_md.length)

  // Step 3: Validate draft content
  console.log('Step 3: Validating draft content...')

  // Check basic structure
  if (!draft.draft_md.includes('#')) {
    console.error('❌ Draft missing headings')
    return false
  }

  if (!draft.draft_md.includes('John Smith')) {
    console.error('❌ Draft missing plaintiff name')
    return false
  }

  if (!draft.draft_md.includes('ABC Corporation')) {
    console.error('❌ Draft missing defendant name')
    return false
  }

  // Check for incident keywords (LLM may rephrase)
  const hasIncidentKeywords = draft.draft_md.toLowerCase().includes('accident') || 
                               draft.draft_md.toLowerCase().includes('main street') ||
                               draft.draft_md.toLowerCase().includes('january')
  if (!hasIncidentKeywords) {
    console.error('❌ Draft missing incident-related content')
    return false
  }

  // Check metadata
  if (!draft.version || draft.version !== 1) {
    console.error('❌ Invalid version number')
    return false
  }

  if (!draft.generated_at) {
    console.error('❌ Missing generated_at timestamp')
    return false
  }

  if (!draft.issues || !Array.isArray(draft.issues)) {
    console.error('❌ Missing or invalid issues array')
    return false
  }

  console.log('✅ Draft validation successful')

  // Step 4: Test draft versioning (generate again should create v2)
  console.log('Step 4: Testing draft versioning...')
  const generateResponse2 = await makeRequest('/v1/generate', 'POST', {
    facts_id: factsId
  })

  if (!generateResponse2.ok) {
    console.error('❌ Second generate failed:', generateResponse2.data)
    return false
  }

  const draft2 = generateResponse2.data
  if (draft2.version !== 2) {
    console.error('❌ Version not incremented correctly')
    return false
  }

  console.log('✅ Versioning test successful')

  // Step 5: Test export to DOCX
  console.log('Step 5: Testing DOCX export...')
  const exportResponse = await makeRequest('/v1/export/docx', 'POST', {
    draft_md: draft.draft_md,
    letterhead: 'Law Offices of John Smith\n123 Main St\nAnytown, ST 12345'
  })

  if (!exportResponse.ok) {
    console.error('❌ Export failed:', exportResponse.data)
    return false
  }

  // Check that we got a binary response (DOCX file)
  const exportBinaryResponse = await fetch(`${BASE_URL}/v1/export/docx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(testToken ? { 'Authorization': `Bearer ${testToken}` } : {})
    },
    body: JSON.stringify({
      draft_md: draft.draft_md
    })
  })

  const contentType = exportBinaryResponse.headers.get('content-type')
  if (!contentType || !contentType.includes('wordprocessingml')) {
    console.error('❌ Export should return DOCX content type')
    return false
  }

  const contentDisposition = exportBinaryResponse.headers.get('content-disposition')
  if (!contentDisposition || !contentDisposition.includes('.docx')) {
    console.error('❌ Export should include .docx filename')
    return false
  }

  const buffer = await exportBinaryResponse.arrayBuffer()
  if (buffer.byteLength === 0) {
    console.error('❌ Export should return non-empty file')
    return false
  }

  // Check DOCX file signature (PK header for ZIP-based format)
  const uint8Array = new Uint8Array(buffer)
  const isZipFormat = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B // PK
  if (!isZipFormat) {
    console.error('❌ Export should return valid DOCX (ZIP format)')
    return false
  }

  console.log('✅ DOCX export test successful')

  // Step 6: Test drafts list endpoint
  console.log('Step 6: Testing drafts list endpoint...')
  const draftsResponse = await makeRequest(`/v1/drafts/${factsId}`, 'GET')

  if (!draftsResponse.ok) {
    console.error('❌ Drafts list failed:', draftsResponse.data)
    return false
  }

  if (!draftsResponse.data?.drafts || !Array.isArray(draftsResponse.data.drafts)) {
    console.error('❌ Drafts list should return array')
    return false
  }

  if (draftsResponse.data.drafts.length < 2) {
    console.error('❌ Should have at least 2 drafts (v1 and v2)')
    return false
  }

  console.log('✅ Drafts list test successful')

  return true
}

async function runE2ETests() {
  try {
    // Check if server is running
    const healthResponse = await fetch(`${BASE_URL}/health`)
    if (!healthResponse.ok) {
      console.error('❌ Server not running or not healthy')
      return false
    }

    const fullFlowSuccess = await testFullFlow()

    return fullFlowSuccess
  } catch (error) {
    console.error('❌ E2E test failed with error:', error.message)
    return false
  }
}

// Run the tests
runE2ETests().then(success => {
  if (success) {
    console.log('🎉 All end-to-end tests passed!')
  } else {
    console.log('❌ Some end-to-end tests failed!')
    process.exit(1)
  }
}).catch(error => {
  console.error('❌ E2E test suite error:', error)
  process.exit(1)
})
