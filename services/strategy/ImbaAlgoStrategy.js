/**
 * IMBA ALGO — JS port of the Pine Script indicator
 *
 * Core Logic:
 *  1. Fibonacci channel (highest/lowest over sensitivity window)
 *  2. Trend detection: close >= fib236 & >= fib50 → LONG; close <= fib786 & <= fib50 → SHORT
 *  3. 4 take-profit levels with configurable position-size allocation per TP
 *  4. Break-even logic (move SL to entry after a configurable TP is hit)
 *  5. RSI overbought/oversold filter (optional)
 *  6. Drawdown tracking (peak-to-trough on total profit%)
 *  7. Risk-Reward calculation per trade
 */

const { formatTimestamp, calculateProfitPercentage } = require('./utils');
const BaseStrategy = require('./base/BaseStrategy');

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Precompute rolling highest over window len */
const precomputeHighest = (arr, len) => {
    const n = arr.length;
    const res = new Array(n);
    let maxIdx = -1;
    for (let i = 0; i < n; i++) {
        if (maxIdx <= i - len) {
            maxIdx = Math.max(0, i - len + 1);
            for (let j = maxIdx + 1; j <= i; j++) {
                if (arr[j] >= arr[maxIdx]) maxIdx = j;
            }
        } else {
            if (arr[i] >= arr[maxIdx]) maxIdx = i;
        }
        res[i] = arr[maxIdx];
    }
    return res;
};

/** Precompute rolling lowest over window len */
const precomputeLowest = (arr, len) => {
    const n = arr.length;
    const res = new Array(n);
    let minIdx = -1;
    for (let i = 0; i < n; i++) {
        if (minIdx <= i - len) {
            minIdx = Math.max(0, i - len + 1);
            for (let j = minIdx + 1; j <= i; j++) {
                if (arr[j] <= arr[minIdx]) minIdx = j;
            }
        } else {
            if (arr[i] <= arr[minIdx]) minIdx = i;
        }
        res[i] = arr[minIdx];
    }
    return res;
};

/** Rolling SMA */
const rollingSMA = (arr, i, len) => {
    let sum = 0, cnt = 0;
    const start = Math.max(0, i - len + 1);
    for (let j = start; j <= i; j++, cnt++) sum += arr[j];
    return cnt > 0 ? sum / cnt : arr[i] ?? 0;
};

/** Risk-Reward ratio (mirrors Pine calc_rr) */
const calcRR = (entry, sl, tp) =>
    entry > sl
        ? (tp - entry) / (entry - sl)   // LONG
        : (entry - tp) / (sl - entry);  // SHORT

/** RSI calculation */
const calculateRSI = (close, period = 14) => {
    const rsi = new Array(close.length).fill(null);
    if (close.length < period + 1) return rsi;

    let gainSum = 0, lossSum = 0;
    for (let i = 1; i <= period; i++) {
        const diff = close[i] - close[i - 1];
        if (diff >= 0) gainSum += diff; else lossSum -= diff;
    }
    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;
    rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < close.length; i++) {
        const diff = close[i] - close[i - 1];
        avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
        rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return rsi;
};

// ─── IMBA ALGO Strategy ──────────────────────────────────────────────────────

class ImbaAlgoStrategy extends BaseStrategy {
    constructor(opts = {}) {
        super();

        // ── Sensitivity (channel lookback) ───────────────────────────────
        this.sensitivity     = opts.sensitivity     ?? 18;   // bars (same as Pine default)

        // ── Risk / Position ──────────────────────────────────────────────
        this.riskPercent     = opts.riskPercent     ?? 1;    // % of deposit risked per trade

        // ── Take-Profit levels (% move from entry) ───────────────────────
        this.tp1Pct          = opts.tp1Pct          ?? 1.0;  // %
        this.tp1SizePct      = opts.tp1SizePct      ?? 40;   // % of position closed at TP1
        this.tp2Pct          = opts.tp2Pct          ?? 2.0;
        this.tp2SizePct      = opts.tp2SizePct      ?? 30;
        this.tp3Pct          = opts.tp3Pct          ?? 3.0;
        this.tp3SizePct      = opts.tp3SizePct      ?? 20;
        this.tp4Pct          = opts.tp4Pct          ?? 4.0;
        this.tp4SizePct      = opts.tp4SizePct      ?? 10;

        // ── Break-even config ────────────────────────────────────────────
        // '1'|'2'|'3'|'WITHOUT' — after which TP to activate breakeven
        this.breakEvenTarget = opts.breakEvenTarget ?? '2';

        // ── Stop-loss config ─────────────────────────────────────────────
        this.fixedStop       = opts.fixedStop       ?? false; // if true, use slPercent
        this.slPercent       = opts.slPercent       ?? 0;     // % from entry (when fixedStop)

        // ── RSI filter ───────────────────────────────────────────────────
        this.rsiLen          = opts.rsiLen          ?? 14;
        this.rsiOB           = opts.rsiOB           ?? 78;
        this.rsiOS           = opts.rsiOS           ?? 22;
        this.useRsiFilter    = opts.useRsiFilter    ?? false; // off by default (mirrors Pine)

        // ── Warmup ───────────────────────────────────────────────────────
        this.warmupBars = Math.max(this.sensitivity * 10, this.rsiLen) + 5;
    }

    // ── Fibonacci channel at index i ──────────────────────────────────────────
    _calcFibChannel(highLine, lowLine) {
        const range    = highLine - lowLine;
        return {
            highLine,
            lowLine,
            fib236: highLine - range * 0.236,
            fib382: highLine - range * 0.382,
            fib5:   highLine - range * 0.5,     // "imba_trend_line"
            fib618: highLine - range * 0.618,
            fib786: highLine - range * 0.786,
            range,
        };
    }

    // ── Compute SL price ─────────────────────────────────────────────────────
    _calcSL(isLong, entryPrice, fib) {
        if (this.fixedStop) {
            return isLong
                ? entryPrice * (1 - this.slPercent / 100)
                : entryPrice * (1 + this.slPercent / 100);
        }
        // Auto SL: fib786 (long) or fib236 (short), with optional % buffer
        const buf = this.slPercent / 100;
        return isLong
            ? fib.fib786 * (1 - buf)
            : fib.fib236 * (1 + buf);
    }

    // ── Compute TP price ─────────────────────────────────────────────────────
    _calcTP(isLong, entryPrice, pct) {
        return isLong
            ? entryPrice * (1 + pct / 100)
            : entryPrice * (1 - pct / 100);
    }

    // ── Break-even target price ───────────────────────────────────────────────
    _breakEvenPrice(target, tp1, tp2, tp3, tp4) {
        switch (target) {
            case '1': return tp1;
            case '2': return tp2;
            case '3': return tp3;
            default:  return tp4;  // 'WITHOUT' → effectively never triggers BE
        }
    }

    // ── Main signal generator ─────────────────────────────────────────────────
    generateSignals(data, options = {}) {
        const lean = options.lean || false;
        const { open, high, low, close, time, volume } = data;
        const n = close.length;

        // Pre-compute RSI
        const rsiArr = calculateRSI(close, this.rsiLen);

        // Pre-compute highest/lowest
        const len = this.sensitivity * 10;
        const rollingHighArr = precomputeHighest(high, len);
        const rollingLowArr  = precomputeLowest(low, len);

        // ── Trend state ───────────────────────────────────────────────────
        const isLongTrend  = new Array(n).fill(false);
        const isShortTrend = new Array(n).fill(false);
        const trendLine    = new Array(n).fill(null);
        const fibChannels  = new Array(n).fill(null);

        // Track previous trend for flip detection
        let prevLong  = false;
        let prevShort = false;

        for (let i = this.warmupBars; i < n; i++) {
            const fib = this._calcFibChannel(rollingHighArr[i], rollingLowArr[i]);
            fibChannels[i] = fib;
            trendLine[i]   = fib.fib5;

            const canLong  = close[i] >= fib.fib5 && close[i] >= fib.fib236 && !prevLong;
            const canShort = close[i] <= fib.fib5 && close[i] <= fib.fib786 && !prevShort;

            if (canLong) {
                prevLong  = true;
                prevShort = false;
                isLongTrend[i]  = true;
                isShortTrend[i] = false;
            } else if (canShort) {
                prevShort = true;
                prevLong  = false;
                isShortTrend[i] = true;
                isLongTrend[i]  = false;
            } else {
                isLongTrend[i]  = prevLong;
                isShortTrend[i] = prevShort;
            }
        }

        // ── Signal / candle loop ──────────────────────────────────────────
        const signals = [];
        const candles = [];

        // Trade-level state (mirrors Pine var Trade)
        let tradeActive       = false;
        let tradeIsLong       = false;
        let entryPrice        = 0;
        let slPrice           = 0;
        let initialSlPrice    = 0;
        let tp1Price          = 0, tp2Price = 0, tp3Price = 0, tp4Price = 0;
        let breakEvenPrice    = 0;
        let tp1Hit = false, tp2Hit = false, tp3Hit = false, tp4Hit = false;
        let canBreakEven      = false;
        let positionSizeLeft  = 100;  // % remaining
        let tradeProfit       = 0;    // cumulative R-adjusted profit% for current trade
        let tradeStartBar     = 0;
        let entryTime         = 0;

        // Stats (mirrors Pine globals)
        let totalProfit     = 0;
        let tradeCount      = 0;
        let profitTrades    = 0;
        let lossTrades      = 0;
        let winStreak       = 0;
        let lossStreak      = 0;
        let winsInARow      = 0;
        let lossInARow      = 0;
        let deposit         = 1000;   // nominal tracking only
        let peakProfit      = 0;
        let maxDrawdown     = 0;

        const closeTrade = (exitPrice, exitTime, reason, idx) => {
            if (!tradeActive) return null;

            // Calculate profit for remaining position
            let profit = 0;
            if (!tradeActive) return null;

            // If not a stoploss hit, compute from close price
            const rr = calcRR(entryPrice, initialSlPrice, exitPrice);
            profit = rr * (positionSizeLeft / 100) * this.riskPercent;
            tradeProfit += profit;

            const finalProfit = tradeProfit;
            totalProfit += finalProfit;
            tradeCount++;

            // Deposit compound
            deposit = finalProfit / 100 * deposit + deposit;

            // Win/loss tracking
            if (finalProfit >= 0) {
                profitTrades++;
                winsInARow++;
                lossInARow = 0;
                winStreak = Math.max(winStreak, winsInARow);
            } else {
                lossTrades++;
                lossInARow++;
                winsInARow = 0;
                lossStreak = Math.max(lossStreak, lossInARow);
            }

            // Drawdown
            peakProfit = Math.max(peakProfit, totalProfit);
            maxDrawdown = Math.max(maxDrawdown, peakProfit - totalProfit);

            const event = {
                signal:       'exit',
                time:         exitTime,
                datetime:     formatTimestamp(exitTime),
                price:        exitPrice,
                profit_pct:   finalProfit,
                reason,
                isLong:       tradeIsLong,
                entry_price:  entryPrice,
                sl_price:     slPrice,
                tp1:          tp1Price, tp2: tp2Price,
                tp3:          tp3Price, tp4: tp4Price,
                tp1_hit:      tp1Hit,   tp2_hit: tp2Hit,
                tp3_hit:      tp3Hit,   tp4_hit: tp4Hit,
                position: {
                    entry_price:  entryPrice,
                    isLong:       tradeIsLong,
                    stoploss:     slPrice,
                    quantity:     0
                }
            };

            // Reset state
            tradeActive     = false;
            tradeIsLong     = false;
            tp1Hit = tp2Hit = tp3Hit = tp4Hit = false;
            canBreakEven    = false;
            positionSizeLeft = 100;
            tradeProfit     = 0;

            return event;
        };

        for (let i = this.warmupBars; i < n; i++) {
            const fib = fibChannels[i];
            if (!fib) {
                if (!lean) candles.push({
                    time: time[i], datetime: formatTimestamp(time[i]),
                    open: open[i], high: high[i], low: low[i], close: close[i],
                    volume: volume?.[i] ?? 0,
                    trendLine: null, isLong: false, isShort: false, rsi: null,
                    new_signal: null, exit_signal: null, partial_exit: null,
                    stoploss: null, profit: 0, remaining_qty: 0,
                    totalProfit, tradeCount, winRate: 0, maxDrawdown
                });
                continue;
            }

            const rsi = rsiArr[i];
            // Detect trend flips
            const prevI       = i > 0 ? i - 1 : i;
            const wasLong     = i > this.warmupBars ? isLongTrend[prevI]  : false;
            const wasShort    = i > this.warmupBars ? isShortTrend[prevI] : false;
            const nowLong     = isLongTrend[i];
            const nowShort    = isShortTrend[i];
            const flipToLong  = nowLong  && !wasLong;
            const flipToShort = nowShort && !wasShort;
            const isTrendChange = flipToLong || flipToShort;

            let partialExitEvent = null;
            let exitEvent        = null;
            let entryEvent       = null;
            let candleSignal     = null;
            let candleBullish    = null;

            // ── 1. Manage open trade ──────────────────────────────────────
            if (tradeActive) {
                const isLong = tradeIsLong;
                let slHit = false;

                // ── SL check (only if not yet at break-even) ─────────────
                if (!canBreakEven) {
                    slHit = isLong
                        ? (low[i] <= slPrice && i !== tradeStartBar)
                        : (high[i] >= slPrice && i !== tradeStartBar);

                    if (slHit) {
                        const lossR = -this.riskPercent * (positionSizeLeft / 100);
                        tradeProfit += lossR;
                        exitEvent = closeTrade(slPrice, time[i], 'stoploss', i);
                        if (exitEvent) signals.push(exitEvent);
                    }
                }

                if (!slHit && tradeActive) {
                    // ── Break-even check ─────────────────────────────────
                    if (!canBreakEven) {
                        const beHit = isLong
                            ? high[i] >= breakEvenPrice
                            : low[i]  <= breakEvenPrice;
                        if (beHit) {
                            canBreakEven = true;
                            // Move SL to entry
                            slPrice = entryPrice;
                        }
                    }

                    // ── BE exit (candle touches entry from wrong side) ────
                    if (canBreakEven && i !== tradeStartBar) {
                        const beExitLong  = isLong  && low[i]  <= entryPrice && !(close[i] >= open[i]);
                        const beExitShort = !isLong && high[i] >= entryPrice && !(close[i] <= open[i]);
                        if (beExitLong || beExitShort) {
                            exitEvent = closeTrade(entryPrice, time[i], 'breakeven', i);
                            if (exitEvent) signals.push(exitEvent);
                        }
                    }

                    // ── TP checks (only if still open) ───────────────────
                    if (tradeActive) {
                        const tpCheck = (tpPrice, tpSizePct, hit, label) => {
                            if (hit) return false;
                            const reached = isLong
                                ? high[i] >= tpPrice
                                : low[i]  <= tpPrice;
                            if (!reached) return false;

                            const rr = calcRR(entryPrice, initialSlPrice, tpPrice);
                            const partialProfit = rr * (tpSizePct / 100) * this.riskPercent;
                            tradeProfit      += partialProfit;
                            positionSizeLeft -= tpSizePct;

                            const ev = {
                                signal:       'partial_exit',
                                time:         time[i],
                                datetime:     formatTimestamp(time[i]),
                                price:        tpPrice,
                                profit_pct:   partialProfit,
                                label,
                                isLong,
                                qty_closed:   tpSizePct,
                                qty_remaining: positionSizeLeft,
                                position: {
                                    entry_price: entryPrice,
                                    isLong,
                                    stoploss:    slPrice,
                                    quantity:    positionSizeLeft
                                }
                            };
                            signals.push(ev);
                            if (!partialExitEvent) partialExitEvent = ev;
                            return true;
                        };

                        if (!tp1Hit) tp1Hit = tpCheck(tp1Price, this.tp1SizePct, false, 'TP1');
                        if (!tp2Hit) {
                            tp2Hit = tpCheck(tp2Price, this.tp2SizePct, false, 'TP2');
                            if (tp2Hit && this.breakEvenTarget === '2') {
                                canBreakEven = true; slPrice = entryPrice;
                            }
                        }
                        if (!tp3Hit) tp3Hit = tpCheck(tp3Price, this.tp3SizePct, false, 'TP3');
                        if (!tp4Hit) {
                            tp4Hit = tpCheck(tp4Price, this.tp4SizePct, false, 'TP4');
                            if (tp4Hit && tradeActive) {
                                exitEvent = closeTrade(tp4Price, time[i], 'tp4', i);
                                if (exitEvent) signals.push(exitEvent);
                            }
                        }

                        // ── Trend change → force close ───────────────────
                        if (tradeActive && isTrendChange) {
                            exitEvent = closeTrade(close[i], time[i], 'trend_change', i);
                            if (exitEvent) signals.push(exitEvent);
                        }
                    }
                }
            }

            // ── 2. New signal ─────────────────────────────────────────────
            if (!tradeActive && (flipToLong || flipToShort)) {
                // RSI filter (optional)
                const rsiOk = !this.useRsiFilter || rsi === null ||
                    (flipToLong  && rsi <= this.rsiOB) ||
                    (flipToShort && rsi >= this.rsiOS);

                if (rsiOk) {
                    const isLong = flipToLong;
                    entryPrice      = close[i];
                    slPrice         = this._calcSL(isLong, entryPrice, fib);
                    initialSlPrice  = slPrice;
                    tp1Price        = this._calcTP(isLong, entryPrice, this.tp1Pct);
                    tp2Price        = this._calcTP(isLong, entryPrice, this.tp2Pct);
                    tp3Price        = this._calcTP(isLong, entryPrice, this.tp3Pct);
                    tp4Price        = this._calcTP(isLong, entryPrice, this.tp4Pct);
                    breakEvenPrice  = this._breakEvenPrice(
                        this.breakEvenTarget, tp1Price, tp2Price, tp3Price, tp4Price
                    );

                    tradeIsLong     = isLong;
                    tradeActive     = true;
                    tradeStartBar   = i;
                    entryTime       = time[i];
                    tp1Hit = tp2Hit = tp3Hit = tp4Hit = false;
                    canBreakEven    = false;
                    positionSizeLeft = 100;
                    tradeProfit     = 0;

                    const rr = calcRR(entryPrice, slPrice, tp4Price);
                    const winRate = tradeCount > 0
                        ? ((profitTrades / tradeCount) * 100).toFixed(2)
                        : '0.00';

                    entryEvent = {
                        signal:    isLong ? 'IMBA Buy' : 'IMBA Sell',
                        bullish:   isLong,
                        time:      time[i],
                        datetime:  formatTimestamp(time[i]),
                        close:     close[i],
                        stoploss:  slPrice,
                        tp1:       tp1Price, tp2: tp2Price,
                        tp3:       tp3Price, tp4: tp4Price,
                        riskReward: rr.toFixed(2),
                        beTarget:  this.breakEvenTarget,
                        fib: {
                            high: fib.highLine, fib236: fib.fib236,
                            fib382: fib.fib382, fib5: fib.fib5,
                            fib618: fib.fib618, fib786: fib.fib786,
                            low: fib.lowLine
                        },
                        rsi,
                        winRate,
                        active: {
                            entry_price: entryPrice,
                            isLong,
                            stoploss:    slPrice,
                            quantity:    100,
                            tps: [
                                { targetPrice: tp1Price, qtyPct: this.tp1SizePct, hit: false },
                                { targetPrice: tp2Price, qtyPct: this.tp2SizePct, hit: false },
                                { targetPrice: tp3Price, qtyPct: this.tp3SizePct, hit: false },
                                { targetPrice: tp4Price, qtyPct: this.tp4SizePct, hit: false },
                            ]
                        }
                    };
                    signals.push(entryEvent);
                    candleSignal  = entryEvent.signal;
                    candleBullish = isLong;
                }
            }

            const profitNow = tradeActive
                ? parseFloat(calculateProfitPercentage(tradeIsLong, entryPrice, close[i]))
                : 0;

            const winRate = tradeCount > 0
                ? parseFloat(((profitTrades / tradeCount) * 100).toFixed(2))
                : 0;

            if (!lean) candles.push({
                time:         time[i],
                datetime:     formatTimestamp(time[i]),
                open:         open[i],
                high:         high[i],
                low:          low[i],
                close:        close[i],
                volume:       volume?.[i] ?? 0,
                rsi,
                // Fib channel
                trendLine:    fib.fib5,
                highLine:     fib.highLine,
                lowLine:      fib.lowLine,
                fib236:       fib.fib236,
                fib382:       fib.fib382,
                fib618:       fib.fib618,
                fib786:       fib.fib786,
                // Trend
                isLong:       isLongTrend[i],
                isShort:      isShortTrend[i],
                // Trade info
                new_signal:   candleSignal,
                bullish:      candleBullish,
                partial_exit: partialExitEvent ? 'partial_exit' : null,
                exit_signal:  exitEvent        ? 'exit'         : null,
                stoploss:     tradeActive ? slPrice : null,
                tp1:          tradeActive ? tp1Price : null,
                tp2:          tradeActive ? tp2Price : null,
                tp3:          tradeActive ? tp3Price : null,
                tp4:          tradeActive ? tp4Price : null,
                tp1_hit:      tp1Hit, tp2_hit: tp2Hit,
                tp3_hit:      tp3Hit, tp4_hit: tp4Hit,
                canBreakEven,
                profit:       profitNow,
                remaining_qty: tradeActive ? positionSizeLeft : 0,
                // Cumulative stats
                totalProfit,
                tradeCount,
                profitTrades,
                lossTrades,
                winRate,
                winStreak,
                lossStreak,
                maxDrawdown,
                deposit
            });
        }

        // Final stats summary
        const summary = {
            totalProfit:  parseFloat(totalProfit.toFixed(2)),
            tradeCount,
            profitTrades,
            lossTrades,
            winRate:      tradeCount > 0 ? parseFloat(((profitTrades / tradeCount) * 100).toFixed(2)) : 0,
            winStreak,
            lossStreak,
            maxDrawdown:  parseFloat(maxDrawdown.toFixed(2)),
            deposit:      parseFloat(deposit.toFixed(2))
        };

        return { signals, candles, summary };
    }
}

module.exports = ImbaAlgoStrategy;
