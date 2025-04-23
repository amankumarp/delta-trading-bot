const express = require('express');
const PaperTradeService= require('./paperTrade');
const app = express();
const PORT = process.env.PAPER_TRADE_SERVICE_PORT || 3007;

app.use(express.json());

router.post('/trade/:strategyId', async (req, res) => {
    const service = new PaperTradeService(req.params.strategyId);
    await service.initialize();
    const trade = await service.placeTrade(req.body);
    res.json(trade);
});


// Start the Paper Trade Service
app.listen(PORT, () => {
    console.log(`Paper Trade Service running on port ${PORT}`);
});

module.exports = router;