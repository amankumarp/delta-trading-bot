const express = require('express');
const BacktestService = require('./backtest');
const logger = require('../logging/logger');
const axios = require("axios");
const app = express();
const PORT = process.env.BACKTEST_SERVICE_PORT || 3006;

app.use(express.json());
const backtestService = new BacktestService();
// Route to run a backtest
app.get('/backtest/supertrend-ai', async (req, res) => {
    const {symbol,interval, start, end } = req.query;
    try {
        console.log("start",start,end)
        let strategySignals = await axios.get(`http://localhost:3002/strategy/supertrend-ai?symbol=${symbol}&interval=${interval}&start=${start}&end=${end}`);
        
        const results = backtestService.runBacktest(strategySignals.data.candles);
        res.json(results);
    } catch (error) {
        logger.error(`Error running backtest: ${error.message}`);
        res.status(500).json({ error: 'Failed to run backtest' });
    }
});

app.get('/backtest/utbot', async (req, res) => {
    const {symbol,interval, start, end } = req.query;
    try {
        console.log("start",start,end)
        let strategySignals = await axios.get(`http://localhost:3002/strategy/utbot?symbol=${symbol}&interval=${interval}&start=${start}&end=${end}`);
        let candles = strategySignals.data.candles;
        const results = backtestService.runBacktest(candles)
        res.json(results);
    } catch (error) {
        logger.error(`Error running backtest: ${error.message}`);
        res.status(500).json({ error: 'Failed to run backtest' });
    }
});

// Start the Backtest Service
app.listen(PORT, () => {
    logger.info(`Backtest Service running on port ${PORT}`);
});