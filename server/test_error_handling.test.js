// Integration tests: error handling scenarios
// Tests various error conditions and edge cases

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787'
const testToken = process.env.API_TOKEN || process.env.API_TOKENS || 'dev-token-123'

console.log('🧪 Running error handling integration tests...')

async function makeRequest(endpoint, method = 'GET', body = null, headers = {}) {
  const url = `${BASE_URL}${endpoint}`
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testToken}`,
      ...headers
    }
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

async function testInvalidFactsId() {
  console.log('Test 1: Invalid facts_id...')
  const response = await makeRequest('/v1/generate', 'POST', {
    facts_id: 'nonexistent-id-12345'
  })

  if (response.status !== 404) {
    console.error(`❌ Expected 404, got ${response.status}`)
    return false
  }

  if (!response.data?.error) {
    console.error('❌ Should return error message')
    return false
  }

  console.log('✅ Invalid facts_id test passed')
  return true
}

async function testMissingAuth() {
  console.log('Test 2: Missing authentication...')
  const response = await fetch(`${BASE_URL}/v1/intake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      facts_json: {
        parties: { plaintiff: 'Test', defendant: 'Test' },
        incident: 'Test',
        damages: { amount_claimed: 100 }
      }
    })
  })

  if (response.status !== 401) {
    console.error(`❌ Expected 401, got ${response.status}`)
    return false
  }

  console.log('✅ Missing authentication test passed')
  return true
}

async function testInvalidAuth() {
  console.log('Test 3: Invalid authentication token...')
  const response = await fetch(`${BASE_URL}/v1/intake`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-token-xyz'
    },
    body: JSON.stringify({
      facts_json: {
        parties: { plaintiff: 'Test', defendant: 'Test' },
        incident: 'Test',
        damages: { amount_claimed: 100 }
      }
    })
  })

  if (response.status !== 401) {
    console.error(`❌ Expected 401, got ${response.status}`)
    return false
  }

  console.log('✅ Invalid authentication test passed')
  return true
}

async function testMissingFactsJson() {
  console.log('Test 4: Missing facts_json in intake...')
  const response = await makeRequest('/v1/intake', 'POST', {})

  if (response.status !== 400) {
    console.error(`❌ Expected 400, got ${response.status}`)
    return false
  }

  if (!response.data?.error) {
    console.error('❌ Should return error message')
    return false
  }

  console.log('✅ Missing facts_json test passed')
  return true
}

async function testInvalidFactsStructure() {
  console.log('Test 5: Invalid facts structure...')
  const response = await makeRequest('/v1/intake', 'POST', {
    facts_json: {
      // Missing required fields
      parties: {}
    }
  })

  // Should either validate and return 400, or accept and handle gracefully
  if (response.status !== 200 && response.status !== 400) {
    console.error(`❌ Expected 200 or 400, got ${response.status}`)
    return false
  }

  console.log('✅ Invalid facts structure test passed')
  return true
}

async function testMissingDraftMdInExport() {
  console.log('Test 6: Missing draft_md in export...')
  const response = await makeRequest('/v1/export/docx', 'POST', {})

  if (response.status !== 400) {
    console.error(`❌ Expected 400, got ${response.status}`)
    return false
  }

  if (!response.data?.error || !response.data.error.includes('draft_md')) {
    console.error('❌ Should return error about missing draft_md')
    return false
  }

  console.log('✅ Missing draft_md in export test passed')
  return true
}

async function testInvalidVersion() {
  console.log('Test 7: Invalid version number...')
  // First create a facts record
  const intakeResponse = await makeRequest('/v1/intake', 'POST', {
    facts_json: {
      parties: { plaintiff: 'Test', defendant: 'Test' },
      incident: 'Test incident',
      damages: { amount_claimed: 100 }
    }
  })

  if (!intakeResponse.ok) {
    console.error('❌ Failed to create facts for version test')
    return false
  }

  const factsId = intakeResponse.data.facts_id

  // Try to get a non-existent version
  const response = await makeRequest('/v1/generate', 'POST', {
    facts_id: factsId,
    version: 999
  })

  // Should return 404 for non-existent version
  if (response.status !== 404) {
    console.error(`❌ Expected 404, got ${response.status}`)
    return false
  }

  console.log('✅ Invalid version test passed')
  return true
}

async function testMalformedJson() {
  console.log('Test 8: Malformed JSON in request...')
  const response = await fetch(`${BASE_URL}/v1/intake`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testToken}`
    },
    body: '{ invalid json }'
  })

  if (response.status !== 400) {
    console.error(`❌ Expected 400, got ${response.status}`)
    return false
  }

  console.log('✅ Malformed JSON test passed')
  return true
}

async function testEmptyFactsJson() {
  console.log('Test 9: Empty facts_json...')
  const response = await makeRequest('/v1/intake', 'POST', {
    facts_json: {}
  })

  // Should handle gracefully (either accept or return validation error)
  if (response.status !== 200 && response.status !== 400) {
    console.error(`❌ Expected 200 or 400, got ${response.status}`)
    return false
  }

  console.log('✅ Empty facts_json test passed')
  return true
}

async function testHealthEndpoint() {
  console.log('Test 10: Health endpoint (should always work)...')
  const response = await fetch(`${BASE_URL}/health`)

  if (response.status !== 200) {
    console.error(`❌ Expected 200, got ${response.status}`)
    return false
  }

  const data = await response.json()
  if (data.status !== 'ok') {
    console.error('❌ Health check should return status: ok')
    return false
  }

  console.log('✅ Health endpoint test passed')
  return true
}

async function runErrorHandlingTests() {
  try {
    // Check if server is running
    const healthResponse = await fetch(`${BASE_URL}/health`)
    if (!healthResponse.ok) {
      console.error('❌ Server not running or not healthy')
      return false
    }

    const tests = [
      testInvalidFactsId,
      testMissingAuth,
      testInvalidAuth,
      testMissingFactsJson,
      testInvalidFactsStructure,
      testMissingDraftMdInExport,
      testInvalidVersion,
      testMalformedJson,
      testEmptyFactsJson,
      testHealthEndpoint
    ]

    let passed = 0
    let failed = 0

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

    console.log(`\n📊 Error handling tests: ${passed} passed, ${failed} failed`)

    return failed === 0
  } catch (error) {
    console.error('❌ Error handling test suite failed:', error.message)
    return false
  }
}

// Run the tests
runErrorHandlingTests().then(success => {
  if (success) {
    console.log('🎉 All error handling tests passed!')
    process.exit(0)
  } else {
    console.log('❌ Some error handling tests failed!')
    process.exit(1)
  }
}).catch(error => {
  console.error('❌ Error handling test suite error:', error)
  process.exit(1)
})

