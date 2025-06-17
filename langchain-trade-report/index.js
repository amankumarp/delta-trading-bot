const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const app = express();
const port = 4040;

app.use(express.json());


function parseCustomDate(dateStr) {
  const regex = /^(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})$/;
  const match = dateStr.match(regex);

  if (!match) return null; // Invalid format

  const [_, day, month, year, hours, minutes, seconds] = match;

  const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);

  return isNaN(date.getTime()) ? null : date; // Return null if invalid date
}


// Analysis function
async function analyzeTrades(trades) {
  // Validate trades array
  if (!Array.isArray(trades) || trades.length === 0) {
    throw new Error("Invalid or empty trades array");
  }

  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.avg_profit > 0);
  const winRate = ((wins.length / totalTrades) * 100).toFixed(2);

  // Calculate totalProfit with validation
  const totalProfit = trades.reduce((sum, t) => {
    const profit = parseFloat(t.avg_profit);
    if (isNaN(profit)) {
      console.warn(
        `Invalid profit value in trade ${t.trade || t.id || "unknown"}: ${
          t.avg_profit
        }`
      );
      return sum;
    }
    return sum + profit;
  }, 0);

  // Check if totalProfit is valid before formatting
  const formattedTotalProfit = isNaN(totalProfit)
    ? "0.00"
    : totalProfit.toFixed(2);

  const avgProfit = (totalProfit / totalTrades).toFixed(2);
  const avgRisk = (
    trades.reduce((sum, t) => sum + (parseFloat(t.risk_percentage) || 0), 0) /
    totalTrades
  ).toFixed(2);
  const grossProfit = wins
    .reduce((sum, t) => sum + (parseFloat(t.avg_profit) || 0), 0)
    .toFixed(2);
  const grossLoss = trades
    .filter((t) => t.avg_profit <= 0)
    .reduce((sum, t) => sum + (parseFloat(t.avg_profit) || 0), 0)
    .toFixed(2);
  const profitFactor =
    grossLoss !== "0.00" ? (grossProfit / -grossLoss).toFixed(2) : "N/A";

  // Cumulative Profit
  let cumulativeProfit = [];
  let currentProfit = 0;
  trades.forEach((t) => {
    const profit = parseFloat(t.avg_profit) || 0;
    currentProfit += profit;
    cumulativeProfit.push(currentProfit.toFixed(2));
  });
  const maxDrawdown = Math.min(...cumulativeProfit).toFixed(2);

  // Session Analysis
  const sessionProfit = trades.reduce((acc, t) => {
    acc[t.session] = (acc[t.session] || 0) + (parseFloat(t.avg_profit) || 0);
    return acc;
  }, {});
  const sessionCounts = trades.reduce((acc, t) => {
    acc[t.session] = (acc[t.session] || 0) + 1;
    return acc;
  }, {});
  const sessionWinRates = Object.keys(sessionProfit).reduce((acc, session) => {
    const sessionWins = trades.filter(
      (t) => t.session === session && t.avg_profit > 0
    ).length;
    acc[session] = ((sessionWins / sessionCounts[session]) * 100).toFixed(2);
    return acc;
  }, {});

  // Volatility Analysis
  const volProfit = trades.reduce((acc, t) => {
    acc[t.volatility] =
      (acc[t.volatility] || 0) + (parseFloat(t.avg_profit) || 0);
    return acc;
  }, {});
  const volCounts = trades.reduce((acc, t) => {
    acc[t.volatility] = (acc[t.volatility] || 0) + 1;
    return acc;
  }, {});
  const volWinRates = Object.keys(volProfit).reduce((acc, vol) => {
    const volWins = trades.filter(
      (t) => t.volatility === vol && t.avg_profit > 0
    ).length;
    acc[vol] = ((volWins / volCounts[vol]) * 100).toFixed(2);
    return acc;
  }, {});

  // Position Type Analysis
  const posProfit = trades.reduce((acc, t) => {
    let position = t.isLong ? "buy" : "sell";
    acc[position] = (acc[position] || 0) + (parseFloat(t.avg_profit) || 0);
    return acc;
  }, {});
  const posCounts = trades.reduce((acc, t) => {
    let position = t.isLong ? "buy" : "sell";
    acc[position] = (acc[position] || 0) + 1;
    return acc;
  }, {});
  const posWinRates = Object.keys(posProfit).reduce((acc, pos) => {
    const posWins = trades.filter(
      (t) => (t.isLong ? "buy" : "sell") == pos && Number(t.avg_profit) > 0
    ).length;
    acc[pos] = ((posWins / posCounts[pos]) * 100).toFixed(2);
    return acc;
  }, {});

  // Best/Worst Trade
  const bestTrade = trades.reduce(
    (best, t) =>
      parseFloat(t.avg_profit) > parseFloat(best.avg_profit) ? t : best,
    trades[0]
  );
  const worstTrade = trades.reduce(
    (worst, t) =>
      parseFloat(t.avg_profit) < parseFloat(worst.avg_profit) ? t : worst,
    trades[0]
  );

  // Consecutive Wins/Losses (Streaks)
  let maxWinStreak = 0,
    maxLossStreak = 0,
    currentWinStreak = 0,
    currentLossStreak = 0;
  trades.forEach((t) => {
    if (parseFloat(t.avg_profit) > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    }
  });



  //  Average R-Multiple (Reward/Risk Ratio)
  const avgRMultiple = trades.length
    ? (
        trades.reduce(
          (sum, t) =>
            sum +
            (parseFloat(t.avg_profit) || 0) /
              (parseFloat(t.risk_percentage) || 1),
          0
        ) / trades.length
      ).toFixed(2)
    : "N/A";

  // Win/Loss by Time of Day

  const hourStats = trades.reduce((acc, t) => {
    if (!t.entry_time) return acc;
    const hour = parseCustomDate(t.entry_time).getUTCHours();
    acc[hour] = acc[hour] || { wins: 0, losses: 0, count: 0 };
    if (parseFloat(t.avg_profit) > 0) acc[hour].wins++;
    else acc[hour].losses++;
    acc[hour].count++;
    return acc;
  }, {});

  // Largest Drawdown (Peak-to-Trough)

  let peak = 0,
    trough = 0,
    maxDD = 0,
    runningProfit = 0;
  trades.forEach((t) => {
    runningProfit += parseFloat(t.avg_profit) || 0;
    if (runningProfit > peak) peak = runningProfit;
    if (runningProfit < trough) trough = runningProfit;
    const dd = peak - runningProfit;
    if (dd > maxDD) maxDD = dd;
  });
  const largestDrawdown = maxDD.toFixed(2);

  // Sharpe Ratio (Risk-Adjusted Return)
  const mean =
    trades.reduce((sum, t) => sum + (parseFloat(t.avg_profit) || 0), 0) /
    trades.length;
  const stdDev = Math.sqrt(
    trades.reduce(
      (sum, t) => sum + Math.pow((parseFloat(t.avg_profit) || 0) - mean, 2),
      0
    ) / trades.length
  );
  const sharpeRatio = stdDev !== 0 ? (mean / stdDev).toFixed(2) : "N/A";

  // Profit Distribution (Histogram Buckets)
  const profitBuckets = trades.reduce((acc, t) => {
    const profit = parseFloat(t.avg_profit) || 0;
    const bucket = Math.floor(profit / 2) * 2; // e.g., -10, -8, ..., 0, 2, 4, ...
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});

  // Trade Duration
  const durations = trades.map((t) => {
    if (!t.entry_time || !t.exit_time) return 0;
    const entry = parseCustomDate(t.entry_time);
    const exit = parseCustomDate(t.exit_time);
    return (exit - entry) / (1000 * 60 * 60); // Hours
  });
  const avgDurationWins = wins.length
    ? (
        wins
          .map((_, i) => durations[i])
          .filter(Boolean)
          .reduce((sum, x) => sum + x, 0) / wins.length
      ).toFixed(2)
    : "N/A";
  const avgDurationLosses =
    totalTrades - wins.length
      ? (
          trades
            .filter((t) => t.avg_profit <= 0)
            .map((_, i) => durations[i])
            .filter(Boolean)
            .reduce((sum, x) => sum + x, 0) /
          (totalTrades - wins.length)
        ).toFixed(2)
      : "N/A";




const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday","Saturday"];
const dayOfWeekStats = {};

trades.forEach(t => {
  if (!t.entry_time) return;
  const dateObj = parseCustomDate(t.entry_time);
  if (!dateObj) return;
  const day = dayNames[dateObj.getDay()];
  if (!dayOfWeekStats[day]) dayOfWeekStats[day] = { profit: 0, count: 0, wins: 0 };
  dayOfWeekStats[day].profit += parseFloat(t.avg_profit) || 0;
  dayOfWeekStats[day].count += 1;
  if (parseFloat(t.avg_profit) > 0) dayOfWeekStats[day].wins += 1;
});

// Format for output: profit and winrate per day
const dayOfWeekAnalysis = {};
Object.keys(dayOfWeekStats).forEach(day => {
  const stats = dayOfWeekStats[day];
  dayOfWeekAnalysis[day] = {
    profit: stats.profit.toFixed(2),
    winRate: stats.count ? ((stats.wins / stats.count) * 100).toFixed(2) : "0.00",
    count: stats.count
  };
});

// Daily profit/loss grouping
const dailyProfits = {};
trades.forEach(t => {
  if (!t.exit_time) return;
  const dateObj = parseCustomDate(t.exit_time);
  if (!dateObj) return;
  const day = dateObj.toISOString().slice(0, 10); // YYYY-MM-DD
  dailyProfits[day] = (dailyProfits[day] || 0) + (parseFloat(t.avg_profit) || 0);
});
const dailyProfitValues = Object.values(dailyProfits);
const maxProfitDay = dailyProfitValues.length ? Math.max(...dailyProfitValues).toFixed(2) : "N/A";
const maxLossDay = dailyProfitValues.length ? Math.min(...dailyProfitValues).toFixed(2) : "N/A";

//Monthly profit/loss grouping
const monthlyProfits = {};
trades.forEach(t => {
  if (!t.exit_time) return;
  const dateObj = parseCustomDate(t.exit_time);
  if (!dateObj) return;
  const month = dateObj.toISOString().slice(0, 7); // YYYY-MM
  monthlyProfits[month] = (monthlyProfits[month] || 0) + (parseFloat(t.avg_profit) || 0);
}
);  

const monthlyProfitValues = Object.values(monthlyProfits);
const maxProfitMonthly = monthlyProfitValues.length ? Math.max(...monthlyProfitValues).toFixed(2) : "N/A";
const maxLossMonthly = monthlyProfitValues.length ? Math.min(...monthlyProfitValues).toFixed(2) : "N/A";

// stoploss touched calculate
const stoplossTouched = trades.filter(t => t.stoploss_touched);

  return {
    startTime: trades[0].entry_time,
    endTime: trades[trades.length - 1].exit_time,
    totalDays: parseInt(
      (parseCustomDate(trades[trades.length - 1].exit_time) -
        parseCustomDate(trades[0].entry_time)) /
        (1000 * 60 * 60 * 24)
    ),
    totalTrades,
    winRate,
    totalProfit: formattedTotalProfit,
    profitFactor,
    maxDrawdown,
    avgProfit,
    avgRisk,
    sharpeRatio,
    maxWinStreak,
    maxLossStreak,
    avgRMultiple,
    largestDrawdown,
    avgDurationWins,
    avgDurationLosses,
    maxProfitDay,
    maxLossDay,
    maxProfitMonthly,
    maxLossMonthly,
    stoplossTouched: stoplossTouched.length,
    cumulativeProfit,
    sessionProfit,
    sessionCounts,
    sessionWinRates,
    volProfit,
    volCounts,
    volWinRates,
    posProfit,
    posCounts,
    posWinRates,
    bestTrade,
    worstTrade,
    hourStats,
    profitBuckets,
    dayOfWeekAnalysis,
    dailyProfits,
    monthlyProfits

  };
}

app.get("/api/analyze", async (req, res) => {
  try {
    const start = req.query.start;
    const end = req.query.end;
    const interval = req.query.interval;
    const symbol = req.query.symbol;
    const trades = await axios.get(
      `http://localhost:3002/strategy/supertrend-ai?symbol=${symbol}&interval=${interval}&onlytrade=true&start=${start}&end=${end}` // Adjust the URL as per your service
    );
    const analysis = await analyzeTrades(trades.data.trades);
    res.json({ analysis, trades: trades.data.trades });
  } catch (error) {
    console.error("Error analyzing trades:", error);
    res.status(500).json({ error: "Failed to analyze trades" });
  }
});

app.listen(port, () => {
  console.log(`Trade Analysis API running at http://localhost:${port}`);
});
