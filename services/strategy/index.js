const express = require('express');
const axios = require('axios');
const SupertrendAI = require('./SupertrendStrategy');
const { convertOHLCVtoArray, convertOHLCVtoHeikinAshi, generateTradeReport } = require('./utils');
const cors = require('cors');
const BollingerBandAI = require('./bbStrategy');
const app = express();
const PORT = process.env.STRATEGY_SERVICE_PORT || 3002;
app.use(cors());

// Market Data Service Base URL
const MARKET_DATA_SERVICE_URL = process.env.MARKET_DATA_SERVICE_URL || 'http://localhost:3000/api';

// Route to calculate Supertrend and generate signals
app.get('/strategy/supertrend-ai', async (req, res) => {
    const { symbol, interval, start, end , onlytrade} = req.query;

    if (!symbol || !interval) {
        console.warn('Missing required query parameters: symbol, interval');
        return res.status(400).json({ error: 'Missing required query parameters: symbol, interval' });
    }

    try {

        // Fetch OHLCV data from Market Data Service
        const marketDataResponse = await axios.get(`${MARKET_DATA_SERVICE_URL}/candles`, {
            params: { symbol, interval, from:start, to:end},
        });
        
        const ohlcv = marketDataResponse.data;
        
        let candles = convertOHLCVtoArray(ohlcv);

        const {open, high, low, close, time, volume } = candles;
        console.log('candlestick count',open.length);
        // convert timestamp to time formate
        const supertrendAI = new SupertrendAI();

        // Calculate Supertrend
        const response = supertrendAI.generateSignals({ open, high, low, close, time, volume });
        // console.log(`Generated Supertrend signals for symbol: ${symbol}, interval: ${interval}`);
      
        if(onlytrade) {
            let trades = generateTradeReport(response.candles);
            return res.json({trades,candles:response.candles});
        }
        return res.json({signal:response.signals,candles:response.candles});
    } catch (error) {
        console.log(`Error generating Supertrend signals: ${error.message}`);
        res.status(500).json({ error: 'Failed to generate Supertrend signals' });
    }
});

app.get('/strategy/bb-ai', async (req, res) => {
    const { symbol, interval, start, end , onlytrade} = req.query;

    if (!symbol || !interval) {
        console.warn('Missing required query parameters: symbol, interval');
        return res.status(400).json({ error: 'Missing required query parameters: symbol, interval' });
    }

    try {

        // Fetch OHLCV data from Market Data Service
        const marketDataResponse = await axios.get(`${MARKET_DATA_SERVICE_URL}/candles`, {
            params: { symbol, interval, from:start, to:end},
        });
     
        const ohlcv = marketDataResponse.data;
             
      
        const candles = convertOHLCVtoArray(ohlcv);
        const {open, high, low, close, time, volume } = candles;
    
        
        // convert timestamp to time formate
        const bbAI = new BollingerBandAI();
      
        // Calculate Supertrend
        const response = bbAI.generateSignals({ open, high, low, close, time, volume });
        // console.log(`Generated Supertrend signals for symbol: ${symbol}, interval: ${interval}`);
             
        if(onlytrade) {
            let trades = generateTradeReport(response.candles);
            return res.json({trades,candles:response.candles});
        }
        return res.json({signal:response.signals,candles:response.candles});

    } catch (error) {
        console.log(`Error generating signals: ${error.message}`);
        res.status(500).json({ error: 'Failed to generate signals' });
    }
});



// Start the Strategy Service
app.listen(PORT, () => {
    console.log(`Strategy Service running on port ${PORT}`);
});