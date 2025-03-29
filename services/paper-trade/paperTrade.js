const SupertrendAI = require('../strategy/SupertrendStrategy');

/**
 * Simulate paper trading using live or historical data.
 * @param {Array} liveData - Array of OHLCV data (open, high, low, close, volume).
 * @param {number} initialBalance - The starting balance for paper trading.
 * @returns {Object} - Paper trading results including trades and balance.
 */
function runPaperTrade(liveData, initialBalance = 10000) {
    const strategy = new SupertrendAI();
    const { high, low, close } = liveData;

    // Generate signals
    const signals = strategy.generateSignals({ high, low, close });

    let balance = initialBalance;
    let position = null;
    const trades = [];

    for (const signal of signals) {
        const price = close[signal.index];

        if (signal.type === 'buy' && !position) {
            // Open a long position
            position = { entryPrice: price, type: 'long' };
            trades.push({ type: 'buy', price, index: signal.index });
        } else if (signal.type === 'sell' && position && position.type === 'long') {
            // Close the long position
            const profit = price - position.entryPrice;
            balance += profit;
            trades.push({ type: 'sell', price, index: signal.index, profit });
            position = null;
        }
    }

    return {
        initialBalance,
        finalBalance: balance,
        trades,
        profit: balance - initialBalance,
        profitPercentage: ((balance - initialBalance) / initialBalance) * 100,
    };
}

module.exports = { runPaperTrade };