// Simple regex test
const text = 'Incident: Car accident at Main St and Oak Ave on March 15, 2024. Damage amount: $7,500'

console.log('Text:', text)

const patterns = [
  /incident[:\s]*(.*)/i,
  /accident[:\s]*(.*)/i,
  /occurred[:\s]*(.*)/i
]

for (const pattern of patterns) {
  const match = text.match(pattern)
  console.log('Pattern:', pattern, 'Match:', match)
  if (match && match[1].trim().length > 10) {
    console.log('Would set incident to:', match[1].trim())
  }
}
