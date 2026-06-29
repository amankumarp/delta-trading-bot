'use strict';

/**
 * RobustnessEngine.js — anti-overfitting tests.
 * scoreReport is now from lib/Scorer.js (Phase 2 — single source of truth).
 */

const BacktestEngine   = require('./Engine');
const ImbaAlgoStrategy = require('../services/strategy/ImbaAlgoStrategy');
const { scoreReport }  = require('../lib/Scorer');

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (in-place) */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function percentile(sorted, p) {
    const idx = (p / 100) * (sorted.length - 1);
    const lo  = Math.floor(idx);
    const hi  = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

function stdDev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

/**
 * Rebuild a report from a slice of processed trades using BacktestEngine.
 * We pass the pnl values directly instead of re-running the strategy.
 */
function reportFromTrades(trades, engineOpts) {
    if (!trades || trades.length === 0) return null;
    const engine = new BacktestEngine(engineOpts);
    const { report } = engine.run(trades);
    return report;
}

// ─── 1. Monte Carlo ───────────────────────────────────────────────────────────

/**
 * @param {object[]} processedTrades  – trades already processed by BacktestEngine
 * @param {object}   engineOpts       – BacktestEngine constructor options
 * @param {object}   opts
 * @param {number}   opts.simulations  – number of shuffle simulations (default 1000)
 * @param {number[]} opts.confidences  – percentile levels to report (default [5,25,50,75,95])
 */
function monteCarlo(processedTrades, engineOpts, opts = {}) {
    const N           = opts.simulations || 1000;
    const confidences = opts.confidences || [5, 10, 25, 50, 75, 90, 95];
    const dropoutRate = opts.dropoutRate || 0.0; // Probability to drop a trade (e.g. 0.05 = 5% missed trades)
    const noiseLevel  = opts.noiseLevel || 0.0;  // Max percentage penalty to apply to PnL (e.g. 0.1 = up to 10% worse execution)

    if (!processedTrades || processedTrades.length === 0) {
        return { error: 'No trades provided for Monte Carlo simulation' };
    }

    // Strip just the pnl values; we'll rebuild artificial trade arrays
    const pnls = processedTrades.map(t => t.pnl ?? 0);

    const finalBalances  = [];
    const maxDrawdowns   = [];
    const maxDrawdownPcts = [];
    const totalReturns   = [];
    const sharpeRatios   = [];
    const winRates       = [];
    const profitFactors  = [];

    const initialBalance = engineOpts.initialBalance ?? 10000;

    let baseSharpe = 0;
    if (dropoutRate === 0 && noiseLevel === 0) {
        const m = mean(pnls);
        const s = stdDev(pnls);
        baseSharpe = s !== 0 ? m / s : 0;
    }

    for (let sim = 0; sim < N; sim++) {
        // Shuffle PnL order
        const shuffled = shuffle([...pnls]);

        // Build equity curve manually (fast path — no engine overhead)
        let balance = initialBalance;
        let peak    = initialBalance;
        let maxDD   = 0;
        let grossProfit = 0, grossLoss = 0;
        let wins = 0, totalExecuted = 0;
        
        let simPnls = [];
        let computeSharpe = (dropoutRate > 0 || noiseLevel > 0);

        for (const pnl of shuffled) {
            // 1. Stress Test: Missed Trade execution (Dropout)
            if (dropoutRate > 0 && Math.random() < dropoutRate) continue;

            let adjustedPnl = pnl;
            // 2. Stress Test: Execution Noise (Slippage / Spread expansion)
            if (noiseLevel > 0) {
                // Apply a random penalty up to `noiseLevel`
                const penalty = Math.random() * noiseLevel;
                // If it's a win, we win less. If it's a loss, we lose more.
                adjustedPnl = pnl > 0 ? pnl * (1 - penalty) : pnl * (1 + penalty);
            }

            if (computeSharpe) simPnls.push(adjustedPnl);

            balance += adjustedPnl;
            if (balance > peak) peak = balance;
            const dd = peak - balance;
            if (dd > maxDD) maxDD = dd;
            if (adjustedPnl > 0) { 
                grossProfit += adjustedPnl;
                wins++;
            } else {
                grossLoss += Math.abs(adjustedPnl);
            }
            totalExecuted++;
        }

        const ddPct = peak > 0 ? (maxDD / peak) * 100 : 0;
        const totalReturn = ((balance / initialBalance) - 1) * 100;
        const winRate = totalExecuted > 0 ? (wins / totalExecuted) * 100 : 0;
        const pf = grossLoss !== 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99 : 0);

        finalBalances.push(balance);
        maxDrawdowns.push(maxDD);
        maxDrawdownPcts.push(ddPct);
        totalReturns.push(totalReturn);
        winRates.push(winRate);
        profitFactors.push(pf);

        if (computeSharpe) {
            const m = mean(simPnls);
            const s = stdDev(simPnls);
            sharpeRatios.push(s !== 0 ? m / s : 0);
        } else {
            sharpeRatios.push(baseSharpe);
        }
    }

    finalBalances.sort((a, b) => a - b);
    maxDrawdowns.sort((a, b) => a - b);
    maxDrawdownPcts.sort((a, b) => a - b);
    totalReturns.sort((a, b) => a - b);
    sharpeRatios.sort((a, b) => a - b);
    winRates.sort((a, b) => a - b);
    profitFactors.sort((a, b) => a - b);

    const ci = (arr) => {
        const result = {};
        for (const p of confidences) result[`p${p}`] = parseFloat(percentile(arr, p).toFixed(2));
        return result;
    };

    // Probability of profit (balance > initial)
    const profitProb = (finalBalances.filter(b => b > initialBalance).length / N * 100).toFixed(1);

    // Expected max drawdown (median sim)
    const expectedMDD = percentile(maxDrawdownPcts, 50).toFixed(2);

    // Ruin probability: balance drops below 20% of initial
    const ruinThreshold = initialBalance * 0.2;
    const ruinProb = (finalBalances.filter(b => b < ruinThreshold).length / N * 100).toFixed(1);

    // Advanced Stats
    const baseFinalBalance = initialBalance + pnls.reduce((s, p) => s + p, 0);
    const pProfitable = (finalBalances.filter(b => b > initialBalance).length / N * 100).toFixed(2);
    
    // Estimate Buy and Hold if ohlcv provided, else fallback
    let buyAndHoldBalance = initialBalance;
    if (opts.ohlcv && opts.ohlcv.close && opts.ohlcv.close.length > 0) {
        const firstC = opts.ohlcv.close[0];
        const lastC = opts.ohlcv.close[opts.ohlcv.close.length - 1];
        buyAndHoldBalance = initialBalance * (lastC / firstC);
    } else {
        buyAndHoldBalance = initialBalance * 1.5; // fallback
    }

    const pBeatsBuyAndHold = (finalBalances.filter(b => b > buyAndHoldBalance).length / N * 100).toFixed(2);
    const pBeatsRealized = (finalBalances.filter(b => b > baseFinalBalance).length / N * 100).toFixed(2);
    const pMaxDD30 = (maxDrawdownPcts.filter(dd => dd > 30).length / N * 100).toFixed(2);
    const pMaxDD50 = (maxDrawdownPcts.filter(dd => dd > 50).length / N * 100).toFixed(2);

    const buildDDHistogram = (arr) => {
        const bins = [
            { label: '<10%', min: -Infinity, max: 10, count: 0 },
            { label: '10-15%', min: 10, max: 15, count: 0 },
            { label: '15-20%', min: 15, max: 20, count: 0 },
            { label: '20-25%', min: 20, max: 25, count: 0 },
            { label: '25-30%', min: 25, max: 30, count: 0 },
            { label: '30-40%', min: 30, max: 40, count: 0 },
            { label: '40-50%', min: 40, max: 50, count: 0 },
            { label: '50-60%', min: 50, max: 60, count: 0 },
            { label: '>60%', min: 60, max: Infinity, count: 0 },
        ];
        for (const val of arr) {
            for (const b of bins) {
                if (val >= b.min && val < b.max) {
                    b.count++; break;
                }
            }
        }
        return bins;
    };

    const buildSharpeHistogram = (arr) => {
        const bins = [
            { label: '<0', min: -Infinity, max: 0, count: 0 },
            { label: '0-0.5', min: 0, max: 0.5, count: 0 },
            { label: '0.5-1.0', min: 0.5, max: 1.0, count: 0 },
            { label: '1.0-1.2', min: 1.0, max: 1.2, count: 0 },
            { label: '1.2-1.4', min: 1.2, max: 1.4, count: 0 },
            { label: '1.4-1.6', min: 1.4, max: 1.6, count: 0 },
            { label: '>1.6', min: 1.6, max: Infinity, count: 0 },
        ];
        for (const val of arr) {
            for (const b of bins) {
                if (val >= b.min && val < b.max) {
                    b.count++; break;
                }
            }
        }
        return bins;
    };

    const getDistStats = (arr) => {
        if (!arr.length) return null;
        return {
            mean: mean(arr),
            median: percentile(arr, 50),
            p5: percentile(arr, 5),
            p25: percentile(arr, 25),
            p75: percentile(arr, 75),
            p95: percentile(arr, 95),
            min: arr[0],
            max: arr[arr.length - 1],
        };
    };

    return {
        simulations: N,
        tradeCount:  processedTrades.length,
        profitProbabilityPct:    parseFloat(profitProb),
        ruinProbabilityPct:      parseFloat(ruinProb),
        expectedMaxDrawdownPct:  parseFloat(expectedMDD),
        finalBalance:            ci(finalBalances),
        maxDrawdownPct:          ci(maxDrawdownPcts),
        totalReturnPct:          ci(totalReturns),
        sharpeRatio:             ci(sharpeRatios),
        histogram:               buildHistogram(finalBalances, 10),
        ddHistogram:             buildDDHistogram(maxDrawdownPcts),
        sharpeHistogram:         buildSharpeHistogram(sharpeRatios),
        distributionTable: {
            netReturn: getDistStats(totalReturns),
            maxDD: getDistStats(maxDrawdownPcts),
            winRate: getDistStats(winRates),
            profitFactor: getDistStats(profitFactors),
        },
        advancedStats: {
            pProfitable,
            pBeatsBuyAndHold,
            pBeatsRealized,
            pMaxDD30,
            pMaxDD50,
        }
    };
}

function buildHistogram(sorted, bins) {
    if (!sorted.length) return [];
    const min = sorted[0], max = sorted[sorted.length - 1];
    const width = (max - min) / bins || 1;
    // O(N) single-pass — previously O(N × bins) due to Array.filter per bucket
    const counts = new Array(bins).fill(0);
    for (const v of sorted) {
        const idx = Math.min(Math.floor((v - min) / width), bins - 1);
        counts[idx]++;
    }
    return counts.map((count, i) => ({
        lo:    parseFloat((min + i * width).toFixed(2)),
        hi:    parseFloat((min + (i + 1) * width).toFixed(2)),
        count,
    }));
}

// ─── 2. In-Sample / Out-of-Sample ────────────────────────────────────────────

/**
 * Splits processedTrades chronologically by `trainPct` and runs BacktestEngine
 * on each half.  Returns IS stats, OOS stats, and an overfitting score.
 *
 * @param {object[]} processedTrades
 * @param {object}   engineOpts
 * @param {object}   opts
 * @param {number}   opts.trainPct  – fraction of trades for IS (default 0.7)
 */
function inSampleOutOfSample(processedTrades, engineOpts, opts = {}) {
    const trainPct = opts.trainPct ?? 0.7;

    if (!processedTrades || processedTrades.length < 10) {
        return { error: 'Need at least 10 trades for IS/OOS split' };
    }

    const cutIdx = Math.floor(processedTrades.length * trainPct);
    const isTrades  = processedTrades.slice(0, cutIdx);
    const oosTrades = processedTrades.slice(cutIdx);

    const isReport  = reportFromTrades(isTrades,  engineOpts);
    const oosReport = reportFromTrades(oosTrades, engineOpts);

    const isScore  = scoreReport(isReport);
    const oosScore = scoreReport(oosReport);

    // Overfitting ratio: how much of IS performance survives OOS
    let overfitRatio = null;
    let overfitVerdict = 'insufficient_data';
    if (isScore !== null && oosScore !== null && isScore > 0) {
        overfitRatio = parseFloat((oosScore / isScore).toFixed(3));
        if (overfitRatio >= 0.8)       overfitVerdict = 'robust';
        else if (overfitRatio >= 0.5)  overfitVerdict = 'moderate_degradation';
        else                           overfitVerdict = 'likely_overfit';
    }

    // Performance degradation %
    const perfDegradationPct = (isScore && oosScore !== null)
        ? parseFloat(((isScore - oosScore) / Math.abs(isScore) * 100).toFixed(1))
        : null;

    return {
        split: { trainPct: parseFloat((trainPct * 100).toFixed(0)) + '%', testPct: parseFloat(((1 - trainPct) * 100).toFixed(0)) + '%' },
        inSample: {
            tradeCount: isTrades.length,
            score: isScore !== null ? parseFloat(isScore.toFixed(3)) : null,
            ...summariseReport(isReport)
        },
        outOfSample: {
            tradeCount: oosTrades.length,
            score: oosScore !== null ? parseFloat(oosScore.toFixed(3)) : null,
            ...summariseReport(oosReport)
        },
        overfitRatio,
        performanceDegradationPct: perfDegradationPct,
        verdict: overfitVerdict,
    };
}

function summariseReport(report) {
    if (!report) return {};
    return {
        winRate:           report.winRate,
        profitFactor:      report.profitFactor,
        sharpeRatio:       report.sharpeRatio,
        maxDrawdownPct:    report.maxDrawdownPercent,
        totalReturn:       report.totalReturn,
        totalProfit:       report.totalProfit,
        expectancy:        report.expectancy,
        recoveryFactor:    report.recoveryFactor,
    };
}

// ─── 3. Walk-Forward Test ─────────────────────────────────────────────────────

/**
 * Divides trades into `windows` equal chronological blocks.
 * Within each block, the first `trainPct` fraction is IS, the rest OOS.
 *
 * @param {object[]} processedTrades
 * @param {object}   engineOpts
 * @param {object}   opts
 * @param {number}   opts.windows   – number of walk-forward windows (default 5)
 * @param {number}   opts.trainPct  – IS fraction within each window (default 0.7)
 */
function walkForward(processedTrades, engineOpts, opts = {}) {
    const windows  = opts.windows  ?? 5;
    const trainPct = opts.trainPct ?? 0.7;

    if (!processedTrades || processedTrades.length < windows * 5) {
        return { error: `Need at least ${windows * 5} trades for walk-forward with ${windows} windows` };
    }

    const windowSize = Math.floor(processedTrades.length / windows);
    const windowResults = [];
    const allOosTrades  = [];

    for (let w = 0; w < windows; w++) {
        const start   = w * windowSize;
        const end     = w === windows - 1 ? processedTrades.length : start + windowSize;
        const block   = processedTrades.slice(start, end);
        const cutIdx  = Math.floor(block.length * trainPct);

        const isTrades  = block.slice(0, cutIdx);
        const oosTrades = block.slice(cutIdx);

        const isReport  = reportFromTrades(isTrades,  engineOpts);
        const oosReport = reportFromTrades(oosTrades, engineOpts);

        allOosTrades.push(...oosTrades);

        const isScore  = scoreReport(isReport);
        const oosScore = scoreReport(oosReport);

        windowResults.push({
            window:     w + 1,
            startIdx:   start,
            endIdx:     end,
            isTrades:   isTrades.length,
            oosTrades:  oosTrades.length,
            isScore:    isScore  !== null ? parseFloat(isScore.toFixed(3))  : null,
            oosScore:   oosScore !== null ? parseFloat(oosScore.toFixed(3)) : null,
            overfitRatio: (isScore && oosScore !== null && isScore > 0)
                ? parseFloat((oosScore / isScore).toFixed(3))
                : null,
            inSample:    summariseReport(isReport),
            outOfSample: summariseReport(oosReport),
        });
    }

    // Aggregate OOS report (all OOS segments combined)
    const aggregateOosReport = reportFromTrades(allOosTrades, engineOpts);
    const avgOvfRatio = mean(
        windowResults.map(w => w.overfitRatio).filter(r => r !== null)
    );

    return {
        windows,
        trainPct: parseFloat((trainPct * 100).toFixed(0)) + '%',
        windowResults,
        aggregateOos: {
            tradeCount: allOosTrades.length,
            score: parseFloat((scoreReport(aggregateOosReport) ?? 0).toFixed(3)),
            ...summariseReport(aggregateOosReport),
        },
        avgOverfitRatio: parseFloat(avgOvfRatio.toFixed(3)),
        verdict: avgOvfRatio >= 0.8 ? 'robust'
               : avgOvfRatio >= 0.5 ? 'moderate_degradation'
               : 'likely_overfit',
    };
}

// ─── 4. Parameter Sensitivity Analysis ───────────────────────────────────────

/**
 * Takes the best parameter set and nudges each param ±step%, running a
 * backtest each time to measure score sensitivity.
 *
 * @param {object}   bestParams    – the winning parameter object from optimizer
 * @param {object}   ohlcv         – { open, high, low, close, time, volume }
 * @param {object}   engineOpts
 * @param {object}   opts
 * @param {number}   opts.step     – fractional nudge (default 0.1 = ±10%)
 * @param {Function} opts.buildTrades – fn(candles) → trades array
 */
function parameterSensitivity(bestParams, ohlcv, engineOpts, opts = {}) {
    const step = opts.step ?? 0.1;
    const buildTrades = opts.buildTrades; // required
    const strategyName = opts.strategyName || 'imba-algo';

    if (!buildTrades || typeof buildTrades !== 'function') {
        return { error: 'opts.buildTrades is required' };
    }

    const StrategyRegistry = require('../services/strategy/StrategyRegistry');
    const entry = StrategyRegistry.get(strategyName);
    if (!entry) return { error: `Unknown strategy: ${strategyName}` };

    const runStrategyLocal = (StratCls, params, feedOhlcv) => {
        try {
            const strategy = new StratCls(params);
            const { candles, signals } = strategy.generateSignals(feedOhlcv, { lean: true });
            let trades = [];
            if (signals && signals.length > 0) {
                let currentTrade = null;
                let partialProfitSum = 0;
                for (let j = 0; j < signals.length; j++) {
                    const s = signals[j];
                    if (s.signal === 'entry' || (typeof s.signal === 'string' && (s.signal.includes('Buy') || s.signal.includes('Sell')))) {
                        currentTrade = { isLong: s.isLong !== undefined ? s.isLong : s.bullish, entry_time: s.datetime || String(s.time), entry_price: s.price || s.close, stoploss: s.stoploss, losspoint: 0, _done: false };
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
            } else {
                trades = buildTrades(candles);
            }
            return reportFromTrades(trades, engineOpts);
        } catch (_) {
            return null;
        }
    };

    let feedOhlcv = ohlcv;
    if (entry.useHeikinAshi) {
        const HeikinAshi = require("../lib/HeikinAshi");
        feedOhlcv = HeikinAshi.transform(ohlcv);
    }

    // Baseline score
    const baseReport = runStrategyLocal(entry.Cls, bestParams, feedOhlcv);
    const baseScore  = baseReport ? scoreReport(baseReport) : null;

    if (baseScore === null) return { error: 'Baseline run produced no valid score' };

    const numericKeys = Object.keys(bestParams).filter(k => typeof bestParams[k] === 'number');
    const sensitivity = [];

    for (const key of numericKeys) {
        const orig  = bestParams[key];
        const delta = Math.abs(orig) * step || step; // handle zero-value params

        const upParams   = { ...bestParams, [key]: orig + delta };
        const downParams = { ...bestParams, [key]: orig - delta };

        const upReport = runStrategyLocal(entry.Cls, upParams, feedOhlcv);
        const dnReport = runStrategyLocal(entry.Cls, downParams, feedOhlcv);
        
        const upScore = upReport ? scoreReport(upReport) : null;
        const downScore = dnReport ? scoreReport(dnReport) : null;

        const avgNudge = mean(
            [upScore, downScore].filter(s => s !== null && !isNaN(s))
        );
        const scoreDrop = baseScore - avgNudge;
        const sensitivity_pct = baseScore !== 0
            ? parseFloat((scoreDrop / Math.abs(baseScore) * 100).toFixed(1))
            : null;

        sensitivity.push({
            param:          key,
            baseline:       parseFloat(orig.toFixed(4)),
            up:             parseFloat((orig + delta).toFixed(4)),
            down:           parseFloat(Math.max(0, orig - delta).toFixed(4)),
            scoreBaseline:  parseFloat(baseScore.toFixed(3)),
            scoreUp:        upScore   !== null ? parseFloat(upScore.toFixed(3))   : null,
            scoreDown:      downScore !== null ? parseFloat(downScore.toFixed(3)) : null,
            scoreDrop:      parseFloat(scoreDrop.toFixed(3)),
            sensitivityPct: sensitivity_pct,
        });
    }

    // Sort by most sensitive first
    sensitivity.sort((a, b) => Math.abs(b.sensitivityPct ?? 0) - Math.abs(a.sensitivityPct ?? 0));

    const highSensitivity = sensitivity.filter(s => Math.abs(s.sensitivityPct ?? 0) > 20);

    return {
        baselineScore: parseFloat(baseScore.toFixed(3)),
        stepSize:      step,
        params:        sensitivity,
        highSensitivityParams: highSensitivity.map(s => s.param),
        robustnessVerdict: highSensitivity.length === 0 ? 'robust'
                         : highSensitivity.length <= 2  ? 'moderate'
                         : 'fragile',
    };
}

// ─── 5. Full Robustness Report ────────────────────────────────────────────────

/**
 * Convenience wrapper that runs all four tests and returns a unified report.
 *
 * @param {object[]} processedTrades – output of BacktestEngine.run(trades).trades
 * @param {object}   engineOpts
 * @param {object}   opts
 * @param {number}   opts.mcSimulations   (default 1000)
 * @param {number}   opts.wfWindows       (default 5)
 * @param {number}   opts.trainPct        (default 0.7)
 * @param {object}   opts.bestParams      – for sensitivity test (optional)
 * @param {object}   opts.ohlcv           – for sensitivity test (optional)
 * @param {Function} opts.buildTrades     – for sensitivity test (optional)
 */
function fullRobustnessReport(processedTrades, engineOpts, opts = {}) {
    const mc  = monteCarlo(processedTrades, engineOpts, { simulations: opts.mcSimulations ?? 1000, ohlcv: opts.ohlcv });
    const iso = inSampleOutOfSample(processedTrades, engineOpts, { trainPct: opts.trainPct ?? 0.7 });
    const wf  = walkForward(processedTrades, engineOpts, { windows: opts.wfWindows ?? 5, trainPct: opts.trainPct ?? 0.7 });

    let sensitivity = null;
    if (opts.bestParams && opts.ohlcv && opts.buildTrades) {
        sensitivity = parameterSensitivity(opts.bestParams, opts.ohlcv, engineOpts, { 
            buildTrades: opts.buildTrades,
            strategyName: opts.strategyName || 'imba-algo'
        });
    }

    // Aggregate verdict
    const verdicts = [iso.verdict, wf.verdict, sensitivity?.robustnessVerdict].filter(Boolean);
    const robustCount = verdicts.filter(v => v === 'robust').length;
    const overallVerdict = robustCount === verdicts.length ? 'robust'
        : robustCount >= verdicts.length / 2 ? 'mixed'
        : 'likely_overfit';

    return {
        overall: {
            verdict: overallVerdict,
            profitProbabilityPct: mc.profitProbabilityPct,
            ruinProbabilityPct:   mc.ruinProbabilityPct,
            overfitRatio:         iso.overfitRatio,
            avgWalkForwardRatio:  wf.avgOverfitRatio,
        },
        monteCarlo:           mc,
        inSampleOutOfSample:  iso,
        walkForward:          wf,
        parameterSensitivity: sensitivity,
    };
}

module.exports = {
    monteCarlo,
    inSampleOutOfSample,
    walkForward,
    parameterSensitivity,
    fullRobustnessReport,
    // expose helpers for worker usage
    reportFromTrades,
    scoreReport,
    summariseReport,
};
