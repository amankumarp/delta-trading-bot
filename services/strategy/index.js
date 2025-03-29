const express = require('express');
const axios = require('axios');

const logger = require('../logging/logger');
const SupertrendAI = require('./SupertrendStrategy');
const { convertOHLCVtoArray } = require('./utils');

const app = express();
const PORT = process.env.STRATEGY_SERVICE_PORT || 3002;

// Market Data Service Base URL
const MARKET_DATA_SERVICE_URL = process.env.MARKET_DATA_SERVICE_URL || 'http://localhost:3001/api';

// Route to calculate Supertrend and generate signals
app.get('/strategy/supertrend-ai', async (req, res) => {
    const { symbol, interval } = req.query;

    if (!symbol || !interval) {
        logger.warn('Missing required query parameters: symbol, interval');
        return res.status(400).json({ error: 'Missing required query parameters: symbol, interval' });
    }

    try {
        // Fetch OHLCV data from Market Data Service
        const marketDataResponse = await axios.get(`${MARKET_DATA_SERVICE_URL}/ohlcv`, {
            params: { symbol, interval},
        });
     
        const ohlcv = marketDataResponse.data.reverse();
        const {open, high, low, close, time, volume } = convertOHLCVtoArray(ohlcv);
        // convert timestamp to time formate
        const supertrendAI = new SupertrendAI();
        // console.log('open', open);
        // Calculate Supertrend
        const response = supertrendAI.generateSignals({ open, high, low, close, time, volume });
        logger.info(`Generated Supertrend signals for symbol: ${symbol}, interval: ${interval}`);
        res.json({signal:response.signals.reverse(),candles:response.candles.reverse()});
    } catch (error) {
        logger.error(`Error generating Supertrend signals: ${error.message}`);
        res.status(500).json({ error: 'Failed to generate Supertrend signals' });
    }
});



// Start the Strategy Service
app.listen(PORT, () => {
    logger.info(`Strategy Service running on port ${PORT}`);
});