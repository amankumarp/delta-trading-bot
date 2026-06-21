# Coding Conventions

## General
- The application uses Node.js workspaces to manage modules (`services/*`, `analytics`, etc.).
- `concurrently` is used heavily in `npm start` to run multiple background services inside one container/process block.
- Environment variables configured via `dotenv` (`.env`).

## Backend
- **Language**: JavaScript (CommonJS pattern).
- **OOP Patterns**:
  - `BaseStrategy` acts as a base class. New strategies inherit and implement required signal generation methods.
  - State management for trades is handled via `TradeManager` and `TradeState` objects.
- **Logging**: Done via `winston` for persistent log rotation and standardization.
- **Database**: Prisma used generically, but explicit SQLite schemas configured via `sqlite3` driver locally.

## Frontend
- **Language**: TypeScript (`.ts`, `.tsx`).
- **UI Architecture**: React functional components using Hooks. Tailwind utility classes used directly in JSX.
- **Strict Typing**: Standard types defined in `client/types.ts`.
