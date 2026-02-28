const { runBackfillAll, backfill } = require('./jobs/backfill');
const syncJob = require('./jobs/syncJob');

const args = process.argv.slice(2);
if (args.includes('--backfill')) {
  const symbol = args[1];
  if (symbol) backfill(symbol);
  else runBackfillAll();
} else {
  syncJob(); // auto cron job
}