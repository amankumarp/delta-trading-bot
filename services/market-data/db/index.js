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
        db.run("PRAGMA journal_mode=WAL;");
        candles.forEach(c =>{
          let time = c.time;
          if(c.time.toString().length==13)
             time = Number(c.time/1000)
             stmt.run([time, c.open, c.high, c.low, c.close, c.volume])
        });
        stmt.finalize(err => err ? rej(err) : res());
    });
  });
}



module.exports = { db, ensureTable, saveToSQLite, loadLatestTime };
