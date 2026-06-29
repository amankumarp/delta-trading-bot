/**
 * Optimizer.js — In-process grid-search optimizer for ImbaAlgo strategy.
 *
 * Design goals:
 *  - Fetch candles ONCE, then sweep all param combinations in memory.
 *  - Score each run with a composite fitness function.
 *  - Optionally run parameter groups in parallel using worker_threads.
 *  - Return top-N results ranked by score.
 */

'use strict';

const path = require('path');
const ImbaAlgoStrategy = require(path.join(__dirname, '../services/strategy/ImbaAlgoStrategy'));
const BacktestEngine   = require('./Engine');

// Phase 2 — import shared canonical implementations
const { buildTradeList } = require(path.join(__dirname, '../lib/TradeBuilder'));
const { computeScore }   = require(path.join(__dirname, '../lib/Scorer'));

// ─── Helpers (now from shared lib — see lib/TradeBuilder.js and lib/Scorer.js)
// buildTradeList and computeScore are imported above.


// ─── Parameter Space Definitions ─────────────────────────────────────────────

/**
 * ULTRA-FAST space — ~50 valid combinations, finishes instantly.
 * Use mode=ultra-fast for the quickest baseline.
 */
const ULTRA_FAST_SPACE = {
    sensitivity:     [15, 20, 25],
    tp1Pct:          [1.0, 1.5],
    tp2Pct:          [2.5, 3.0],
    tp3Pct:          [4.5],
    tp4Pct:          [7.0],
    tp1SizePct:      [40],
    tp2SizePct:      [30],
    tp3SizePct:      [20],
    breakEvenTarget: ['1', '2'],
    slPercent:       [0, 0.5]
};

/**
 * FAST space — ~300 valid combinations, typically finishes in 5-15 s.
 * Use mode=fast (default) for interactive use.
 */
const FAST_SPACE = {
    sensitivity:     [10, 15, 20, 25, 30],
    tp1Pct:          [0.5, 1.0, 1.5],
    tp2Pct:          [2.0, 2.5, 3.0],
    tp3Pct:          [3.5, 4.5],
    tp4Pct:          [5.0, 7.0],
    tp1SizePct:      [30, 40, 50],
    tp2SizePct:      [20, 30],
    tp3SizePct:      [15, 20],
    breakEvenTarget: ['1', '2'],
    slPercent:       [0, 0.5]
};

/**
 * FULL space — ~5 000+ valid combinations for deep search (30-120 s).
 * Use mode=full when you have time to burn.
 */
const FULL_SPACE = {
    sensitivity:     [3, 5, 8, 10, 12, 15, 18, 20, 25, 30],
    tp1Pct:          [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
    tp2Pct:          [1.0, 1.5, 2.0, 2.5, 3.0, 3.5,4.0],
    tp3Pct:          [2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 7.0],
    tp4Pct:          [4.0, 5.0, 6.0, 7.0, 8.0, 10.0],
    tp1SizePct:      [25, 30, 40, 50],
    tp2SizePct:      [20, 25, 30],
    tp3SizePct:      [10, 15, 20],
    breakEvenTarget: ['1', '2', '3'],
    slPercent:       [0, 0.25, 0.5, 1.0]
};

const DEFAULT_SPACE = FAST_SPACE;

/** Cartesian product of an object of arrays → array of param objects */
function cartesian(space) {
    const keys = Object.keys(space);
    let result = [{}];
    for (const key of keys) {
        const newResult = [];
        for (const obj of result) {
            for (const val of space[key]) {
                newResult.push({ ...obj, [key]: val });
            }
        }
        result = newResult;
    }
    return result;
}

/** Ensure TP pcts are strictly ascending and size pcts sum ≤ 100 */
function isValidParams(p) {
    if (p.tp1Pct >= p.tp2Pct) return false;
    if (p.tp2Pct >= p.tp3Pct) return false;
    if (p.tp3Pct >= p.tp4Pct) return false;
    const usedPct = (p.tp1SizePct || 40) + (p.tp2SizePct || 30) + (p.tp3SizePct || 20);
    if (usedPct > 100) return false;
    return true;
}

// ─── Main Optimizer Class ─────────────────────────────────────────────────────

class Optimizer {
    /**
     * @param {object} opts
     * @param {number}  opts.initialBalance
     * @param {number}  opts.leverage
     * @param {number}  opts.fee
     * @param {number}  opts.riskPercentPerTrade
     * @param {number}  opts.topN              – how many top results to return (default 10)
     * @param {number}  opts.minTrades         – minimum trade count to consider a result valid (default 3)
     * @param {string}  opts.mode              – 'fast' (default) | 'full' search space
     * @param {object}  opts.fixedParams       – params that should NOT be varied (passed through to every run)
     * @param {object}  opts.paramSpace        – override / narrow the search space
     * @param {boolean} opts.verbose           – log progress to console
     */
    constructor(opts = {}) {
        this.initialBalance    = opts.initialBalance    ?? 1000;
        this.leverage          = opts.leverage          ?? 50;
        this.fee               = opts.fee               ?? 0.00;
        this.riskPercentPerTrade = opts.riskPercentPerTrade ?? 1;
        this.topN              = opts.topN              ?? 10;
        this.minTrades         = opts.minTrades         ?? 3;
        this.fixedParams       = opts.fixedParams       ?? {};
        this.verbose           = opts.verbose           ?? true;
        this.mode              = opts.mode              ?? 'fast';
        this.onProgress        = opts.onProgress        || null;

        // Build search space — override defaults with caller's narrower space
        let base = FAST_SPACE;
        if (this.mode === 'full') base = FULL_SPACE;
        else if (this.mode === 'ultra-fast' || this.mode === '50') base = ULTRA_FAST_SPACE;
        
        this.paramSpace = { ...base, ...(opts.paramSpace || {}) };
    }

    /**
     * Run the optimisation sweep.
     *
     * @param {object} ohlcv – { open, high, low, close, time, volume } arrays
     * @returns {{ results: Array, best: object, totalRuns: number, validRuns: number }}
     */
    run(ohlcv) {
        const allCombinations = cartesian(this.paramSpace)
            .filter(isValidParams)
            .map(p => ({
                ...p,
                // Derive tp4SizePct so all sizes sum to 100
                tp4SizePct: 100 - (p.tp1SizePct || 40) - (p.tp2SizePct || 30) - (p.tp3SizePct || 20),
                // Merge fixed overrides
                ...this.fixedParams,
                // Always keep riskPercent = 1 for fair comparison across runs
                riskPercent: this.fixedParams.riskPercent ?? 1,
            }));

        if (this.verbose) {
            console.log(`[Optimizer] Total combinations to test: ${allCombinations.length}`);
        }

        const engineOpts = {
            initialBalance:    this.initialBalance,
            leverage:          this.leverage,
            fee:               this.fee,
            riskPercentPerTrade: this.riskPercentPerTrade
        };

        let validRuns = 0;
        const scored = [];

        for (let i = 0; i < allCombinations.length; i++) {
            const params = allCombinations[i];

            try {
                // Run strategy in lean mode
                const strategy = new ImbaAlgoStrategy(params);
                const { signals } = strategy.generateSignals(ohlcv, { lean: true });

                // Build trades efficiently from events
                const trades = [];
                let currentTrade = null;
                let partialProfitSum = 0;

                for (let j = 0; j < signals.length; j++) {
                    const s = signals[j];
                    if (s.signal === 'entry' || (typeof s.signal === 'string' && (s.signal.includes('Buy') || s.signal.includes('Sell')))) {
                        currentTrade = {
                            isLong: s.isLong !== undefined ? s.isLong : s.bullish,
                            entry_time: s.datetime || String(s.time),
                            entry_price: s.price || s.close,
                            stoploss: s.stoploss,
                            losspoint: 0,
                            _done: false
                        };
                        partialProfitSum = 0;
                    } else if (s.signal === 'partial_exit' && currentTrade) {
                        partialProfitSum += s.profit_pct || 0;
                    } else if (s.signal === 'exit' && currentTrade) {
                        partialProfitSum += s.profit_pct || 0;
                        currentTrade.exit_time = s.datetime || String(s.time);
                        currentTrade.exit_price = s.price;
                        currentTrade.avg_profit = partialProfitSum.toFixed(2);
                        currentTrade.exit_reason = s.reason;
                        trades.push(currentTrade);
                        currentTrade = null;
                    }
                }

                if (!trades.length) continue;

                // Run backtest engine
                const engine = new BacktestEngine(engineOpts);
                const { report } = engine.run(trades);

                const score = computeScore(report, this.minTrades);
                if (score === -Infinity) continue;

                validRuns++;
                scored.push({ params, report, score });

            } catch (err) {
                // Silent — some param combos may cause edge cases
                if (this.verbose) console.warn(`[Optimizer] run ${i} failed: ${err.message}`);
            }

            // Progress logging every 100 runs
            if (i % 100 === 0 && i > 0) {
                if (this.verbose) console.log(`[Optimizer] Progress: ${i}/${allCombinations.length} (valid so far: ${validRuns})`);
                if (this.onProgress) this.onProgress({ current: i, total: allCombinations.length, valid: validRuns });
            }
        }

        // Send final progress before sorting
        if (this.onProgress) this.onProgress({ current: allCombinations.length, total: allCombinations.length, valid: validRuns });

        // Sort descending by score
        scored.sort((a, b) => b.score - a.score);

        const topResults = scored.slice(0, this.topN).map((r, rank) => ({
            rank:        rank + 1,
            score:       parseFloat(r.score.toFixed(4)),
            params:      r.params,
            performance: {
                totalTrades:      r.report.totalTrades,
                winRate:          r.report.winRate,
                profitFactor:     r.report.profitFactor,
                sharpeRatio:      r.report.sharpeRatio,
                sortinoRatio:     r.report.sortinoRatio,
                expectancy:       r.report.expectancy,
                totalProfit:      r.report.totalProfit,
                maxDrawdown:      r.report.maxDrawdown,
                maxDrawdownPercent: r.report.maxDrawdownPercent,
                recoveryFactor:   r.report.recoveryFactor,
                finalBalance:     r.report.finalBalance,
                totalReturn:      r.report.totalReturn,
                maxWinStreak:     r.report.maxWinStreak,
                maxLossStreak:    r.report.maxLossStreak,
                totalFees:        r.report.totalFees,
            }
        }));

        return {
            totalRuns:  allCombinations.length,
            validRuns,
            best:       topResults[0] || null,
            results:    topResults,
        };
    }

    /**
     * Static factory — convenience for worker-entry.js.
     *
     * @param {object} ohlcv       – { open, high, low, close, time, volume }
     * @param {object} engineOpts  – BacktestEngine constructor options
     * @param {object} workerOpts  – { mode, topN, minTrades, verbose, fixedParams, paramSpace }
     * @returns same shape as instance .run()
     */
    static runGrid(ohlcv, engineOpts = {}, workerOpts = {}) {
        const opt = new Optimizer({ ...engineOpts, ...workerOpts });
        return opt.run(ohlcv);
    }
}

module.exports = Optimizer;
