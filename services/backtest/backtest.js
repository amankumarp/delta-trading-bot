const SupertrendAI = require('../strategy/SupertrendStrategy');

/**
 * Run a backtest on historical data.
 * @param {Array} historicalData - Array of OHLCV data (open, high, low, close, volume).
 * @param {number} initialBalance - The starting balance for the backtest.
 * @returns {Object} - Backtest results including final balance, trades, and performance metrics.
 */
function runBacktest(historicalData, initialBalance = 10000) {
    const strategy = new SupertrendAI();
    const { high, low, close } = historicalData;

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

module.exports = { runBacktest };