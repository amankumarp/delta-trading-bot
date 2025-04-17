const math = require("mathjs");

class BacktestService {
    constructor({
        initialCapital = 10000,
        riskPerTrade = 0.001,
        fixedPositionSize = 0.01, // default to 1 lot
        positionSizingMode = "risk", // "risk" or "fixed"
        commission = 0.005,
        leverage = 20,
        mode = "futures" // "spot" or "futures"
    } = {}) {
        this.initialCapital = initialCapital;
        this.riskPerTrade = riskPerTrade;
        this.fixedPositionSize = fixedPositionSize;
        this.positionSizingMode = positionSizingMode;
        this.commission = commission;
        this.leverage = leverage;
        this.mode = mode;
        this.reset();
    }

    reset() {
        this.equity = this.initialCapital;
        this.equityCurve = [{ timestamp: null, equity: this.initialCapital }];
        this.trades = [];
        this.sessionStats = { London: 0, NewYork: 0, Tokyo:0, LondonNewYork:0,Other: 0 };
        this.dayStats = {Monday: 0, Tuesday: 0, Wednesday: 0,Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0};
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


    executeTrade(signal, price, timestamp ,sl=0) {
        
        if (signal === "buy" || signal === "sell") {
            if (this.openTrade) return;
            let positionSize;
            
            if (this.positionSizingMode === "fixed") {
                positionSize = this.fixedPositionSize;
            } else {
                // risk-based sizing
                const stopLossDistance = Math.abs(price - sl);
                if(stopLossDistance > 500) return;
                 console.log("stopLossDistance", stopLossDistance);
                positionSize = (this.equity * this.riskPerTrade ) / stopLossDistance;

            }

            this.openTrade = {
                entryPrice: price,
                positionSize,
                stoploss:sl,
                isLong: signal === "buy",
                entryTimestamp: timestamp
            };
        } else if (signal === "exit" || signal === "partial_exit") {
            if (!this.openTrade) return;

            const { entryPrice, positionSize, isLong, entryTimestamp ,stoploss} = this.openTrade;
            const exitSize = signal === "partial_exit" ? positionSize / 2 : positionSize;

            let pnl = isLong
            ? (price - entryPrice) * exitSize
            : (entryPrice - price) * exitSize;
           
            if (this.mode === "spot") {
                pnl = Math.max(-this.equity, pnl);
            }

            const commissionCost = (entryPrice + price) * exitSize * this.commission;
            pnl -= commissionCost;


            const date = new Date(timestamp*1000);
            const session = this.detectSession(timestamp);
            const day = date.toLocaleString("en-GB", { weekday: "long" });
 
            const dayStr = date.toISOString().split("T")[0];
            this.sessionStats[session] += pnl;
            this.dayStats[day] += pnl;
            this.dailyReturns[dayStr] = (this.dailyReturns[dayStr] || 0) + pnl;
   
            this.updateDailyPerformance();

            const closedTrade = {
                entryPrice,
                exitPrice: price,
                stoploss:stoploss,
                pnl,
                positionSize: exitSize,
                isWin: pnl > 0,
                isPartial: signal === "partial_exit",
                entryDate:new Date(entryTimestamp*1000).toLocaleString("en-GB", { timeZone: "Asia/kolkata" }),
                exitDate: new Date(timestamp*1000).toLocaleString("en-GB", { timeZone: "Asia/kolkata" }),
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

            const holdingTime = (new Date(timestamp) - new Date(entryTimestamp)) / ( 60 * 60 * 24);
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
        const date = new Date(timestamp * 1000);
        const utcHour = date.getUTCHours();
        const utcMinute = date.getUTCMinutes();
        const totalMinutes = utcHour * 60 + utcMinute;
    
        const inRange = (min, max) => totalMinutes >= min && totalMinutes < max;
    
        const TOKYO_START = 0 * 60 + 0;    // 00:00 UTC
        const TOKYO_END   = 5 * 60 + 55;   // 05:55 UTC
    
        const LONDON_START = 7 * 60 + 30;  // 07:30 UTC
        const LONDON_END   = 15 * 60 + 25; // 15:25 UTC
    
        const NY_START = 13 * 60 + 30;     // 13:30 UTC
        const NY_END   = 19 * 60 + 55;     // 19:55 UTC
    
        const inTokyo = inRange(TOKYO_START, TOKYO_END);
        const inLondon = inRange(LONDON_START, LONDON_END);
        const inNY = inRange(NY_START, NY_END);
        const inOverlap = inLondon && inNY;
    
        if (inOverlap) return "LondonNewYork";
        if (inTokyo) return "Tokyo";
        if (inLondon) return "London";
        if (inNY) return "NewYork";
        return "Other";
    }

    getBacktestStats() {
        const totalTrades = this.trades.length;
        const avgProfit = this.totalWins > 0 ? this.totalProfit / this.totalWins : 0;
        const avgLoss = this.totalLosses > 0 ? this.totalLoss / this.totalLosses : 0;
        const equityChangePct = ((this.equity - this.initialCapital) / this.initialCapital) * 100;
        const totalDays = (new Date(this.endDate*1000) - new Date(this.startDate*1000)) / ( 1000*60 * 60 * 24);
        const avgHoldingTime = this.holdingPeriods.length > 0 ? math.mean(this.holdingPeriods) : 0;
        const returns = this.trades.map(t => t.pnl);
        const sharpeRatio = returns.length > 1 ? math.mean(returns) / (math.std(returns) || 1) : 0;
        
        // console.log(this.dayStats);
        // console.log(this.sessionStats);

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
            startDate: new Date(this.startDate*1000).toLocaleString("en-GB", { timeZone: "Asia/kolkata" }), 
            endDate: new Date(this.endDate*1000).toLocaleString("en-GB", { timeZone: "Asia/kolkata" }),
            marketChangePct,
            equityChangePct,
            relativePerformance,
            profitableDays: this.profitableDays,
            losingDays: this.losingDays,
            dayStats:this.dayStats,
            sessionStats:this.sessionStats,
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
            if (candle.bullish === true) this.executeTrade("buy", candle.close, candle.time, candle.supertrend);
            if (candle.bullish === false) this.executeTrade("sell", candle.close, candle.time, candle.supertrend);
        }

        return this.getBacktestStats();
    }
}

module.exports = BacktestService;
