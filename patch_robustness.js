const fs = require('fs');

let code = fs.readFileSync('analytics/RobustnessEngine.js', 'utf8');

// 1. Rename confidence interval
code = code.replace(/confidenceInterval95/g, 'percentileInterval95');
code = code.replace(/confidenceInterval99/g, 'percentileInterval99');
code = code.replace(/method: "Bootstrap Percentile"/g, 'method: "Percentile Interval"');

// 2. Correct CAGR
code = code.replace(/const tradingDays = 365;\n\s*const annStrat = meanStrat \* tradingDays;\n\s*const annBench = meanBench \* tradingDays;/g,
    `const years = alignedStrat.length / 365.25;
    const annStrat = years > 0 ? (Math.pow(stratEq, 1 / years) - 1) : 0;
    const annBench = years > 0 ? (Math.pow(benchEq, 1 / years) - 1) : 0;`);

// 3. Make ValidationManager
code = code.replace(/function preValidationLayer\(processedTrades, opts\) \{([\s\S]*?)\} \/\/ ends before function/g, ""); // wait, I can just replace the function names and add a class.
// Let's do it safer.

// We will construct the complete ValidationManager class
const valManager = `
class ValidationManager {
    static validatePre(processedTrades, opts) {
        const errors = [];
        const { mcSimulations, wfWindows } = opts;
        if (!processedTrades || processedTrades.length < 30) {
            errors.push("Insufficient sample size. Minimum 30 trades required for robust statistical analysis.");
        }
        if (mcSimulations < 100 || mcSimulations > 100000) {
            errors.push("Invalid Monte Carlo simulation count. Must be between 100 and 100,000.");
        }
        if (wfWindows < 2 || wfWindows > 50) {
            errors.push("Invalid walk-forward windows. Must be between 2 and 50.");
        }
        return {
            valid: errors.length === 0,
            errors,
            summary: errors.length === 0 ? "Pre-validation passed." : "Pre-validation failed."
        };
    }

    static validatePost(report) {
        const errors = [];
        function walk(obj, path) {
            if (obj === null || obj === undefined) return;
            if (typeof obj === 'number') {
                if (isNaN(obj)) errors.push(\`NaN detected at \${path}\`);
                if (!isFinite(obj)) errors.push(\`Infinity detected at \${path}\`);
            } else if (Array.isArray(obj)) {
                obj.forEach((val, i) => walk(val, \`\${path}[\${i}]\`));
            } else if (typeof obj === 'object') {
                for (const key of Object.keys(obj)) {
                    walk(obj[key], \`\${path}.\${key}\`);
                }
            }
        }
        walk(report, 'report');
        return {
            valid: errors.length === 0,
            errors,
            summary: errors.length === 0 ? "Post-validation passed." : "Post-validation failed."
        };
    }
}
`;

code = code.replace(/function preValidationLayer[\s\S]*?(?=function monteCarlo)/, valManager);

// Replace finalValidationLayer
code = code.replace(/function finalValidationLayer[\s\S]*?(?=function buildHistogram)/, ""); // this is at the bottom, wait.
// Let's just find finalValidationLayer and remove it.
const finalValIdx = code.indexOf('function finalValidationLayer');
if(finalValIdx !== -1) {
    const nextFunc = code.indexOf('function ', finalValIdx + 10);
    if(nextFunc !== -1) {
        code = code.substring(0, finalValIdx) + code.substring(nextFunc);
    } else {
        // if it's the last function
        const moduleExportsIdx = code.indexOf('module.exports =', finalValIdx);
        if (moduleExportsIdx !== -1) {
            code = code.substring(0, finalValIdx) + code.substring(moduleExportsIdx);
        }
    }
}

// 4. Update fullRobustnessReport to use ValidationManager and be async
let frrMatch = code.match(/function fullRobustnessReport\([\s\S]*?finalValidationLayer\(report\);\n\}/);
if (frrMatch) {
    let frrStr = frrMatch[0];
    frrStr = frrStr.replace('function fullRobustnessReport', 'async function fullRobustnessReport');
    frrStr = frrStr.replace(/const preValidation = preValidationLayer\(.*?\);\n\s*if \(preValidation\.error\) return preValidation;/,
        `const preValidation = ValidationManager.validatePre(processedTrades, { mcSimulations, wfWindows });
    if (!preValidation.valid) return { error: "Validation failed before running robustness engine.", details: preValidation.errors };`);
    
    // Make monteCarlo async
    frrStr = frrStr.replace(/const mc\s*=\s*monteCarlo\(/, 'const mc = await monteCarlo(');

    frrStr = frrStr.replace(/return finalValidationLayer\(report\);/, 
        `const postVal = ValidationManager.validatePost(report);
    if (!postVal.valid) return { error: "Final validation failed. Report contains impossible or inconsistent statistics.", details: postVal.errors };
    report.validationSummary = { pre: preValidation, post: postVal };
    return report;`);

    code = code.replace(frrMatch[0], frrStr);
}

// 5. Rewrite monteCarlo to use worker_threads and seeded RNG.
// Let's replace the whole monteCarlo function.
const mcStart = code.indexOf('function monteCarlo(');
const mcEnd = code.indexOf('function buildHistogram(');
if (mcStart !== -1 && mcEnd !== -1) {
    const newMc = `
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

function createSeededRandom(seed) {
    let state = seed || 123456789;
    return function() {
        state = (state * 9301 + 49297) % 233280;
        return state / 233280;
    };
}

// The parallel worker logic for MC
if (!isMainThread) {
    const { pnls, N, initialBalance, dropoutRate, noiseLevel, mcMethod, seed, opts } = workerData;
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

    for (let sim = 0; sim < N; sim++) {
        let shuffled = [];
        if (mcMethod === 'shuffle') {
            shuffled = [...pnls];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
        } else if (mcMethod === 'block_bootstrap') {
            const blockSize = opts.blockSize || Math.max(2, Math.floor(pnls.length / 10));
            while (shuffled.length < pnls.length) {
                const startIdx = Math.floor(random() * (pnls.length - blockSize + 1));
                for (let k = 0; k < blockSize && shuffled.length < pnls.length; k++) {
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
        } else { // default to bootstrap
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
        const simSharpe = simStd !== 0 ? (simMean / simStd) * Math.sqrt(252) : 0; 
        sharpeRatios.push(simSharpe);

        const downSims = simReturns.filter(p => p < 0);
        const downStd = downSims.length ? Math.sqrt(downSims.reduce((acc, r) => acc + Math.pow(r, 2), 0) / downSims.length) : 0;
        sortinoRatios.push(downStd !== 0 ? (simMean / downStd) * Math.sqrt(252) : 0);
        
        calmarRatios.push(maxDD !== 0 ? ((totalReturn/100) / maxDD) : 0);
        const maxDD_abs = peak * maxDD;
        recoveryFactors.push(maxDD_abs !== 0 ? ((balance - initialBalance) / maxDD_abs) : 0);
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
        
        const workers = [];
        let completed = 0;
        
        const results = {
            finalBalances: [], maxDrawdownPcts: [], totalReturns: [], sharpeRatios: [], winRates: [], profitFactors: [], sortinoRatios: [], calmarRatios: [], recoveryFactors: []
        };
        
        const simsPerThread = Math.ceil(N / numThreads);
        let remainingSims = N;
        
        for (let i = 0; i < numThreads; i++) {
            const currentSims = Math.min(simsPerThread, remainingSims);
            if (currentSims <= 0) break;
            remainingSims -= currentSims;
            
            const worker = new Worker(__filename, {
                workerData: {
                    pnls,
                    N: currentSims,
                    initialBalance,
                    dropoutRate: opts.dropoutRate || 0,
                    noiseLevel: opts.noiseLevel || 0,
                    mcMethod,
                    seed: (opts.seed || 12345) + i,
                    opts
                }
            });
            
            worker.on('message', (msg) => {
                for (const key of Object.keys(results)) {
                    results[key].push(...msg[key]);
                }
            });
            worker.on('error', reject);
            worker.on('exit', (code) => {
                if (code !== 0) reject(new Error(\`Worker stopped with exit code \${code}\`));
                completed++;
                if (completed === numThreads) {
                    resolve(processMonteCarloResults(results, N, initialBalance, mcMethod, pnls, opts));
                }
            });
            workers.push(worker);
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
        for (const p of confidences) result[\`p\${p}\`] = parseFloat(percentile(arr, p).toFixed(2));
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
    if (opts.ohlcv && opts.ohlcv.close.length > 0) {
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
            mean: mean(arr),
            median: percentile(arr, 50),
            p5: percentile(arr, 5),
            p25: percentile(arr, 25),
            p75: percentile(arr, 75),
            p95: percentile(arr, 95),
            min: arr[0],
            max: arr[arr.length - 1],
            percentileInterval95: { lower: percentile(arr, 2.5), upper: percentile(arr, 97.5), method: "Percentile Interval" },
            percentileInterval99: { lower: percentile(arr, 0.5), upper: percentile(arr, 99.5), method: "Percentile Interval" }
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
        ddHistogram: buildDDHistogram(maxDrawdownPcts),
        sharpeHistogram: buildSharpeHistogram(sharpeRatios),
        distributionTable: {
            netReturn: getDistStats(totalReturns),
            maxDD: getDistStats(maxDrawdownPcts),
            winRate: getDistStats(winRates),
            profitFactor: getDistStats(profitFactors),
        }
    };
}
`;
    code = code.substring(0, mcStart) + newMc + "\n" + code.substring(mcEnd);
}

// Remove buildDDHistogram and buildSharpeHistogram from outside since they are in mc now, or let them be inside mc.
// Actually buildDDHistogram was used inside mc before. Now it's not defined inside processMonteCarloResults.
// So let's inject them at the bottom of the file or just inside processMonteCarloResults.
const helpers = `
function buildDDHistogram(arr) {
    const bins = [
        { label: '<10%', min: -99999, max: 10, count: 0 },
        { label: '10-15%', min: 10, max: 15, count: 0 },
        { label: '15-20%', min: 15, max: 20, count: 0 },
        { label: '20-25%', min: 20, max: 25, count: 0 },
        { label: '25-30%', min: 25, max: 30, count: 0 },
        { label: '30-40%', min: 30, max: 40, count: 0 },
        { label: '40-50%', min: 40, max: 50, count: 0 },
        { label: '50-60%', min: 50, max: 60, count: 0 },
        { label: '>60%', min: 60, max: 99999, count: 0 },
    ];
    for (const val of arr) {
        for (const b of bins) {
            if (val >= b.min && val < b.max) {
                b.count++; break;
            }
        }
    }
    return bins;
}

function buildSharpeHistogram(arr) {
    const bins = [
        { label: '<0', min: -99999, max: 0, count: 0 },
        { label: '0-0.5', min: 0, max: 0.5, count: 0 },
        { label: '0.5-1.0', min: 0.5, max: 1.0, count: 0 },
        { label: '1.0-1.2', min: 1.0, max: 1.2, count: 0 },
        { label: '1.2-1.4', min: 1.2, max: 1.4, count: 0 },
        { label: '1.4-1.6', min: 1.4, max: 1.6, count: 0 },
        { label: '>1.6', min: 1.6, max: 99999, count: 0 },
    ];
    for (const val of arr) {
        for (const b of bins) {
            if (val >= b.min && val < b.max) {
                b.count++; break;
            }
        }
    }
    return bins;
}
`;
code = code + "\n" + helpers;

// Add percentile function safely because it's duplicated in some places.
// We'll leave it for now.

fs.writeFileSync('analytics/RobustnessEngine.new.js', code);
console.log("Wrote RobustnessEngine.new.js");
