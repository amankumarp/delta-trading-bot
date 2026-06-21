# Testing

## Framework
- **Tools**: `jest` and `supertest` are configured in `devDependencies`.

## Current State
- **Coverage**: No test coverage currently exists. Running `npm test` yields `"No tests defined yet."`.

## Recommended Path
- Establish unit tests around technical indicators in `services/strategy/indicators`.
- Implement testing for strategy signal generation.
- Add integration tests for the `market-data` ingestion processes.
