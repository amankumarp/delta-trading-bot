'use strict';

/**
 * services/strategy/StrategyRegistry.js
 *
 * PHASE 4 — Strategy Registry.
 *
 * Maps strategy slugs to their class constructors and parameter schemas.
 * Adding a new strategy = 1 line here, zero changes to route handlers.
 *
 * Previously: 5 identical copy-paste GET handlers in index.js, each ~40 lines.
 * Now: 1 generic handler in index.js + this registry.
 *
 * Each registry entry has:
 *   Cls           – Strategy class constructor
 *   parseOpts     – function(query) → opts object (strategy-specific params)
 *   useHeikinAshi – whether to convert candles to Heikin-Ashi before signals
 *   description   – human-readable description
 */

const SupertrendAI = require('./SupertrendStrategy');
const BollingerBandAI = require('./bbStrategy');
const ImbaAlgoStrategy = require('./ImbaAlgoStrategy');


// ─── Parameter parsers (strategy-specific query params → opts object) ─────────

function parseSupertrendOpts(q) {
  const opts = {};
  if (q.atrPeriod) opts.atrPeriod = parseInt(q.atrPeriod);
  if (q.multiplier) opts.multiplier = parseFloat(q.multiplier);
  return opts;
}

function parseBBOpts(q) {
  const opts = {};
  if (q.period) opts.period = parseInt(q.period);
  if (q.stdDev) opts.stdDev = parseFloat(q.stdDev);
  if (q.rsiPeriod) opts.rsiPeriod = parseInt(q.rsiPeriod);
  return opts;
}


function parseImbaOpts(q) {
  const opts = {};
  if (q.sensitivity) opts.sensitivity = parseFloat(q.sensitivity);
  if (q.riskPercent) opts.riskPercent = parseFloat(q.riskPercent);
  if (q.tp1Pct) opts.tp1Pct = parseFloat(q.tp1Pct);
  if (q.tp1SizePct) opts.tp1SizePct = parseFloat(q.tp1SizePct);
  if (q.tp2Pct) opts.tp2Pct = parseFloat(q.tp2Pct);
  if (q.tp2SizePct) opts.tp2SizePct = parseFloat(q.tp2SizePct);
  if (q.tp3Pct) opts.tp3Pct = parseFloat(q.tp3Pct);
  if (q.tp3SizePct) opts.tp3SizePct = parseFloat(q.tp3SizePct);
  if (q.tp4Pct) opts.tp4Pct = parseFloat(q.tp4Pct);
  if (q.tp4SizePct) opts.tp4SizePct = parseFloat(q.tp4SizePct);
  if (q.breakEvenTarget) opts.breakEvenTarget = q.breakEvenTarget; // '1'|'2'|'3'|'WITHOUT'
  if (q.fixedStop) opts.fixedStop = q.fixedStop === 'true';
  if (q.slPercent) opts.slPercent = parseFloat(q.slPercent);
  if (q.rsiLen) opts.rsiLen = parseInt(q.rsiLen);
  if (q.rsiOB) opts.rsiOB = parseFloat(q.rsiOB);
  if (q.rsiOS) opts.rsiOS = parseFloat(q.rsiOS);
  if (q.useRsiFilter) opts.useRsiFilter = q.useRsiFilter === 'true';
  if (q.useSwingSl) opts.useSwingSl = q.useSwingSl === 'true';
  if (q.swingLength) opts.swingLength = parseInt(q.swingLength);
  if (q.maxSlPercent) opts.maxSlPercent = parseFloat(q.maxSlPercent);
  if (q.tpType) opts.tpType = q.tpType;
  if (q.rr1) opts.rr1 = parseFloat(q.rr1);
  if (q.rr2) opts.rr2 = parseFloat(q.rr2);
  if (q.rr3) opts.rr3 = parseFloat(q.rr3);
  if (q.rr4) opts.rr4 = parseFloat(q.rr4);
  if (q.tp4Open) opts.tp4Open = q.tp4Open === 'true';
  if (q.allowedDays) opts.allowedDays = q.allowedDays;
  if (q.allowedSessions) opts.allowedSessions = q.allowedSessions;
  if (q.maxDailyLossPercent) opts.maxDailyLossPercent = parseFloat(q.maxDailyLossPercent);
  return opts;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const REGISTRY = {
  'supertrend-ai': {
    Cls: SupertrendAI,
    parseOpts: parseSupertrendOpts,
    useHeikinAshi: false,
    description: 'Supertrend AI — ATR-based adaptive trend following',
    params: [
      { name: 'atrPeriod', type: 'number', default: 10, label: 'ATR Period', group: 'Core' },
      { name: 'multiplier', type: 'number', step: 0.1, default: 3.0, label: 'Multiplier', group: 'Core' }
    ]
  },
  'bb-ai': {
    Cls: BollingerBandAI,
    parseOpts: parseBBOpts,
    useHeikinAshi: false,
    description: 'Bollinger Band AI — volatility breakout with RSI filter',
    params: [
      { name: 'period', type: 'number', default: 20, label: 'BB Period', group: 'Core' },
      { name: 'stdDev', type: 'number', step: 0.1, default: 2.0, label: 'Std Dev', group: 'Core' },
      { name: 'rsiPeriod', type: 'number', default: 14, label: 'RSI Period', group: 'Core' }
    ]
  },
  'imba-algo': {
    Cls: ImbaAlgoStrategy,
    parseOpts: parseImbaOpts,
    useHeikinAshi: false,
    description: 'Imba Algo — Fibonacci-based multi-TP trend system',
    params: [
      { name: 'sensitivity', type: 'number', step: 0.1, default: 0.8, label: 'Sensitivity (Fib)', group: 'Core' },
      
      { name: 'riskPercent', type: 'number', step: 0.1, default: 1.0, label: 'Risk (%)', group: 'Risk Management' },
      { name: 'fixedStop', type: 'boolean', default: false, label: 'Fixed Stop Loss?', group: 'Risk Management' },
      { name: 'slPercent', type: 'number', step: 0.1, default: 1.5, label: 'SL Distance (%)', group: 'Risk Management' },
      { name: 'useSwingSl', type: 'boolean', default: false, label: 'Use Swing SL?', group: 'Risk Management' },
      { name: 'swingLength', type: 'number', default: 10, label: 'Swing Lookback', group: 'Risk Management' },
      { name: 'maxSlPercent', type: 'number', step: 0.1, default: 3.0, label: 'Max SL Cap (%)', group: 'Risk Management' },
      { name: 'breakEvenTarget', type: 'select', options: ['1','2','3','WITHOUT'], default: '1', label: 'Break-Even Target', group: 'Risk Management' },
      
      { name: 'tpType', type: 'select', options: ['Percent', 'RR'], default: 'Percent', label: 'Take Profit Type', group: 'Take Profits' },
      { name: 'tp1Pct', type: 'number', step: 0.1, default: 30, label: 'TP1 (%)', group: 'Take Profits' },
      { name: 'tp1SizePct', type: 'number', step: 0.1, default: 25, label: 'TP1 Size (%)', group: 'Take Profits' },
      { name: 'rr1', type: 'number', step: 0.1, default: 1.0, label: 'TP1 (RR)', group: 'Take Profits' },
      
      { name: 'tp2Pct', type: 'number', step: 0.1, default: 60, label: 'TP2 (%)', group: 'Take Profits' },
      { name: 'tp2SizePct', type: 'number', step: 0.1, default: 25, label: 'TP2 Size (%)', group: 'Take Profits' },
      { name: 'rr2', type: 'number', step: 0.1, default: 2.0, label: 'TP2 (RR)', group: 'Take Profits' },
      
      { name: 'tp3Pct', type: 'number', step: 0.1, default: 80, label: 'TP3 (%)', group: 'Take Profits' },
      { name: 'tp3SizePct', type: 'number', step: 0.1, default: 25, label: 'TP3 Size (%)', group: 'Take Profits' },
      { name: 'rr3', type: 'number', step: 0.1, default: 3.0, label: 'TP3 (RR)', group: 'Take Profits' },
      
      { name: 'tp4Pct', type: 'number', step: 0.1, default: 100, label: 'TP4 (%)', group: 'Take Profits' },
      { name: 'tp4SizePct', type: 'number', step: 0.1, default: 25, label: 'TP4 Size (%)', group: 'Take Profits' },
      { name: 'rr4', type: 'number', step: 0.1, default: 4.0, label: 'TP4 (RR)', group: 'Take Profits' },
      { name: 'tp4Open', type: 'boolean', default: false, label: 'TP4 Open (Runner)', group: 'Take Profits' },
      
      { name: 'useRsiFilter', type: 'boolean', default: false, label: 'Use RSI Filter?', group: 'Filters' },
      { name: 'rsiLen', type: 'number', default: 14, label: 'RSI Length', group: 'Filters' },
      { name: 'rsiOB', type: 'number', default: 70, label: 'RSI Overbought', group: 'Filters' },
      { name: 'rsiOS', type: 'number', default: 30, label: 'RSI Oversold', group: 'Filters' },
      
      { name: 'allowedDays', type: 'days_checkbox', default: '1,2,3,4,5,6,7', label: 'Allowed Days', group: 'Time & Limits' },
      { name: 'allowedSessions', type: 'sessions_checkbox', default: '00:00-23:59', label: 'Trading Sessions (IST)', group: 'Time & Limits' },
      { name: 'maxDailyLossPercent', type: 'number', step: 0.1, default: 2.0, label: 'Max Daily Loss (%)', group: 'Time & Limits' }
    ]
  },
};

/**
 * Get a registry entry by slug.
 * @param {string} name
 * @returns {{ Cls, parseOpts, useHeikinAshi, description } | null}
 */
function get(name) {
  return REGISTRY[name] || null;
}

/**
 * List all registered strategy slugs.
 * @returns {string[]}
 */
function list() {
  return Object.keys(REGISTRY);
}

/**
 * Get metadata (name + description) for all strategies, for the /strategies endpoint.
 */
function listMeta() {
  return Object.entries(REGISTRY).map(([slug, entry]) => ({
    slug,
    description: entry.description,
    params: entry.params || [],
    available: !entry.disabled,
  }));
}

module.exports = { get, list, listMeta };