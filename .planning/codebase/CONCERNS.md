# Codebase Concerns & Tech Debt

## Testing
- Zero test coverage exists. Trading logic must be heavily tested to avoid loss of funds in production environments.
- Backtesting frameworks do not seem strictly decoupled from live trading components. 

## Reliability
- `concurrently` is used to spawn multiple background services inside one Node.js process group. If one service encounters an unhandled exception and exits, it might bring down or desync the entire node instance depending on configuration.
- The `TradeManager.js` relies on constant sync with `market-data`. Any latency or drop in SQLite DB read/writes could cause missed trade exits.

## Hardcoded Configurations
- Strategy parameters (e.g., stop loss buffers, trailing rules) contain magic numbers and hardcoded values instead of utilizing strategy configuration profiles.
- Telegram notification code contains heavily coupled formatting rules that could be split into a template engine logic.

## Monolithic Service Bleed
- The services share a single `package.json` at the root for standardizing dependencies, but lack explicit workspace boundaries. Upgrading a package could break multiple services simultaneously without discrete package.json manifests defining bounded contexts.
