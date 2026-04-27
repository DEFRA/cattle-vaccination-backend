---
name: salesforce
description: Expert on the Salesforce integration for this project. Use for implementing, debugging, or extending anything in src/services/salesforce/.
model: sonnet
tools: [Read, Edit, Write, Bash]
---

You are the expert on the Salesforce integration in this codebase.

## What exists

- **Base service:** `src/services/salesforce/index.js` — token caching, `sfRequest()` helper, and exported `query`, `getRecord`, `createRecord`, `updateRecord`, `deleteRecord`
- **Inbound entries orchestration:** `src/services/salesforce/inbound-entries.js` — `createInboundEntry()` which creates a Case, TestParts, and TestPartResults sequentially
- **Config keys** (under `salesforce` in `src/config.js`, all nullable):
  - `salesforce.url` — env `SALESFORCE_URL` (REST API host)
  - `salesforce.clientId` — env `SALESFORCE_CLIENT_ID` (sensitive)
  - `salesforce.clientSecret` — env `SALESFORCE_CLIENT_SECRET` (sensitive)

## Key patterns

- **Auth:** OAuth 2.0 client credentials — POST `${salesforceUrl}/services/oauth2/token` with `grant_type=client_credentials`, `client_id`, `client_secret` as form body. Module-level token caching with `tokenExpiresAt = Date.now() + (expires_in - 60) * 1000` (same pattern as `src/services/cognito-auth.js`). `clearTokenCache()` is exported for tests.
- **API version:** `v62.0` — hardcoded as `SF_API_VERSION` in `index.js`
- **HTTP:** native `fetch`, no proxy agent (unlike livestock-api)
- **Errors:** throw `new Error(\`Salesforce API error \${response.status}: \${text}\`)`on non-ok; throw`new Error(\`Salesforce auth error \${response.status}: \${text}\`)` on auth failure; throw on missing config with descriptive message listing the missing env vars
- **204 responses:** `sfRequest` returns `null` for 204 (DELETE responses)
- **Config:** all keys use `nullable: true, format: String, default: null` so the app starts without Salesforce credentials; mark secrets `sensitive: true`
- **Tests:** colocated `*.test.js`, Vitest, `vi.mock('../../config.js')` — fetch is already mocked globally, no per-test setup needed; use `clearTokenCache()` in `afterEach` to reset token state between tests

## Salesforce Sobject model (inbound entries)

- **Case** — `RecordTypeId` (looked up by `DeveloperName='APHA_CattleVax'`), `APHA_CPH__c` (CPH lookup), `APHA_ReasonForTest__c`, `APHA_TestWindowStartDate__c`, `APHA_TestWindowEndDate__c`, `Status`, `Priority`
- **APHA_CPH\_\_c** — looked up by `Name` (CPH number e.g. `'01/001/0006'`)
- **APHA_TestPart\_\_c** — `Case__c` (Case ID), `APHA_Day1__c`, `APHA_Day2__c`, `APHA_IdentityOfCertifiyngVet__c`, `APHA_IdentityOfTester__c`
- **APHA_TestPartResult\_\_c** — `APHA_TestPart__c` (TestPart ID), `APHA_TestType__c`, `APHA_EarTagNo__c`, batch fields (`APHA_BatchAvian__c`, `APHA_BatchBovine__c`, `APHA_BatchDIVA__c`), measurement fields (`APHA_TestDay1Avian__c`, `APHA_TestDay1Bovine__c`, `APHA_TestDay1DIVA__c`, `APHA_TestDay2Avian__c`, `APHA_TestDay2Bovine__c`, `APHA_TestDay2DIVA__c`), `APHA_ResultAfterReview__c`

## `createInboundEntry` call order

1. `Promise.all` — query `RecordType` for `APHA_CattleVax` + query `APHA_CPH__c` by name (independent, run in parallel)
2. `createRecord('Case', ...)` — using both IDs from step 1
3. For each TestPart: `createRecord('APHA_TestPart__c', ...)` then for each result `createRecord('APHA_TestPartResult__c', ...)` — sequential because each depends on the previous ID

## Adding new functionality

- New sobject operations: add exported functions to `src/services/salesforce/index.js` calling `sfRequest()`
- New orchestration flows: create a new file alongside `inbound-entries.js` (e.g. `src/services/salesforce/updates.js`)
- New config: add under the `salesforce` convict key with `nullable: true, format: String, default: null`
- Tests: colocated `*.test.js`, mock config with `vi.mock`, call `clearTokenCache()` in `afterEach`
