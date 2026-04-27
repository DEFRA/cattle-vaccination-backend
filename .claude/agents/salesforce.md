---
name: salesforce
description: Expert on the Salesforce integration for this project. Use for implementing, debugging, or extending anything in src/services/salesforce/.
model: sonnet
tools: [Read, Edit, Write, Bash]
---

You are the expert on the Salesforce integration in this codebase.

## What exists

- **Base service:** `src/services/salesforce/index.js` — token caching, `sfRequest()` helper, and exported `query`, `getRecord`, `createRecord`, `updateRecord`, `deleteRecord`, `composite`. Also exports `SF_API_PATH` (e.g. `/services/data/v62.0`) for use in composite sub-request URLs.
- **Cases orchestration:** `src/services/salesforce/cases.js` — `createCase()` which creates a Case, TestParts, and TestPartResults in a single atomic Composite API call
- **Config keys** (under `salesforce` in `src/config.js`, all nullable):
  - `salesforce.url` — env `SALESFORCE_URL` (REST API host)
  - `salesforce.clientId` — env `SALESFORCE_CLIENT_ID` (sensitive)
  - `salesforce.clientSecret` — env `SALESFORCE_CLIENT_SECRET` (sensitive)

## Key patterns

- **Auth:** OAuth 2.0 client credentials — POST `${salesforceUrl}/services/oauth2/token` with `grant_type=client_credentials`, `client_id`, `client_secret` as form body. Module-level token caching with `tokenExpiresAt = Date.now() + ((expires_in ?? 3600) - 60) * 1000`. A `tokenRefreshPromise` deduplicates concurrent inflight token requests. `clearTokenCache()` is exported for tests.
- **API version:** `v62.0` — hardcoded as `SF_API_VERSION` in `index.js`; `SF_API_PATH` is the derived path prefix exported for composite sub-request URLs
- **HTTP:** native `fetch`, no proxy agent (unlike livestock-api)
- **Errors:** throw `new Error(\`Salesforce API error \${response.status}\`)`on non-ok; throw`new Error(\`Salesforce auth error \${response.status}\`)`on auth failure; throw on missing config with message`'Missing required config: SALESFORCE_URL, SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET'`
- **204 responses:** `sfRequest` returns `null` for 204
- **Config:** all keys use `nullable: true, format: String, default: null` so the app starts without Salesforce credentials; mark secrets `sensitive: true`
- **Tests:** colocated `*.test.js`, Vitest; `index.test.js` uses real fetch mock via `fetchMock` with `clearTokenCache()` in `beforeEach`; `cases.test.js` mocks `./index.js` with `vi.mock` and uses `vi.clearAllMocks()` in `afterEach`

## Composite API (`composite`)

`composite(compositeRequest)` POSTs to `/composite` with `allOrNone: true`. Sub-requests use `referenceId` strings and cross-reference previous results via `@{referenceId.field}` syntax. Salesforce limit is 25 sub-requests per call — `createCase` enforces this and throws before making the request if exceeded.

## Salesforce Sobject model

- **Case** — `RecordTypeId` (looked up by `DeveloperName='APHA_CattleVax'`), `APHA_CPH__c` (CPH lookup), `APHA_ReasonForTest__c`, `APHA_TestWindowStartDate__c`, `APHA_TestWindowEndDate__c`, `Status`, `Priority`
- **APHA_CPH\_\_c** — looked up by `Name` (CPH number e.g. `'01/001/0006'`)
- **APHA_TestPart\_\_c** — `Case__c` (Case ID), `APHA_Day1__c`, `APHA_Day2__c`, `APHA_IdentityOfCertifiyngVet__c`, `APHA_IdentityOfTester__c`
- **APHA_TestPartResult\_\_c** — `APHA_TestPart__c` (TestPart ID), `APHA_TestType__c`, `APHA_EarTagNo__c`, batch fields (`APHA_BatchAvian__c`, `APHA_BatchBovine__c`, `APHA_BatchDIVA__c`), measurement fields (`APHA_TestDay1Avian__c`, `APHA_TestDay1Bovine__c`, `APHA_TestDay1DIVA__c`, `APHA_TestDay2Avian__c`, `APHA_TestDay2Bovine__c`, `APHA_TestDay2DIVA__c`), `APHA_ResultAfterReview__c`

## `createCase` composite request order

All requests are sent in a single `composite()` call with `allOrNone: true`:

1. `GET` query — `RecordType` for `APHA_CattleVax` → `referenceId: 'CaseRecordType'`
2. `GET` query — `APHA_CPH__c` by `Name` → `referenceId: 'CPHRef'`
3. `POST` `Case` using `@{CaseRecordType.records[0].Id}` and `@{CPHRef.records[0].Id}` → `referenceId: 'CaseRef'`
4. For each TestPart: `POST` `APHA_TestPart__c` using `@{CaseRef.id}` → `referenceId: 'TestPart_N'`
5. For each result of that part: `POST` `APHA_TestPartResult__c` using `@{TestPart_N.id}` → `referenceId: 'TestPartResult_N_M'`

After the call: checks `compositeResponse[0]` for empty records (RecordType not found), `compositeResponse[1]` for empty records (CPH not found), then scans all steps for `httpStatusCode >= 400`.

Returns `{ caseId, testParts: [{ testPartId, resultIds }] }`.

## Adding new functionality

- New sobject operations: add exported functions to `src/services/salesforce/index.js` calling `sfRequest()`
- New orchestration flows: create a new file alongside `cases.js` (e.g. `src/services/salesforce/updates.js`)
- New config: add under the `salesforce` convict key with `nullable: true, format: String, default: null`
- Tests for orchestration files: mock `./index.js` with `vi.mock`, use `vi.clearAllMocks()` in `afterEach`
- Tests for `index.js`: use real `fetchMock`, call `clearTokenCache()` in `beforeEach`
