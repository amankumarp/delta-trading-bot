const express = require('express');
const { getCandles } = require('./candleService');

const app = express();
require('./jobs/syncJob'); // start the sync job
const {runBackfillAll} = require('./jobs/backfill'); // optional: run backfill on startup

app.get('/api/candles', async (req, res) => {
  const { symbol, interval, from, to, type } = req.query;
  
  try {
    const candles = await getCandles({
      symbol,
      interval,
      from: from ? parseInt(from) : undefined,
      to: to ? parseInt(to) : undefined,
      type,
    });
    res.json(candles);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(3000, () => {console.log("Candle API running at http://localhost:3000"); runBackfillAll()});
