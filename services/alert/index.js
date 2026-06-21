const cron = require('node-cron');
const axios = require('axios');
const TelegramService = require('../notification/telegram');
const AlertScanner = require('./AlertScanner');
const config = require('./AlertConfig');
const globalConfig = require('../../config/index');

const telegramService = new TelegramService(globalConfig.botToken, globalConfig.chatId);
const MARKET_DATA_SERVICE_URL = process.env.MARKET_DATA_SERVICE_URL || 'http://localhost:3000/api';

/**
 * Fetch candle data and run the alert scanner.
 */
async function runScan(symbol, timeframe) {
    try {
        console.log(`[AlertService] Scanning ${symbol} on ${timeframe}...`);

        // Fetch OHLCV data from Market Data Service
        // Fetching 250 candles to ensure enough history for EMA 200 and daily breakout logic
        const response = await axios.get(`${MARKET_DATA_SERVICE_URL}/candles`, {
            params: { symbol, interval: timeframe, limit: 250 },
        });

        const ohlcv = response.data.reverse(); // Ensure chronological order old -> new if API returns newest first
        if (!ohlcv || ohlcv.length === 0) return;

        // Convert to array format expected by indicators
        const candles = {
            open: ohlcv.map(c => c.open),
            high: ohlcv.map(c => c.high),
            low: ohlcv.map(c => c.low),
            close: ohlcv.map(c => c.close),
            volume: ohlcv.map(c => c.volume),
            time: ohlcv.map(c => c.time)
        };

        const alerts = AlertScanner.scan(symbol, timeframe, candles);

        if (alerts.length > 0) {
            console.log(`[AlertService] Detected ${alerts.length} alerts for ${symbol} on ${timeframe}`);
            await telegramService.getMarketAlertMessage(symbol, timeframe, alerts);
        } else {
            console.log(`[AlertService] No alerts for ${symbol} on ${timeframe}`);
        }

    } catch (error) {
        console.error(`[AlertService] Error scanning ${symbol} on ${timeframe}:`, error.response?.data || error.message);
    }
}

/**
 * Initialize all cron jobs based on config
 */
function startAlertService() {
    console.log('🚀 Starting Alert Service Scheduler...');

    config.enabledAssets.forEach(symbol => {

        // 15 Minute Scan
        if (config.timeframes['15m']) {
            cron.schedule('*/15 * * * *', () => {
                runScan(symbol, '15m');
            });
            console.log(`Scheduled 15m scan for ${symbol}`);
        }

        // 1 Hour Scan (Run at minute 0 of every hour)
        if (config.timeframes['1h']) {
            cron.schedule('0 * * * *', () => {
                runScan(symbol, '1h');
            });
            console.log(`Scheduled 1h scan for ${symbol}`);
        }

        // 4 Hour Scan (Run at minute 0 every 4 hours)
        if (config.timeframes['4h']) {
            cron.schedule('0 */4 * * *', () => {
                runScan(symbol, '4h');
            });
            console.log(`Scheduled 4h scan for ${symbol}`);
        }

        // 1 Day Scan (Run at midnight)
        if (config.timeframes['1d']) {
            cron.schedule('0 0 * * *', () => {
                runScan(symbol, '1d');
            });
            console.log(`Scheduled 1d scan for ${symbol}`);
        }
    });
}

// Allow running as a standalone standalone script
if (require.main === module) {
    startAlertService();
}

module.exports = { startAlertService, runScan };
