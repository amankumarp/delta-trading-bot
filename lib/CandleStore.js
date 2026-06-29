'use strict';

/**
 * lib/CandleStore.js
 *
 * PHASE 1 — Shared In-Process Candle Data Access
 *
 * Replaces all axios.get('http://localhost:3000/api/candles') calls inside
 * the same process with a direct SQLite query backed by an LRU TTL cache.
 *
 * Key design decisions:
 *  - Single SQLite connection per process (reuse from db/index.js)
 *  - In-memory TTL cache keyed by (symbol, interval, from, to)
 *  - EventEmitter interface so LiveSignalEngine can subscribe to new candles
 *    without polling (replaces setInterval in main.js — Phase 5)
 *  - All public methods return plain JS objects; no HTTP, no JSON.parse
 *
 * Usage:
 *   const CandleStore = require('../lib/CandleStore');
 *   const candles = await CandleStore.get({ symbol, interval, from, to });
 *   const ohlcv   = await CandleStore.getAsOHLCV({ symbol, interval, from, to });
 *   CandleStore.on('candle', ({ symbol, candle }) => { ... });
 */

const path         = require('path');
const EventEmitter = require('events');

// ── Resolve DB from market-data service (single connection shared in-process)
const dbModule = require(path.join(__dirname, '../services/market-data/db/index'));
const db       = dbModule.db;

// ── Interval definitions (seconds)
const INTERVAL_SECS = {
  '1m':  60,
  '3m':  3  * 60,
  '5m':  5  * 60,
  '15m': 15 * 60,
  '1h':  60 * 60,
  '2h':  2  * 60 * 60,
  '4h':  4  * 60 * 60,
  '1d':  24 * 60 * 60,
  '7d':  7  * 24 * 60 * 60,
  '1mo': 30 * 24 * 60 * 60,
};

// ── TTL LRU Cache ─────────────────────────────────────────────────────────────
const CACHE_TTL_MS  = 5 * 60 * 1000; // 5 minutes — historical data is immutable
const MAX_CACHE_SIZE = 50;            // max distinct (symbol, interval, range) entries

class LRUCache {
  constructor(maxSize) {
    this._max  = maxSize;
    this._map  = new Map(); // insertion-order = LRU order
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      this._map.delete(key);
      return null;
    }
    // Refresh position (LRU)
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.data;
  }

  set(key, data) {
    if (this._map.size >= this._max) {
      // Evict oldest entry
      this._map.delete(this._map.keys().next().value);
    }
    this._map.set(key, { data, ts: Date.now() });
  }

  invalidate(pattern) {
    for (const k of this._map.keys()) {
      if (k.startsWith(pattern)) this._map.delete(k);
    }
  }
}

const _cache = new LRUCache(MAX_CACHE_SIZE);

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Round a unix timestamp (seconds) down to the nearest interval bucket.
 */
function roundDown(tSec, intervalSec) {
  return Math.floor(tSec / intervalSec) * intervalSec;
}

/**
 * Group raw 1m rows into larger candles (e.g. 4h) in a single O(N) pass.
 * Returns an array of { time, open, high, low, close, volume } objects.
 */
function groupCandles(rows, intervalSec) {
  if (!rows.length) return [];
  const buckets = new Map();

  for (const r of rows) {
    const bucket = roundDown(r.time, intervalSec);
    if (!buckets.has(bucket)) {
      buckets.set(bucket, { time: bucket, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume });
    } else {
      const b    = buckets.get(bucket);
      if (r.high > b.high) b.high = r.high;
      if (r.low  < b.low)  b.low  = r.low;
      b.close   = r.close;
      b.volume += r.volume;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

/**
 * Heikin-Ashi transform over grouped candles.
 */
function heikinAshi(candles) {
  const out = [];
  for (let i = 0; i < candles.length; i++) {
    const c    = candles[i];
    const prev = out[i - 1] || c;
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen  = (prev.open + prev.close) / 2;
    out.push({
      time:   c.time,
      open:   haOpen,
      high:   Math.max(c.high, haOpen, haClose),
      low:    Math.min(c.low,  haOpen, haClose),
      close:  haClose,
      volume: c.volume,
    });
  }
  return out;
}

/**
 * Raw SQLite query for 1m rows in a time range.
 * Returns a Promise<object[]>.
 */
async function backfillMissing1m(symbol, from, to) {
  if (!from) return; 
  const targetTo = to || Math.floor(Date.now() / 1000);
  const { fetchCandlesFromCoinDCX } = require('../services/market-data/delta');
  const { saveToSQLite, ensureTable } = require('../services/market-data/db/index');
  const EventBus = require('./EventBus');
  const table = `${symbol.toLowerCase()}_1m`;
  await ensureTable(table);

  let currentEnd = targetTo;
  const CHUNK_SIZE = 30 * 24 * 60 * 60; // ~1 month in seconds

  while (currentEnd > from) {
      let currentStart = Math.max(from, currentEnd - CHUNK_SIZE);
      console.log(`[CandleStore] Background backfilling ${symbol} from ${currentStart} to ${currentEnd}`);
      try {
          const candles = await fetchCandlesFromCoinDCX(symbol, '1m', currentStart, currentEnd);
          if (!candles || candles.length === 0) {
              console.log(`[CandleStore] No data found for ${symbol} before ${currentEnd}. Stopping backfill.`);
              break;
          }
          await saveToSQLite(table, candles);
          
          // Emit progress event
          EventBus.emit('data_backfilled', { symbol, from: currentStart, to: currentEnd });
          
          const firstReturnedTime = candles[0].time;
          const firstTimeSec = firstReturnedTime > 1e11 ? Math.floor(firstReturnedTime/1000) : firstReturnedTime;
          
          if (firstTimeSec > currentStart + 3600) {
             console.log(`[CandleStore] Reached earliest available data for ${symbol} at ${firstTimeSec}.`);
             break;
          }
          
          currentEnd = currentStart - 1; 
          
          // Respect API rate limits
          await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
          console.error(`[CandleStore] Backfill error:`, err.message);
          break;
      }
  }
  
  // Emit completion
  EventBus.emit('data_backfilled_complete', { symbol, from, to: targetTo });
}

async function queryRaw(symbol, from, to) {
  const { ensureTable } = require('../services/market-data/db/index');
  const table = `${symbol.toLowerCase()}_1m`;
  await ensureTable(table);
  let sql, params;

  if (!from && !to) {
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
    sql    = `SELECT * FROM ${table} WHERE time >= ? ORDER BY time ASC`;
    params = [sevenDaysAgo];
  } else if (from && !to) {
    sql    = `SELECT * FROM ${table} WHERE time >= ? ORDER BY time ASC`;
    params = [from];
  } else if (!from && to) {
    sql    = `SELECT * FROM ${table} WHERE time <= ? ORDER BY time ASC`;
    params = [to];
  } else {
    sql    = `SELECT * FROM ${table} WHERE time BETWEEN ? AND ? ORDER BY time ASC`;
    params = [from, to];
  }

  const queryDB = () => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else     resolve(rows || []);
    });
  });

  let rows = await queryDB();
  let isPartial = false;

  if (from) {
      const firstTime = rows.length ? rows[0].time : Infinity;
      const lastTime = rows.length ? rows[rows.length - 1].time : -Infinity;
      
      const reqTo = to || Math.floor(Date.now() / 1000);
      let missingRanges = [];
      
      if (rows.length === 0) {
          missingRanges.push({ start: from, end: reqTo });
      } else {
          // Check for missing data before the first candle in DB
          if (firstTime > from + 3600) {
              missingRanges.push({ start: from, end: firstTime - 60 });
          }
          // Check for missing data after the last candle in DB
          if (reqTo > lastTime + 3600 && lastTime > 0) {
              missingRanges.push({ start: lastTime + 60, end: reqTo });
          }
      }
      
      if (missingRanges.length > 0) {
          isPartial = true;
          // Fire and forget backfill in the background
          missingRanges.forEach(range => {
              backfillMissing1m(symbol, range.start, range.end).catch(console.error);
          });
      }
  }

  // Attach partial flag to array
  if (isPartial) rows._isPartial = true;
  return rows;
}

// ── Public API ────────────────────────────────────────────────────────────────

class CandleStore extends EventEmitter {

  /**
   * Get candles as an array of { time, open, high, low, close, volume }.
   *
   * @param {object} opts
   * @param {string} opts.symbol   – e.g. 'BTC_USDT'
   * @param {string} opts.interval – e.g. '4h'
   * @param {number} [opts.from]   – unix seconds
   * @param {number} [opts.to]     – unix seconds
   * @param {string} [opts.type]   – 'normal' | 'heikin_ashi'
   * @returns {Promise<object[]>}
   */
  async get({ symbol, interval, from, to, type = 'normal' }) {
    const intervalSec = INTERVAL_SECS[interval];
    if (!intervalSec) throw new Error(`Unknown interval: ${interval}`);

    const cacheKey = `${symbol}:${interval}:${from ?? ''}:${to ?? ''}:${type}`;
    const hit      = _cache.get(cacheKey);
    if (hit) return hit;

    const raw     = await queryRaw(symbol, from, to);
    const grouped = groupCandles(raw, intervalSec);
    const result  = type === 'heikin_ashi' ? heikinAshi(grouped) : grouped;

    if (raw._isPartial) result._isPartial = true;

    _cache.set(cacheKey, result);
    return result;
  }

  /**
   * Get candles as columnar OHLCV arrays compatible with strategy.generateSignals().
   * This is the format all strategies expect.
   *
   * @returns {Promise<{ open, high, low, close, time, volume }>} — each is Float64Array
   */
  async getAsOHLCV({ symbol, interval, from, to, type = 'normal' }) {
    const candles = await this.get({ symbol, interval, from, to, type });

    if (!candles.length) {
      return { open: [], high: [], low: [], close: [], time: [], volume: [] };
    }

    // Use typed arrays for memory efficiency and zero-copy SharedArrayBuffer transfer
    const n      = candles.length;
    const open   = new Float64Array(n);
    const high   = new Float64Array(n);
    const low    = new Float64Array(n);
    const close  = new Float64Array(n);
    const time   = new Float64Array(n);
    const volume = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      const c  = candles[i];
      open[i]  = c.open;
      high[i]  = c.high;
      low[i]   = c.low;
      close[i] = c.close;
      time[i]  = c.time;
      volume[i]= c.volume;
    }

    const out = { open, high, low, close, time, volume };
    if (candles._isPartial) out._isPartial = true;
    return out;
  }

  /**
   * Notify subscribers that a new candle was ingested (called by syncJob).
   * Phase 5 wires this to EventBus.on('candle') in LiveSignalEngine.
   *
   * @param {string} symbol
   * @param {string} interval
   * @param {object} candle
   */
  notifyNewCandle(symbol, interval, candle) {
    // Invalidate cache for this symbol so next read picks up fresh data
    _cache.invalidate(`${symbol}:`);
    this.emit('candle', { symbol, interval, candle });
  }

  /**
   * Get the latest stored timestamp for a symbol/interval combo.
   * Used by syncJob to determine the fetch window.
   */
  getLatestTime(symbol) {
    return new Promise((resolve, reject) => {
      const table = `${symbol.toLowerCase()}_1m`;
      db.get(`SELECT MAX(time) as last FROM ${table}`, (err, row) => {
        if (err) reject(err);
        else     resolve(row?.last ?? 0);
      });
    });
  }

  /**
   * Expose interval seconds map for external use.
   */
  getIntervalSecs() {
    return { ...INTERVAL_SECS };
  }
}

// Singleton — all require() calls get the same instance
module.exports = new CandleStore();
