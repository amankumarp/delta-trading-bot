const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");
const cors = require("cors");
const BacktestEngine = require("./Engine");
const QuantReporter = require("./Reporter");

dotenv.config();

const app = express();
const port = 4040;

app.use(express.json());
app.use(cors({ origin: "*" }));

app.get("/api/analyze", async (req, res) => {
  try {
    const start = req.query.start;
    const end = req.query.end;
    const interval = req.query.interval;
    const symbol = req.query.symbol;
    const strategy = req.query.strategy || "supertrend-ai";

    const initialBalance = parseFloat(req.query.balance) || 10000;
    const leverage = parseFloat(req.query.leverage) || 200;
    const fee = parseFloat(req.query.fee) || 0.01;
    const riskPercentPerTrade = parseFloat(req.query.risk) || 1;

    const response = await axios.get(`http://localhost:3002/strategy/${strategy}?symbol=${symbol}&interval=${interval}&onlytrade=true&start=${start}&end=${end}`);
    const trades = response.data.trades;

    if (!Array.isArray(trades) || trades.length === 0) {
      return res.status(400).json({ error: "No trades found for analysis" });
    }

    const engine = new BacktestEngine({
      initialBalance,
      leverage,
      fee,
      riskPercentPerTrade
    });
    const { report, trades: processedTrades } = engine.run(trades);
    const analysis = QuantReporter.generateReport(report);

    res.json({ 
      analysis, 
      trades: processedTrades,
      candles: response.data.candles.map(candle => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }))
    });
  } catch (error) {
    console.error("Error analyzing trades:", error);
    res.status(500).json({ error: "Failed to analyze trades" });
  }
});

app.listen(port, () => {
  console.log(`Trade Analysis API running at http://localhost:${port}`);
});
