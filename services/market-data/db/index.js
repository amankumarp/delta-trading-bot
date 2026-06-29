const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// const writeQueue = new PQueue({ concurrency: 1 }); 

// Create folder if it doesn't exist
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Use absolute path for DB
const dbPath = path.join(dataDir, 'ohlcv.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message);
  } else {
    console.log(`Connected to SQLite DB at ${dbPath}`);
    // Core reliability
    db.run("PRAGMA busy_timeout = 10000;");
    db.run("PRAGMA journal_mode = WAL;");
    // Performance: large-dataset reads (10-year data)
    db.run("PRAGMA cache_size = -65536;");   // 64 MB page cache
    db.run("PRAGMA mmap_size = 536870912;"); // 512 MB memory-mapped I/O
    db.run("PRAGMA synchronous = NORMAL;");  // safe with WAL, ~2× faster than FULL
    db.run("PRAGMA temp_store = MEMORY;");   // sort/group temps in RAM, not disk
  }
});

async function loadLatestTime(table) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT MAX(time) as last FROM ${table}`, (err, row) => {
            if (err) reject(err);
            else resolve(row?.last || 0); // Return 0 if no data
        });
    });
}

function ensureTable(table) {
  return new Promise((res, rej) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS ${table} (
        time INTEGER PRIMARY KEY,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        volume REAL
      );
    `, err => err ? rej(err) : res());
  });
}

function saveToSQLite(table, candles) {
  return new Promise((res, rej) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO ${table} (time, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    db.serialize(() => {
        // Wrap all inserts in a single transaction: avoids N individual fsyncs,
        // making 10-year backfills 10-50× faster.
        db.run("BEGIN");
        candles.forEach(c => {
          let time = c.time;
          if (c.time.toString().length === 13)
            time = Math.floor(c.time / 1000); // ms → sec (integer, not float)
          stmt.run([time, c.open, c.high, c.low, c.close, c.volume]);
        });
        db.run("COMMIT");
        stmt.finalize(err => err ? rej(err) : res());
    });
  });
}



module.exports = { db, ensureTable, saveToSQLite, loadLatestTime };
