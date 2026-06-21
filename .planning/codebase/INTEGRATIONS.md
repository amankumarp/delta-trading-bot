# External Integrations

## Exchanges
- **Delta Exchange / General Exchange via CCXT**: Core integration for fetching market data, order book, and executing trades (`services/order-execution/ExchangeService.js`, `ccxt` dependency).

## Notifications
- **Telegram**: Used for sending alerts, trade signals, trailing stop updates, and profit/loss reports (`services/notification/telegram.js`, utilizing `axios` for webhooks).

## Data Sources
- **WebSockets / REST**: Used by the market data service to pull continuous stream of OHLCV data to local SQLite for strategies.
