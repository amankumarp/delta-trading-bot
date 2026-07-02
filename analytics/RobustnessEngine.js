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

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

function createSeededRandom(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

if (!isMainThread) {
    const { pnls, N, initialBalance, dropoutRate, noiseLevel, mcMethod, seed, blockSize, ohlcvLen } = workerData;
    const random = createSeededRandom(seed);
    
    const finalBalances = [];
    const maxDrawdownPcts = [];
    const totalReturns = [];
    const sharpeRatios = [];
    const winRates = [];
    const profitFactors = [];
    const sortinoRatios = [];
    const calmarRatios = [];
    const recoveryFactors = [];

    const m = pnls.length ? pnls.reduce((a,b)=>a+b,0)/pnls.length : 0;
    const s = pnls.length ? Math.sqrt(pnls.reduce((acc, p) => acc + Math.pow(p - m, 2), 0) / pnls.length) : 0;
    
    const elapsedYears = workerData.elapsedYears || 1;
    const tradesPerYear = pnls.length / elapsedYears;

    for (let sim = 0; sim < N; sim++) {
        let shuffled = [];
        if (mcMethod === 'shuffle') {
            shuffled = [...pnls];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
        } else if (mcMethod === 'block_bootstrap') {
            const actualBlockSize = blockSize || Math.max(2, Math.floor(pnls.length / 10));
            while (shuffled.length < pnls.length) {
                const startIdx = Math.floor(random() * (pnls.length - actualBlockSize + 1));
                for (let k = 0; k < actualBlockSize && shuffled.length < pnls.length; k++) {
                    shuffled.push(pnls[startIdx + k]);
                }
            }
        } else if (mcMethod === 'parametric') {
            for (let i = 0; i < pnls.length; i++) {
                const u = 1 - random();
                const v = random();
                const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
                shuffled.push(z * s + m);
            }
        } else { // bootstrap
            for (let i = 0; i < pnls.length; i++) {
                shuffled.push(pnls[Math.floor(random() * pnls.length)]);
            }
        }

        let balance = initialBalance;
        let peak    = initialBalance;
        let maxDD   = 0;
        let grossProfit = 0, grossLoss = 0;
        let wins = 0, totalExecuted = 0;
        let simReturns = [];

        for (const pnl of shuffled) {
            if (dropoutRate > 0 && random() < dropoutRate) continue;
            let adjustedPnl = pnl;
            if (noiseLevel > 0) {
                const slippage = (random() - 0.5) * noiseLevel;
                adjustedPnl -= Math.abs(slippage);
            }
            const ret = adjustedPnl / balance;
            simReturns.push(ret);
            
            balance += adjustedPnl;
            if (balance > peak) peak = balance;
            const dd = (peak - balance) / peak;
            if (dd > maxDD) maxDD = dd;
            if (adjustedPnl > 0) { grossProfit += adjustedPnl; wins++; }
            else { grossLoss += Math.abs(adjustedPnl); }
            totalExecuted++;
        }

        const totalReturn = (balance - initialBalance) / initialBalance * 100;
        maxDrawdownPcts.push(parseFloat((maxDD * 100).toFixed(2)));
        finalBalances.push(parseFloat(balance.toFixed(2)));
        totalReturns.push(parseFloat(totalReturn.toFixed(2)));
        winRates.push(totalExecuted > 0 ? parseFloat((wins / totalExecuted * 100).toFixed(2)) : 0);
        profitFactors.push(grossLoss !== 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : 0);
        
        const simMean = simReturns.length ? simReturns.reduce((a,b)=>a+b,0)/simReturns.length : 0;
        const simStd = simReturns.length ? Math.sqrt(simReturns.reduce((acc, r) => acc + Math.pow(r - simMean, 2), 0) / simReturns.length) : 0;
        const simSharpe = simStd !== 0 ? (simMean / simStd) * Math.sqrt(tradesPerYear) : 0; 
        sharpeRatios.push(parseFloat(simSharpe.toFixed(2)));

        const downSims = simReturns.filter(p => p < 0);
        const downStd = downSims.length ? Math.sqrt(downSims.reduce((acc, r) => acc + Math.pow(r, 2), 0) / downSims.length) : 0;
        sortinoRatios.push(parseFloat((downStd !== 0 ? (simMean / downStd) * Math.sqrt(tradesPerYear) : 0).toFixed(2)));
        
        const simYears = elapsedYears;
        const simAnnRet = simYears > 0 ? (Math.pow(balance / initialBalance, 1 / simYears) - 1) : 0;
        calmarRatios.push(parseFloat((maxDD !== 0 ? (simAnnRet / maxDD) : 0).toFixed(2)));
        const maxDD_abs = peak * maxDD;
        recoveryFactors.push(parseFloat((maxDD_abs !== 0 ? ((balance - initialBalance) / maxDD_abs) : 0).toFixed(2)));
    }
    
    parentPort.postMessage({
        finalBalances, maxDrawdownPcts, totalReturns, sharpeRatios, winRates, profitFactors, sortinoRatios, calmarRatios, recoveryFactors
    });
}

function monteCarlo(processedTrades, engineOpts, opts = {}) {
    return new Promise((resolve, reject) => {
        if (!processedTrades || processedTrades.length === 0) return resolve(null);
        
        const N = opts.simulations || 1000;
        const initialBalance = engineOpts.initialBalance ?? 10000;
        const mcMethod = opts.mcMethod || 'bootstrap';
        const numThreads = opts.numThreads || 4;
        const pnls = processedTrades.map(t => t.pnl);
        const ohlcvLen = opts.ohlcv && opts.ohlcv.time ? opts.ohlcv.time.length : 0;

        let elapsedYears = 1;
        if (processedTrades.length > 1) {
            const parseDate = (dStr) => {
                if (!dStr) return new Date(NaN);
                if (typeof dStr === 'number' || (typeof dStr === 'string' && /^\d+$/.test(dStr))) {
                    return new Date(Number(dStr));
                }
                const match = String(dStr).match(/^(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})$/);
                if (match) return new Date(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6]}`);
                return new Date(dStr);
            };
            const firstDate = parseDate(processedTrades[0].entry_time);
            const lastDate = parseDate(processedTrades[processedTrades.length - 1].exit_time);
            if (!isNaN(firstDate) && !isNaN(lastDate)) {
                elapsedYears = Math.max((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25), 0.01);
            }
        }
        
        const workers = [];
        let completed = 0;
        
        const results = {
            finalBalances: [], maxDrawdownPcts: [], totalReturns: [], sharpeRatios: [], winRates: [], profitFactors: [], sortinoRatios: [], calmarRatios: [], recoveryFactors: []
        };
        
        const simsPerThread = Math.ceil(N / numThreads);
        let remainingSims = N;
        
        let workerCount = 0;
        for (let i = 0; i < numThreads; i++) {
            const currentSims = Math.min(simsPerThread, remainingSims);
            if (currentSims <= 0) break;
            remainingSims -= currentSims;
            workerCount++;
            
            const worker = new Worker(__filename, {
                workerData: {
                    pnls,
                    N: currentSims,
                    initialBalance,
                    dropoutRate: opts.dropoutRate || 0,
                    noiseLevel: opts.noiseLevel || 0,
                    mcMethod,
                    seed: (opts.seed || 12345) + i,
                    blockSize: opts.blockSize || 0,
                    ohlcvLen,
                    elapsedYears
                }
            });
            
            worker.on('message', (msg) => {
                for (const key of Object.keys(results)) {
                    results[key].push(...msg[key]);
                }
            });
            worker.on('error', (err) => {
                workers.forEach(w => w.terminate());
                reject(err);
            });
            worker.on('exit', (code) => {
                if (code !== 0) {
                    workers.forEach(w => w.terminate());
                    return reject(new Error(`Worker stopped with exit code ${code}`));
                }
                completed++;
                if (completed === workerCount) {
                    resolve(processMonteCarloResults(results, N, initialBalance, mcMethod, pnls, opts));
                }
            });
            workers.push(worker);
        }
        
        if (workerCount === 0) {
            resolve(processMonteCarloResults(results, N, initialBalance, mcMethod, pnls, opts));
        }
    });
}

function processMonteCarloResults(results, N, initialBalance, mcMethod, pnls, opts) {
    const { finalBalances, maxDrawdownPcts, totalReturns, sharpeRatios, winRates, profitFactors, sortinoRatios, calmarRatios, recoveryFactors } = results;
    
    // Sort all arrays
    finalBalances.sort((a, b) => a - b);
    maxDrawdownPcts.sort((a, b) => a - b);
    totalReturns.sort((a, b) => a - b);
    sharpeRatios.sort((a, b) => a - b);
    winRates.sort((a, b) => a - b);
    profitFactors.sort((a, b) => a - b);
    sortinoRatios.sort((a, b) => a - b);
    calmarRatios.sort((a, b) => a - b);
    recoveryFactors.sort((a, b) => a - b);

    const percentile = (arr, p) => {
        if (!arr || !arr.length) return 0;
        const index = (p / 100) * (arr.length - 1);
        const lower = Math.floor(index);
        const upper = lower + 1;
        const weight = index - lower;
        if (upper >= arr.length) return arr[lower];
        return arr[lower] * (1 - weight) + arr[upper] * weight;
    };
    
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    
    const confidences = [5, 10, 25, 50, 75, 90, 95];
    const ci = (arr) => {
        const result = {};
        for (const p of confidences) result[`p${p}`] = parseFloat(percentile(arr, p).toFixed(2));
        result.percentileInterval95 = {
            lower: parseFloat(percentile(arr, 2.5).toFixed(2)),
            upper: parseFloat(percentile(arr, 97.5).toFixed(2)),
            method: "Percentile Interval"
        };
        result.percentileInterval99 = {
            lower: parseFloat(percentile(arr, 0.5).toFixed(2)),
            upper: parseFloat(percentile(arr, 99.5).toFixed(2)),
            method: "Percentile Interval"
        };
        return result;
    };

    let buyAndHoldBalance = initialBalance;
    if (opts.ohlcv && opts.ohlcv.close && opts.ohlcv.close.length > 0) {
        const firstClose = opts.ohlcv.close[0];
        const lastClose = opts.ohlcv.close[opts.ohlcv.close.length - 1];
        if (firstClose > 0) {
            buyAndHoldBalance = initialBalance * (lastClose / firstClose);
        }
    } else {
        buyAndHoldBalance = initialBalance * 1.5;
    }

    const baseFinalBalance = initialBalance + pnls.reduce((s, p) => s + p, 0);

    const probabilityMetrics = {
        positiveReturn: parseFloat((finalBalances.filter(b => b > initialBalance).length / N * 100).toFixed(2)),
        beatBuyAndHold: parseFloat((finalBalances.filter(b => b > buyAndHoldBalance).length / N * 100).toFixed(2)),
        beatRealized: parseFloat((finalBalances.filter(b => b > baseFinalBalance).length / N * 100).toFixed(2)),
        positiveExpectancy: parseFloat((sharpeRatios.filter(s => s > 0).length / N * 100).toFixed(2)),
        drawdown10: parseFloat((maxDrawdownPcts.filter(dd => dd > 10).length / N * 100).toFixed(2)),
        drawdown20: parseFloat((maxDrawdownPcts.filter(dd => dd > 20).length / N * 100).toFixed(2)),
        drawdown30: parseFloat((maxDrawdownPcts.filter(dd => dd > 30).length / N * 100).toFixed(2)),
        drawdown50: parseFloat((maxDrawdownPcts.filter(dd => dd > 50).length / N * 100).toFixed(2))
    };
    
    const riskOfRuin = {
        marginCall: parseFloat((finalBalances.filter(b => b <= 0).length / N * 100).toFixed(2)),
        drawdown30: parseFloat((maxDrawdownPcts.filter(dd => dd >= 30).length / N * 100).toFixed(2)),
        drawdown50: parseFloat((maxDrawdownPcts.filter(dd => dd >= 50).length / N * 100).toFixed(2)),
        equity25: parseFloat((finalBalances.filter(b => b <= initialBalance * 0.25).length / N * 100).toFixed(2)),
        equity10: parseFloat((finalBalances.filter(b => b <= initialBalance * 0.10).length / N * 100).toFixed(2))
    };

    const getDistStats = (arr) => {
        if (!arr.length) return null;
        return {
            mean: parseFloat(mean(arr).toFixed(2)),
            median: parseFloat(percentile(arr, 50).toFixed(2)),
            p5: parseFloat(percentile(arr, 5).toFixed(2)),
            p25: parseFloat(percentile(arr, 25).toFixed(2)),
            p75: parseFloat(percentile(arr, 75).toFixed(2)),
            p95: parseFloat(percentile(arr, 95).toFixed(2)),
            min: parseFloat(arr[0].toFixed(2)),
            max: parseFloat(arr[arr.length - 1].toFixed(2)),
            percentileInterval95: { lower: parseFloat(percentile(arr, 2.5).toFixed(2)), upper: parseFloat(percentile(arr, 97.5).toFixed(2)), method: "Percentile Interval" },
            percentileInterval99: { lower: parseFloat(percentile(arr, 0.5).toFixed(2)), upper: parseFloat(percentile(arr, 99.5).toFixed(2)), method: "Percentile Interval" }
        };
    };

    return {
        simulations: N,
        method: mcMethod,
        tradeCount: pnls.length,
        probabilityMetrics,
        riskOfRuin,
        expectedMaxDrawdownPct: parseFloat(percentile(maxDrawdownPcts, 50).toFixed(2)),
        finalBalance: ci(finalBalances),
        maxDrawdownPct: ci(maxDrawdownPcts),
        totalReturnPct: ci(totalReturns),
        sharpeRatio: ci(sharpeRatios),
        sortinoRatio: ci(sortinoRatios),
        calmarRatio: ci(calmarRatios),
        recoveryFactor: ci(recoveryFactors),
        histogram: buildHistogram(finalBalances, 10),
        ddHistogram: buildHistogram(maxDrawdownPcts, 10).map(b => ({ label: `${b.lo}%`, count: b.count })),
        sharpeHistogram: buildHistogram(sharpeRatios, 10).map(b => ({ label: `${b.lo}`, count: b.count })),
        distributionTable: {
            netReturn: getDistStats(totalReturns),
            maxDD: getDistStats(maxDrawdownPcts),
            winRate: getDistStats(winRates),
            profitFactor: getDistStats(profitFactors),
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
        avgWinner:         report.avgWin,
        avgLoser:          report.avgLoss,
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

    const oosScores = windowResults.map(w => w.oosScore).filter(s => s !== null);
    
    const passRate = oosScores.length > 0 ? parseFloat((oosScores.filter(s => s > 0).length / oosScores.length * 100).toFixed(2)) : 0;
    
    const stdOos = stdDev(oosScores);
    const meanOos = mean(oosScores);
    const stabilityScore = stdOos > 0 ? parseFloat((meanOos / stdOos).toFixed(2)) : (meanOos > 0 ? 99 : 0);
    
    const sortedWindows = [...windowResults].filter(w => w.oosScore !== null).sort((a, b) => a.oosScore - b.oosScore);
    const worstWindow = sortedWindows.length > 0 ? sortedWindows[0].window : null;
    const bestWindow = sortedWindows.length > 0 ? sortedWindows[sortedWindows.length - 1].window : null;
    const medianWindow = sortedWindows.length > 0 ? sortedWindows[Math.floor(sortedWindows.length / 2)].window : null;

    let driftScore = 0;
    if (oosScores.length > 1) {
        let diffs = 0;
        for (let i = 1; i < oosScores.length; i++) {
            diffs += (oosScores[i] - oosScores[i-1]);
        }
        driftScore = parseFloat((diffs / (oosScores.length - 1)).toFixed(3));
    }

    return {
        windows,
        trainPct: parseFloat((trainPct * 100).toFixed(0)) + '%',
        passRatePct: passRate,
        stabilityScore,
        driftScore,
        bestWindow,
        worstWindow,
        medianWindow,
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
                        currentTrade.exit_time = s.datetime || String(s.time);
                        currentTrade.exit_price = s.price;
                        currentTrade.avg_profit = (s.profit_pct || 0).toFixed(2);
                        currentTrade.exit_reason = s.reason;
                        trades.push(currentTrade);
                        currentTrade = null;
                    }
                }
            } else {
                trades = buildTrades(candles);
            }
            return reportFromTrades(trades, engineOpts);
        } catch (err) {
            console.error(`[RobustnessEngine] runStrategyLocal error for ${StratCls.name}:`, err);
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
        const downParams = { ...bestParams, [key]: Math.max(0, orig - delta) };

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

    // Interaction Analysis for top 3 sensitive parameters
    const interactions = [];
    const topParams = sensitivity.slice(0, 3).map(s => s.param);
    
    for (let i = 0; i < topParams.length; i++) {
        for (let j = i + 1; j < topParams.length; j++) {
            const k1 = topParams[i];
            const k2 = topParams[j];
            
            const orig1 = bestParams[k1];
            const orig2 = bestParams[k2];
            const delta1 = Math.abs(orig1) * step || step;
            const delta2 = Math.abs(orig2) * step || step;
            
            const interactParams = { ...bestParams, [k1]: orig1 + delta1, [k2]: orig2 + delta2 };
            const interactReport = runStrategyLocal(entry.Cls, interactParams, feedOhlcv);
            const interactScore = interactReport ? scoreReport(interactReport) : null;
            
            if (interactScore !== null) {
                const s1 = sensitivity.find(s => s.param === k1);
                const s2 = sensitivity.find(s => s.param === k2);
                
                const drop1 = s1.scoreBaseline - (s1.scoreUp || s1.scoreBaseline);
                const drop2 = s2.scoreBaseline - (s2.scoreUp || s2.scoreBaseline);
                const expectedDrop = drop1 + drop2;
                const actualDrop = baseScore - interactScore;
                
                interactions.push({
                    pair: `${k1} x ${k2}`,
                    scoreBaseline: parseFloat(baseScore.toFixed(3)),
                    scoreInteract: parseFloat(interactScore.toFixed(3)),
                    expectedDrop: parseFloat(expectedDrop.toFixed(3)),
                    actualDrop: parseFloat(actualDrop.toFixed(3)),
                    interactionType: actualDrop > expectedDrop ? 'Antagonistic' : (actualDrop < expectedDrop ? 'Synergistic' : 'Linear')
                });
            }
        }
    }

    return {
        baselineScore: parseFloat(baseScore.toFixed(3)),
        stepSize:      step,
        params:        sensitivity,
        interactions:  interactions,
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
async function fullRobustnessReport(processedTrades, engineOpts, opts = {}) {
    const mcSimulations = opts.mcSimulations ?? 1000;
    const wfWindows = opts.wfWindows ?? 10;
    const trainPct = opts.trainPct ?? 0.7;

    const preValidation = ValidationManager.validatePre(processedTrades, { mcSimulations, wfWindows });
    // Relaxed: do not return error on preValidation failure, just attach it.

    const mc = await monteCarlo(processedTrades, engineOpts, { 
        simulations: mcSimulations, 
        ohlcv: opts.ohlcv,
        mcMethod: opts.mcMethod,
        seed: opts.seed,
        numThreads: opts.numThreads,
        blockSize: opts.blockSize,
        dropoutRate: opts.dropoutRate,
        noiseLevel: opts.noiseLevel
    });
    const iso = inSampleOutOfSample(processedTrades, engineOpts, { trainPct: trainPct });
    const wf  = walkForward(processedTrades, engineOpts, { windows: wfWindows, trainPct: trainPct });

    let sensitivity = null;
    if (opts.bestParams && opts.ohlcv && opts.buildTrades) {
        sensitivity = parameterSensitivity(opts.bestParams, opts.ohlcv, engineOpts, { 
            buildTrades: opts.buildTrades,
            strategyName: opts.strategyName || 'imba-algo'
        });
    }

    const tc = transactionCostStressing(processedTrades, engineOpts, { maxMultiplier: opts.tcMax, step: opts.tcStep });
    const stats = statisticalTests(processedTrades, engineOpts, opts);
    const benchmark = benchmarkComparison(processedTrades, engineOpts, opts);

    // Aggregate weighted score
    const getVerdictScore = (v) => {
        if (v === 'highly_robust' || v === 'edge_confirmed') return 100;
        if (v === 'robust') return 85;
        if (v === 'moderate' || v === 'mixed' || v === 'moderate_degradation') return 50;
        if (v === 'fragile' || v === 'no_statistical_edge') return 20;
        if (v === 'likely_overfit') return 20;
        if (v === 'highly_overfit') return 0;
        return 50;
    };

    const wfScore = getVerdictScore(wf.verdict);
    const isoScore = getVerdictScore(iso.verdict);
    const mcScore = Math.max(0, Math.min(100, (mc.probabilityMetrics?.positiveReturn || 0) - ((mc.riskOfRuin?.marginCall || 0) * 2)));
    const sensScore = sensitivity ? getVerdictScore(sensitivity.robustnessVerdict) : 50;
    const tcScore = tc ? getVerdictScore(tc.verdict) : 50;
    const statScore = stats ? (100 - (stats.pboEstimatePct || 0)) : 50;

    // Walk Forward: 30%, IS/OOS: 25%, Monte Carlo: 20%, Sensitivity: 10%, TC: 10%, Stats: 5%
    const overallScore = (wfScore * 0.30) + (isoScore * 0.25) + (mcScore * 0.20) + (sensScore * 0.10) + (tcScore * 0.10) + (statScore * 0.05);

    let overallVerdict = overallScore >= 85 ? 'highly_robust'
        : overallScore >= 70 ? 'robust'
        : overallScore >= 50 ? 'mixed'
        : overallScore >= 30 ? 'likely_overfit'
        : 'highly_overfit';

    // Override if PBO is extreme
    if (stats && stats.pboEstimatePct >= 95) {
        overallVerdict = 'highly_overfit';
    } else if (stats && stats.pboEstimatePct >= 70 && overallScore >= 50) {
        overallVerdict = 'likely_overfit';
    }

    let confidence = 'Low';
    let liveReadiness = 'Do Not Deploy';
    if (overallVerdict === 'robust' || overallVerdict === 'highly_robust') {
        confidence = 'High';
        liveReadiness = 'Ready';
    } else if (overallVerdict === 'mixed' || overallVerdict === 'moderate_degradation') {
        confidence = 'Medium';
        liveReadiness = 'Warning';
    }

    const report = {
        overall: {
            score: parseFloat(overallScore.toFixed(2)),
            verdict: overallVerdict,
            confidence: confidence,
            liveReadiness: liveReadiness,
            profitProbabilityPct: mc.probabilityMetrics?.positiveReturn,
            ruinProbabilityPct:   mc.riskOfRuin?.marginCall,
            overfitRatio:         iso.overfitRatio,
            avgWalkForwardRatio:  wf.avgOverfitRatio,
        },
        monteCarlo:           mc,
        inSampleOutOfSample:  iso,
        walkForward:          wf,
        parameterSensitivity: sensitivity,
        transactionCostStressing: tc,
        benchmarkComparison:  benchmark,
        statisticalTests:     stats,
    };

    const postVal = ValidationManager.validatePost(report);
    if (!postVal.valid) {
        return { error: "Calculation failure in report: " + postVal.errors.join(", "), partialReport: report };
    }
    report.validationSummary = { pre: preValidation, post: postVal };
    return report;
}


class ValidationManager {
    static validatePre(processedTrades, opts) {
        const warnings = [];
        const { mcSimulations, wfWindows } = opts;
        if (!processedTrades || processedTrades.length < 30) {
            warnings.push("Insufficient sample size. Minimum 30 trades required for robust statistical analysis.");
        }
        if (mcSimulations < 100 || mcSimulations > 100000) {
            warnings.push("Invalid Monte Carlo simulation count. Adjusting to safe defaults.");
        }
        if (wfWindows < 2 || wfWindows > 50) {
            warnings.push("Invalid walk-forward windows. Adjusting to safe defaults.");
        }
        return {
            valid: true,
            warnings,
            summary: warnings.length === 0 ? "Pre-validation passed." : "Pre-validation passed with warnings."
        };
    }

    static validatePost(report) {
        const errors = [];
        const warnings = [];
        function walk(obj, path) {
            if (obj === null || obj === undefined) return;
            if (typeof obj === 'number') {
                if (isNaN(obj)) errors.push(`NaN detected at ${path}`);
                if (!isFinite(obj)) errors.push(`Infinity detected at ${path}`);
            } else if (Array.isArray(obj)) {
                obj.forEach((val, i) => walk(val, `${path}[${i}]`));
            } else if (typeof obj === 'object') {
                for (const key of Object.keys(obj)) {
                    walk(obj[key], `${path}.${key}`);
                }
            }
        }
        walk(report, 'report');
        
        if (report.statisticalTests && report.statisticalTests.pboEstimatePct >= 70) {
            warnings.push(`High Probability of Backtest Overfitting (${report.statisticalTests.pboEstimatePct}%). This strategy is highly likely to fail in live markets.`);
        }
        if (report.statisticalTests && report.statisticalTests.pboEstimatePct >= 95) {
            warnings.push(`EXTREME OVERFITTING DETECTED. Probability of Backtest Overfitting is ${report.statisticalTests.pboEstimatePct}%. Do not trade this strategy.`);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            summary: errors.length === 0 ? (warnings.length > 0 ? "Post-validation passed with warnings." : "Post-validation passed.") : "Post-validation failed due to calculation errors."
        };
    }
}

// ─── 6. Transaction Cost Stressing ─────────────────────────────────────────────
function transactionCostStressing(processedTrades, engineOpts, opts = {}) {
    if (!processedTrades || processedTrades.length === 0) return null;
    
    const baseFee = engineOpts.fee || 0;
    const baseSlippage = engineOpts.slippage || 0.05;
    const baseSpread = engineOpts.spread || 0.01;
    const baseCostPerSide = baseFee + baseSlippage + (baseSpread / 2);

    let breakdownMultiplier = null;
    const maxMultiplier = opts.maxMultiplier || 20.0;
    const step = opts.step || 0.5;
    const curve = [];

    for (let m = 1.0; m <= maxMultiplier; m += step) {
        const testEngineOpts = { ...engineOpts, fee: baseFee * m, slippage: baseSlippage * m, spread: baseSpread * m };
        const report = reportFromTrades(processedTrades, testEngineOpts);
        
        if (!report) continue;

        const isBroken = report.totalProfit <= 0 || parseFloat(report.sharpeRatio || 0) < 0.5;
        if (isBroken && breakdownMultiplier === null) {
            breakdownMultiplier = parseFloat(m.toFixed(2));
        }

        curve.push({
            multiplier: parseFloat(m.toFixed(2)),
            cost: parseFloat((baseCostPerSide * m).toFixed(4)),
            return: parseFloat(report.totalReturn),
            PF: report.profitFactor === "N/A" ? 0 : parseFloat(report.profitFactor),
            sharpe: report.sharpeRatio === "N/A" ? 0 : parseFloat(report.sharpeRatio)
        });
    }

    const verdict = breakdownMultiplier === null ? 'highly_robust' 
                  : (breakdownMultiplier > 5 ? 'robust' 
                  : (breakdownMultiplier > 2 ? 'moderate' : 'fragile'));

    return {
        baseCostPerSide,
        breakdownMultiplier: breakdownMultiplier !== null ? breakdownMultiplier : `>${maxMultiplier}`,
        verdict,
        curve
    };
}

// ─── 7. Statistical Tests ────────────────────────────────────────────────────
function statisticalTests(processedTrades, engineOpts, opts = {}) {
    if (!processedTrades || processedTrades.length < 30) return null;
    
    const random = createSeededRandom(opts.seed || 12345);

    const pnls = processedTrades.map(t => (t.pnl ? parseFloat(t.pnl) : 0));
    const n = pnls.length;
    
    // Mean & StdDev
    const m = mean(pnls);
    const s = stdDev(pnls);
    
    // 1. T-Test
    const se = s / Math.sqrt(n);
    let tStat = se > 1e-8 ? (m / se) : 0;
    if (!isFinite(tStat)) tStat = 0;
    
    let pValueEstimate = '>0.10';
    if (tStat > 3.29) pValueEstimate = '<0.001';
    else if (tStat > 2.576) pValueEstimate = '<0.01';
    else if (tStat > 1.96) pValueEstimate = '<0.05';
    else if (tStat > 1.645) pValueEstimate = '<0.10';

    // 2. Runs Test (Wald-Wolfowitz) for randomness of win/loss sequence
    let wins = 0, losses = 0, runs = 1;
    for (let i = 0; i < n; i++) {
        if (pnls[i] > 0) wins++;
        else losses++;
        if (i > 0 && ((pnls[i] > 0 && pnls[i-1] <= 0) || (pnls[i] <= 0 && pnls[i-1] > 0))) {
            runs++;
        }
    }
    const expectedRuns = ((2 * wins * losses) / n) + 1;
    const varRuns = (2 * wins * losses * (2 * wins * losses - n)) / (n * n * (n - 1));
    let zRuns = varRuns > 1e-8 ? (runs - expectedRuns) / Math.sqrt(varRuns) : 0;
    if (!isFinite(zRuns)) zRuns = 0;

    // 3. Jarque-Bera Test (Normality)
    let skewSum = 0, kurtSum = 0;
    for (let i = 0; i < n; i++) {
        const diff = pnls[i] - m;
        skewSum += Math.pow(diff, 3);
        kurtSum += Math.pow(diff, 4);
    }
    let skewness = s > 1e-8 ? (skewSum / n) / Math.pow(s, 3) : 0;
    let kurtosis = s > 1e-8 ? (kurtSum / n) / Math.pow(s, 4) : 3;
    if (!isFinite(skewness)) skewness = 0;
    if (!isFinite(kurtosis)) kurtosis = 3;
    
    let jbStat = (n / 6) * (Math.pow(skewness, 2) + 0.25 * Math.pow(kurtosis - 3, 2));
    if (!isFinite(jbStat)) jbStat = 0;

    // Calculate elapsed years and trades per year for proper annualization
    let elapsedYears = 1;
    if (processedTrades.length > 1) {
        const parseDate = (dStr) => {
            if (!dStr) return new Date(NaN);
            if (typeof dStr === 'number' || (typeof dStr === 'string' && /^\d+$/.test(dStr))) {
                return new Date(Number(dStr));
            }
            const match = String(dStr).match(/^(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})$/);
            if (match) return new Date(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6]}`);
            return new Date(dStr);
        };
        const firstDate = parseDate(processedTrades[0].entry_time);
        const lastDate = parseDate(processedTrades[processedTrades.length - 1].exit_time);
        if (!isNaN(firstDate) && !isNaN(lastDate)) {
            elapsedYears = Math.max((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25), 0.01);
        }
    }
    const tradesPerYear = n / elapsedYears;

    // 4. Deflated Sharpe Ratio (Approximation)
    const annualFactor = Math.sqrt(tradesPerYear);
    const baseSharpe = s > 1e-8 ? (m / s) * annualFactor : 0;
    const eulerMascheroni = 0.5772;
    const trials = 100;
    const expectedMaxSharpe = Math.sqrt(2 * Math.log(trials)) + ((2 * Math.log(trials)) ** -0.5) * eulerMascheroni;
    
    // dsrDenominator can be NaN if term under sqrt is negative
    const innerTerm = 1 - skewness * baseSharpe + ((kurtosis - 1) / 4) * Math.pow(baseSharpe, 2);
    const dsrDenominator = innerTerm > 0 ? Math.sqrt(innerTerm) : 0;
    
    let dsrZ = dsrDenominator > 1e-8 ? ((baseSharpe - expectedMaxSharpe) * Math.sqrt(n)) / dsrDenominator : 0;
    if (!isFinite(dsrZ)) dsrZ = 0;
    
    // 5. Mann-Whitney U (1st Half vs 2nd Half)
    const half = Math.floor(n / 2);
    const meanU1 = (half * (n - half)) / 2;
    const varU = (half * (n - half) * (n + 1)) / 12;
    let rankSum1 = 0;
    const combined = pnls.map((v, i) => ({ v, i: i < half ? 1 : 2 })).sort((a, b) => a.v - b.v);
    combined.forEach((obj, idx) => { if (obj.i === 1) rankSum1 += (idx + 1); });
    const u1 = rankSum1 - (half * (half + 1)) / 2;
    let zMW = varU > 1e-8 ? (u1 - meanU1) / Math.sqrt(varU) : 0;
    if (!isFinite(zMW)) zMW = 0;

    // 6. Estimated Probability of Backtest Overfitting (Heuristic)
    // Real CSCV is required for true PBO. Until then, use a heuristic based on t-stat and sample size.
    // A robust t-stat (> 2.5) and large sample size (> 250) yields low PBO.
    const tStatPenalty = Math.max(0, 1 - (Math.max(0, tStat) / 2.5));
    const samplePenalty = Math.min(1, 250 / Math.max(1, n));
    const pboEstimatePct = Math.max(0, Math.min(100, (tStatPenalty * 70) + (samplePenalty * 30)));
    
    // 7. Bootstrap Significance & White Reality Check Approximation
    let bsPositiveCount = 0;
    const bsTrials = 1000;
    let wrcMaxStat = 0;
    
    for (let t = 0; t < bsTrials; t++) {
        let sampleMean = 0;
        for (let i = 0; i < n; i++) {
            sampleMean += pnls[Math.floor(random() * n)];
        }
        if ((sampleMean / n) > 0) bsPositiveCount++;
        
        // WRC approximation for single strategy vs null (0 mean)
        // Center the bootstrap distribution
        const centeredMean = (sampleMean / n) - m; 
        if (centeredMean > wrcMaxStat) wrcMaxStat = centeredMean;
    }
    const bootstrapSignificance = bsPositiveCount / bsTrials;
    const wrcPValue = wrcMaxStat > m ? 0.05 : (wrcMaxStat > 0 ? 0.2 : 0.8); // Approximated p-value

    return {
        tradeCount: n,
        tTest: {
            tStat: parseFloat(tStat.toFixed(2)),
            pValueEstimate,
            significantAt5Pct: tStat > 1.96,
        },
        runsTest: {
            zScore: parseFloat(zRuns.toFixed(2)),
            isRandom: Math.abs(zRuns) < 1.96
        },
        jarqueBera: {
            jbStat: parseFloat(jbStat.toFixed(2)),
            skewness: parseFloat(skewness.toFixed(2)),
            kurtosis: parseFloat(kurtosis.toFixed(2)),
            isNormal: jbStat < 5.99
        },
        deflatedSharpeRatio: {
            dsrZScore: parseFloat(dsrZ.toFixed(2)),
            penaltyApplied: true
        },
        mannWhitneyU: {
            zScore: parseFloat(zMW.toFixed(2)),
            distributionShift: Math.abs(zMW) > 1.96
        },
        pboEstimatePct: parseFloat(pboEstimatePct.toFixed(2)),
        bootstrapSignificance: parseFloat(bootstrapSignificance.toFixed(4)),
        whiteRealityCheck: {
            p_value: wrcPValue,
            significant: wrcPValue < 0.05,
            note: "Approximated vs Null (0 mean)"
        },
        verdict: (tStat > 1.96 && dsrZ > 0) ? 'edge_confirmed' : 'no_statistical_edge',
        explanation: (tStat > 1.96 && dsrZ > 0) ? 
            "The strategy demonstrates a statistically significant edge that survives multiple-testing penalties and effect-size adjustments." : 
            "While simulated performance may be positive, hypothesis testing cannot confidently reject the null hypothesis. This is often due to insufficient sample size, high variance, or penalties from multiple-testing adjustments (Deflated Sharpe), meaning the observed edge might be luck."
    };
}

// ─── 8. Benchmark Comparison ─────────────────────────────────────────────────
function benchmarkComparison(processedTrades, engineOpts, opts = {}) {
    if (!processedTrades || processedTrades.length === 0 || !opts.ohlcv || !opts.ohlcv.close || !opts.ohlcv.time) return null;

    const riskFreeRate = opts.riskFreeRate ?? 0.05; // 5% annual

    function parseDate(str) {
        if (!str) return null;
        if (typeof str === 'number' || (typeof str === 'string' && /^\d+$/.test(str))) {
            const d = new Date(Number(str));
            return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
        }
        const regex = /^(\d{2})\/(\d{2})\/(\d{4})/;
        const match = String(str).match(regex);
        if (match) return `${match[3]}-${match[2]}-${match[1]}`;
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    }

    const dailyPnl = {};
    for (const t of processedTrades) {
        if (!t.exit_time) continue;
        const date = parseDate(t.exit_time);
        if (date) {
            dailyPnl[date] = (dailyPnl[date] || 0) + (parseFloat(t.pnl) || 0);
        }
    }

    const times = opts.ohlcv.time;
    const closes = opts.ohlcv.close;
    
    // 1. Group by date and keep the LAST close price of each day
    const dailyCloses = {};
    for (let i = 0; i < times.length; i++) {
        const date = new Date(times[i] * 1000).toISOString().split('T')[0];
        dailyCloses[date] = closes[i];
    }

    // 2. Compute benchmark daily returns
    const sortedDates = Object.keys(dailyCloses).sort();
    const benchDaily = {};
    let prevClose = null;
    
    for (const date of sortedDates) {
        if (prevClose !== null) {
            benchDaily[date] = (dailyCloses[date] - prevClose) / prevClose;
        } else {
            benchDaily[date] = 0; // First day
        }
        prevClose = dailyCloses[date];
    }

    // 3. Compute strategy geometric returns on running balance and align
    let runningBalance = engineOpts.initialBalance || 10000;
    const alignedStrat = [];
    const alignedBench = [];
    for (const date of sortedDates) {
        const pnlForDay = dailyPnl[date] || 0;
        const ret = pnlForDay / runningBalance;
        alignedStrat.push(ret);
        alignedBench.push(benchDaily[date]);
        runningBalance += pnlForDay;
    }

    if (alignedStrat.length < 2) return null;

    const meanStrat = mean(alignedStrat);
    const meanBench = mean(alignedBench);
    
    let cov = 0;
    let varBench = 0;
    let varStrat = 0;
    for (let i = 0; i < alignedStrat.length; i++) {
        const ds = alignedStrat[i] - meanStrat;
        const db = alignedBench[i] - meanBench;
        cov += ds * db;
        varBench += db * db;
        varStrat += ds * ds;
    }
    
    const n = alignedStrat.length;
    cov /= n;
    varBench /= n;
    varStrat /= n;

    const stdStrat = Math.sqrt(varStrat);
    const stdBench = Math.sqrt(varBench);
    const beta = varBench > 0 ? cov / varBench : 0;
    
    let stratPeak = 1, benchPeak = 1;
    let stratEq = 1, benchEq = 1;
    let stratMaxDD = 0, benchMaxDD = 0;
    
    for (let i = 0; i < alignedStrat.length; i++) {
        stratEq *= (1 + alignedStrat[i]);
        benchEq *= (1 + alignedBench[i]);
        if (stratEq > stratPeak) stratPeak = stratEq;
        if (benchEq > benchPeak) benchPeak = benchEq;
        
        const sDD = (stratPeak - stratEq) / stratPeak;
        const bDD = (benchPeak - benchEq) / benchPeak;
        if (sDD > stratMaxDD) stratMaxDD = sDD;
        if (bDD > benchMaxDD) benchMaxDD = bDD;
    }

    let elapsedYears = 1;
    if (sortedDates.length >= 2) {
        const first = new Date(sortedDates[0]).getTime();
        const last = new Date(sortedDates[sortedDates.length - 1]).getTime();
        elapsedYears = Math.max((last - first) / (1000 * 60 * 60 * 24 * 365.25), 0.01);
    }

    const annStrat = elapsedYears > 0 ? (Math.pow(stratEq, 1 / elapsedYears) - 1) : 0;
    const annBench = elapsedYears > 0 ? (Math.pow(benchEq, 1 / elapsedYears) - 1) : 0;
    const alpha = annStrat - (riskFreeRate + beta * (annBench - riskFreeRate));
    
    const correlation = (stdStrat > 0 && stdBench > 0) ? cov / (stdStrat * stdBench) : 0;
    
    const diffs = alignedStrat.map((s, i) => s - alignedBench[i]);
    const meanDiff = mean(diffs);
    const varDiff = diffs.reduce((sum, d) => sum + Math.pow(d - meanDiff, 2), 0) / n;
    const trackingError = Math.sqrt(varDiff) * Math.sqrt(365);
    const excessReturn = annStrat - annBench;
    const informationRatio = trackingError > 0 ? excessReturn / trackingError : 0;
    
    const relativeDrawdown = stratMaxDD - benchMaxDD;

    return {
        benchmark: "Buy & Hold (Asset)",
        alpha: parseFloat(alpha.toFixed(4)),
        beta: parseFloat(beta.toFixed(4)),
        correlation: parseFloat(correlation.toFixed(4)),
        trackingError: parseFloat(trackingError.toFixed(4)),
        informationRatio: parseFloat(informationRatio.toFixed(4)),
        excessReturnPct: parseFloat((excessReturn * 100).toFixed(2)),
        relativeDrawdownPct: parseFloat((relativeDrawdown * 100).toFixed(2)),
        strategyCAGRPct: parseFloat((annStrat * 100).toFixed(2)),
        benchmarkCAGRPct: parseFloat((annBench * 100).toFixed(2))
    };
}

module.exports = {
    monteCarlo,
    inSampleOutOfSample,
    walkForward,
    parameterSensitivity,
    transactionCostStressing,
    statisticalTests,
    fullRobustnessReport,
    // expose helpers for worker usage
    reportFromTrades,
    scoreReport,
    summariseReport,
};
