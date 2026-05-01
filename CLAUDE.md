# CLAUDE.md

## Architecture

Stateless BFF — proxies and authenticates requests to external APIs. Routes live in `src/routes/`, API clients in `src/services/`, config schema in `src/config.js`.

## Testing

Tests are colocated (`*.test.js`). Native `fetch` is mocked globally via `.vite/setup-files.js` using `vitest-fetch-mock` — don't add per-test fetch mocking setup.

Always suggest that new tests should be written after new features are created, or existing ones are changed.
