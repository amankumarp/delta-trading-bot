'use strict';

/**
 * lib/TradeBuilder.js
 *
 * PHASE 2 — Single canonical trade-building logic.
 *
 * Previously duplicated verbatim in:
 *   - analytics/Optimizer.js       (buildTradeList)
 *   - analytics/index.js           (buildTradeList)
 *   - analytics/optimizer-worker.js (buildTradeList)
 *   - services/strategy/index.js   (generateImbaTradeReport — same logic, different field name)
 *
 * All four import sites now require this module. Bug fixes and improvements
 * propagate automatically everywhere.
 *
 * Exported functions:
 *   buildTradeList(candles)           → trades[]   (analytics-compatible format)
 *   generateImbaTradeReport(candles)  → trades[]   (strategy-service compatible, richer fields)
 */

/**
 * Build a minimal trade list from ImbaAlgo signal candles.
 * Compatible with BacktestEngine.run(trades).
 *
 * Gap-aware SL detection:
 *   - If open gaps past SL on next candle, exit is at open price (gap fill)
 *   - If low/high touches SL intrabar, exit is at exact SL price
 *
 * @param {object[]} candles – annotated candles from ImbaAlgoStrategy.generateSignals()
 * @returns {object[]} trades
 */
function buildTradeList(candles) {
  const trades = [];
  let current  = null;

  for (const c of candles) {
    if (current) {
      // ── Max Adverse Excursion (MAE) tracking ──────────────────────────────
      if (current.isLong) {
        current.losspoint = Math.max(current.losspoint, current.entry_price - c.low);
      } else {
        current.losspoint = Math.max(current.losspoint, c.high - current.entry_price);
      }

      // ── Stop-Loss Hit Check (gap-aware) ──────────────────────────────────
      let slHit  = false;
      let exitPx = current.stoploss;

      if (current.isLong) {
        if      (c.open <= current.stoploss) { slHit = true; exitPx = c.open; }        // gap down
        else if (c.low  <= current.stoploss) { slHit = true; exitPx = current.stoploss; } // intrabar
      } else {
        if      (c.open >= current.stoploss) { slHit = true; exitPx = c.open; }        // gap up
        else if (c.high >= current.stoploss) { slHit = true; exitPx = current.stoploss; } // intrabar
      }

      if (slHit && !current._done) {
        const profit = current.isLong
          ? (exitPx - current.entry_price) / current.entry_price * 100
          : (current.entry_price - exitPx) / current.entry_price * 100;

        trades.push({
          ...current,
          exit_time:        c.datetime || String(c.time),
          exit_price:       exitPx,
          avg_profit:       profit.toFixed(2),
          exit_reason:      'stoploss',
          stoploss_touched: true,
          risk_percentage:  Math.abs(profit).toFixed(2),
        });
        current._done = true;
        current = null;
        continue;
      }

      // ── Strategy Exit Signal ──────────────────────────────────────────────
      if (c.exit_signal === 'exit' && !current._done) {
        const profit = current.isLong
          ? (c.close - current.entry_price) / current.entry_price * 100
          : (current.entry_price - c.close) / current.entry_price * 100;

        trades.push({
          ...current,
          exit_time:        c.datetime || String(c.time),
          exit_price:       c.close,
          avg_profit:       profit.toFixed(2),
          exit_reason:      profit >= 0 ? 'target' : 'trend_change',
          stoploss_touched: false,
          risk_percentage:  Math.abs(profit).toFixed(2),
        });
        current._done = true;
        current = null;
      }
    }

    // ── New Entry ─────────────────────────────────────────────────────────
    if (!current && typeof c.new_signal === 'string' && (c.new_signal.includes('Buy') || c.new_signal.includes('Sell'))) {
      current = {
        entry_time:   c.datetime || String(c.time),
        entry_price:  c.close,
        stoploss:     c.stoploss,
        isLong:       c.bullish,
        open:         c.open,
        high:         c.high,
        low:          c.low,
        close:        c.close,
        volume:       c.volume,
        losspoint:    0,
        _done:        false,
      };
    }
  }

  return trades;
}

/**
 * Richer version used by strategy/index.js — preserves TP levels, RSI, Fibonacci
 * fields from ImbaAlgo candles for display in the dashboard.
 *
 * Uses `exit_processed` as the done flag (previously mismatched with analytics'
 * `_done` flag — now both exist to maintain backward compatibility with callers
 * that check either field).
 *
 * @param {object[]} candles – annotated candles from ImbaAlgoStrategy.generateSignals()
 * @returns {object[]} trades
 */
function generateImbaTradeReport(candles) {
  const trades = [];
  let current  = null;

  for (const c of candles) {
    if (current) {
      // MAE
      if (current.isLong) {
        current.losspoint = Math.max(current.losspoint, current.entry_price - c.low);
      } else {
        current.losspoint = Math.max(current.losspoint, c.high - current.entry_price);
      }

      // SL hit (gap-aware)
      let slHit  = false;
      let exitPx = current.stoploss;
      if (current.isLong) {
        if      (c.open <= current.stoploss) { slHit = true; exitPx = c.open; }
        else if (c.low  <= current.stoploss) { slHit = true; exitPx = current.stoploss; }
      } else {
        if      (c.open >= current.stoploss) { slHit = true; exitPx = c.open; }
        else if (c.high >= current.stoploss) { slHit = true; exitPx = current.stoploss; }
      }

      if (slHit && !current.exit_processed) {
        const profit = current.isLong
          ? (exitPx - current.entry_price) / current.entry_price * 100
          : (current.entry_price - exitPx) / current.entry_price * 100;
        trades.push({
          ...current,
          exit_time:        c.datetime || c.time,
          exit_price:       exitPx,
          avg_profit:       profit.toFixed(2),
          profit:           profit.toFixed(2),
          exit_reason:      'stoploss',
          stoploss_touched: true,
          risk_percentage:  Math.abs(profit).toFixed(2),
        });
        current.exit_processed = true;
        current._done          = true;
        current = null;
        continue;
      }

      // Strategy exit
      if (c.exit_signal === 'exit' && !current.exit_processed) {
        const profit = current.isLong
          ? (c.close - current.entry_price) / current.entry_price * 100
          : (current.entry_price - c.close) / current.entry_price * 100;
        trades.push({
          ...current,
          exit_time:        c.datetime || c.time,
          exit_price:       c.close,
          avg_profit:       profit.toFixed(2),
          profit:           profit.toFixed(2),
          exit_reason:      profit >= 0 ? 'target' : 'trend_change',
          stoploss_touched: false,
          risk_percentage:  Math.abs(profit).toFixed(2),
        });
        current.exit_processed = true;
        current._done          = true;
        current = null;
      }
    }

    // New entry — preserve all strategy indicator fields
    if (!current && typeof c.new_signal === 'string' && (c.new_signal.includes('Buy') || c.new_signal.includes('Sell'))) {
      current = {
        entry_time:     c.datetime || c.time,
        entry_price:    c.close,
        stoploss:       c.stoploss,
        tp1:            c.tp1,
        tp2:            c.tp2,
        tp3:            c.tp3,
        tp4:            c.tp4,
        isLong:         c.bullish,
        rsi:            c.rsi,
        trendLine:      c.trendLine,
        fib236:         c.fib236,
        fib786:         c.fib786,
        open:           c.open,
        high:           c.high,
        low:            c.low,
        close:          c.close,
        volume:         c.volume,
        losspoint:      0,
        maxpoint:       0,
        exit_processed: false,
        _done:          false,
      };
    }
  }

  return trades;
}

module.exports = { buildTradeList, generateImbaTradeReport };
