# Project Structure

```text
.
├── analytics/           # Trade logic observers and reporting engine
├── client/              # React/Vite/TS frontend application
│   ├── components/      # Reusable UI components (charts, stat cards)
│   ├── services/        # Frontend API services (geminiService, etc.)
│   └── utils/           # Frontend utilities
├── config/              # Environment-based configurations (dev, prod)
├── services/            # Backend Microservices
│   ├── alert/           # Scans market data for custom alerts
│   ├── market-data/     # CCXT integration, syncs OHLCV into SQLite DB
│   ├── notification/    # Telegram integration
│   ├── order-execution/ # Interfaces with exchanges to place live trades
│   └── strategy/        # Trading strategies (Supertrend, BB) & Base classes
├── main.js              # Entrypoint (orchestrator)
├── package.json         # Root Node.js dependencies and workspace scripts
├── docker-compose.yml   # Docker compose configuration
└── Dockerfile           # Backend build specification
```
