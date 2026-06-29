'use strict';

const cron = require('node-cron');
const { fetchCandlesFromCoinDCX } = require('../delta');
const { ensureTable, saveToSQLite, loadLatestTime } = require('../db/index');

// Phase 5 — EventBus + CandleStore for push-based live signal delivery
const EventBus    = require('../../../lib/EventBus');
const CandleStore = require('../../../lib/CandleStore');

const symbols = ['BTC_USDT', 'ETH_USDT']; // symbols to live-sync every 2 min

async function sync() {
  for (const s of symbols) {
    const table = `${s.toLowerCase()}_1m`;
    await ensureTable(table);
    const lastTime = await loadLatestTime(table) || 0;
    const now       = Math.floor(Date.now() / 1000);

    try {
      const candles = await fetchCandlesFromCoinDCX(s, '1m', lastTime + 60, now);
      if (candles.length) {
        await saveToSQLite(table, candles);
        console.log(`[syncJob] Synced ${s}: +${candles.length} candles`);

        // ── Phase 5: invalidate cache + notify all subscribers ──────────
        // CandleStore.notifyNewCandle() invalidates its LRU cache for this
        // symbol and emits 'candle' on EventBus for LiveSignalEngine/WS.
        const latest = candles[candles.length - 1];
        CandleStore.notifyNewCandle(s, '1m', latest);
        EventBus.emitCandle(s, '1m', latest);
      }
    } catch (err) {
      console.error(`[syncJob] Failed to sync ${s}:`, err.message);
      EventBus.emitError('syncJob', err);
      // Continue to next symbol instead of crashing the whole cron job
    }
  }
}

cron.schedule('*/2 * * * *', sync);

module.exports = sync;

