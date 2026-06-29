const { fetchCandlesFromCoinDCX, fetchCandlesFromDelta } = require("../delta");
const { db, saveToSQLite, ensureTable, loadLatestTime } = require("../db");

const symbols = ["BTC_USDT", "ETH_USDT", 'XAU_USDT'];


async function backfill(symbol, interval = "1m", years = 10) {
  const table = `${symbol.toLowerCase()}_${interval}`;
  const intervalSec = 60;

  await ensureTable(table);
  const now = Math.floor(Date.now() / 1000);

  let lastStored = await loadLatestTime(table);
  let from, to;

  // backfill 10 years of historical data in chunks (1000 candles per request)
  console.log(`Backfilling ${years} years of data for ${symbol}...`);
  from = now - years * 365 * 24 * 3600;
  if (lastStored > from) {
    console.log(`Last stored time is ${new Date(lastStored * 1000).toISOString()}, starting from there.`);
    from = lastStored + intervalSec;
  }

  while (from < now) {
    to = from + intervalSec * 1000;
    if (to > now) to = now;

    const candles = await fetchCandlesFromCoinDCX(symbol, interval, from, to);
    if (candles.length === 0) break;

    await saveToSQLite(table, candles);

    console.log(
      `Stored ${candles.length} candles from ${new Date(
        from * 1000
      ).toISOString()} to ${new Date(to * 1000).toISOString()}`
    );
    from = to + intervalSec;
  }
}

async function runBackfillAll(years = 10) {
  for (const sym of symbols) {
    await backfill(sym, "1m", years);
  }
}

module.exports = { backfill, runBackfillAll };
