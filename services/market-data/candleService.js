const { db } = require("./db");

// ── In-memory TTL cache (keyed by symbol+interval+from+to) ──────────────────
// Candle data from the past is immutable. Caching avoids repeated SQLite full
// scans on consecutive API calls with the same parameters.
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function _cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return hit.data;
}
function _cacheSet(key, data) { _cache.set(key, { data, ts: Date.now() }); }

const intervalsIn = {
  '1m': 60,
  '3m': 3 * 60,
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '2h': 2 * 60 * 60,
  '4h': 4 * 60 * 60,
  '1d': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
  '1mo': 30 * 24 * 60 * 60,
};

function roundTime(timestampSec, intervalSec) {
  return Math.floor(timestampSec / intervalSec) * intervalSec;
}

function heikinAshiTransform(candles) {
  let haCandles = [];
  for (let i = 0; i < candles.length; i++) {
    const prev = haCandles[i - 1] || candles[i];
    const c = candles[i];

    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = (prev.open + prev.close) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);

    haCandles.push({
      time: c.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: c.volume,
    });
  }
  return haCandles;
}


function groupCandles(candles, intervalSec) {
  const grouped = new Map();

  for (const c of candles) {
    const bucket = roundTime(c.time, intervalSec);
    if (!grouped.has(bucket)) {
      grouped.set(bucket, {
        time: bucket,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
      });
    } else {
      const g = grouped.get(bucket);
      g.high = Math.max(g.high, c.high);
      g.low = Math.min(g.low, c.low);
      g.close = c.close;
      g.volume += c.volume;
    }
  }

  return Array.from(grouped.values()).sort((a, b) => a.time - b.time);
}


function fetchRawCandles(symbol, interval, from, to) {
  return new Promise((resolve, reject) => {
    const table = `${symbol.toLowerCase()}_1m`;
    const intervalSec = intervalsIn[interval];

    if (!intervalSec) return reject(new Error("Invalid interval"));

    // Case: Neither from nor to is provided
    // BUG FIX: Removed hardcoded limit=100 which silently clipped 10-year datasets.
    // Require at least 'from' for large-dataset queries; default to last 7 days.
    if (!from && !to) {
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
      const query = `SELECT * FROM ${table} WHERE time >= ? ORDER BY time ASC`;
      db.all(query, [sevenDaysAgo], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });

    // Case: Only 'from' is provided
    } else if (from && !to) {
      const query = `SELECT * FROM ${table} WHERE time >= ? ORDER BY time ASC`;
      db.all(query, [from], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });

    // Case: Only 'to' is provided
    } else if (!from && to) {
      const query = `SELECT * FROM ${table} WHERE time <= ? ORDER BY time ASC`;
      db.all(query, [to], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });

    // Case: Both 'from' and 'to' are provided
    } else {
      const query = `SELECT * FROM ${table} WHERE time BETWEEN ? AND ? ORDER BY time ASC`;
      db.all(query, [from, to], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }
  });
}


async function getCandles({ symbol, interval, from, to, type = 'normal' }) {
  const cacheKey = `${symbol}:${interval}:${from ?? ''}:${to ?? ''}:${type}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const raw = await fetchRawCandles(symbol, interval, from, to);
  const grouped = groupCandles(raw, intervalsIn[interval]);
  const result = type === 'heikin_ashi' ? heikinAshiTransform(grouped) : grouped;

  _cacheSet(cacheKey, result);
  return result;
}

module.exports = { getCandles };