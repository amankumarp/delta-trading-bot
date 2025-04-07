const math = require("mathjs");

class BacktestService {
    constructor({
        initialCapital = 10000,
        riskPerTrade = 0.01,
        commission = 0.0005,
        leverage = 10,
        mode = "futures" // "spot" or "futures"
    } = {}) {
        this.initialCapital = initialCapital;
        this.riskPerTrade = riskPerTrade;
        this.commission = commission;
        this.leverage = leverage;
        this.mode = mode;
        this.reset();
    }

    reset() {
        this.equity = this.initialCapital;
        this.equityCurve = [{ timestamp: null, equity: this.initialCapital }];
        this.trades = [];
        this.sessionStats = { London: 0, NewYork: 0, Asian: 0, Other: 0 };
        this.dayStats = {
            Monday: 0, Tuesday: 0, Wednesday: 0,
            Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
        };
        this.profitableDays = 0;
        this.losingDays = 0;
        this.dailyReturns = {};
        this.drawdowns = [];
        this.maxDrawdown = 0;
        this.totalWins = 0;
        this.totalLosses = 0;
        this.biggestWin = 0;
        this.biggestLoss = 0;
        this.totalProfit = 0;
        this.totalLoss = 0;
        this.peakReturns = 0;
        this.winStreak = 0;
        this.lossStreak = 0;
        this.maxWinStreak = 0;
        this.maxLossStreak = 0;
        this.holdingPeriods = [];
        this.startDate = null;
        this.endDate = null;
        this.totalCommission = 0;
        this.openTrade = null;
    }

    updateDailyPerformance() {
        let profitableDays = 0;
        let losingDays = 0;
        Object.values(this.dailyReturns).forEach((profit) => {
            if (profit > 0) profitableDays++;
            else if (profit < 0) losingDays++;
        });

        this.profitableDays = profitableDays;
        this.losingDays = losingDays;
    }

    getBestTradingSession() {
        return Object.entries(this.sessionStats).sort((a, b) => b[1] - a[1])[0];
    }

    getBestTradingDay() {
        return Object.entries(this.dayStats).sort((a, b) => b[1] - a[1])[0];
    }

    executeTrade(signal, price, timestamp) {
        const positionSize = (this.equity * this.riskPerTrade * this.leverage) / price;

        if (signal === "buy" || signal === "sell") {
            if (this.openTrade) return;

            this.openTrade = {
                entryPrice: price,
                positionSize,
                isLong: signal === "buy",
                entryTimestamp: timestamp
            };
        } else if (signal === "exit" || signal === "partial_exit") {
            if (!this.openTrade) return;

            const { entryPrice, positionSize, isLong, entryTimestamp } = this.openTrade;

            let pnl = isLong
                ? (price - entryPrice) * positionSize
                : (entryPrice - price) * positionSize;

            if (this.mode === "spot") {
                pnl = Math.max(-this.equity, pnl);
            }

            const commissionCost = (entryPrice + price) * positionSize * this.commission;
            pnl -= commissionCost;

            const date = new Date(timestamp);
            const session = this.detectSession(timestamp);
            const day = date.toLocaleString("en-US", { weekday: "long" });
            const dayStr = date.toISOString().split("T")[0];

            this.sessionStats[session] += pnl;
            this.dayStats[day] += pnl;
            this.dailyReturns[dayStr] = (this.dailyReturns[dayStr] || 0) + pnl;

            this.updateDailyPerformance();

            const closedTrade = {
                entryPrice,
                exitPrice: price,
                pnl,
                positionSize,
                isWin: pnl > 0,
                isPartial: signal === "partial_exit",
                entryTimestamp,
                exitTimestamp: timestamp,
                isLong,
                leverage: this.leverage,
                commission: commissionCost
            };

            this.trades.push(closedTrade);
            this.equity += pnl;
            this.equityCurve.push({ timestamp, equity: this.equity });
            this.totalCommission += commissionCost;

            if (pnl > 0) {
                this.totalWins++;
                this.totalProfit += pnl;
                this.biggestWin = Math.max(this.biggestWin, pnl);
                this.winStreak++;
                this.lossStreak = 0;
                this.maxWinStreak = Math.max(this.maxWinStreak, this.winStreak);
            } else {
                this.totalLosses++;
                this.totalLoss += pnl;
                this.biggestLoss = Math.min(this.biggestLoss, pnl);
                this.lossStreak++;
                this.winStreak = 0;
                this.maxLossStreak = Math.max(this.maxLossStreak, this.lossStreak);
            }

            this.updateDrawdown();
            this.updatePeakReturns();

            const holdingTime = (new Date(timestamp) - new Date(entryTimestamp)) / (1000 * 60 * 60 * 24);
            this.holdingPeriods.push(holdingTime);

            if (signal === "exit") {
                this.openTrade = null;
            } else {
                this.openTrade.positionSize *= 0.5;
            }
        }

        if (!this.startDate) this.startDate = timestamp;
        this.endDate = timestamp;
    }

    updateDrawdown() {
        const peak = Math.max(...this.equityCurve.map(e => e.equity));
        const drawdown = (peak - this.equity) / peak;
        this.drawdowns.push(drawdown);
        this.maxDrawdown = Math.max(this.maxDrawdown, drawdown);
    }

    updatePeakReturns() {
        this.peakReturns = Math.max(this.peakReturns, this.equity - this.initialCapital);
    }

    detectSession(timestamp) {
        const date = new Date(timestamp);
        const utcHour = date.getUTCHours();
        if (utcHour >= 0 && utcHour < 9) return "Asian";
        if (utcHour >= 8 && utcHour < 17) return "London";
        if (utcHour >= 13 && utcHour < 22) return "NewYork";
        return "Other";
    }

    getBacktestStats() {
        const totalTrades = this.trades.length;
        const avgProfit = this.totalWins > 0 ? this.totalProfit / this.totalWins : 0;
        const avgLoss = this.totalLosses > 0 ? this.totalLoss / this.totalLosses : 0;
        const equityChangePct = ((this.equity - this.initialCapital) / this.initialCapital) * 100;
        const totalDays = (new Date(this.endDate) - new Date(this.startDate)) / (1000 * 60 * 60 * 24);
        const avgHoldingTime = this.holdingPeriods.length > 0 ? math.mean(this.holdingPeriods) : 0;
        const returns = this.trades.map(t => t.pnl);
        const sharpeRatio = returns.length > 1 ? math.mean(returns) / (math.std(returns) || 1) : 0;
        const bestTradingSession = this.getBestTradingSession();
        const bestTradingDay = this.getBestTradingDay();

        let marketChangePct = 0;
        let relativePerformance = 0;

        if (this.trades.length > 0) {
            const firstPrice = this.trades[0].entryPrice;
            const lastTrade = this.trades[this.trades.length - 1];
            const lastPrice = lastTrade.exitPrice || lastTrade.entryPrice;
            marketChangePct = ((lastPrice - firstPrice) / firstPrice) * 100;
            relativePerformance = equityChangePct - marketChangePct;
        }

        return {
            mode: this.mode,
            leverage: this.leverage,
            finalEquity: this.equity,
            startDate: this.startDate,
            endDate: this.endDate,
            marketChangePct,
            equityChangePct,
            relativePerformance,
            profitableDays: this.profitableDays,
            losingDays: this.losingDays,
            bestTradingSession,
            bestTradingDay,
            totalDays,
            maxDrawdown: this.maxDrawdown,
            winRate: totalTrades > 0 ? (this.totalWins / totalTrades) * 100 : 0,
            totalTrades,
            sharpeRatio,
            biggestWin: this.biggestWin,
            biggestLoss: this.biggestLoss,
            avgProfit,
            avgLoss,
            totalReturn: equityChangePct,
            peakReturns: this.peakReturns,
            maxWinStreak: this.maxWinStreak,
            maxLossStreak: this.maxLossStreak,
            profitFactor: this.totalLoss !== 0 ? Math.abs(this.totalProfit / this.totalLoss) : Infinity,
            expectancy: avgProfit + avgLoss,
            avgHoldingTime,
            totalCommission: this.totalCommission,
            equityCurve: this.equityCurve,
            trades: this.trades
        };
    }

    runBacktest(candles) {
        this.reset();

        for (let i = 0; i < candles.length; i++) {
            const candle = candles[i];
            if (candle.exit_signal) this.executeTrade("exit", candle.close, candle.time);
            if (candle.partial_exit) this.executeTrade("partial_exit", candle.close, candle.time);
            if (candle.bullish === true) this.executeTrade("buy", candle.close, candle.time);
            if (candle.bullish === false) this.executeTrade("sell", candle.close, candle.time);
        }

        return this.getBacktestStats();
    }
}

module.exports = BacktestService;
