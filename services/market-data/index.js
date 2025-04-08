const express = require('express');
const axios = require('axios');
const logger = require('../logging/logger');
const { parseIntervalToSeconds } = require('./utils');
const config = require('../../config/index');

const app = express();
const PORT = process.env.MARKET_DATA_PORT || 3001;
const router = express.Router();
const DELTA_API_BASE_URL = 'https://api.india.delta.exchange/v2';

// Helper to fetch candles in chunks
async function fetchCandleChunks(symbol, interval, start, end) {
    const CHUNK_SIZE = 200; // Max 200 candles per request
    const intervalSec = parseIntervalToSeconds(interval);
    let allCandles = [];

    let from = start;
    while (from < end) {
        const to = Math.min(from + CHUNK_SIZE * intervalSec, end);

        try {
            const response = await axios.get(`${DELTA_API_BASE_URL}/history/candles`, {
                params: {
                    symbol,
                    resolution: interval,
                    start: from,
                    end: to,
                },
            });

            const candles = response.data.result || [];
            allCandles = allCandles.concat(candles);

            if (candles.length === 0) break; // No more data
        } catch (err) {
            logger.error(`Chunk fetch failed: ${err.message}`);
            break;
        }

        from = to;
    }

    return allCandles;
}

// Route to fetch OHLCV data
router.get('/ohlcv', async (req, res) => {
    const { symbol, interval, start, end } = req.query;

    if (!symbol || !interval) {
        logger.warn('Missing required query parameters: symbol, interval');
        return res.status(400).json({ error: 'Missing required query parameters: symbol, interval' });
    }

    try {
        const now = Math.floor(Date.now() / 1000);
        const intervalSec = parseIntervalToSeconds(interval);

        const defaultEnd = now;
        const defaultStart = now - 200 * intervalSec;

        const startTime = parseInt(start) || defaultStart;
        const endTime = parseInt(end) || defaultEnd;

        let candles;

        if (!start && !end) {
            // Only 200 candles
            const response = await axios.get(`${DELTA_API_BASE_URL}/history/candles`, {
                params: {
                    symbol,
                    resolution: interval,
                    start: startTime,
                    end: endTime,
                },
            });
            candles = response.data.result;
        } else {
            // Fetch in chunks
            candles = await fetchCandleChunks(symbol, interval, startTime, endTime);
        }

        // logger.info(`📊 Fetched ${candles.length} candles for ${symbol} (${interval})`);
        res.json(candles);
    } catch (error) {
        logger.error(`❌ Error fetching OHLCV data: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch OHLCV data' });
    }
});

app.use('/api', router);

// Start the server
app.listen(PORT, () => {
    logger.info(`🚀 Market Data Service running on port ${PORT}`);
});

module.exports = router;
