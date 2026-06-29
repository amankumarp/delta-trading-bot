'use strict';

/**
 * lib/Scorer.js
 *
 * PHASE 2 — Single canonical composite score function.
 *
 * Previously duplicated in:
 *   - analytics/Optimizer.js        (computeScore)
 *   - analytics/optimizer-worker.js (computeScore)
 *   - analytics/RobustnessEngine.js (scoreReport)
 *
 * Scoring formula (weights tuned to favour risk-adjusted profitability):
 *   +2.0 × profit factor          (risk-adjusted profitability)
 *   +1.0 × Sharpe ratio           (return consistency)
 *   +1.0 × win-rate (0–1)         (reliability signal)
 *   +0.5 × recovery factor        (drawdown recovery speed)
 *   −0.5 × max-drawdown% / 100    (penalise blow-up risk)
 *
 * Returns -Infinity when trade count is below minTrades to discard
 * parameter sets that barely generate signals.
 */

/**
 * Compute composite score from a BacktestEngine report.
 *
 * @param {object} report    – output of BacktestEngine.generateReport()
 * @param {number} minTrades – minimum trades required for a valid score (default 3)
 * @returns {number}         – score, or -Infinity if invalid
 */
function computeScore(report, minTrades = 3) {
  if (!report) return -Infinity;

  const n = parseInt(report.totalTrades) || 0;
  if (n < minTrades) return -Infinity;

  const pf  = parseFloat(report.profitFactor)       || 0;
  const sr  = parseFloat(report.sharpeRatio)        || 0;
  const wr  = parseFloat(report.winRate)   / 100    || 0;
  const rf  = parseFloat(report.recoveryFactor)     || 0;
  const mdd = parseFloat(report.maxDrawdownPercent) || 0;

  return (2 * pf) + sr + wr + (0.5 * rf) - (0.5 * (mdd / 100));
}

/**
 * Score a report and return null (instead of -Infinity) when invalid.
 * Useful in robustness tests where null means "insufficient data"
 * rather than "this is a bad score".
 *
 * @param {object} report
 * @param {number} minTrades
 * @returns {number|null}
 */
function scoreReport(report, minTrades = 1) {
  if (!report) return null;
  const n = parseInt(report.totalTrades) || 0;
  if (n < minTrades) return null;
  const score = computeScore(report, minTrades);
  return score === -Infinity ? null : score;
}

module.exports = { computeScore, scoreReport };
