require('dotenv').config();

module.exports = {
    EXCHANGE_API: "https://api.india.delta.exchange/v2",
    WEBSOCKET_URL: "wss://socket.india.delta.exchange",
    SYMBOL: "BTCUSD",
    TIMEFRAME: "15m",
    STRATEGY:"supertrend-ai",
    RISK_PERCENTAGE_PER_TRADE: 0.01,
    SL_OFFSET: 50
};
