function parseCustomDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr === 'number') {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
  }
  if (dateStr instanceof Date) {
      return isNaN(dateStr.getTime()) ? null : dateStr;
  }
  if (typeof dateStr !== 'string') {
      dateStr = String(dateStr);
  }
  
  // Handle purely numeric strings (Unix timestamps)
  if (/^\d+$/.test(dateStr)) {
      let num = Number(dateStr);
      if (dateStr.length <= 10) num *= 1000; // Convert seconds to milliseconds
      const d = new Date(num);
      return isNaN(d.getTime()) ? null : d;
  }

  const regex = /^(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})$/;
  const match = dateStr.match(regex);
  if (!match) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  const [_, day, month, year, hours, minutes, seconds] = match;
  const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
  return isNaN(date.getTime()) ? null : date;
}

class BaseObserver {
    constructor(options = {}) {
        this.options = {
            initialBalance: 10000,
            leverage: 200,
            fee: 0.1, // percentage
            riskPercentPerTrade: 1, // percentage of balance
            ...options
        };
    }
    update(trade, currentBalance) {}
    getResult(trades) { return {}; }
}

class TradeSummaryObserver extends BaseObserver {
    constructor(options) {
        super(options);
        this.totalTrades = 0;
        this.wins = [];
        this.totalProfit = 0;
        this.grossProfit = 0;
        this.grossLoss = 0;
        this.bestTrade = null;
        this.worstTrade = null;
        this.stoplossTouchedCount = 0;
        this.totalFees = 0;
        
        this.maxWinStreak = 0;
        this.maxLossStreak = 0;
        this.currentWinStreak = 0;
        this.currentLossStreak = 0;
        
        this.profitsPerTrade = [];
        this.riskPercentages = [];
        this.rMultiples = [];
    }

    update(trade, currentBalance) {
        const adjustedProfit = trade.pnl || 0;
        const feePaid = trade.feePaid || 0;

        this.totalTrades++;
        this.totalProfit += adjustedProfit;
        this.totalFees += feePaid;
        this.profitsPerTrade.push(adjustedProfit);
        
        if (adjustedProfit > 0) {
            this.wins.push(trade);
            this.grossProfit += adjustedProfit;
            this.currentWinStreak++;
            this.currentLossStreak = 0;
            if (this.currentWinStreak > this.maxWinStreak) this.maxWinStreak = this.currentWinStreak;
        } else {
            this.grossLoss += adjustedProfit;
            this.currentLossStreak++;
            this.currentWinStreak = 0;
            if (this.currentLossStreak > this.maxLossStreak) this.maxLossStreak = this.currentLossStreak;
        }

        this.riskPercentages.push(parseFloat(trade.risk_percentage) || 0);
        // R-Multiple calculation
        const positionSize = (currentBalance * this.options.riskPercentPerTrade / 100) * this.options.leverage;
        const riskAmount = positionSize * (parseFloat(trade.risk_percentage) || 1) / 100;
        this.rMultiples.push(riskAmount !== 0 ? adjustedProfit / riskAmount : 0);

        if (!this.bestTrade || adjustedProfit > (this.bestTrade.pnl || -Infinity)) {
            this.bestTrade = trade;
        }
        if (!this.worstTrade || adjustedProfit < (this.worstTrade.pnl || Infinity)) {
            this.worstTrade = trade;
        }

        if (trade.stoploss_touched) this.stoplossTouchedCount++;
    }

    getResult(trades = []) {
        const winRate = this.totalTrades > 0 ? (this.wins.length / this.totalTrades) : 0;
        const avgProfit = this.totalTrades > 0 ? (this.totalProfit / this.totalTrades) : 0;
        const avgRisk = this.totalTrades > 0 ? (this.riskPercentages.reduce((a, b) => a + b, 0) / this.totalTrades) : 0;
        const profitFactor = this.grossLoss !== 0 ? (this.grossProfit / -this.grossLoss).toFixed(2) : "N/A";
        const avgRMultiple = this.totalTrades > 0 ? (this.rMultiples.reduce((a, b) => a + b, 0) / this.totalTrades).toFixed(2) : "N/A";

        // Standard Ratios using percentage returns for accuracy
        // Fallback to avg_profit if adjusted_profit_pct is undefined (e.g. legacy compatibility)
        const returns = trades.map(t => {
            if (t.adjusted_profit_pct !== undefined) return parseFloat(t.adjusted_profit_pct);
            return parseFloat(t.avg_profit) || 0;
        });
        
        if (returns.length === 0) return {
            totalTrades: 0,
            winRate: "0.00",
            totalProfit: "0.00",
            avgProfit: "0.00",
            avgRisk: "0.00",
            grossProfit: "0.00",
            grossLoss: "0.00",
            profitFactor: "N/A",
            bestTrade: null,
            worstTrade: null,
            maxWinStreak: 0,
            maxLossStreak: 0,
            avgRMultiple: "N/A",
            sharpeRatio: "N/A",
            sortinoRatio: "N/A",
            expectancy: "0.00",
            totalFees: "0.00",
            stoplossTouched: 0,
            avgWin: "0.00",
            avgLoss: "0.00",
            cagr: "N/A",
            annualReturn: "N/A"
        };

        // Determine elapsed days dynamically
        let totalDays = 1;
        if (trades && trades.length > 1) {
            const firstDate = parseCustomDate(trades[0].entry_time) || new Date(trades[0].entry_time);
            const lastDate = parseCustomDate(trades[trades.length - 1].exit_time) || new Date(trades[trades.length - 1].exit_time);
            
            if (firstDate && lastDate && !isNaN(firstDate) && !isNaN(lastDate)) {
                totalDays = Math.max((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24), 1);
            }
        }
        this.totalDays = totalDays;


        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const varianceReturn = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
        const stdDevReturn = Math.sqrt(varianceReturn);
        const sharpeRatio = stdDevReturn !== 0 ? ((meanReturn / stdDevReturn) * Math.sqrt(this.totalTrades > 0 ? (this.totalTrades / (this.totalDays > 0 ? (this.totalDays/365) : 1)) : 1)).toFixed(2) : "N/A";

        const downsideReturns = returns.filter(r => r < 0);
        const downsideVarReturn = downsideReturns.length > 0 ? downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length : 0;
        const downsideStdDevReturn = Math.sqrt(downsideVarReturn);
        const sortinoRatio = downsideStdDevReturn !== 0 ? ((meanReturn / downsideStdDevReturn) * Math.sqrt(this.totalTrades > 0 ? (this.totalTrades / (this.totalDays > 0 ? (this.totalDays/365) : 1)) : 1)).toFixed(2) : "N/A";

        // Expectancy: (WinRate * AvgWin) + (LossRate * AvgLoss)
        const avgWin = this.wins.length > 0 ? this.grossProfit / this.wins.length : 0;
        const lossCount = this.totalTrades - this.wins.length;
        const avgLoss = lossCount > 0 ? this.grossLoss / lossCount : 0;
        const expectancy = ((winRate * avgWin) + ((1 - winRate) * avgLoss)).toFixed(2);

        // Win/Loss Ratio
        const winLossRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss).toFixed(2) : "N/A";

        // Kelly Criterion: W - [(1-W) / R] where W is winRate and R is winLossRatio
        let kelly = "N/A";
        if (winRate > 0 && winLossRatio !== "N/A" && parseFloat(winLossRatio) > 0) {
            const R = parseFloat(winLossRatio);
            kelly = (winRate - ((1 - winRate) / R)).toFixed(2);
        }

        return {
            totalTrades: this.totalTrades,
            winRate: (winRate * 100).toFixed(2),
            totalProfit: this.totalProfit.toFixed(2),
            avgProfit: avgProfit.toFixed(2),
            avgRisk: avgRisk.toFixed(2),
            grossProfit: this.grossProfit.toFixed(2),
            grossLoss: this.grossLoss.toFixed(2),
            profitFactor,
            bestTrade: this.bestTrade,
            worstTrade: this.worstTrade,
            maxWinStreak: this.maxWinStreak,
            maxLossStreak: this.maxLossStreak,
            avgRMultiple,
            sharpeRatio,
            sortinoRatio,
            expectancy,
            winLossRatio,
            kelly,
            totalFees: this.totalFees.toFixed(2),
            stoplossTouched: this.stoplossTouchedCount,
            avgWin: avgWin.toFixed(2),
            avgLoss: avgLoss.toFixed(2)
        };
    }
}

class EquityObserver extends BaseObserver {
    constructor(options) {
        super(options);
        this.cumulativeProfit = [];
        this.currentBalance = this.options.initialBalance;
        this.currentProfit = 0;
        this.peak = this.options.initialBalance;
        this.maxDrawdownP2T = 0;
    }

    update(trade) {
        const adjustedProfit = trade.pnl || 0;

        this.currentBalance += adjustedProfit;
        this.currentProfit += adjustedProfit;
        this.cumulativeProfit.push(this.currentProfit.toFixed(2));

        if (this.currentBalance > this.peak) this.peak = this.currentBalance;
        const dd = this.peak - this.currentBalance;
        if (dd > this.maxDrawdownP2T) this.maxDrawdownP2T = dd;
    }

    getResult(trades) {
        let cagr = "N/A";
        let calmarRatio = "N/A";

        if (trades.length > 0) {
            const firstDate = parseCustomDate(trades[0].entry_time);
            const lastDate = parseCustomDate(trades[trades.length - 1].exit_time);
            if (firstDate && lastDate) {
                const years = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 365.25);
                if (years > 0) {
                    const totalReturn = (this.currentBalance / this.options.initialBalance);
                    cagr = ((Math.pow(totalReturn, 1 / years) - 1) * 100).toFixed(2);
                    
                    const maxDDPercent = (this.maxDrawdownP2T / this.peak) * 100;
                    calmarRatio = maxDDPercent !== 0 ? (parseFloat(cagr) / maxDDPercent).toFixed(2) : "N/A";
                }
            }
        }

        return {
            cumulativeProfit: this.cumulativeProfit,
            maxDrawdown: this.maxDrawdownP2T.toFixed(2),
            maxDrawdownPercent: (this.peak > 0) ? ((this.maxDrawdownP2T / this.peak) * 100).toFixed(2) : "0.00",
            finalBalance: this.currentBalance.toFixed(2),
            totalReturn: (((this.currentBalance / this.options.initialBalance) - 1) * 100).toFixed(2),
            cagr,
            calmarRatio
        };
    }
}

class CategoricalObserver extends BaseObserver {
    constructor(options) {
        super(options);
        this.sessionProfit = {};
        this.sessionCounts = {};
        this.volProfit = {};
        this.volCounts = {};
        this.posProfit = {};
        this.posCounts = {};
        this.profitBuckets = {};
    }

    update(trade, currentBalance) {
        const adjustedProfit = trade.pnl || 0;

        if (trade.session) {
            this.sessionProfit[trade.session] = (this.sessionProfit[trade.session] || 0) + adjustedProfit;
            this.sessionCounts[trade.session] = (this.sessionCounts[trade.session] || 0) + 1;
        }
        if (trade.volatility) {
            this.volProfit[trade.volatility] = (this.volProfit[trade.volatility] || 0) + adjustedProfit;
            this.volCounts[trade.volatility] = (this.volCounts[trade.volatility] || 0) + 1;
        }
        const pos = trade.isLong ? "buy" : "sell";
        this.posProfit[pos] = (this.posProfit[pos] || 0) + adjustedProfit;
        this.posCounts[pos] = (this.posCounts[pos] || 0) + 1;

        const bucket = Math.floor(adjustedProfit / 10) * 10;
        this.profitBuckets[bucket] = (this.profitBuckets[bucket] || 0) + 1;
    }

    getResult(trades) {
        const sessions = Object.keys(this.sessionCounts).map(s => {
            const wins = trades.filter(t => t.session === s && parseFloat(t.avg_profit) > 0).length;
            return {
                [s]: {
                    profit: parseFloat(this.sessionProfit[s].toFixed(2)),
                    count: this.sessionCounts[s],
                    winRate: ((wins / this.sessionCounts[s]) * 100).toFixed(2)
                }
            };
        });

        const volatility = Object.keys(this.volCounts).map(v => {
            const wins = trades.filter(t => t.volatility === v && parseFloat(t.avg_profit) > 0).length;
            return {
                [v]: {
                    profit: parseFloat(this.volProfit[v].toFixed(2)),
                    count: this.volCounts[v],
                    winRate: ((wins / this.volCounts[v]) * 100).toFixed(2)
                }
            };
        });

        const positions = Object.keys(this.posCounts).map(p => {
            const wins = trades.filter(t => (t.isLong ? "buy" : "sell") === p && parseFloat(t.avg_profit) > 0).length;
            return {
                [p]: {
                    profit: parseFloat(this.posProfit[p].toFixed(2)),
                    count: this.posCounts[p],
                    winRate: ((wins / this.posCounts[p]) * 100).toFixed(2)
                }
            };
        });

        return {
            sessions,
            volatility,
            positions,
            profitBuckets: this.profitBuckets
        };
    }
}

class TimeObserver extends BaseObserver {
    constructor(options) {
        super(options);
        this.hourStats = {};
        this.sessionStats = {
            'Asian': { wins: 0, losses: 0, count: 0, profit: 0 },
            'London': { wins: 0, losses: 0, count: 0, profit: 0 },
            'New York': { wins: 0, losses: 0, count: 0, profit: 0 },
            'Other': { wins: 0, losses: 0, count: 0, profit: 0 }
        };
        this.dayOfWeekStats = {};
        this.dailyStats = {};
        this.monthlyStats = {};
        this.winDurations = [];
        this.lossDurations = [];
    }

    update(trade, currentBalance) {
        const adjustedProfit = trade.pnl || 0;

        if (trade.entry_time) {
            const date = parseCustomDate(trade.entry_time);
            if (date) {
                const hour = date.getUTCHours();
                if (!this.hourStats[hour]) this.hourStats[hour] = { wins: 0, losses: 0, count: 0 };
                this.hourStats[hour].count++;
                if (adjustedProfit > 0) this.hourStats[hour].wins++;
                else this.hourStats[hour].losses++;
                
                // Session
                let session = 'Other';
                if (hour >= 0 && hour < 8) session = 'Asian';
                else if (hour >= 8 && hour < 14) session = 'London';
                else if (hour >= 14 && hour < 20) session = 'New York';
                
                this.sessionStats[session].count++;
                this.sessionStats[session].profit += adjustedProfit;
                if (adjustedProfit > 0) this.sessionStats[session].wins++;
                else this.sessionStats[session].losses++;

                const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                const day = dayNames[date.getDay()];
                if (!this.dayOfWeekStats[day]) this.dayOfWeekStats[day] = { profit: 0, count: 0, wins: 0 };
                this.dayOfWeekStats[day].profit += adjustedProfit;
                this.dayOfWeekStats[day].count++;
                if (adjustedProfit > 0) this.dayOfWeekStats[day].wins++;
            }
        }

        if (trade.exit_time) {
            const date = parseCustomDate(trade.exit_time);
            if (date) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                
                const dayKey = `${day}-${month}-${year}`;
                if (!this.dailyStats[dayKey]) this.dailyStats[dayKey] = { profit: 0, count: 0 };
                this.dailyStats[dayKey].profit = parseFloat((this.dailyStats[dayKey].profit + adjustedProfit).toFixed(2));
                this.dailyStats[dayKey].count++;

                const monthKey = `${month}-${year}`;
                if (!this.monthlyStats[monthKey]) this.monthlyStats[monthKey] = { profit: 0, count: 0 };
                this.monthlyStats[monthKey].profit = parseFloat((this.monthlyStats[monthKey].profit + adjustedProfit).toFixed(2));
                this.monthlyStats[monthKey].count++;
            }
        }

        if (trade.entry_time && trade.exit_time) {
            const entry = parseCustomDate(trade.entry_time);
            const exit = parseCustomDate(trade.exit_time);
            if (entry && exit) {
                const duration = (exit - entry) / (1000 * 60 * 60);
                if (adjustedProfit > 0) this.winDurations.push(duration);
                else this.lossDurations.push(duration);
            }
        }
    }

    getResult() {
        const dayOfWeekAnalysis = {};
        Object.keys(this.dayOfWeekStats).forEach(day => {
            const stats = this.dayOfWeekStats[day];
            dayOfWeekAnalysis[day] = {
                profit: stats.profit.toFixed(2),
                winRate: stats.count ? ((stats.wins / stats.count) * 100).toFixed(2) : "0.00",
                count: stats.count
            };
        });
        const dailyValues = Object.values(this.dailyStats).map(s => s.profit);
        const monthlyValues = Object.values(this.monthlyStats).map(s => s.profit);

        const sessions = Object.keys(this.sessionStats).map(key => {
            const stats = this.sessionStats[key];
            return {
                [key]: {
                    profit: parseFloat(stats.profit.toFixed(2)),
                    count: stats.count,
                    winRate: stats.count ? ((stats.wins / stats.count) * 100).toFixed(2) : "0.00"
                }
            };
        });

        return {
            hourStats: this.hourStats,
            sessions,
            dayOfWeekAnalysis,
            daily: this.dailyStats,
            monthly: this.monthlyStats,
            maxProfitDay: dailyValues.length ? Math.max(...dailyValues).toFixed(2) : "N/A",
            maxLossDay: dailyValues.length ? Math.min(...dailyValues).toFixed(2) : "N/A",
            maxProfitMonthly: monthlyValues.length ? Math.max(...monthlyValues).toFixed(2) : "N/A",
            maxLossMonthly: monthlyValues.length ? Math.min(...monthlyValues).toFixed(2) : "N/A",
            avgDurationWins: this.winDurations.length ? (this.winDurations.reduce((a, b) => a + b, 0) / this.winDurations.length).toFixed(2) : "N/A",
            avgDurationLosses: this.lossDurations.length ? (this.lossDurations.reduce((a, b) => a + b, 0) / this.lossDurations.length).toFixed(2) : "N/A"
        };
    }
}

class VolatilityObserver extends BaseObserver {
    constructor(options) {
        super(options);
        this.volatilityStats = {
            'Low Volatility': { wins: 0, losses: 0, count: 0, profit: 0 },
            'Medium Volatility': { wins: 0, losses: 0, count: 0, profit: 0 },
            'High Volatility': { wins: 0, losses: 0, count: 0, profit: 0 }
        };
    }

    update(trade, currentBalance) {
        const adjustedProfit = trade.pnl || 0;
        let slDist = 0;
        
        // Try to derive volatility from sl_price distance or risk_percentage
        if (trade.sl_price && trade.entry_price) {
            slDist = Math.abs(trade.entry_price - trade.sl_price) / trade.entry_price * 100;
        } else if (trade.risk_percentage) {
            slDist = parseFloat(trade.risk_percentage);
        } else {
            slDist = 1.0; // fallback medium
        }

        let cat = 'Medium Volatility';
        if (slDist < 0.8) cat = 'Low Volatility';
        else if (slDist > 2.0) cat = 'High Volatility';

        this.volatilityStats[cat].count++;
        this.volatilityStats[cat].profit += adjustedProfit;
        if (adjustedProfit > 0) this.volatilityStats[cat].wins++;
        else this.volatilityStats[cat].losses++;
    }

    getResult() {
        const volatility = Object.keys(this.volatilityStats).map(key => {
            const stats = this.volatilityStats[key];
            return {
                [key]: {
                    profit: parseFloat(stats.profit.toFixed(2)),
                    count: stats.count,
                    winRate: stats.count ? ((stats.wins / stats.count) * 100).toFixed(2) : "0.00"
                }
            };
        });

        return {
            volatility
        };
    }
}

module.exports = {
    TradeSummaryObserver,
    EquityObserver,
    CategoricalObserver,
    TimeObserver,
    VolatilityObserver,
    parseCustomDate,
    BaseObserver
};
