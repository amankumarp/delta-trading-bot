
import { BacktestResponse, Candle, Trade, Analysis, TrendDataPoint } from './types';

export const INTERVAL_OPTIONS = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1mo'];
export const ASSET_OPTIONS = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'XAU_USDT', 'EUR_USD'];
export const STRATEGY_OPTIONS = [
  { id: 'supertrend-ai', name: 'Supertrend AI', description: 'Advanced trend following with machine learning volatility filters.', icon: 'Zap' },
  { id: 'bb-ai', name: 'Bollinger AI', description: 'Mean reversion strategy leveraging Gaussian distribution and neural signals.', icon: 'Activity' },
  { id: 'scalping-ai', name: 'Scalping AI', description: 'BTC scalping with EMA ribbon, MACD, RSI & ATR trailing SL. Min 1:2 RR, >50% win-rate target.', icon: 'Crosshair' },
  { id: 'imba-algo', name: 'IMBA ALGO', description: 'Fibonacci channel trend system with 4 TP levels, break-even logic, RSI filter & live drawdown tracking.', icon: 'TrendingUp' },
  { id: 'sats', name: 'SATS', description: 'Self-Aware Trend System v1.9.0 — adaptive TQI + dynamic TP', icon: 'Compass' },
  { id: 'pdh-pdl-sweep', name: 'PDH/PDL Sweep Reversal', description: 'ICT/SMC Liquidity Sweep Reversal strategy on Previous Day High/Low with multi-tier TP and Break-Even CTC.', icon: 'TrendingUp' }
];

const generateRichMockData = (): BacktestResponse => {
  const candles: Candle[] = [];
  const trades: Trade[] = [];
  let price = 65000;
  const startTime = 1717196400; // ~ June 2024
  const count = 1000;
  const interval = 3600; // 1h

  const marketTrendData: TrendDataPoint[] = [];
  let currentEquity = 0;

  for (let i = 0; i < count; i++) {
    // Generate organic-looking price movement with alternating "regimes"
    const regime = Math.floor(i / 200);
    let bias = 0;
    let trendType: 'Bullish' | 'Bearish' | 'Sideways' = 'Sideways';

    if (regime === 0) { bias = 200; trendType = 'Bullish'; } // Bull
    else if (regime === 1) { bias = -150; trendType = 'Bearish'; } // Bear
    else if (regime === 2) { bias = 50; trendType = 'Sideways'; } // Sideways/Choppy
    else if (regime === 3) { bias = 300; trendType = 'Bullish'; } // Strong Bull
    else { bias = -50; trendType = 'Bearish'; }

    const change = (Math.random() - 0.5) * 500 + bias;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 200;
    const low = Math.min(open, close) - Math.random() * 200;
    const time = startTime + i * interval;

    candles.push({ time, open, high, low, close, volume: Math.random() * 50000 });
    price = close;

    // Generate a trade every few steps
    if (i > 20 && i % 10 === 0) {
      const isLong = trendType === 'Bullish' || (trendType === 'Sideways' && Math.random() > 0.5);
      // Strategy performs best in Bullish markets, okay in Sideways, poor in Bearish
      let successBias = 0;
      if (trendType === 'Bullish') successBias = 1.5;
      else if (trendType === 'Bearish') successBias = -1.2;
      else successBias = 0.2;

      const profitVal = (Math.random() - 0.5) * 4 + successBias;
      currentEquity += profitVal;

      const entryTime = new Date(time * 1000).toLocaleString();
      const exitTime = new Date((time + interval * 2) * 1000).toLocaleString();

      trades.push({
        entry_time: entryTime,
        entry_price: open,
        exit_time: exitTime,
        exit_price: isLong ? open * (1 + profitVal / 100) : open * (1 - profitVal / 100),
        profit: profitVal.toFixed(2),
        risk_percentage: "0.50",
        isLong,
        session: ["London Session", "Tokyo Session", "New York Session", "Overlap"][Math.floor(Math.random() * 4)],
        volatility: ["Low", "High", "Very Low", "Very High"][Math.floor(Math.random() * 4)],
        stoploss: isLong ? open * 0.98 : open * 1.02,
        rsi: Math.random() * 100,
        atr: Math.random() * 500
      });

      marketTrendData.push({
        time: time,
        equity: parseFloat(currentEquity.toFixed(2)),
        price: close,
        trend: trendType
      });
    }
  }

  const cumulativeProfit = trades.map((_, i) =>
    trades.slice(0, i + 1).reduce((acc, t) => acc + parseFloat(t.profit), 0).toFixed(2)
  );

  const dailyProfits: Record<string, number> = {};
  trades.forEach(t => {
    const d = new Date(t.entry_time).toISOString().split('T')[0];
    dailyProfits[d] = (dailyProfits[d] || 0) + parseFloat(t.profit);
  });

  const monthlyProfits: Record<string, number> = {};
  trades.forEach(t => {
    const m = new Date(t.entry_time).toISOString().slice(0, 7);
    monthlyProfits[m] = (monthlyProfits[m] || 0) + parseFloat(t.profit);
  });

  const hourStats: Record<string, any> = {};
  for (let h = 0; h < 24; h++) hourStats[h] = { wins: 0, losses: 0, count: 0 };
  trades.forEach(t => {
    const h = new Date(t.entry_time).getHours();
    const isWin = parseFloat(t.profit) >= 0;
    hourStats[h].count++;
    if (isWin) hourStats[h].wins++; else hourStats[h].losses++;
  });

  return {
    analysis: {
      initialBalance: 1000000,
      leverage: 50,
      fee: 0.05,
      riskPercentPerTrade: 1,
      startTime: new Date(startTime * 1000).toLocaleString(),
      endTime: new Date((startTime + count * interval) * 1000).toLocaleString(),
      totalDays: Math.floor(count * interval / 86400),
      totalTrades: trades.length,
      winRate: (trades.filter(t => parseFloat(t.profit) >= 0).length / trades.length * 100).toFixed(2),
      totalProfit: currentEquity.toFixed(2),
      avgProfit: (currentEquity / trades.length).toFixed(2),
      avgRisk: "0.50",
      grossProfit: "100.50",
      grossLoss: "-50.25",
      profitFactor: "2.12",
      bestTrade: trades.sort((a, b) => parseFloat(b.profit) - parseFloat(a.profit))[0],
      worstTrade: trades.sort((a, b) => parseFloat(a.profit) - parseFloat(b.profit))[0],
      maxWinStreak: 8,
      maxLossStreak: 4,
      avgRMultiple: "1.45",
      sharpeRatio: "1.85",
      sortinoRatio: "2.10",
      expectancy: "1.25",
      winLossRatio: "1.8",
      kelly: "0.25",
      totalFees: "150.00",
      stoplossTouched: 12,
      cumulativeProfit,
      maxDrawdown: "-4.50",
      maxDrawdownPercent: "5.2",
      finalBalance: "1012500",
      totalReturn: "1.25",
      cagr: "15.00",
      calmarRatio: "2.1",
      sessionProfit: { "New York": 12.5, "London": 8.2, "Tokyo": 4.1, "Overlap": 15.3 },
      sessionCounts: { "New York": 150, "London": 120, "Tokyo": 80, "Overlap": 100 },
      sessionWinRates: { "New York": "55", "London": "48", "Tokyo": "60", "Overlap": "65" },
      volProfit: { "Low": 5.2, "High": 18.4, "Very Low": 2.1, "Very High": 8.5 },
      volCounts: { "Low": 200, "High": 180, "Very Low": 50, "Very High": 20 },
      volWinRates: { "Low": "52", "High": "58", "Very Low": "45", "Very High": "70" },
      posProfit: { "buy": currentEquity * 0.6, "sell": currentEquity * 0.4 },
      posCounts: { "buy": Math.floor(trades.length * 0.6), "sell": Math.floor(trades.length * 0.4) },
      posWinRates: { "buy": "54", "sell": "52" },
      hourStats,
      marketTrendData,
      profitBuckets: { "Break Even": 120, "2% Profit": 80, "4% Profit": 40, "6% Profit": 10, "-2% Profit": 100 },
      dayOfWeekAnalysis: {
        "Monday": { profit: "4.2", winRate: "55", count: 80 },
        "Tuesday": { profit: "3.8", winRate: "52", count: 75 },
        "Wednesday": { profit: "5.1", winRate: "58", count: 85 },
        "Thursday": { profit: "2.5", winRate: "48", count: 70 },
        "Friday": { profit: "6.2", winRate: "62", count: 90 },
        "Saturday": { profit: "1.2", winRate: "45", count: 50 },
        "Sunday": { profit: "2.4", winRate: "50", count: 60 }
      },
      dailyProfits,
      monthlyProfits,
      avgDurationWins: "4.5",
      avgDurationLosses: "2.1",
      recoveryFactor: "2.5",
      largestDrawdown: "2.10"
    },
    trades,
    candles
  };
};

export const MOCK_RESPONSE: BacktestResponse = generateRichMockData();
