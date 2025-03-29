const express = require('express');
const { runPaperTrade } = require('./paperTrade');
const logger = require('../logging/logger');

const app = express();
const PORT = process.env.PAPER_TRADE_SERVICE_PORT || 3007;

app.use(express.json());

// Route to run paper trading
app.post('/paper-trade', (req, res) => {
    const { liveData, initialBalance } = req.body;

    if (!liveData || !initialBalance) {
        logger.warn('Missing required parameters: liveData, initialBalance');
        return res.status(400).json({ error: 'Missing required parameters: liveData, initialBalance' });
    }

    try {
        const results = runPaperTrade(liveData, initialBalance);
        res.json(results);
    } catch (error) {
        logger.error(`Error running paper trade: ${error.message}`);
        res.status(500).json({ error: 'Failed to run paper trade' });
    }
});

// Start the Paper Trade Service
app.listen(PORT, () => {
    logger.info(`Paper Trade Service running on port ${PORT}`);
});