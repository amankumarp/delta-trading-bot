const { BaseObserver, parseCustomDate } = require('./Observers');

class RiskMetricsObserver extends BaseObserver {
    constructor(options) {
        super(options);
        this.returns = [];
        this.currentBalance = this.options.initialBalance;
        this.peak = this.options.initialBalance;
        this.drawdowns = []; // Keep track of drawdown squared for Ulcer Index
    }

    update(trade) {
        const pnl = trade.pnl || 0;
        this.currentBalance += pnl;
        
        if (this.currentBalance > this.peak) {
            this.peak = this.currentBalance;
        }

        const drawdownPct = this.peak > 0 ? ((this.peak - this.currentBalance) / this.peak) * 100 : 0;
        this.drawdowns.push(drawdownPct);

        const returnPct = trade.adjusted_profit_pct || 0;
        this.returns.push(returnPct);
    }

    getResult(trades = []) {
        if (this.returns.length === 0) return {};

        const meanReturn = this.returns.reduce((sum, r) => sum + r, 0) / this.returns.length;
        const variance = this.returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / this.returns.length;
        const volatility = Math.sqrt(variance);

        const downsideReturns = this.returns.filter(r => r < 0);
        const downsideVariance = downsideReturns.length > 0 
            ? downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length 
            : 0;
        const downsideDeviation = Math.sqrt(downsideVariance);

        // Ulcer Index
        const sumSquaredDrawdowns = this.drawdowns.reduce((sum, dd) => sum + Math.pow(dd, 2), 0);
        const ulcerIndex = this.drawdowns.length > 0 ? Math.sqrt(sumSquaredDrawdowns / this.drawdowns.length) : 0;

        // Value at Risk (VaR) at 95% confidence
        const sortedReturns = [...this.returns].sort((a, b) => a - b);
        const varIndex = Math.floor(sortedReturns.length * 0.05);
        const var95 = sortedReturns[varIndex] || 0;

        // Conditional VaR (CVaR) - expected shortfall
        const tailReturns = sortedReturns.slice(0, varIndex + 1);
        const cvar95 = tailReturns.length > 0 ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length : 0;

        // Tail Ratio: 95th percentile return / absolute 5th percentile return
        const p95Index = Math.floor(sortedReturns.length * 0.95);
        const p95Return = sortedReturns[p95Index] || 0;
        const tailRatio = Math.abs(var95) > 0 ? (p95Return / Math.abs(var95)) : 0;

        // Omega Ratio
        const riskFreeRate = 0;
        const sumGains = this.returns.filter(r => r > riskFreeRate).reduce((sum, r) => sum + r, 0);
        const sumLosses = Math.abs(this.returns.filter(r => r < riskFreeRate).reduce((sum, r) => sum + r, 0));
        const omegaRatio = sumLosses > 0 ? sumGains / sumLosses : 0;

        return {
            historicalVolatility: volatility.toFixed(2),
            downsideDeviation: downsideDeviation.toFixed(2),
            ulcerIndex: ulcerIndex.toFixed(2),
            valueAtRisk95: var95.toFixed(2),
            conditionalVaR95: cvar95.toFixed(2),
            tailRatio: tailRatio.toFixed(2),
            omegaRatio: omegaRatio.toFixed(2)
        };
    }
}

class DrawdownObserver extends BaseObserver {
    constructor(options) {
        super(options);
        this.currentBalance = this.options.initialBalance;
        this.peak = this.options.initialBalance;
        this.peakDate = null;
        
        this.drawdownTimeline = [];
        this.drawdownPeriods = []; // Record start, bottom, recovery, days, loss%
        
        this.inDrawdown = false;
        this.currentDDStart = null;
        this.currentDDBottom = null;
        this.currentDDMaxPct = 0;
    }

    update(trade) {
        const pnl = trade.pnl || 0;
        this.currentBalance += pnl;
        const tradeDate = parseCustomDate(trade.exit_time) || new Date(trade.exit_time);

        if (this.currentBalance >= this.peak) {
            // New peak reached
            if (this.inDrawdown) {
                // Drawdown recovered
                const days = (tradeDate - this.currentDDStart) / (1000 * 60 * 60 * 24);
                this.drawdownPeriods.push({
                    start: this.currentDDStart,
                    bottom: this.currentDDBottom,
                    recovery: tradeDate,
                    days: Math.max(1, days),
                    lossPct: this.currentDDMaxPct
                });
                this.inDrawdown = false;
            }
            this.peak = this.currentBalance;
            this.peakDate = tradeDate;
            this.drawdownTimeline.push(0);
        } else {
            // In drawdown
            const ddPct = ((this.peak - this.currentBalance) / this.peak) * 100;
            this.drawdownTimeline.push(ddPct);
            
            if (!this.inDrawdown) {
                this.inDrawdown = true;
                this.currentDDStart = this.peakDate || tradeDate;
                this.currentDDBottom = tradeDate;
                this.currentDDMaxPct = ddPct;
            } else {
                if (ddPct > this.currentDDMaxPct) {
                    this.currentDDMaxPct = ddPct;
                    this.currentDDBottom = tradeDate;
                }
            }
        }
    }

    getResult() {
        const dds = this.drawdownPeriods.map(d => d.lossPct).concat(this.inDrawdown ? [this.currentDDMaxPct] : []);
        const avgDrawdown = dds.length > 0 ? dds.reduce((sum, d) => sum + d, 0) / dds.length : 0;
        
        const sortedDDs = [...dds].sort((a, b) => b - a);
        const medianDrawdown = sortedDDs.length > 0 ? sortedDDs[Math.floor(sortedDDs.length / 2)] : 0;
        
        const longestDrawdown = this.drawdownPeriods.length > 0 
            ? Math.max(...this.drawdownPeriods.map(d => d.days)) 
            : 0;

        // Pain Index: Mean of the absolute drawdowns (similar to Ulcer but using mean instead of RMS)
        const painIndex = this.drawdownTimeline.length > 0 
            ? this.drawdownTimeline.reduce((sum, d) => sum + d, 0) / this.drawdownTimeline.length 
            : 0;

        const topDrawdowns = this.drawdownPeriods
            .sort((a, b) => b.lossPct - a.lossPct)
            .slice(0, 5)
            .map(d => ({
                start: d.start ? d.start.toISOString().split('T')[0] : 'N/A',
                bottom: d.bottom ? d.bottom.toISOString().split('T')[0] : 'N/A',
                recovery: d.recovery ? d.recovery.toISOString().split('T')[0] : 'N/A',
                days: Math.round(d.days),
                lossPct: d.lossPct.toFixed(2)
            }));

        return {
            avgDrawdown: avgDrawdown.toFixed(2),
            medianDrawdown: medianDrawdown.toFixed(2),
            longestDrawdownDays: Math.round(longestDrawdown),
            painIndex: painIndex.toFixed(2),
            topDrawdowns,
            drawdownTimeline: this.drawdownTimeline
        };
    }
}

class TransactionCostObserver extends BaseObserver {
    constructor(options) {
        super(options);
        this.grossProfit = 0;
        this.netProfit = 0;
        this.totalFees = 0;
        this.totalSlippage = 0;
        this.totalFunding = 0;
        this.totalHoldingHours = 0;
        this.totalTrades = 0;
    }

    update(trade, currentBalance) {
        this.totalTrades++;
        
        // From Engine calculation
        const positionSize = (currentBalance * this.options.riskPercentPerTrade / 100) * this.options.leverage;
        
        // Fee & Slippage cost
        const feeCost = (positionSize * this.options.fee / 100) * 2;
        const slippageCost = (positionSize * this.options.slippage / 100) * 2;
        const fundingCost = trade.fundingCost || 0;
        
        this.totalFees += feeCost;
        this.totalSlippage += slippageCost;
        this.totalFunding += fundingCost;
        this.totalHoldingHours += trade.holdingHours || 0;
        
        const rawProfitPct = parseFloat(trade.avg_profit) || parseFloat(trade.profit) || 0;
        const rawPnl = (positionSize * rawProfitPct / 100);
        
        this.grossProfit += rawPnl;
        this.netProfit += (rawPnl - feeCost - slippageCost - fundingCost);
    }

    getResult() {
        const avgCost = this.totalTrades > 0 ? (this.totalFees + this.totalSlippage + this.totalFunding) / this.totalTrades : 0;
        const costAsPctOfGross = this.grossProfit > 0 ? ((this.totalFees + this.totalSlippage + this.totalFunding) / this.grossProfit) * 100 : 0;
        const avgHoldingHours = this.totalTrades > 0 ? this.totalHoldingHours / this.totalTrades : 0;

        return {
            grossProfitValue: this.grossProfit.toFixed(2),
            netProfitValue: this.netProfit.toFixed(2),
            totalCommission: this.totalFees.toFixed(2),
            totalSlippageValue: this.totalSlippage.toFixed(2),
            totalFundingCost: this.totalFunding.toFixed(2),
            avgHoldingHours: avgHoldingHours.toFixed(2),
            fundingRateSetting: (this.options.fundingRate || 0.01).toFixed(4),
            avgCostPerTrade: avgCost.toFixed(2),
            costAsPctOfGross: costAsPctOfGross.toFixed(2)
        };
    }
}

class MarketRegimeObserver extends BaseObserver {
    constructor(options) {
        super(options);
        this.regimeStats = {
            'Trending': { count: 0, profit: 0, wins: 0, losses: 0, drawdowns: [] },
            'Sideways': { count: 0, profit: 0, wins: 0, losses: 0, drawdowns: [] },
            'Volatile': { count: 0, profit: 0, wins: 0, losses: 0, drawdowns: [] }
        };
    }

    update(trade) {
        const regime = trade.market_regime || 'Sideways'; // Default to sideways if unknown
        const pnl = trade.pnl || 0;
        
        if (!this.regimeStats[regime]) {
            this.regimeStats[regime] = { count: 0, profit: 0, wins: 0, losses: 0, drawdowns: [] };
        }
        
        this.regimeStats[regime].count++;
        this.regimeStats[regime].profit += pnl;
        
        if (pnl > 0) this.regimeStats[regime].wins++;
        else this.regimeStats[regime].losses++;
    }

    getResult() {
        const result = {};
        for (const [regime, stats] of Object.entries(this.regimeStats)) {
            result[regime] = {
                trades: stats.count,
                netProfit: stats.profit.toFixed(2),
                winRate: stats.count > 0 ? ((stats.wins / stats.count) * 100).toFixed(2) : "0.00",
                profitFactor: stats.losses > 0 ? (stats.wins / stats.losses).toFixed(2) : "N/A", // Simplified pf
                avgTrade: stats.count > 0 ? (stats.profit / stats.count).toFixed(2) : "0.00"
            };
        }
        return { marketRegimeAnalysis: result };
    }
}

class ExitAnalysisObserver extends BaseObserver {
    constructor(options) {
        super(options);
        this.exitStats = {
            'Stop Loss': { count: 0, profit: 0, wins: 0, losses: 0 },
            'Take Profit': { count: 0, profit: 0, wins: 0, losses: 0 },
            'Trailing Stop': { count: 0, profit: 0, wins: 0, losses: 0 },
            'Time Exit': { count: 0, profit: 0, wins: 0, losses: 0 },
            'Signal Reverse': { count: 0, profit: 0, wins: 0, losses: 0 }
        };
    }

    update(trade) {
        const exitReason = trade.exit_reason || (trade.stoploss_touched ? 'Stop Loss' : 'Take Profit');
        const pnl = trade.pnl || 0;
        
        if (!this.exitStats[exitReason]) {
            this.exitStats[exitReason] = { count: 0, profit: 0, wins: 0, losses: 0 };
        }
        
        this.exitStats[exitReason].count++;
        this.exitStats[exitReason].profit += pnl;
        
        if (pnl > 0) this.exitStats[exitReason].wins++;
        else this.exitStats[exitReason].losses++;
    }

    getResult() {
        const totalProfit = Object.values(this.exitStats).reduce((sum, stat) => sum + stat.profit, 0);
        
        const result = {};
        for (const [reason, stats] of Object.entries(this.exitStats)) {
            result[reason] = {
                frequency: stats.count,
                winRate: stats.count > 0 ? ((stats.wins / stats.count) * 100).toFixed(2) : "0.00",
                avgProfit: stats.wins > 0 ? (Math.max(0, stats.profit) / stats.wins).toFixed(2) : "0.00",
                avgLoss: stats.losses > 0 ? (Math.min(0, stats.profit) / stats.losses).toFixed(2) : "0.00",
                contributionPct: totalProfit !== 0 ? ((stats.profit / totalProfit) * 100).toFixed(2) : "0.00"
            };
        }
        return { exitAnalysis: result };
    }
}

module.exports = {
    RiskMetricsObserver,
    DrawdownObserver,
    TransactionCostObserver,
    MarketRegimeObserver,
    ExitAnalysisObserver
};
