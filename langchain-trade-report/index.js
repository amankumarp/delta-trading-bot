const express = require("express");
const { ChatDeepSeek } = require("@langchain/deepseek");
const { PromptTemplate } = require("@langchain/core/prompts");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const app = express();
const port = 4040;

app.use(express.json());


// LangChain setup
const grok = new ChatDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: "deepseek-chat", 
  temperature: 0.7,
  maxTokens: 1024,
});

// Analysis function
async function analyzeTrades(trades) {
  // Validate trades array
  if (!Array.isArray(trades) || trades.length === 0) {
    throw new Error('Invalid or empty trades array');
  }

  const totalTrades = trades.length;
  const wins = trades.filter(t => t.avg_profit > 0);
  const winRate = ((wins.length / totalTrades) * 100).toFixed(2);

  // Calculate totalProfit with validation
  const totalProfit = trades.reduce((sum, t) => {
    const profit = parseFloat(t.avg_profit);
    if (isNaN(profit)) {
      console.warn(`Invalid profit value in trade ${t.trade || t.id || 'unknown'}: ${t.avg_profit}`);
      return sum;
    }
    return sum + profit;
  }, 0);
  
  // Check if totalProfit is valid before formatting
  const formattedTotalProfit = isNaN(totalProfit) ? '0.00' : totalProfit.toFixed(2);

  const avgProfit = (totalProfit / totalTrades).toFixed(2);
  const avgRisk = (trades.reduce((sum, t) => sum + (parseFloat(t.risk_percentage) || 0), 0) / totalTrades).toFixed(2);
  const grossProfit = wins.reduce((sum, t) => sum + (parseFloat(t.avg_profit) || 0), 0).toFixed(2);
  const grossLoss = trades.filter(t => t.avg_profit <= 0).reduce((sum, t) => sum + (parseFloat(t.avg_profit) || 0), 0).toFixed(2);
  const profitFactor = grossLoss !== '0.00' ? (grossProfit / -grossLoss).toFixed(2) : 'N/A';

  // Cumulative Profit
  let cumulativeProfit = [];
  let currentProfit = 0;
  trades.forEach(t => {
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
    const sessionWins = trades.filter(t => t.session === session && t.avg_profit > 0).length;
    acc[session] = ((sessionWins / sessionCounts[session]) * 100).toFixed(2);
    return acc;
  }, {});

  // Volatility Analysis
  const volProfit = trades.reduce((acc, t) => {
    acc[t.volatility] = (acc[t.volatility] || 0) + (parseFloat(t.avg_profit) || 0);
    return acc;
  }, {});
  const volCounts = trades.reduce((acc, t) => {
    acc[t.volatility] = (acc[t.volatility] || 0) + 1;
    return acc;
  }, {});
  const volWinRates = Object.keys(volProfit).reduce((acc, vol) => {
    const volWins = trades.filter(t => t.volatility === vol && t.avg_profit > 0).length;
    acc[vol] = ((volWins / volCounts[vol]) * 100).toFixed(2);
    return acc;
  }, {});

  // Position Type Analysis
  const posProfit = trades.reduce((acc, t) => {
    let position = t.isLong?"buy":"sell";
    acc[position] = (acc[position] || 0) + (parseFloat(t.avg_profit) || 0);
    return acc;
  }, {});
  const posCounts = trades.reduce((acc, t) => {
    let position = t.isLong?"buy":"sell";
    acc[position] = (acc[position] || 0) + 1;
    return acc;
  }, {});
  const posWinRates = Object.keys(posProfit).reduce((acc, pos) => {
    const posWins = trades.filter(t => (t.isLong?"buy":"sell") == pos && Number(t.avg_profit) > 0).length;
    acc[pos] = ((posWins / posCounts[pos]) * 100).toFixed(2);
    return acc;
  }, {});

 // Technical Indicators Analysis
  const avgDistEma200Wins = (wins.reduce((sum,t)=> sum + Math.abs(t.entry_price - parseFloat(t.ema200))) / wins.length).toFixed(2);
  const avgDistEma200Loss = (trades.filter(t => t.avg_profit <= 0).reduce((sum,t)=> sum + Math.abs(t.entry_price - parseFloat(t.ema200)))/(totalTrades - wins.length)).toFixed(2);
  // const avgDistSMA13Wins = wins.map(t=> Math.abs(t.entry_price - parseFloat(t.sma13))).filter(Boolean);
  // const avgDistSma13Loss = trades.filter(t => t.avg_profit <= 0).map(t=> Math.abs(t.entry_price - parseFloat(t.sma13))).filter(Boolean);
 


  // Trade Duration
  const durations = trades.map(t => {
    if (!t.entry_time || !t.exit_time) return 0;
    const entry = new Date(t.entry_time);
    const exit = new Date(t.exit_time);
    return (exit - entry) / (1000 * 60 * 60); // Hours
  });
  const avgDurationWins = wins.length ? (wins.map((_, i) => durations[i]).filter(Boolean).reduce((sum, x) => sum + x, 0) / wins.length).toFixed(2) : "N/A";
  const avgDurationLosses = (totalTrades - wins.length) ? (trades.filter(t => t.avg_profit <= 0).map((_, i) => durations[i]).filter(Boolean).reduce((sum, x) => sum + x, 0) / (totalTrades - wins.length)).toFixed(2) : "N/A";

  // LangChain Analysis for Technical Indicators
  // const indicatorsPrompt = PromptTemplate.fromTemplate(`
  //   Analyze the following trade data with a focus on technical indicators:
  //   - RSI: Mean {avgRSIWins} (wins), {avgRSILosses} (losses)
  //   - ATR: Mean {avgATRWins} (wins), {avgATRLosses} (losses)
  //   - Supertrend: Mean {avgSupertrendWins} (wins), {avgSupertrendLosses} (losses)
  //   - EMA200: Mean {avgEMA200Wins} (wins), {avgEMA200Losses} (losses)
  //   - SMA13: Mean {avgSMA13Wins} (wins), {avgSMA13Losses} (losses)
  //   - Total Trades: {totalTrades}
  //   - Win Rate: {winRate}%
  //   - Total Profit: {formattedTotalProfit}%

  //   Provide a detailed analysis of how each indicator correlates with trade outcomes. Format as:
  //   - **Indicator Name**: Description, range, mean for wins/losses, and impact on trades.
  // `);

  // const indicatorsFormattedPrompt = await indicatorsPrompt.format({
  //   avgRSIWins,
  //   avgRSILosses,
  //   avgATRWins,
  //   avgATRLosses,
  //   avgSupertrendWins,
  //   avgSupertrendLosses,
  //   avgEMA200Wins,
  //   avgEMA200Losses,
  //   avgSMA13Wins,
  //   avgSMA13Losses,
  //   totalTrades,
  //   winRate,
  //   formattedTotalProfit
  // });

  // console.log("Formatted Indicators Prompt:", indicatorsFormattedPrompt);

  // const indicatorsResponse = await grok.invoke(indicatorsFormattedPrompt);
  // const indicatorsAnalysis = indicatorsResponse.content.split('\n').filter(line => line.startsWith('- **')).map(line => line.trim());

  // LangChain Analysis for Performance
  // const performancePrompt = PromptTemplate.fromTemplate(`
  //   Analyze the performance of the following trade data:
  //   - Total Trades: {totalTrades}
  //   - Win Rate: {winRate}%
  //   - Total Profit: {formattedTotalProfit}%
  //   - Profit Factor: {profitFactor}
  //   - Max Drawdown: {maxDrawdown}%
  //   - Session Profits: {sessionProfit}
  //   - Volatility Profits: {volProfit}
  //   - Position Profits: {posProfit}
  //   - Avg Duration: {avgDurationWins}h (wins), {avgDurationLosses}h (losses)

  //   Provide a detailed performance analysis, focusing on how technical indicators, sessions, volatility, and position types impact outcomes. Format as:
  //   - **Category**: Key findings and impact on performance.
  // `);

  // const performanceFormattedPrompt = await performancePrompt.format({
  //   totalTrades,
  //   winRate,
  //   formattedTotalProfit,
  //   profitFactor,
  //   maxDrawdown,
  //   sessionProfit: JSON.stringify(sessionProfit),
  //   volProfit: JSON.stringify(volProfit),
  //   posProfit: JSON.stringify(posProfit),
  //   avgRSIWins,
  //   avgRSILosses,
  //   avgATRWins,
  //   avgATRLosses,
  //   avgDurationWins,
  //   avgDurationLosses
  // });

  // console.log("Formatted Performance Prompt:", performanceFormattedPrompt);

  // const performanceResponse = await grok.invoke(performanceFormattedPrompt);
  // const performanceAnalysis = performanceResponse.content.split('\n').filter(line => line.startsWith('- **')).map(line => line.trim());

  // LangChain Recommendations
  // const recommendationsPrompt = PromptTemplate.fromTemplate(`
  //   Based on the following trade data analysis:
  //   - RSI: Mean {avgRSIWins} (wins), {avgRSILosses} (losses)
  //   - ATR: Mean {avgATRWins} (wins), {avgATRLosses} (losses)
  //   - Supertrend: Mean {avgSupertrendWins} (wins), {avgSupertrendLosses} (losses)
  //   - EMA200: Mean {avgEMA200Wins} (wins), {avgEMA200Losses} (losses)
  //   - SMA13: Mean {avgSMA13Wins} (wins), {avgSMA13Losses} (losses)
  //   - Session Profits: {sessionProfit}
  //   - Volatility Profits: {volProfit}
  //   - Position Profits: {posProfit}
  //   - Win Rate: {winRate}%
  //   - Total Profit: {formattedTotalProfit}%

  //   Provide specific, indicator-based recommendations to improve trading performance. Format as:
  //   1. **Recommendation**: Action, indicator basis, and expected impact.
  // `);

  // const recommendationsFormattedPrompt = await recommendationsPrompt.format({
  //   avgRSIWins,
  //   avgRSILosses,
  //   avgATRWins,
  //   avgATRLosses,
  //   avgSupertrendWins,
  //   avgSupertrendLosses,
  //   avgEMA200Wins,
  //   avgEMA200Losses,
  //   avgSMA13Wins,
  //   avgSMA13Losses,
  //   sessionProfit: JSON.stringify(sessionProfit),
  //   volProfit: JSON.stringify(volProfit),
  //   posProfit: JSON.stringify(posProfit),
  //   winRate,
  //   formattedTotalProfit
  // });
  // console.log("Formatted Recommendations Prompt:", recommendationsFormattedPrompt);

  // const recommendationsResponse = await grok.invoke(recommendationsFormattedPrompt);
  // const recommendations = recommendationsResponse.content.split('\n').filter(line => line.match(/^\d+\.\s*\*\*/)).map(line => line.trim());

  return {
    startTime: trades[0].entry_time,
    endTime: trades[trades.length - 1].exit_time,
    totalDays: ((new Date(trades[trades.length - 1].exit_time) - new Date(trades[0].entry_time)) / (1000 * 60 * 60 * 24)).toFixed(2),
    totalTrades,
    winRate,
    totalProfit: formattedTotalProfit,
    profitFactor,
    maxDrawdown,
    avgProfit,
    avgRisk,
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
    avgDistEma200Wins,
    avgDistEma200Loss,
    // avgDistSMA13Wins,
    // avgDistSma13Loss,
    avgDurationWins,
    avgDurationLosses,

    // indicatorsAnalysis,
    // performanceAnalysis,
    // recommendations
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
