const express = require('express');
const axios = require('axios');
const SupertrendAI = require('./SupertrendStrategy');
const { convertOHLCVtoArray, convertOHLCVtoHeikinAshi, generateTradeReport } = require('./utils');
const ARSIStrategy = require('./ARSIStrategy');
const UTBotAlertStrategy = require('./UTBotStrategy');

const app = express();
const PORT = process.env.STRATEGY_SERVICE_PORT || 3002;

// Market Data Service Base URL
const MARKET_DATA_SERVICE_URL = process.env.MARKET_DATA_SERVICE_URL || 'http://localhost:3001/api';

// Route to calculate Supertrend and generate signals
app.get('/strategy/supertrend-ai', async (req, res) => {
    const { symbol, interval, start, end , candletype, onlytrade} = req.query;

    if (!symbol || !interval) {
        console.warn('Missing required query parameters: symbol, interval');
        return res.status(400).json({ error: 'Missing required query parameters: symbol, interval' });
    }

    try {

        // Fetch OHLCV data from Market Data Service
        const marketDataResponse = await axios.get(`${MARKET_DATA_SERVICE_URL}/ohlcv`, {
            params: { symbol, interval, start, end},
        });
     
        const ohlcv = marketDataResponse.data;
        let candles = convertOHLCVtoArray(ohlcv);
        const {open, high, low, close, time, volume } = candles;
        // convert timestamp to time formate
        const supertrendAI = new SupertrendAI();
        // console.log('open', open);
        // Calculate Supertrend
        const response = supertrendAI.generateSignals({ open, high, low, close, time, volume });
        // console.log(`Generated Supertrend signals for symbol: ${symbol}, interval: ${interval}`);
        if(onlytrade) {
            let trades = generateTradeReport(response.candles);
            res.json({trades:trades});
        }
        res.json({signal:response.signals,candles:response.candles});
    } catch (error) {
        console.log(`Error generating Supertrend signals: ${error.message}`);
        res.status(500).json({ error: 'Failed to generate Supertrend signals' });
    }
});

app.get('/strategy/rsi-ai', async (req, res) => {
    const { symbol, interval, start, end } = req.query;

    if (!symbol || !interval) {
        console.warn('Missing required query parameters: symbol, interval');
        return res.status(400).json({ error: 'Missing required query parameters: symbol, interval' });
    }

    try {

        // Fetch OHLCV data from Market Data Service
        const marketDataResponse = await axios.get(`${MARKET_DATA_SERVICE_URL}/ohlcv`, {
            params: { symbol, interval, start, end},
        });
     
        const ohlcv = marketDataResponse.data;
        const {open, high, low, close, time, volume } = convertOHLCVtoArray(ohlcv);
        // convert timestamp to time formate
        const adaptiveRSi = new ARSIStrategy();
        // console.log('open', open);
        // Calculate Supertrend
        const response = adaptiveRSi.generateSignals({ open, high, low, close, time, volume });
        // console.log(`Generated Supertrend signals for symbol: ${symbol}, interval: ${interval}`);
        res.json({signal:response.signals.reverse(),candles:response.candles.reverse()});
    } catch (error) {
        console.log(`Error generating RSI signals: ${error.message}`);
        res.status(500).json({ error: 'Failed to generate Adaptive RSI signals' });
    }
});


app.get('/strategy/utbot', async (req, res) => {
    const { symbol, interval, start, end } = req.query;

    if (!symbol || !interval) {
        console.warn('Missing required query parameters: symbol, interval');
        return res.status(400).json({ error: 'Missing required query parameters: symbol, interval' });
    }

    try {

        // Fetch OHLCV data from Market Data Service
        const marketDataResponse = await axios.get(`${MARKET_DATA_SERVICE_URL}/ohlcv`, {
            params: { symbol, interval, start, end},
        });
     
        const ohlcv = marketDataResponse.data;
        const {open, high, low, close, time, volume } = convertOHLCVtoArray(ohlcv);
        // convert timestamp to time formate
        const utbot = new UTBotAlertStrategy();
        // console.log('open', open);
        // Calculate Supertrend
        const response = utbot.generateSignals({ open, high, low, close, time, volume });
        // console.log(`Generated Supertrend signals for symbol: ${symbol}, interval: ${interval}`);
        res.json({signal:response.signals,candles:response.candles});
    } catch (error) {
        console.log(`Error generating RSI signals: ${error.message}`);
        res.status(500).json({ error: 'Failed to generate Adaptive RSI signals' });
    }
});


// Start the Strategy Service
app.listen(PORT, () => {
    console.log(`Strategy Service running on port ${PORT}`);
});