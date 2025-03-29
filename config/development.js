require('dotenv').config();

module.exports = {
    EXCHANGE_API: "https://cdn-ind.testnet.deltaex.org/v2",
    WEBSOCKET_URL: "wss://socket-ind.testnet.deltaex.org",
    SYMBOL: "BTCUSD",
    TIMEFRAME: "15m",
    STRATEGY:"supertrend-ai",
    RISK_PERCENTAGE_PER_TRADE: 0.01,
    SL_OFFSET: 50
};
