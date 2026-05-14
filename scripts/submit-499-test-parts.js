#!/usr/bin/env node

const CASE_ID = '500Ad00000VD4dlIAD'
const API_BASE = 'http://localhost:3002'

function pad(n, length = 6) {
  return String(n).padStart(length, '0')
}

const results = Array.from({ length: 499 }, (_, i) => ({
  testType: i % 2 === 0 ? 'SICCT' : 'DIVA',
  earTagNo: `UK${pad(i + 1)}`
}))

const body = {
  testParts: [
    {
      day1: '2026-04-29',
      day2: '2026-05-01',
      certifyingVet: 'Dr. Test Vet',
      tester: 'Test Tester',
      results
    }
  ]
}

console.log(
  `Submitting ${results.length} results to case ${CASE_ID} (${results.length + 1} sub-requests → graph path)...`
)

const response = await fetch(`${API_BASE}/cases/${CASE_ID}/test-parts`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})

const text = await response.text()

if (!response.ok) {
  console.error(`Failed: HTTP ${response.status}`)
  console.error(text)
  process.exit(1)
}

const data = JSON.parse(text)
console.log(`Success: HTTP ${response.status}`)
console.log(`Created ${data.testParts?.length ?? 0} test part(s)`)
console.log(JSON.stringify(data, null, 2))
