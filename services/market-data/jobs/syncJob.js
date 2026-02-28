const cron = require('node-cron');
const { fetchCandlesFromCoinDCX } = require('../delta');
const { ensureTable, saveToSQLite, loadLatestTime } = require('../db/index');

const symbols = ['BTCUSD']; // can customize

async function sync() {
  for (const s of symbols) {
    const table = `${s.toLowerCase()}_1m`;
    await ensureTable(table);
    const lastTime = await loadLatestTime(table) || 0;
    const now = Math.floor(Date.now()/1000);
    const intervalSec = 60;
    const candles = await fetchCandlesFromCoinDCX(s, '1m', lastTime + intervalSec, now);
    if (candles.length) {
      await saveToSQLite(table, candles);
      console.log(`Synced ${s}: +${candles.length}`);
    }
  }
}


cron.schedule('*/2 * * * *', sync);

module.exports = sync;
