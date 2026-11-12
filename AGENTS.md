# Project Guidance

## Coding Standards

- Follow nearby conventions. Use clear, intention-revealing names and named properties rather than positional values where they clarify the data.
- Prefer simple solutions for confirmed needs. Wait for three similar cases before introducing a reusable abstraction; prefer modules over new packages or services.
- Use JavaScript; do not introduce TypeScript without approval.
- Keep code self-explanatory. Comments should explain why, not narrate how; do not leave commented-out code.

## Architecture

Stateless Hapi BFF. Keep request validation and HTTP error mapping in `src/routes/`, external API calls and authentication in `src/services/`, and configuration in `src/config.js`.

- Prefer grouping related code by feature when it improves cohesion. Keep feature boundaries broad; don't create a folder for every endpoint or small variation. Follow the existing layout for small changes, and avoid unrelated restructuring.
- Reuse existing API request helpers and authentication clients when adding endpoints.
- Keep integration credentials nullable so the app can start without them; validate required credentials when the integration is used. Mark secrets `sensitive: true` in the config schema.

## Testing

- Tests are colocated `*.test.js` files using Vitest. Add or update tests for changed behaviour, including upstream failures and relevant auth/proxy handling.
- `fetch` is mocked globally in `.vite/setup-files.js` with `vitest-fetch-mock`; do not add per-test fetch mocking setup.
- Keep `fileParallelism: false` in `vitest.config.js`: module-level auth caches can interfere across suites.
- Mock `getSalesforceConnection()` in Salesforce service tests rather than making real connections.

Run focused tests with `npm test -- <path>`. Checks: `npm test`, `npm run lint`, `npm run format:check`.

## Security and Documentation

- When changing dependencies, check for updates and known vulnerabilities and run `npm run security-audit`; do not introduce packages with known vulnerabilities.
- Do not commit secrets or sensitive configuration.
- Follow the commands in `README.md` and `package.json`. Update the appropriate project documentation when setup, running, deployment, or usage changes; keep operational instructions out of code comments.

## Integrations

- **APHA:** use `getCognitoToken()` for bearer authentication. Preserve the CDP `x-api-key` header only in the local environment when a dev API key is configured. Date queries use midnight ISO timestamps (`${date}T00:00:00.000Z`).
- **Livestock:** uses a configured bearer token, not Cognito. Preserve the `undici` proxy `dispatcher` when `httpProxy` is configured; do not add the APHA dev header. Encode holding IDs in query parameters because they contain slashes.
- **Salesforce:** use the shared `getSalesforceConnection()` promise and jsforce client-credentials auth. Preserve retry after failed login and token refresh; do not create a connection per request.

## Reviews

When asked for a review, keep it read-only. Report actionable findings with file locations, most severe first; prioritise bugs, security risks, regressions, and missing tests over style.
