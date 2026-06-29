'use strict';

/**
 * lib/EventBus.js
 *
 * PHASE 5 — Internal Event Bus.
 *
 * Thin singleton wrapper around Node's built-in EventEmitter.
 * Replaces the setInterval(1000ms) polling loop in main.js with
 * a push-based candle notification system.
 *
 * Flow:
 *   1. CandleStore.notifyNewCandle()  →  EventBus.emit('candle', { symbol, interval, candle })
 *   2. syncJob.js calls CandleStore.notifyNewCandle() after each successful SQLite write
 *   3. main.js / LiveSignalEngine subscribes:
 *        EventBus.on('candle', ({ symbol }) => runSignalCheck(symbol))
 *   4. WebSocket handler in analytics/index.js subscribes:
 *        EventBus.on('signal', payload => ws.send(JSON.stringify(payload)))
 *
 * Events:
 *   'candle'  { symbol: string, interval: string, candle: object }
 *   'signal'  { symbol: string, strategy: string, signal: object, timestamp: number }
 *   'error'   { source: string, message: string }
 */

const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Increase default listener limit (many subscribers per symbol are normal)
    this.setMaxListeners(50);
  }

  /**
   * Emit a new candle event.
   * Called by CandleStore.notifyNewCandle() after SQLite write.
   */
  emitCandle(symbol, interval, candle) {
    this.emit('candle', { symbol, interval, candle, timestamp: Date.now() });
  }

  /**
   * Emit a new signal event.
   * Called by LiveSignalEngine after strategy evaluation.
   */
  emitSignal(symbol, strategy, signal) {
    this.emit('signal', { symbol, strategy, signal, timestamp: Date.now() });
  }

  /**
   * Emit an operational error.
   */
  emitError(source, err) {
    this.emit('error', { source, message: err.message || String(err) });
  }
}

// Singleton — all require() calls share the same bus
module.exports = new EventBus();
