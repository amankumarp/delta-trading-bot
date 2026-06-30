const fs = require('fs');
const path = require('path');

// 1. Patch Observers.js
let observers = fs.readFileSync('analytics/Observers.js', 'utf8');

// Fix Sharpe, Sortino formulas (approximate annualization by assuming returns are percentage of peak or initial)
observers = observers.replace(/const sharpeRatio = stdDevReturn !== 0 \? \(meanReturn \/ stdDevReturn\)\.toFixed\(2\) : "N\/A";/,
    `const sharpeRatio = stdDevReturn !== 0 ? ((meanReturn / stdDevReturn) * Math.sqrt(this.totalTrades > 0 ? (this.totalTrades / (this.totalDays > 0 ? (this.totalDays/365) : 1)) : 1)).toFixed(2) : "N/A";`);

observers = observers.replace(/const sortinoRatio = downsideStdDevReturn !== 0 \? \(meanReturn \/ downsideStdDevReturn\)\.toFixed\(2\) : "N\/A";/,
    `const sortinoRatio = downsideStdDevReturn !== 0 ? ((meanReturn / downsideStdDevReturn) * Math.sqrt(this.totalTrades > 0 ? (this.totalTrades / (this.totalDays > 0 ? (this.totalDays/365) : 1)) : 1)).toFixed(2) : "N/A";`);

// Make sure TradeSummaryObserver has totalDays
observers = observers.replace(/this\.options\.riskPercentPerTrade = options\.riskPercentPerTrade \|\| 1;/, 
    `this.options.riskPercentPerTrade = options.riskPercentPerTrade || 1;\n        this.totalDays = options.totalDays || 1;`);

fs.writeFileSync('analytics/Observers.js', observers);

// 2. Patch index.js to await fullRobustnessReport
let indexJs = fs.readFileSync('analytics/index.js', 'utf8');
indexJs = indexJs.replace(/const result = fullRobustnessReport\(/, 'const result = await fullRobustnessReport(');
fs.writeFileSync('analytics/index.js', indexJs);

console.log("Patched index.js and Observers.js");
