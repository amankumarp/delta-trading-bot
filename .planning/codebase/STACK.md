# Tech Stack

## Backend
- **Runtime**: Node.js
- **Framework**: Express (implied for REST endpoints), `ws` (WebSockets)
- **Database**: SQLite (via `services/market-data/db/data/ohlcv.db`), Prisma ORM
- **In-Memory / PubSub**: Redis
- **Market Data / Trading**: `ccxt`
- **Technical Indicators**: `technicalindicators`, custom implementations (`mathjs`)
- **Process Management**: `concurrently`, `nodemon`
- **Scheduling**: `node-cron`
- **Logging**: `winston`, `winston-daily-rotate-file`

## Frontend
- **Framework**: React, Vite
- **Language**: TypeScript (`.tsx` / `.ts` extensions)
- **Styling**: Tailwind CSS (implied by typical React+Vite UI stacks)
- **Charting**: Unspecified (likely Lightweight Charts or Recharts based on `.tsx` file names like `TradingChart`, `ProfitChart`)

## Infrastructure
- **Containerization**: Docker (`Dockerfile`, `docker-compose.yml`)
