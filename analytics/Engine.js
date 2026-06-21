const { TradeSummaryObserver, EquityObserver, CategoricalObserver, TimeObserver, parseCustomDate } = require('./Observers');

class BacktestEngine {
    constructor(options = {}) {
        this.options = {
            initialBalance: 10000,
            leverage: 200,
            fee: 0.1,
            riskPercentPerTrade: 1,
            ...options
        };
        this.observers = [
            new TradeSummaryObserver(this.options),
            new EquityObserver(this.options),
            new CategoricalObserver(this.options),
            new TimeObserver(this.options)
        ];
    }

    run(trades) {
        if (!Array.isArray(trades)) {
            throw new Error("Trades must be an array");
        }

        const equityObserver = this.observers.find(o => o instanceof EquityObserver);
        const processedTrades = [];

        for (const trade of trades) {
            const currentBalance = equityObserver.currentBalance;

            // Calculate Dollar PnL for this trade
            const rawProfitPct = parseFloat(trade.avg_profit) || parseFloat(trade.profit) || 0;
            const entryPrice = parseFloat(trade.entry_price) || 0;
            const positionSize = (currentBalance * this.options.riskPercentPerTrade / 100) * this.options.leverage;
            const qnt = entryPrice !== 0 ? (positionSize / entryPrice) : 0;
            const feeAmount = (positionSize * this.options.fee / 100) * 2; // entry + exit
            const pnl = (positionSize * rawProfitPct / 100) - feeAmount;

            // Handle partial exit quantities if applicable
            let partial_exit_qnt = undefined;
            let partial_pnl = undefined;

            if (trade.partial_exit_price) {
                // Currently Supertrend AI takes 50% out at partial exit target
                partial_exit_qnt = qnt * 0.5;
                const partialRawProfit = parseFloat(trade.partial_profit) || 0;
                partial_pnl = ((positionSize * 0.5) * partialRawProfit / 100) - (feeAmount * 0.5);
            }

            // Attach pnl and qnt to a copy of the trade
            const processedTrade = {
                ...trade,
                pnl: parseFloat(pnl.toFixed(2)),
                feePaid: parseFloat(feeAmount.toFixed(2)),
                qnt: parseFloat(qnt.toFixed(4)),
                ...(partial_exit_qnt && { partial_exit_qnt: parseFloat(partial_exit_qnt.toFixed(4)) }),
                ...(partial_pnl !== undefined && { partial_pnl: parseFloat(partial_pnl.toFixed(2)) })
            };
            processedTrades.push(processedTrade);

            for (const observer of this.observers) {
                observer.update(processedTrade, currentBalance);
            }
        }

        const report = this.generateReport(processedTrades);
        return { report, trades: processedTrades };
    }

    generateReport(trades) {
        const report = {
            initialBalance: this.options.initialBalance,
            leverage: this.options.leverage,
            fee: this.options.fee,
            riskPercentPerTrade: this.options.riskPercentPerTrade
        };

        if (trades.length > 0) {
            const firstTrade = trades[0];
            const lastTrade = trades[trades.length - 1];
            report.startTime = firstTrade.entry_time;
            report.endTime = lastTrade.exit_time;

            const start = parseCustomDate(firstTrade.entry_time);
            const end = parseCustomDate(lastTrade.exit_time);
            if (start && end) {
                report.totalDays = parseInt((end - start) / (1000 * 60 * 60 * 24));
            }
        }

        for (const observer of this.observers) {
            Object.assign(report, observer.getResult(trades));
        }

        // Add Recovery Factor: Total Profit / Max Drawdown
        if (report.totalProfit && report.maxDrawdown && parseFloat(report.maxDrawdown) !== 0) {
            report.recoveryFactor = (parseFloat(report.totalProfit) / Math.abs(parseFloat(report.maxDrawdown))).toFixed(2);
        } else {
            report.recoveryFactor = "N/A";
        }

        return report;
    }
}

module.exports = BacktestEngine;
