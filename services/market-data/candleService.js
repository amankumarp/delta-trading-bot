const { db } = require("./db");

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

    // Case: Neither from nor to is provided (fetch latest N candles)
    if (!from && !to) {
      const limit = 100; // adjust as needed
      const latestQuery = `
        SELECT * FROM ${table}
        ORDER BY time DESC
        LIMIT ${limit * Math.ceil(intervalSec / 60)}
      `;
      db.all(latestQuery, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.reverse());
      });

      // Case: Only 'from' is provided
    } else if (from && !to) {
      const query = `
        SELECT * FROM ${table}
        WHERE time >= ?
        ORDER BY time ASC
      `;
      db.all(query, [from], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });

      // Case: Only 'to' is provided
    } else if (!from && to) {
      const query = `
        SELECT * FROM ${table}
        WHERE time <= ?
        ORDER BY time ASC
      `;
      db.all(query, [to], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });

      // Case: Both 'from' and 'to' are provided
    } else {
      const query = `
        SELECT * FROM ${table}
        WHERE time BETWEEN ? AND ?
        ORDER BY time ASC
      `;
      db.all(query, [from, to], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }
  });
}


async function getCandles({ symbol, interval, from, to, type = 'normal' }) {
  const raw = await fetchRawCandles(symbol, interval, from, to);

  const grouped = groupCandles(raw, intervalsIn[interval]);

  const result = type === 'heikin_ashi' ? heikinAshiTransform(grouped) : grouped;

  return result;
}

module.exports = { getCandles };