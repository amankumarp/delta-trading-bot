# Architecture

## High-Level System Design
The application operates as a localized microservices-style monolithic architecture. Independent services run concurrently and likely communicate via Redis Pub/Sub, shared DB state, or inter-process communication.

### Core Components
1. **Market Data Service (`services/market-data`)**:
   - Ingests real-time and historical OHLCV (Open, High, Low, Close, Volume) data.
   - Syncs and stores data into an SQLite database (`ohlcv.db`).
   - Handles background jobs for backfilling data (`jobs/backfill.js`, `jobs/syncJob.js`).

2. **Strategy Service (`services/strategy`)**:
   - Analyzes market data provided by the DB.
   - Computes technical indicators (Supertrend, Bollinger Bands, EMA, RSI).
   - Generates trade signals and manages dynamic stop losses/take profits (`TradeManager.js`).

3. **Order Execution Service (`services/order-execution`)**:
   - Listens for signals from the Strategy service.
   - Interfaces with exchanges via CCXT to place limit/market orders and monitor fills.

4. **Alerts & Notification Services (`services/alert`, `services/notification`)**:
   - Scans the market data independently for threshold or pattern matching.
   - Formats and sends Markdown messages to Telegram.

5. **Analytics Service (`analytics`)**:
   - Logs overall performance, trade history, and account equity metrics.

6. **Frontend Dashboard (`client`)**:
   - React SPA (Single Page Application) that polls or receives WebSockets to display performance, recent trades, and charts.

## Deployment
- Can be deployed via `docker-compose` wrapping the `Dockerfile` for the core app, with possible external dependencies (like Redis) provided as containers.
