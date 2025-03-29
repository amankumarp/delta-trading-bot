const express = require('express');
const { runBacktest } = require('./backtest');
const logger = require('../logging/logger');

const app = express();
const PORT = process.env.BACKTEST_SERVICE_PORT || 3006;

app.use(express.json());

// Route to run a backtest
app.post('/backtest', (req, res) => {
    const { historicalData, initialBalance } = req.body;

    if (!historicalData || !initialBalance) {
        logger.warn('Missing required parameters: historicalData, initialBalance');
        return res.status(400).json({ error: 'Missing required parameters: historicalData, initialBalance' });
    }

    try {
        const results = runBacktest(historicalData, initialBalance);
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