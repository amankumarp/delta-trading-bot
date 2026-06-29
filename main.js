'use strict';

/**
 * main.js — Live Trading Engine
 *
 * PHASE 5 (updated): Replaced setInterval(1000ms) polling with EventBus
 * push-based candle notification.
 *
 * Before: checked DB every 1 second regardless of market activity.
 *         97% of ticks did nothing. Signal detection latency: avg 500ms.
 *
 * After:  EventBus.on('candle') fires exactly when a new candle arrives
 *         from syncJob (~every 2 min). Zero CPU burn between candles.
 *         Signal detection latency: ~0ms (fires immediately after DB write).
 *
 * Architecture:
 *   syncJob (cron every 2min)
 *     → saves to SQLite
 *     → CandleStore.notifyNewCandle() → EventBus.emitCandle()
 *                                         ↓
 *                                  main.js onCandle()
 *                                    → CandleStore.getAsOHLCV()  [in-memory cache hit]
 *                                    → strategy.generateSignals() [synchronous, fast]
 *                                    → check signals → order / telegram
 */

const config          = require('./config/index');
const TelegramService = require('./services/notification/telegram');
const ExchangeService = require('./services/order-execution/ExchangeService');
const SupertrendAI    = require('./services/strategy/SupertrendStrategy');
const { convertOHLCVtoArray } = require('./services/strategy/utils');

// Phase 1 + 5 — in-process data + event-driven delivery
const CandleStore = require('./lib/CandleStore');
const EventBus    = require('./lib/EventBus');

const telegramService = new TelegramService(config.botToken, config.chatId);
const exchangeService = new ExchangeService(config.apiKey, config.apiSecret);
const strategyService = new SupertrendAI();

const SYMBOL    = config.SYMBOL    || 'BTC_USDT';
const TIMEFRAME = config.TIMEFRAME || '15m';
const MIN_BARS  = 50;

let prevTrade           = null;
let lastCandleTimestamp = 0;

// ─── Signal handler ───────────────────────────────────────────────────────────

/**
 * Fired once per new candle (from EventBus, replaces setInterval).
 * Only processes candles for the configured symbol.
 */
async function onCandle({ symbol }) {
    // Only act on the configured trading symbol
    if (symbol !== SYMBOL) return;

    try {
        // Phase 1: in-process cache hit (no HTTP, no SQLite scan for repeat calls)
        const ohlcv = await CandleStore.getAsOHLCV({ symbol: SYMBOL, interval: TIMEFRAME });

        if (!ohlcv.close || ohlcv.close.length < MIN_BARS) return;

        const response = strategyService.generateSignals(ohlcv);
        const candles  = response.candles.slice().reverse();
        const signals  = response.signals.slice().reverse();

        const candle     = candles[1];
        const prevCandle = candles[2];
        const signal     = signals[0];

        if (!candle) return;

        // Track most recent active signal
        if (signal && signal.signal !== 'exit') {
            prevTrade = signal.signal === 'partial_exit' ? signal.active : signal;
        }

        const candleTimestamp = candle.time;

        // Guard: only act when a genuinely new candle is detected
        if (lastCandleTimestamp === 0) {
            lastCandleTimestamp = candleTimestamp;
            return; // initialisation tick — no action
        }

        if (candleTimestamp <= lastCandleTimestamp) return;

        lastCandleTimestamp = candleTimestamp;
        console.log(`[main] New ${TIMEFRAME} candle @ ${new Date(candleTimestamp * 1000).toISOString()}`);

        // ── Exit signal ───────────────────────────────────────────────────────
        if (candle.exit_signal != null && prevTrade != null) {
            console.log('[main] Exit signal triggered');
            await telegramService.getExitNotificationMessage(SYMBOL, candle.close, candle.profit, 'exit');
            const position = await getPosition(SYMBOL);
            if (position) {
                const side = Number(position.size) < 0 ? 'buy' : 'sell';
                await exchangeService.exitOrder(position.product_id, -Number(position.size), side);
            }
            prevTrade = null;
        }

        // ── Partial exit ──────────────────────────────────────────────────────
        if (candle.partial_exit != null && prevTrade != null) {
            console.log('[main] Partial exit signal triggered');
            await telegramService.getPartialExitMessage(SYMBOL, candle.close, '30%', '40%');
            const position = await getPosition(SYMBOL);
            if (position) {
                const exit = Math.abs(position.size) > 1
                    ? Number(position.size) * 0.5
                    : Number(position.size);
                const side = Number(position.size) < 0 ? 'buy' : 'sell';
                await exchangeService.exitOrder(position.product_id, -Number(exit), side);
            }
        }

        // ── Trailing stop update ──────────────────────────────────────────────
        if (
            prevCandle != null && prevTrade != null &&
            Number(prevCandle.supertrend) !== Number(candle.supertrend) &&
            candle.exit_signal == null && candle.bullish === null &&
            candle.partial_exit == null
        ) {
            await telegramService.getTrailingStopMessage(
                SYMBOL,
                Number(candle.supertrend).toFixed(2),
                `Profit: ${candle.profit}%`
            );
            console.log('[main] Trailing stop updated');
        }

        // ── Buy signal ────────────────────────────────────────────────────────
        if (['Buy', 'Smart Buy'].includes(candle.new_signal)) {
            console.log('[main] Buy signal — placing order');
            prevTrade = candle;
            await telegramService.getTradeSignalMessage(
                candle.new_signal, SYMBOL, candle.close, '',
                Number(candle.stoploss).toFixed(2)
            );
            const order = await exchangeService.placeOrder(
                SYMBOL, 'buy', 2, candle.close, 'market_order',
                Number(candle.stoploss).toFixed(2)
            );
            console.log('[main] Buy order result:', order?.result);
        }

        // ── Sell signal ───────────────────────────────────────────────────────
        if (['Sell', 'Smart Sell'].includes(candle.new_signal)) {
            console.log('[main] Sell signal — placing order');
            prevTrade = candle;
            await telegramService.getTradeSignalMessage(
                candle.new_signal, SYMBOL, candle.close, '',
                Number(candle.stoploss).toFixed(2)
            );
            const order = await exchangeService.placeOrder(
                SYMBOL, 'sell', 2, candle.close, 'market_order',
                Number(candle.stoploss).toFixed(2)
            );
            console.log('[main] Sell order result:', order?.result);
        }

        // Publish to EventBus so WebSocket clients get live signal updates
        if (candle.new_signal || candle.exit_signal) {
            EventBus.emitSignal(SYMBOL, 'supertrend-ai', {
                new_signal:   candle.new_signal,
                exit_signal:  candle.exit_signal,
                close:        candle.close,
                stoploss:     candle.stoploss,
                time:         candleTimestamp,
            });
        }

    } catch (err) {
        console.error('[main] Trading loop error:', err.message);
        EventBus.emitError('main', err);
    }
}

// ─── Startup ──────────────────────────────────────────────────────────────────

async function main() {
    console.log('[main] Bot starting — event-driven mode (no polling)');
    console.log(`[main] Watching ${SYMBOL} @ ${TIMEFRAME}`);

    // Phase 5: subscribe to EventBus instead of setInterval
    EventBus.on('candle', onCandle);

    // Log operational errors from other services
    EventBus.on('error', ({ source, message }) => {
        console.error(`[EventBus] Error from ${source}: ${message}`);
    });

    console.log('[main] Waiting for candle events from syncJob…');
}

main();

// ─── Exchange helpers ─────────────────────────────────────────────────────────

async function getPosition(symbol) {
    const positions = await exchangeService.getMarginedPositions();
    const position  = positions.result.find(p => p.product_symbol === symbol);
    if (!position) return null;
    return { product_id: position.product_id, size: position.size };
}

async function getSLOrder() {
    const orders = await exchangeService.getOrders();
    const order  = orders.result.find(o => o.stop_order_type === 'stop_loss_order');
    if (!order) return null;
    return { order_id: order.id, product_id: order.product_id, exit_lots: order.size, side: order.side };
}