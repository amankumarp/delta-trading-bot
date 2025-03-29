const express = require('express');
const axios = require('axios');
const logger = require('../logging/logger'); // Import the logger
const { parseIntervalToSeconds } = require('./utils'); // Import the utility function
const config = require('../../config/index');
const app = express();
const PORT = process.env.MARKET_DATA_PORT || 3001;

const router = express.Router(); // Create a router instance
const DELTA_API_BASE_URL = 'https://api.india.delta.exchange/v2';

// Route to fetch OHLCV data
router.get('/ohlcv', async (req, res) => {
    const { symbol, interval, start, end } = req.query;

    if (!symbol || !interval) {
        logger.warn('Missing required query parameters: symbol, interval');
        return res.status(400).json({ error: 'Missing required query parameters: symbol, interval' });
    }

    try {
        // Calculate default start and end timestamps if not provided
        const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
        const defaultEnd = now;
        const defaultStart = now - 200 * parseIntervalToSeconds(interval); // Previous 100 candles

        const response = await axios.get(`${DELTA_API_BASE_URL}/history/candles`, {
            params: {
                symbol,
                resolution: interval,
                start: start || defaultStart,
                end: end || defaultEnd,
            },
        });
        
        logger.info(`Fetched OHLCV data for symbol: ${symbol}, interval: ${interval}`);
        res.json(response.data.result);
    } catch (error) {
        logger.error(`Error fetching OHLCV data: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch OHLCV data' });
    }
});

app.use('/api', router); // Use the router for API routes

// Start the server
app.listen(PORT, () => {
    logger.info(`Market Data Service running on port ${PORT}`);
});


module.exports = router; // Export the router
