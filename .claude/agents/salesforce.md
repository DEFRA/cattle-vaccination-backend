---
name: salesforce
description: Expert on the Salesforce integration for this project. Use for implementing, debugging, or extending anything in src/services/salesforce/.
model: sonnet
tools: [Read, Edit, Write, Bash]
---

You are the expert on the Salesforce integration in this codebase.

## What exists

- **Base service:** `src/services/salesforce/index.js` — token caching, `sfRequest()` helper, and exported `query`, `getRecord`, `createRecord`, `updateRecord`, `deleteRecord`, `composite`, `compositeGraph`. Also exports `SF_API_PATH` (e.g. `/services/data/v62.0`) for use in composite sub-request URLs.
- **Cases orchestration:** `src/services/salesforce/cases.js` — `createCase()` creates a Case only; `getCase()` retrieves a Case with its TestParts and results
- **Test parts:** `src/services/salesforce/test-parts.js` — `submitTestParts()` submits new TestParts and their results to an existing Case using the graph API
- **Test part results:** `src/services/salesforce/test-part-results.js` — `addTestPartResults()` adds results to an already-existing TestPart using the graph API
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
- **Tests:** colocated `*.test.js`, Vitest; `index.test.js` uses real fetch mock via `fetchMock` with `clearTokenCache()` in `beforeEach`; all orchestration test files (`cases.test.js`, `test-parts.test.js`, `test-part-results.test.js`) mock `./index.js` with `vi.mock` (exporting `composite`, `compositeGraph`, `SF_API_PATH`) and use `vi.clearAllMocks()` in `afterEach`

## Composite API (`composite`)

`composite(compositeRequest)` POSTs to `/composite` with `allOrNone: true`. Sub-requests use `referenceId` strings and cross-reference previous results via `@{referenceId.field}` syntax. Salesforce limit is 25 sub-requests per call.

## Composite Graph API (`compositeGraph`)

`compositeGraph(graphs)` POSTs to `/composite/graph` with a `{ graphs }` body. Each graph is `{ graphId, compositeRequest[] }`. Unlike the regular Composite API, there is no 25 sub-request limit per graph node (Salesforce allows up to 500). `submitTestParts` always uses the graph API.

## Salesforce Sobject model

- **Case** — `RecordTypeId` (looked up by `DeveloperName='APHA_CattleVax'`), `APHA_CPH__c` (CPH lookup), `APHA_ReasonForTest__c`, `APHA_TestWindowStartDate__c`, `APHA_TestWindowEndDate__c`, `Status`, `Priority`
- **APHA_CPH\_\_c** — looked up by `Name` (CPH number e.g. `'01/001/0006'`)
- **APHA_TestPart\_\_c** — `Case__c` (Case ID), `APHA_Day1__c`, `APHA_Day2__c`, `APHA_IdentityOfCertifiyngVet__c`, `APHA_IdentityOfTester__c`
- **APHA_TestPartResult\_\_c** — `APHA_TestPart__c` (TestPart ID), `APHA_TestType__c`, `APHA_EarTagNo__c`, batch fields (`APHA_BatchAvian__c`, `APHA_BatchBovine__c`, `APHA_BatchDIVA__c`), measurement fields (`APHA_TestDay1Avian__c`, `APHA_TestDay1Bovine__c`, `APHA_TestDay1DIVA__c`, `APHA_TestDay2Avian__c`, `APHA_TestDay2Bovine__c`, `APHA_TestDay2DIVA__c`), `APHA_ResultAfterReview__c`

## Case flow

### `createCase({ cphNumber, reasonForTest, testWindowStart, testWindowEnd })`

Single `composite()` call with 3 sub-requests:

1. `GET` query — `RecordType` for `APHA_CattleVax` → `referenceId: 'CaseRecordType'`
2. `GET` query — `APHA_CPH__c` by `Name` → `referenceId: 'CPHRef'`
3. `POST` `Case` using `@{CaseRecordType.records[0].Id}` and `@{CPHRef.records[0].Id}` → `referenceId: 'CaseRef'`

Returns `{ caseId }`. Does NOT create TestParts or results.

### `getCase(caseNumber)`

Accepts a **case number** (numeric string, e.g. `'00001234'`) — NOT a Salesforce ID. Three sequential SOQL queries:

1. Query `Case WHERE CaseNumber='${escapedCaseNumber}' LIMIT 1` — selects `Id, CaseNumber, Status, Priority, APHA_ReasonForTest__c, APHA_TestWindowStartDate__c, APHA_TestWindowEndDate__c, APHA_CPH__r.Name, CreatedDate, CreatedBy.Name`. Throws `Case not found: ${caseNumber}` if no records returned.
2. Query `APHA_TestPart__c WHERE Case__c='${caseRecord.Id}'` — uses `caseRecord.Id` obtained from step 1.
3. For each TestPart in parallel (`Promise.all`): query `APHA_TestPartResult__c WHERE APHA_TestPart__c='${tp.Id}'`.

Returns the full nested object with camelCase field names: `{ id, caseNumber, status, priority, reasonForTest, testWindowStart, testWindowEnd, cph, openedDate, openedBy, testParts: [{ id, day1, day2, certifyingVet, tester, results: [{ id, testType, earTagNo, batchAvian, batchBovine, batchDiva, day1Avian, day1Bovine, day1Diva, day2Avian, day2Bovine, day2Diva, resultAfterReview }] }] }`.

`cph` is the CPH number string from `APHA_CPH__r.Name` (relationship traversal, not the raw lookup ID). `openedDate` is `CreatedDate`. `openedBy` is `CreatedBy.Name`. Both `cph` and `openedBy` default to `null` if the relationship is absent.

### `submitTestParts(caseId, testParts)` — `src/services/salesforce/test-parts.js`

Submits new TestParts and their results to an existing Case using `compositeGraph` (single node, `graphId: 'Graph_0'`). Private helper `buildSubRequests` interleaves `APHA_TestPart__c` POSTs (referenceId `TestPart_${i}`) with `APHA_TestPartResult__c` POSTs (referenceId `TestPartResult_${i}_${j}`); results cross-reference the TestPart via `@{TestPart_${i}.id}`. `APHA_ResultAfterReview__c` is always hardcoded to `null` in the POST body (unlike `addTestPartResults` which reads it from the input). Private helper `extractResults` walks the flat composite response sequentially to reconstruct the return shape. Returns `{ testParts: [{ testPartId, resultIds }] }`. Throws `Salesforce graph request failed at step: <referenceId>` (or without the step suffix if no failed step is found) on failure.

### `addTestPartResults(testPartId, results)` — `src/services/salesforce/test-part-results.js`

Adds results to an **already-existing** TestPart (does not create the TestPart). Uses `compositeGraph` with a single node; one sub-request per result, referenceIds `Result_0`, `Result_1`, etc. All optional result fields (`batchAvian`, `batchBovine`, `batchDiva`, `day1Avian`, `day1Bovine`, `day1Diva`, `day2Avian`, `day2Bovine`, `day2Diva`, `resultAfterReview`) default to `null` via `?? null` — unlike `submitTestParts` which passes optional fields through directly. Returns `{ resultIds: string[] }`.

Error handling differs from `submitTestParts`: on graph failure it looks for a `FIELD_CUSTOM_VALIDATION_EXCEPTION` error code in the failed step's body array and extracts its `message`, falling back to `'Salesforce validation failed'`. Throws `Salesforce graph request failed - ${errorMessage}`.

## HTTP Routes (`src/routes/cases.js`)

All routes use Joi validation and convert errors to Boom responses. `'Case not found: ...'` errors from `getCase` map to `404 Not Found`; all other service errors map to `502 Bad Gateway`.

### `POST /cases`

Creates a new Case. Payload validated with Joi:

- `cphNumber` — string matching `/^\d{2}\/\d{3}\/\d{4}$/`
- `reasonForTest` — one of `'Radial'`, `'6W'`, `'6M'`, `'12M'`, `'48M'`, `'Pre-Movement'`, `'Post-Movement'`
- `testWindowStart` — ISO date string
- `testWindowEnd` — ISO date string

Returns `201` with `{ caseId }`.

### `GET /cases/{caseNumber}`

Retrieves a Case with all TestParts and results. Path param `caseNumber` must match `/^\d+$/` (numeric digits only). Calls `getCase(caseNumber)` and returns `200` with the full nested object. Returns `404` if the case is not found.

### `POST /cases/{id}/test-parts`

Submits new TestParts to an existing Case. Path param `id` is a Salesforce ID (alphanum, 15–18 chars). Payload:

- `testParts` — array (min 1) of:
  - `day1`, `day2` — ISO date strings
  - `certifyingVet`, `tester` — strings
  - `results` — array (min 1) of `testPartResultSchema` (see below)

Returns `201` with `{ testParts: [{ testPartId, resultIds }] }`.

### `POST /cases/{caseId}/test-parts/{testPartId}/results`

Adds results to an existing TestPart. Both path params are Salesforce IDs (alphanum, 15–18 chars). Payload: `{ results: [testPartResultSchema] }` (min 1). Returns `201` with `{ resultIds: string[] }`.

### `testPartResultSchema` (shared Joi schema)

- `testType` — `'DIVA'` or `'SICCT'`
- `earTagNo` — string, max 20 chars
- `batchAvian`, `batchBovine`, `batchDiva` — string max 20, nullable, default `null`
- `day1Avian`, `day1Bovine`, `day2Avian`, `day2Bovine` — integer 0–999, required when `testType='SICCT'`, `null` otherwise
- `day1Diva`, `day2Diva` — integer 0–999, required when `testType='DIVA'`, `null` otherwise
- `resultAfterReview` — string, nullable, default `null`

## Adding new functionality

- New sobject operations: add exported functions to `src/services/salesforce/index.js` calling `sfRequest()`
- New orchestration flows: create a new file alongside `cases.js` (e.g. `src/services/salesforce/updates.js`)
- New config: add under the `salesforce` convict key with `nullable: true, format: String, default: null`
- Tests for orchestration files: mock `./index.js` with `vi.mock`, use `vi.clearAllMocks()` in `afterEach`
- Tests for `index.js`: use real `fetchMock`, call `clearTokenCache()` in `beforeEach`
