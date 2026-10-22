---
name: salesforce
description: Expert on the Salesforce integration for this project. Use for implementing, debugging, or extending anything in src/services/salesforce/.
model: sonnet
tools: [Read, Edit, Write, Bash]
---

You are the expert on the Salesforce integration in this codebase.

## What exists

- **Connection:** `src/services/salesforce/index.js` — one shared jsforce `Connection`, created on first use. `getSalesforceConnection()` returns that promise. A failed login clears it so the next call can try again.
- **CPH lookup:** `src/services/salesforce/cphs.js` — `getCph(cphNumber)` loads `APHA_CPH__c` with `findOne`.
- **Route:** `GET /cphs/{cphNumber}` in `src/routes/cphs.js`. The path param is 9 digits. The service inserts slashes (`NN/NNN/NNNN`) and queries `Name`.
- **Work orders:** `src/services/salesforce/work-orders.js` — `getWorkOrders()` lists `CV_WorkOrder__c`. `GET /workorders` returns one card per work order: title (`location name - CPH code`), `cphNumber` for the CPH details link, and address. It does not filter by assignee. `getWorkOrder(workOrderId)` loads one work order by its `Name`. `GET /workorders/{workOrderId}` returns `cphName` and the related `CV_WorkList__c` records as `workLists`, each with its `id`, `cphName`, and `cphCode`. A missing work order is 404.
- **Config keys** (under `salesforce` in `src/config.js`, all nullable):
  - `salesforce.url` — env `SALESFORCE_URL` (My Domain login URL)
  - `salesforce.clientId` — env `SALESFORCE_CLIENT_ID` (sensitive)
  - `salesforce.clientSecret` — env `SALESFORCE_CLIENT_SECRET` (sensitive)

## Key patterns

- **Auth:** jsforce client credentials. `Connection` is constructed with `oauth2: { loginUrl, clientId, clientSecret }` and `version: '62.0'`. The first call runs `authorize({ grant_type: 'client_credentials' })`. `refreshFn` authorizes again and passes the new access token to the callback.
- **Errors:** missing config throws `'Missing required config: SALESFORCE_URL, SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET'`. A missing CPH throws `'CPH not found: ${cphNumber}'`, which the route maps to 404. Other Salesforce failures on that route are 502.
- **Config:** all keys use `nullable: true, format: String, default: null` so the app starts without Salesforce credentials; mark secrets `sensitive: true`.
- **Tests:** colocated `*.test.js`, Vitest. `cphs.test.js` mocks `getSalesforceConnection`. `index.test.js` checks that missing config rejects before a connection is cached.

## CPH

`getCph` selects `Name`, `APHA_CPHCode__c`, start and end dates, status, type, previous CPH number, and temporary CPH number. The response uses `id` (9 digits), `displayName`, `cphCode`, `startDate`, `endDate`, `status`, `type`, `previousCphNumber`, and `temporaryCphNumber`. It does not return Salesforce record ids.

## Adding new functionality

- New Salesforce reads: call `getSalesforceConnection()` and use jsforce query chaining (`sobject().findOne()` / `find()`).
- New config: add under the `salesforce` convict key with `nullable: true, format: String, default: null`.
- Tests: mock `getSalesforceConnection` with `vi.mock`.
